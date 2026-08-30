import { createHash, randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  CaseSchema,
  CheckpointIdSchema,
  DecisionActionSchema,
  DecisionActorSchema,
  DecisionTargetSchema,
  EvidenceArtifactSchema,
  IntakeEvidencePurposeSchema,
  appendActionEvent,
  attachHumanDecision,
  checkpointById,
  checkpointDataCatalog,
  checkpoints,
  collectNativeFacts,
  demoMetrics,
  deriveDeterministicSignals,
  evidenceAvailableAt,
  evaluateCheckpoint,
  syntheticImageFixtures,
  type EvidenceArtifact,
  type CaseActionEvent,
  type HumanDecision,
  type ReturnIntegrityCase,
} from "@return-integrity/domain";
import { assessWithOpenAI, DEFAULT_OPENAI_MODEL, OPENAI_PROMPT_VERSION, simulateAssessment } from "./openai.js";
import { resolveOpenAIKey } from "./secrets.js";
import { createStoreFromEnvironment, type DataStore, type WaitlistLead } from "./store.js";
import {
  completeIntakeUpload,
  createIntakeUploadUrl,
  createUploadUrl,
  getEvidenceObjectUrl,
} from "./uploads.js";
import {
  ReturnIntakeService,
  type ReturnIntakeServiceOptions,
} from "./intake-service.js";
import {
  MemoryReturnIntakeStore,
  createReturnIntakeStoreFromEnvironment,
  type ReturnIntakeStore,
} from "./intake-store.js";
import {
  MCP_PROTOCOL_VERSION,
  MCP_VERIFIED_SESSION_HEADER,
  createReturnIntakeMcpHandler,
} from "./mcp.js";

type Result = APIGatewayProxyStructuredResultV2;

const evaluateBodySchema = z.object({
  evaluatedAt: z.string().datetime({ offset: true }).optional(),
  simulate: z.boolean().default(false),
  imageUrls: z.array(z.string().max(7_500_000)).max(4).optional(),
  physicalFinding: z.enum(["empty", "decoy", "wrong-item", "possible-imitation", "quantity-mismatch", "inconclusive"]).optional(),
});

const actionBodySchema = z.object({
  actor: DecisionActorSchema,
  action: DecisionActionSchema,
  target: DecisionTargetSchema,
  rationale: z.string().min(3).max(2_000),
  evidenceIds: z.array(z.string()).max(40).default([]),
  decisionId: z.string().optional(),
  supersedesDecisionId: z.string().optional(),
});

const uploadBodySchema = z.object({
  fixtureId: z.enum(["outboundProtocol", "emptyReturn", "wrongItem", "possibleImitation"]).optional(),
  checkpointId: CheckpointIdSchema.default("ITEM_INSPECTION"),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  sha256: z.string().optional(),
}).refine((body) => body.fixtureId !== undefined || (body.mimeType && body.sizeBytes && body.sha256), {
  message: "Select a synthetic fixture or provide mimeType, sizeBytes, and sha256.",
});

const waitlistBodySchema = z.object({
  email: z.string().email().max(254),
  role: z.string().min(1).max(100),
  companyUrl: z.string().url().max(500).optional(),
  consent: z.literal(true),
  noticeVersion: z.string().min(1).max(50),
});

const intakeUploadBodySchema = z.object({
  purpose: IntakeEvidencePurposeSchema,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

const completeIntakeUploadBodySchema = z.object({
  purpose: IntakeEvidencePurposeSchema,
  objectKey: z.string().min(1).max(1_024),
  versionId: z.string().trim().min(1).max(1_024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

const parseJson = (event: APIGatewayProxyEventV2, maxBytes = 100_000): unknown => {
  if (!event.body) return {};
  const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (Buffer.byteLength(body, "utf8") > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(body);
};

const configuredOrigins = (): Set<string> => {
  const raw = [process.env.ALLOWED_ORIGIN, process.env.PUBLIC_BASE_URL].filter(Boolean).join(",");
  return new Set(raw.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean));
};

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
    return configuredOrigins().has(origin.replace(/\/$/, ""));
  } catch {
    return false;
  }
};

const corsHeaders = (origin: string | undefined): Record<string, string> => {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-demo-session,mcp-protocol-version,mcp-method,mcp-name,mcp-session-id,last-event-id",
    "access-control-max-age": "600",
    vary: "Origin",
  };
  if (origin && isOriginAllowed(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
  }
  return headers;
};

const response = (
  statusCode: number,
  payload: unknown,
  origin?: string,
  cookies?: string[],
): Result => ({ statusCode, headers: corsHeaders(origin), cookies, body: JSON.stringify(payload) });

const eventBodyText = (event: APIGatewayProxyEventV2): string | undefined => {
  if (event.body === undefined) return undefined;
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
};

const mcpWebRequest = (
  event: APIGatewayProxyEventV2,
  verifiedSessionId: string,
): Request => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) {
    if (value !== undefined) headers.set(name, value);
  }
  headers.set(MCP_VERIFIED_SESSION_HEADER, verifiedSessionId);
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `https://${event.requestContext.domainName || "lambda.invalid"}${event.rawPath}${query}`;
  const method = event.requestContext.http.method;
  const body = ["GET", "HEAD"].includes(method) ? undefined : eventBodyText(event);
  return new Request(url, { method, headers, ...(body === undefined ? {} : { body }) });
};

const mcpGatewayResponse = async (
  sdkResponse: Response,
  origin: string | undefined,
): Promise<Result> => {
  const headers = corsHeaders(origin);
  sdkResponse.headers.forEach((value, name) => {
    // API Gateway owns hop-by-hop transfer framing. Forwarding these headers
    // can corrupt an otherwise valid buffered Streamable HTTP response.
    if (!["connection", "content-length", "transfer-encoding"].includes(name.toLowerCase())) {
      headers[name] = value;
    }
  });
  return {
    statusCode: sdkResponse.status,
    headers,
    body: await sdkResponse.text(),
  };
};

const cookieValue = (event: APIGatewayProxyEventV2, name: string): string | undefined => {
  for (const cookie of event.cookies ?? []) {
    const [key, ...value] = cookie.split("=");
    if (key?.trim() === name) return decodeURIComponent(value.join("="));
  }
  const header = event.headers.cookie;
  for (const cookie of header?.split(";") ?? []) {
    const [key, ...value] = cookie.split("=");
    if (key?.trim() === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
};

const sessionIdFor = (event: APIGatewayProxyEventV2): string | undefined => {
  const sessionId = event.headers["x-demo-session"] ?? cookieValue(event, "redo_demo_session");
  return sessionId && /^[a-f0-9-]{36}$/i.test(sessionId) ? sessionId : undefined;
};

const pathFor = (event: APIGatewayProxyEventV2): string => {
  const raw = event.rawPath || event.requestContext.http.path || "/";
  const normalized = raw.startsWith("/api/") ? raw.slice(4) : raw === "/api" ? "/" : raw;
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
};

const statusForError = (error: unknown): { status: number; code: string; message: string } => {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return { status: 400, code: "INVALID_REQUEST", message: "The request did not match the documented contract." };
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "SESSION_NOT_FOUND") return { status: 401, code, message: "Create or refresh an anonymous demo session." };
  if (["SESSION_EVALUATION_LIMIT", "DAILY_EVALUATION_LIMIT"].includes(code)) return { status: 429, code, message: "The bounded demo model-evaluation limit has been reached." };
  if (["UPLOAD_SESSION_LIMIT", "DAILY_UPLOAD_LIMIT"].includes(code)) return { status: 429, code, message: "The bounded demo upload-policy limit has been reached." };
  if (code.endsWith("NOT_FOUND")) return { status: 404, code, message: "The requested resource was not found in this demo session." };
  if (["REQUEST_TOO_LARGE", "UNSUPPORTED_UPLOAD_TYPE", "UPLOAD_SIZE_LIMIT", "UPLOAD_SIZE_MISMATCH", "UPLOAD_MAGIC_BYTES_MISMATCH", "INVALID_UPLOAD_CHECKSUM", "UPLOAD_VERSION_REQUIRED", "UPLOAD_VERSION_MISMATCH", "UPLOAD_PURPOSE_MISMATCH"].includes(code)) return { status: 400, code, message: "The request failed a safety, immutable-version, image-validation, or size constraint." };
  if (["UPLOAD_SESSION_MISMATCH", "EVIDENCE_SESSION_MISMATCH", "EVIDENCE_PURPOSE_MISMATCH"].includes(code)) return { status: 403, code, message: "The evidence does not belong to this session and required purpose." };
  if (code === "UPLOAD_DISABLED") return { status: 503, code, message: "Ephemeral uploads are not configured in this environment; use a synthetic fixture instead." };
  if (["COMMUNICATION_NOT_RECOMMENDED", "RECIPIENT_NOT_AVAILABLE"].includes(code)) return { status: 409, code, message: "The requested communication action is not available for this record." };
  if (["REVIEW_CONTEXT_MISMATCH", "REVIEW_EVIDENCE_MISMATCH"].includes(code)) return { status: 409, code, message: "The operator review is not bound to this exact draft, inspection, and evidence set." };
  if (code === "EVIDENCE_CONTEXT_MISMATCH") return { status: 409, code, message: "An immutable evidence identifier already exists with a different context." };
  if (code.includes("requires") || code.includes("must") || code.includes("referenced") || code.includes("unknown evidence")) return { status: 409, code: "DECISION_INVARIANT", message: code };
  return { status: 500, code: "INTERNAL_ERROR", message: "The request could not be completed safely." };
};

const requireSession = async (event: APIGatewayProxyEventV2, store: DataStore, now: Date): Promise<string> => {
  const sessionId = sessionIdFor(event);
  if (!sessionId || !await store.getSession(sessionId, now)) throw new Error("SESSION_NOT_FOUND");
  return sessionId;
};

const attachFixture = async (
  store: DataStore,
  sessionId: string,
  caseData: ReturnIntegrityCase,
  fixtureId: keyof Omit<typeof syntheticImageFixtures, "manifest">,
  checkpointId: z.infer<typeof CheckpointIdSchema>,
): Promise<ReturnIntegrityCase> => {
  const evidence = EvidenceArtifactSchema.parse({
    evidenceId: `ev-upload-${randomUUID()}`,
    caseId: caseData.caseId,
    checkpointId,
    sourceSystem: "synthetic-fixture-picker",
    provenanceTier: "E2",
    observedAt: new Date().toISOString(),
    availableAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    facts: { imageRole: fixtureId, synthetic: true, noRealPii: true },
    fixtureUrl: syntheticImageFixtures[fixtureId],
    protocolVersion: "synthetic-fixtures-1.0",
    piiClass: "NONE",
    useScope: ["RISK_DECISION", "MODEL_EVALUATION", "ANALYTICS"],
  });
  const updated = CaseSchema.parse({ ...caseData, evidence: [...caseData.evidence, evidence] });
  await store.putCase(sessionId, updated);
  return updated;
};

const physicalScenarioEvidence = (
  baseEvidence: readonly EvidenceArtifact[],
  caseId: string,
  checkpointId: z.infer<typeof CheckpointIdSchema>,
  evaluatedAt: string,
  finding: z.infer<typeof evaluateBodySchema>["physicalFinding"],
): EvidenceArtifact[] => {
  if (!finding || finding === "empty" || checkpointId !== "ITEM_INSPECTION") return [...baseEvidence];
  const normalized = finding === "decoy" ? "wrong-item" : finding;
  const retained = baseEvidence.filter((artifact) => ![
    "ev-physical-receipt",
    "ev-physical-empty-photo",
    "ev-physical-second-inspection",
  ].includes(artifact.evidenceId));
  const common = {
    caseId,
    protocolVersion: "synthetic-branch-1.0",
    piiClass: "NONE" as const,
    useScope: ["RISK_DECISION", "CUSTOMER_SUPPORT", "DISPUTE_EVIDENCE", "MODEL_EVALUATION", "ANALYTICS"] as const,
  };
  const artifact = (partial: Pick<EvidenceArtifact, "evidenceId" | "checkpointId" | "sourceSystem" | "provenanceTier" | "facts"> & { fixtureUrl?: string }): EvidenceArtifact => ({
    ...partial,
    ...common,
    observedAt: evaluatedAt,
    availableAt: evaluatedAt,
    receivedAt: evaluatedAt,
    useScope: [...common.useScope],
  });
  const scenario = normalized === "wrong-item"
    ? {
        observedWeightGrams: 430,
        observedSku: "JC-BASIC-MOUSE",
        observedQuantity: 1,
        observedSerials: [] as string[],
        fixtureUrl: syntheticImageFixtures.wrongItem,
        disposition: "WRONG_ITEM_OR_DECOY",
      }
    : normalized === "inconclusive"
      ? {
          observedWeightGrams: 1765,
          observedSku: undefined,
          observedQuantity: undefined,
          observedSerials: undefined,
          fixtureUrl: syntheticImageFixtures.possibleImitation,
          disposition: "INCONCLUSIVE",
        }
      : {
          observedWeightGrams: 940,
          observedSku: "JC-ARC-ONE-KIT",
          observedQuantity: 1,
          observedSerials: ["JCA1-UNKNOWN"],
          fixtureUrl: syntheticImageFixtures.possibleImitation,
          disposition: normalized === "quantity-mismatch" ? "QUANTITY_MISMATCH" : "POSSIBLE_IMITATION_REQUIRES_QUALIFIED_REVIEW",
        };
  return [
    ...retained,
    artifact({
      evidenceId: `ev-scenario-${normalized}-weight`,
      checkpointId: "WAREHOUSE_RECEIPT",
      sourceSystem: "redo-warehouse-scale",
      provenanceTier: "E4",
      facts: {
        expectedWeightGrams: 1800,
        observedWeightGrams: scenario.observedWeightGrams,
        weightToleranceGrams: 90,
        scaleCalibrationStatus: "PASS",
        observedReturnLabel: "RMA-8821",
      },
    }),
    artifact({
      evidenceId: `ev-scenario-${normalized}-inspection`,
      checkpointId: "ITEM_INSPECTION",
      sourceSystem: "redo-warehouse-camera",
      provenanceTier: "E4",
      fixtureUrl: scenario.fixtureUrl,
      facts: {
        captureProtocol: "INBOUND_SIX_VIEW",
        expectedSku: "JC-ARC-ONE-KIT",
        expectedQuantity: 2,
        expectedSerials: ["JCA1-88K2", "JCA1-91M7"],
        ...(scenario.observedSku === undefined ? {} : { observedSku: scenario.observedSku }),
        ...(scenario.observedQuantity === undefined ? {} : { observedQuantity: scenario.observedQuantity }),
        ...(scenario.observedSerials === undefined ? {} : { observedSerials: scenario.observedSerials }),
        inspectionDisposition: scenario.disposition,
        synthetic: true,
      },
    }),
  ];
};

export interface HandlerDependencies {
  intakeStore?: ReturnIntakeStore;
  resolveOpenAIKey?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  model?: string;
  publicBaseUrl?: string;
  now?: () => Date;
  resolveEvidenceImage?: ReturnIntakeServiceOptions["resolveEvidenceImage"];
  acquireModelSlot?: ReturnIntakeServiceOptions["acquireModelSlot"];
}

export const createHandler = (providedStore?: DataStore, dependencies: HandlerDependencies = {}) => {
  const dataStore = providedStore ?? createStoreFromEnvironment();
  const resolveKey = dependencies.resolveOpenAIKey ?? resolveOpenAIKey;
  const clock = dependencies.now ?? (() => new Date());
  const intakeStore = dependencies.intakeStore
    ?? (providedStore ? new MemoryReturnIntakeStore() : createReturnIntakeStoreFromEnvironment());
  const resolveEvidenceImage = dependencies.resolveEvidenceImage ?? (async (
    sessionId: string,
    evidenceId: string,
    expectedPurpose: "RETURN_LABEL" | "PACKAGE_CONTENTS",
  ) => {
    const evidence = await intakeStore.getCompletedEvidence(sessionId, evidenceId);
    if (evidence && evidence.purpose !== expectedPurpose) throw new Error("EVIDENCE_PURPOSE_MISMATCH");
    return evidence ? getEvidenceObjectUrl(evidence.objectKey, evidence.versionId) : undefined;
  });
  const intakeService = new ReturnIntakeService({
    store: intakeStore,
    resolveApiKey: resolveKey,
    fetchImpl: dependencies.fetchImpl,
    model: dependencies.model,
    publicBaseUrl: dependencies.publicBaseUrl ?? process.env.PUBLIC_BASE_URL,
    now: dependencies.now,
    resolveEvidenceImage,
    acquireModelSlot: dependencies.acquireModelSlot
      ?? ((sessionId: string) => dataStore.acquireEvaluationSlot(sessionId)),
  });
  const mcpHandler = createReturnIntakeMcpHandler(intakeService);

  return async (
    event: APIGatewayProxyEventV2,
  ): Promise<Result> => {
  const origin = event.headers.origin;
  if (!isOriginAllowed(origin)) return response(403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "This origin is not allowed." } }, undefined);
  if (event.requestContext.http.method === "OPTIONS") return response(204, {}, origin);

  const store = dataStore;
  const method = event.requestContext.http.method;
  const path = pathFor(event);

  try {
    if (method === "GET" && path === "/health") {
      return response(200, {
        ok: true,
        service: "redo-return-integrity-api",
        model: DEFAULT_OPENAI_MODEL,
        openAIConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_SECRET_NAME),
        persistence: process.env.CASE_TABLE_NAME || process.env.CASES_TABLE_NAME || process.env.TABLE_NAME ? "dynamodb" : "memory-demo",
        returnLookupPersistence: process.env.RETURN_LOOKUP_TABLE_NAME ? "dynamodb" : "memory-demo",
        intakeUploadCompletion: Boolean(process.env.UPLOAD_BUCKET_NAME),
        mcpSurface: "official-sdk-stateless-streamable-http",
        mcpProtocolVersion: MCP_PROTOCOL_VERSION,
        mcpSessions: false,
        mcpResponseMode: "terminal-json",
        policy: "human-final-adverse-decisions",
      }, origin);
    }

    if (method === "POST" && path === "/sessions") {
      const session = await store.createSession();
      const cookie = `redo_demo_session=${encodeURIComponent(session.sessionId)}; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Strict`;
      return response(201, {
        session,
        sessionToken: session.sessionId,
        privacy: "Synthetic fixture data expires after 24 hours. Optional uploads are ephemeral and must not contain government ID, real labels, or unrelated personal data.",
      }, origin, [cookie]);
    }

    if (method === "POST" && path === "/waitlist") {
      const body = waitlistBodySchema.parse(parseJson(event));
      const submittedAt = new Date();
      const email = body.email.trim().toLowerCase();
      const emailHash = createHash("sha256")
        .update(`${process.env.WAITLIST_HASH_PEPPER ?? "return-integrity-demo"}:${email}`)
        .digest("hex");
      const lead: WaitlistLead = {
        email,
        emailHash,
        role: body.role,
        companyUrl: body.companyUrl,
        consent: true,
        noticeVersion: body.noticeVersion,
        submittedAt: submittedAt.toISOString(),
        expiresAt: new Date(submittedAt.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      };
      const state = await store.saveWaitlistLead(lead);
      return response(state === "CREATED" ? 201 : 200, {
        state,
        message: "Thanks—your consented waitlist request was recorded. This demo does not send email. Active-retention target: 30 days; AWS TTL deletion and retained backups may lag per policy.",
        retentionDays: 30,
        controller: "Canyon",
      }, origin);
    }

    const sessionId = await requireSession(event, store, clock());

    if (method === "GET" && path === "/session") {
      return response(200, { session: await store.getSession(sessionId) }, origin);
    }
    if (method === "POST" && path === "/session/reset") {
      return response(200, { session: await store.resetSession(sessionId), reset: true }, origin);
    }
    if (method === "GET" && path === "/cases") {
      const cases = await store.listCases(sessionId);
      return response(200, { cases: cases.map((caseData) => ({ ...caseData, evidence: undefined })) }, origin);
    }
    if (method === "GET" && path === "/metrics") {
      return response(200, { metrics: demoMetrics, illustrative: true }, origin);
    }

    if (method === "POST" && path === "/uploads/presign") {
      const body = intakeUploadBodySchema.parse(parseJson(event));
      if (process.env.UPLOAD_BUCKET_NAME) await store.acquireUploadUrlSlot(sessionId);
      return response(201, await createIntakeUploadUrl(sessionId, body.purpose, body), origin);
    }

    if (method === "POST" && path === "/uploads/complete") {
      const body = completeIntakeUploadBodySchema.parse(parseJson(event));
      const completed = await completeIntakeUpload(sessionId, body);
      const persistedEvidence = await intakeStore.putCompletedEvidence(sessionId, completed.evidence);
      return response(201, {
        status: "VERIFIED_INTAKE_EVIDENCE",
        ...completed,
        evidence: persistedEvidence,
        expiresInSeconds: 300,
      }, origin);
    }

    if (method === "POST" && path === "/intake/label-lookup") {
      const result = await intakeService.lookupReturnByLabel(sessionId, parseJson(event, 7_500_000));
      return response(200, result, origin);
    }

    if (method === "POST" && path === "/intake/inspections") {
      const result = await intakeService.analyzeReturnContents(sessionId, parseJson(event, 7_500_000));
      return response(201, result, origin);
    }

    if (method === "POST" && path === "/intake/communications/draft") {
      const result = await intakeService.draftReturnCommunication(sessionId, parseJson(event));
      return response(201, result, origin);
    }

    if (method === "POST" && path === "/intake/reviews") {
      const result = await intakeService.recordReturnReview(sessionId, parseJson(event));
      return response(201, result, origin);
    }

    if (method === "POST" && path === "/intake/communications/queue") {
      const result = await intakeService.queueTestCommunication(sessionId, parseJson(event));
      return response(202, result, origin);
    }

    if (path === "/mcp") {
      const rawMcpBody = eventBodyText(event);
      if (rawMcpBody && Buffer.byteLength(rawMcpBody, "utf8") > 100_000) throw new Error("REQUEST_TOO_LARGE");
      return mcpGatewayResponse(await mcpHandler.fetch(mcpWebRequest(event, sessionId)), origin);
    }

    const caseMatch = path.match(/^\/cases\/([^/]+)$/);
    if (method === "GET" && caseMatch?.[1]) {
      const caseData = await store.getCase(sessionId, decodeURIComponent(caseMatch[1]));
      if (!caseData) throw new Error("CASE_NOT_FOUND");
      return response(200, { case: caseData, checkpoints, checkpointDataCatalog }, origin);
    }

    const evaluationMatch = path.match(/^\/cases\/([^/]+)\/checkpoints\/([^/]+)\/evaluate$/);
    if (method === "POST" && evaluationMatch?.[1] && evaluationMatch[2]) {
      const caseId = decodeURIComponent(evaluationMatch[1]);
      const checkpointId = CheckpointIdSchema.parse(evaluationMatch[2]);
      const body = evaluateBodySchema.parse(parseJson(event));
      const caseData = await store.getCase(sessionId, caseId);
      if (!caseData) throw new Error("CASE_NOT_FOUND");
      const limits = await store.acquireEvaluationSlot(sessionId);
      const evaluatedAt = body.evaluatedAt ?? new Date().toISOString();
      const scenarioEvidence = physicalScenarioEvidence(caseData.evidence, caseId, checkpointId, evaluatedAt, body.physicalFinding);
      const inlineEvidence: EvidenceArtifact[] = (body.imageUrls ?? []).map((imageUrl, index) => ({
        evidenceId: `ev-inline-image-${index + 1}`,
        caseId,
        checkpointId,
        sourceSystem: "ephemeral-inline-image",
        provenanceTier: "E0",
        observedAt: evaluatedAt,
        availableAt: evaluatedAt,
        receivedAt: evaluatedAt,
        facts: {
          ephemeral: true,
          unverified: true,
          byteLength: Buffer.byteLength(imageUrl, "utf8"),
          mediaKind: imageUrl.startsWith("data:image/") ? "INLINE_IMAGE_DATA" : "REMOTE_HTTPS_IMAGE",
        },
        checksum: createHash("sha256").update(imageUrl).digest("hex"),
        protocolVersion: "ephemeral-inline-1.0",
        piiClass: "PERSONAL",
        useScope: ["RISK_DECISION", "MODEL_EVALUATION"],
      }));
      const evaluationEvidence = [...scenarioEvidence, ...inlineEvidence];
      const snapshot = evidenceAvailableAt(evaluationEvidence, checkpointId, evaluatedAt);
      const facts = collectNativeFacts(snapshot);
      const signals = deriveDeterministicSignals(facts, snapshot);
      const modelResult = body.simulate
        ? {
            assessment: simulateAssessment(snapshot, signals),
            modelVersion: "synthetic-fixture-assessor-1.0",
            promptVersion: OPENAI_PROMPT_VERSION,
            simulated: true,
            latencyMs: 0,
          }
        : await assessWithOpenAI({
            sessionId,
            checkpointId,
            evidence: snapshot,
            nativeFacts: facts,
            deterministicSignals: signals,
            imageUrls: body.imageUrls,
            apiKey: await resolveKey(),
            publicBaseUrl: process.env.PUBLIC_BASE_URL,
          });
      const decision = evaluateCheckpoint({
        caseId,
        checkpointId,
        evaluatedAt,
        allEvidence: evaluationEvidence,
        openAIAssessment: modelResult.assessment,
        modelVersion: modelResult.modelVersion,
        promptVersion: modelResult.promptVersion,
        simulated: modelResult.simulated,
      });
      const updated = CaseSchema.parse({
        ...caseData,
        currentCheckpointId: checkpointId,
        state: decision.nextState,
        decisions: [...caseData.decisions, decision],
      });
      await store.putCase(sessionId, updated);
      return response(200, {
        decision,
        limits,
        model: { modelVersion: modelResult.modelVersion, promptVersion: modelResult.promptVersion, simulated: modelResult.simulated, latencyMs: modelResult.latencyMs },
        contract: {
          flow: ["nativeFacts", "deterministicSignals", "openAIAssessment", "merchantPolicyResult", "accountableFinalAction", "shopperCure", "nextState"],
          humanFinalAdverseDecision: true,
        },
      }, origin);
    }

    const actionsMatch = path.match(/^\/cases\/([^/]+)\/actions$/);
    if (method === "POST" && actionsMatch?.[1]) {
      const caseId = decodeURIComponent(actionsMatch[1]);
      const body = actionBodySchema.parse(parseJson(event));
      const caseData = await store.getCase(sessionId, caseId);
      if (!caseData) throw new Error("CASE_NOT_FOUND");
      const knownEvidence = new Set(caseData.evidence.map((artifact) => artifact.evidenceId));
      const unknownEvidence = body.evidenceIds.filter((id) => !knownEvidence.has(id));
      if (unknownEvidence.length > 0) throw new Error(`Action referenced unknown evidence: ${unknownEvidence.join(", ")}`);
      if (body.action === "DENY" && (body.actor !== "HUMAN_OPERATOR" || body.evidenceIds.length === 0)) {
        throw new Error("DENY requires an accountable human operator and at least one case evidence reference.");
      }
      const supersedesDecisionId = body.supersedesDecisionId ?? body.decisionId;
      let decisions = [...caseData.decisions];
      if (body.actor === "HUMAN_OPERATOR" && ["APPROVE", "PARTIAL_APPROVE", "DENY", "OVERTURN", "CLOSE"].includes(body.action)) {
        const base = body.decisionId
          ? caseData.decisions.find((decision) => decision.decisionId === body.decisionId)
          : caseData.decisions.at(-1);
        if (!base && body.decisionId) throw new Error("DECISION_NOT_FOUND");
        if (!base) throw new Error("A human final action requires a prior checkpoint decision.");
        const humanDecision: HumanDecision = {
          decisionId: randomUUID(),
          decidedAt: new Date().toISOString(),
          operatorId: "demo-operator",
          action: body.action,
          target: body.target,
          rationale: body.rationale,
          evidenceIds: body.evidenceIds,
          supersedesDecisionId: base.decisionId,
        };
        const adjudicated = attachHumanDecision({ ...base, decisionId: humanDecision.decisionId }, humanDecision);
        decisions = [...decisions, adjudicated];
      }
      const events = appendActionEvent(caseData.events, {
        caseId,
        actor: body.actor,
        action: body.action,
        target: body.target,
        rationale: body.rationale,
        evidenceIds: body.evidenceIds,
        priorState: caseData.state,
        occurredAt: new Date().toISOString(),
        supersedesDecisionId,
      });
      const actionEvent = events.at(-1) as CaseActionEvent;
      const updated = CaseSchema.parse({ ...caseData, decisions, events, state: actionEvent.nextState });
      await store.appendEvent(sessionId, caseId, actionEvent, updated);
      return response(201, {
        event: actionEvent,
        appendOnly: true,
        priorDecisionPreserved: true,
        paymentCaseStatus: body.target === "PAYMENT_CASE" ? "EVIDENCE_READY_NOT_SUBMITTED" : undefined,
      }, origin);
    }

    const uploadMatch = path.match(/^\/cases\/([^/]+)\/uploads$/);
    if (method === "POST" && uploadMatch?.[1]) {
      const caseId = decodeURIComponent(uploadMatch[1]);
      const body = uploadBodySchema.parse(parseJson(event));
      const caseData = await store.getCase(sessionId, caseId);
      if (!caseData) throw new Error("CASE_NOT_FOUND");
      if (body.fixtureId) {
        const updated = await attachFixture(store, sessionId, caseData, body.fixtureId, body.checkpointId);
        return response(201, { status: "SYNTHETIC_FIXTURE_ATTACHED", evidence: updated.evidence.at(-1), synthetic: true }, origin);
      }
      if (process.env.UPLOAD_BUCKET_NAME) await store.acquireUploadUrlSlot(sessionId);
      return response(201, await createUploadUrl(sessionId, caseId, {
        mimeType: body.mimeType!,
        sizeBytes: body.sizeBytes!,
        sha256: body.sha256!,
      }), origin);
    }

    const evidenceMatch = path.match(/^\/cases\/([^/]+)\/evidence\/([^/]+)$/);
    if (method === "GET" && evidenceMatch?.[1] && evidenceMatch[2]) {
      const caseData = await store.getCase(sessionId, decodeURIComponent(evidenceMatch[1]));
      if (!caseData) throw new Error("CASE_NOT_FOUND");
      const artifact = caseData.evidence.find((candidate) => candidate.evidenceId === decodeURIComponent(evidenceMatch[2]!));
      if (!artifact) throw new Error("EVIDENCE_NOT_FOUND");
      const objectVersionId = typeof artifact.facts.objectVersionId === "string"
        ? artifact.facts.objectVersionId
        : undefined;
      const objectUrl = artifact.objectKey && objectVersionId
        ? await getEvidenceObjectUrl(artifact.objectKey, objectVersionId)
        : undefined;
      return response(200, { evidence: artifact, previewUrl: objectUrl ?? artifact.fixtureUrl, expiresInSeconds: objectUrl ? 300 : undefined }, origin);
    }

    return response(404, { error: { code: "ROUTE_NOT_FOUND", message: "No API route matched this request." } }, origin);
  } catch (error) {
    const mapped = statusForError(error);
    if (mapped.status >= 500) console.error(JSON.stringify({ event: "request_failed", path, code: mapped.code }));
    return response(mapped.status, { error: { code: mapped.code, message: mapped.message } }, origin);
  }
  };
};

export const handler = createHandler();
