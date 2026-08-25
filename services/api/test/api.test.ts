import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { createHandler } from "../src/handler.js";
import { LabelLookupInputSchema } from "../src/intake-service.js";
import { MemoryReturnIntakeStore } from "../src/intake-store.js";
import { MCP_PROTOCOL_VERSION } from "../src/mcp.js";
import { MemoryStore } from "../src/store.js";

const apiEvent = (
  method: string,
  path: string,
  body?: unknown,
  sessionId?: string,
  origin?: string,
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "$default",
  rawPath: `/api${path}`,
  rawQueryString: "",
  headers: {
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(sessionId ? { "x-demo-session": sessionId } : {}),
    ...(origin ? { origin } : {}),
  },
  requestContext: {
    accountId: "test",
    apiId: "test",
    domainName: "test",
    domainPrefix: "test",
    http: { method, path: `/api${path}`, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
    requestId: "test",
    routeKey: "$default",
    stage: "$default",
    time: "",
    timeEpoch: Date.now(),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
  isBase64Encoded: false,
});

const json = (result: Awaited<ReturnType<ReturnType<typeof createHandler>>>): any => JSON.parse(String(result.body));

const modernMcpEvent = (
  rpcMethod: string,
  params: Record<string, unknown>,
  sessionId: string,
  id: string | number,
  toolName?: string,
): APIGatewayProxyEventV2 => {
  const event = apiEvent("POST", "/mcp", {
    jsonrpc: "2.0",
    id,
    method: rpcMethod,
    params: {
      ...params,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientInfo": { name: "return-integrity-api-test", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  }, sessionId);
  event.headers = {
    ...event.headers,
    accept: "application/json",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    "mcp-method": rpcMethod,
    ...(toolName ? { "mcp-name": toolName } : {}),
  };
  return event;
};

describe("Lambda API", () => {
  it("creates isolated anonymous sessions and resets only the selected session", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const firstResult = await invoke(apiEvent("POST", "/sessions"));
    const secondResult = await invoke(apiEvent("POST", "/sessions"));
    const first = json(firstResult).sessionToken as string;
    const second = json(secondResult).sessionToken as string;
    expect(first).not.toBe(second);
    expect(firstResult.cookies?.[0]).toContain("HttpOnly; Secure; SameSite=Strict");

    const attached = await invoke(apiEvent("POST", "/cases/case-good-actor-checkout/uploads", {
      fixtureId: "wrongItem",
      checkpointId: "ITEM_INSPECTION",
    }, first));
    expect(attached.statusCode).toBe(201);
    const firstCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, first))).case;
    const secondCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, second))).case;
    expect(firstCase.evidence).toHaveLength(secondCase.evidence.length + 1);

    await invoke(apiEvent("POST", "/session/reset", {}, first));
    const resetCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, first))).case;
    expect(resetCase.evidence).toHaveLength(secondCase.evidence.length);
  });

  it("evaluates the visible contract and never auto-denies on model failure", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const result = await invoke(apiEvent("POST", "/cases/case-good-actor-checkout/checkpoints/ORDER_RELEASE/evaluate", {
      evaluatedAt: "2026-08-24T14:11:00.000Z",
      simulate: false,
    }, session));
    const payload = json(result);
    expect(result.statusCode).toBe(200);
    expect(payload.decision.openAIAssessment.status).toBe("ERROR");
    expect(payload.decision.accountableFinalAction).toMatchObject({ action: "HUMAN_REVIEW", actor: "SYSTEM_POLICY" });
    expect(payload.contract.flow).toEqual([
      "nativeFacts",
      "deterministicSignals",
      "openAIAssessment",
      "merchantPolicyResult",
      "accountableFinalAction",
      "shopperCure",
      "nextState",
    ]);
  });

  it("requires a human with cited evidence to deny, then preserves an append-only shopper appeal", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const evaluated = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:09:00.000Z",
      simulate: true,
    }, session))).decision;
    expect(evaluated.accountableFinalAction.action).toBe("HOLD");

    const invalid = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "SYSTEM_POLICY",
      action: "DENY",
      target: "REFUND",
      rationale: "System attempted denial",
      evidenceIds: ["ev-physical-empty-photo"],
      decisionId: evaluated.decisionId,
    }, session));
    expect(invalid.statusCode).toBe(409);

    const deniedResult = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "HUMAN_OPERATOR",
      action: "DENY",
      target: "REFUND",
      rationale: "Two protocol inspections found no returned item; appeal remains available.",
      evidenceIds: ["ev-physical-empty-photo", "ev-physical-second-inspection"],
      decisionId: evaluated.decisionId,
    }, session));
    const denied = json(deniedResult);
    expect(deniedResult.statusCode).toBe(201);
    expect(denied.event).toMatchObject({ actor: "HUMAN_OPERATOR", action: "DENY", nextState: "DENIED" });

    const beforeAppeal = json(await invoke(apiEvent("GET", "/cases/case-physical-empty-return", undefined, session))).case;
    const humanDecisionId = beforeAppeal.decisions.at(-1).decisionId;
    const appealResult = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "SHOPPER",
      action: "HUMAN_REVIEW",
      target: "APPEAL",
      rationale: "Please review the carrier weight and my packing record.",
      evidenceIds: ["ev-physical-appeal-assertion"],
      supersedesDecisionId: humanDecisionId,
    }, session));
    expect(json(appealResult).event).toMatchObject({ nextState: "APPEALED", supersedesDecisionId: humanDecisionId });
    const afterAppeal = json(await invoke(apiEvent("GET", "/cases/case-physical-empty-return", undefined, session))).case;
    expect(afterAppeal.decisions).toEqual(beforeAppeal.decisions);
    expect(afterAppeal.events).toHaveLength(beforeAppeal.events.length + 1);
  });

  it("binds each physical fixture branch to internally consistent quantity, SKU, weight, and image evidence", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const wrongItem = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:20:00.000Z",
      simulate: true,
      physicalFinding: "wrong-item",
    }, session))).decision;
    expect(wrongItem.nativeFacts).toMatchObject({
      expectedSku: "JC-ARC-ONE-KIT",
      expectedQuantity: 2,
      observedSku: "JC-BASIC-MOUSE",
      observedQuantity: 1,
      observedWeightGrams: 430,
    });
    expect(wrongItem.deterministicSignals.map((signal: { code: string }) => signal.code)).toEqual(expect.arrayContaining(["SKU_MISMATCH", "QUANTITY_MISMATCH", "SERIAL_MISMATCH"]));
    expect(wrongItem.evidenceSnapshot.some((artifact: { fixtureUrl?: string }) => artifact.fixtureUrl === "/evidence/return-wrong-item.png")).toBe(true);

    const inconclusive = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:21:00.000Z",
      simulate: true,
      physicalFinding: "inconclusive",
    }, session))).decision;
    expect(inconclusive.openAIAssessment.status).toBe("INCONCLUSIVE");
    expect(inconclusive.accountableFinalAction.action).toBe("HUMAN_REVIEW");
  });

  it("enforces evaluation limits and does not expose a waitlist read route", async () => {
    const store = new MemoryStore();
    const session = await store.createSession();
    for (let index = 0; index < 30; index += 1) await store.acquireEvaluationSlot(session.sessionId, new Date("2026-08-24T12:00:00.000Z"));
    await expect(store.acquireEvaluationSlot(session.sessionId, new Date("2026-08-24T12:00:00.000Z"))).rejects.toThrow("SESSION_EVALUATION_LIMIT");

    const invoke = createHandler(new MemoryStore());
    const getWaitlist = await invoke(apiEvent("GET", "/waitlist"));
    expect([401, 404]).toContain(getWaitlist.statusCode);
  });

  it("bounds upload-policy issuance and does not reset the quota with fixture reset", async () => {
    vi.stubEnv("MAX_UPLOAD_URLS_PER_SESSION", "2");
    vi.stubEnv("DAILY_UPLOAD_URL_LIMIT", "10");
    try {
      const store = new MemoryStore();
      const session = await store.createSession(new Date("2026-08-24T12:00:00.000Z"));
      await store.acquireUploadUrlSlot(session.sessionId, new Date("2026-08-24T12:01:00.000Z"));
      await store.acquireUploadUrlSlot(session.sessionId, new Date("2026-08-24T12:02:00.000Z"));
      await store.resetSession(session.sessionId, new Date("2026-08-24T12:03:00.000Z"));
      await expect(store.acquireUploadUrlSlot(session.sessionId, new Date("2026-08-24T12:04:00.000Z")))
        .rejects.toThrow("UPLOAD_SESSION_LIMIT");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("records consented waitlist leads idempotently without sending email", async () => {
    const invoke = createHandler(new MemoryStore());
    const lead = { email: "test@example.com", role: "Merchant", consent: true, noticeVersion: "2026-08-24" };
    const created = await invoke(apiEvent("POST", "/waitlist", lead));
    const duplicate = await invoke(apiEvent("POST", "/waitlist", lead));
    expect(created.statusCode).toBe(201);
    expect(json(created)).toMatchObject({ state: "CREATED", retentionDays: 30, controller: "Canyon" });
    expect(json(duplicate).state).toBe("EXISTING");
    expect(json(created).message).toContain("does not send email");
  });

  it("rejects unconfigured cross-origin mutation requests", async () => {
    const result = await createHandler(new MemoryStore())(apiEvent("POST", "/sessions", {}, undefined, "https://evil.example"));
    expect(result.statusCode).toBe(403);
    expect(result.headers?.["access-control-allow-origin"]).toBeUndefined();
  });

  it("looks up a return label, inspects quantity, drafts evidence-aware copy, and queues only the test outbox", async () => {
    const invoke = createHandler(new MemoryStore(), { resolveOpenAIKey: async () => undefined });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;

    const lookupResult = await invoke(apiEvent("POST", "/intake/label-lookup", { fixtureId: "labelRma8821" }, session));
    const lookup = json(lookupResult);
    expect(lookupResult.statusCode).toBe(200);
    expect(lookup).toMatchObject({
      mode: "SYNTHETIC_FIXTURE",
      matchedBy: "LABEL",
      extraction: { rmaId: "RMA-8821", orderId: "JC-1042" },
      returnRecord: { returnRecordId: "ret-jc-1042", product: { sku: "JC-ARC-ONE-KIT", quantity: 2 } },
    });

    const inspectionResult = await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: lookup.returnRecord.returnRecordId,
      fixtureId: "quantityMismatch",
    }, session));
    const inspection = json(inspectionResult).inspection;
    expect(inspectionResult.statusCode).toBe(201);
    expect(inspection).toMatchObject({
      classification: "QUANTITY_MISMATCH",
      nextAction: "APPROVE_PARTIAL",
      refund: {
        recommendedType: "PARTIAL",
        recommendedAmountCents: 92_450,
        withholdAmountCents: 92_450,
        requiresHumanApproval: true,
      },
      communication: { recommended: true, channel: "EMAIL", templateIntent: "PARTIAL_REFUND_EXPLANATION" },
      warehouseEvidenceImageUrl: "/evidence/return-quantity-mismatch.png",
    });

    const draftResult = await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: inspection.inspectionId,
      channel: "EMAIL",
    }, session));
    const draft = json(draftResult).draft;
    expect(draftResult.statusCode).toBe(201);
    expect(draft).toMatchObject({
      generationMode: "SAFE_FALLBACK",
      deliveryStatus: "DRAFT_NOT_SENT",
      requiresHumanApproval: true,
      originalProductImageUrl: "/evidence/catalog-juniper-arc-one.png",
      warehouseEvidenceImageUrl: "/evidence/return-quantity-mismatch.png",
    });
    expect(draft.attachments.map((attachment: { role: string }) => attachment.role)).toEqual([
      "ORIGINAL_PRODUCT_REFERENCE",
      "WAREHOUSE_EVIDENCE",
    ]);
    expect(draft.body.toLowerCase()).not.toContain("you committed fraud");

    const reviewResult = await invoke(apiEvent("POST", "/intake/reviews", {
      inspectionId: inspection.inspectionId,
      draftId: draft.draftId,
      reviewerLabel: "Warehouse Operator 7",
      draftDecision: "APPROVE_AS_WRITTEN",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: inspection.evidenceIds,
    }, session));
    const review = json(reviewResult).review;
    expect(reviewResult.statusCode).toBe(201);
    expect(review).toMatchObject({
      inspectionId: inspection.inspectionId,
      draftId: draft.draftId,
      returnRecordId: inspection.returnRecordId,
      reviewerLabel: "Warehouse Operator 7",
      reviewerIdentityAssurance: "UNAUTHENTICATED_DISPLAY_LABEL",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: inspection.evidenceIds,
    });

    const queueInput = { draftId: draft.draftId, reviewId: review.reviewId };
    const firstQueue = json(await invoke(apiEvent("POST", "/intake/communications/queue", queueInput, session)));
    const secondQueue = json(await invoke(apiEvent("POST", "/intake/communications/queue", queueInput, session)));
    expect(firstQueue).toMatchObject({
      status: "QUEUED_TEST_OUTBOX",
      deliveryDisabled: true,
      message: {
        draftId: draft.draftId,
        inspectionId: inspection.inspectionId,
        reviewId: review.reviewId,
        deliveryDisabled: true,
      },
    });
    expect(secondQueue.messageId).toBe(firstQueue.messageId);
  });

  it("serves the five intake tools through the official stateless Streamable HTTP MCP handler", async () => {
    const invoke = createHandler(new MemoryStore(), { resolveOpenAIKey: async () => undefined });
    const preflight = await invoke(apiEvent("OPTIONS", "/mcp", undefined, undefined, "http://localhost:5173"));
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers?.["access-control-allow-methods"]).toContain("DELETE");
    expect(preflight.headers?.["access-control-allow-headers"]).toContain("mcp-method");
    expect(preflight.headers?.["access-control-allow-headers"]).toContain("mcp-name");
    expect(json(await invoke(apiEvent("GET", "/health")))).toMatchObject({
      mcpSurface: "official-sdk-stateless-streamable-http",
      mcpProtocolVersion: MCP_PROTOCOL_VERSION,
      mcpSessions: false,
      mcpResponseMode: "terminal-json",
    });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const discoveryResult = await invoke(modernMcpEvent("server/discover", {}, session, 1));
    const discovered = json(discoveryResult);
    expect(discoveryResult.statusCode).toBe(200);
    expect(discoveryResult.headers?.["content-type"]).toBe("application/json");
    expect(discovered.result).toMatchObject({
      supportedVersions: [MCP_PROTOCOL_VERSION],
      capabilities: { tools: expect.any(Object) },
      resultType: "complete",
    });

    const listed = json(await invoke(modernMcpEvent("tools/list", {}, session, 2)));
    expect(listed.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "lookup_return_by_label",
      "analyze_return_contents",
      "draft_return_communication",
      "record_return_review",
      "queue_test_communication",
    ]);
    expect(JSON.stringify(listed.result.tools)).not.toContain("imageDataUrl");
    expect(JSON.stringify(listed.result.tools)).toContain("draftDecision");
    expect(listed.result.tools.every((tool: { outputSchema?: unknown }) => tool.outputSchema !== undefined)).toBe(true);
    expect(listed.result).toMatchObject({ resultType: "complete", cacheScope: "private", ttlMs: 0 });

    const called = json(await invoke(modernMcpEvent(
      "tools/call",
      { name: "lookup_return_by_label", arguments: { fixtureId: "labelRma8821" } },
      session,
      3,
      "lookup_return_by_label",
    )));
    expect(called.result).toMatchObject({
      isError: false,
      structuredContent: { returnRecord: { returnRecordId: "ret-jc-1042" } },
      resultType: "complete",
    });

    const inspection = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      fixtureId: "emptyReturn",
    }, session))).inspection;
    const draft = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: inspection.inspectionId,
      channel: "EMAIL",
    }, session))).draft;
    const reviewed = json(await invoke(modernMcpEvent(
      "tools/call",
      {
        name: "record_return_review",
        arguments: {
          inspectionId: inspection.inspectionId,
          draftId: draft.draftId,
          reviewerLabel: "MCP Demo Reviewer",
          draftDecision: "APPROVE_AS_WRITTEN",
          acknowledgedRecommendation: true,
          acknowledgedPolicy: true,
          acknowledgedEvidence: true,
          evidenceIds: inspection.evidenceIds,
        },
      },
      session,
      4,
      "record_return_review",
    )));
    expect(reviewed.result).toMatchObject({
      isError: false,
      structuredContent: {
        review: {
          draftId: draft.draftId,
          inspectionId: inspection.inspectionId,
          reviewerIdentityAssurance: "UNAUTHENTICATED_DISPLAY_LABEL",
        },
      },
    });

    const failed = json(await invoke(modernMcpEvent(
      "tools/call",
      {
        name: "draft_return_communication",
        arguments: { inspectionId: "inspection-does-not-exist", channel: "EMAIL" },
      },
      session,
      5,
      "draft_return_communication",
    )));
    expect(failed.result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "INSPECTION_NOT_FOUND" } },
      resultType: "complete",
    });
  });

  it("keeps the SDK's finite 2025-era stateless fallback and rejects session stream methods", async () => {
    const invoke = createHandler(new MemoryStore(), { resolveOpenAIKey: async () => undefined });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const initializeEvent = apiEvent("POST", "/mcp", {
      jsonrpc: "2.0",
      id: "legacy-init",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "legacy-test", version: "1.0.0" },
      },
    }, session);
    initializeEvent.headers.accept = "application/json, text/event-stream";
    const initialized = await invoke(initializeEvent);
    expect(initialized.statusCode).toBe(200);
    expect(initialized.headers?.["content-type"]).toBe("text/event-stream");
    expect(String(initialized.body)).toContain('"protocolVersion":"2025-06-18"');
    expect(String(initialized.body)).toContain('"name":"redo-return-integrity"');

    const getResult = await invoke(apiEvent("GET", "/mcp", undefined, session));
    expect(getResult.statusCode).toBe(405);
    expect(json(getResult)).toMatchObject({ error: { code: -32000, message: "Method not allowed." } });
  });

  it("keeps inspection drafts isolated to the anonymous demo session", async () => {
    const invoke = createHandler(new MemoryStore(), { resolveOpenAIKey: async () => undefined });
    const first = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const second = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const inspection = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      fixtureId: "emptyReturn",
    }, first))).inspection;
    const draft = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: inspection.inspectionId,
      channel: "EMAIL",
    }, first))).draft;
    const review = json(await invoke(apiEvent("POST", "/intake/reviews", {
      inspectionId: inspection.inspectionId,
      draftId: draft.draftId,
      reviewerLabel: "First-session reviewer",
      draftDecision: "APPROVE_AS_WRITTEN",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: inspection.evidenceIds,
    }, first))).review;
    const crossSessionQueue = await invoke(apiEvent("POST", "/intake/communications/queue", {
      draftId: draft.draftId,
      reviewId: review.reviewId,
    }, second));
    expect(crossSessionQueue.statusCode).toBe(404);
    expect(json(crossSessionQueue).error.code).toBe("DRAFT_NOT_FOUND");
  });

  it("accepts a completed-upload evidence ID as the sole label-lookup input", () => {
    expect(LabelLookupInputSchema.safeParse({ evidenceId: "ev-label-upload-1" }).success).toBe(true);
    expect(LabelLookupInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects completed evidence when its verified purpose does not match the operation", async () => {
    const store = new MemoryStore();
    const intakeStore = new MemoryReturnIntakeStore();
    const session = await store.createSession(new Date("2026-08-24T12:00:00.000Z"));
    const base = {
      sessionId: session.sessionId,
      objectKey: "ephemeral/test/evidence.png",
      versionId: "version-1",
      mimeType: "image/png" as const,
      sizeBytes: 8,
      sha256: "a".repeat(64),
      verifiedAt: "2026-08-24T12:00:00.000Z",
      expiresAt: "2027-08-24T12:00:00.000Z",
    };
    await intakeStore.putCompletedEvidence(session.sessionId, {
      ...base,
      evidenceId: "ev-purpose-label",
      purpose: "RETURN_LABEL",
    });
    await intakeStore.putCompletedEvidence(session.sessionId, {
      ...base,
      objectKey: "ephemeral/test/package.png",
      versionId: "version-2",
      evidenceId: "ev-purpose-package",
      purpose: "PACKAGE_CONTENTS",
    });
    const invoke = createHandler(store, { intakeStore, resolveOpenAIKey: async () => undefined });

    const labelAsPackage = await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      evidenceId: "ev-purpose-label",
    }, session.sessionId));
    expect(labelAsPackage.statusCode).toBe(403);
    expect(json(labelAsPackage).error.code).toBe("EVIDENCE_PURPOSE_MISMATCH");

    const packageAsLabel = await invoke(apiEvent("POST", "/intake/label-lookup", {
      evidenceId: "ev-purpose-package",
    }, session.sessionId));
    expect(packageAsLabel.statusCode).toBe(403);
    expect(json(packageAsLabel).error.code).toBe("EVIDENCE_PURPOSE_MISMATCH");
  });

  it("enforces complete evidence acknowledgment and exact review-to-draft binding before queue", async () => {
    const invoke = createHandler(new MemoryStore(), { resolveOpenAIKey: async () => undefined });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const firstInspection = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      fixtureId: "emptyReturn",
    }, session))).inspection;
    const firstDraft = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: firstInspection.inspectionId,
      channel: "EMAIL",
    }, session))).draft;

    const missingReview = await invoke(apiEvent("POST", "/intake/communications/queue", {
      draftId: firstDraft.draftId,
    }, session));
    expect(missingReview.statusCode).toBe(400);

    const incompleteEvidence = await invoke(apiEvent("POST", "/intake/reviews", {
      inspectionId: firstInspection.inspectionId,
      draftId: firstDraft.draftId,
      reviewerLabel: "Operator 1",
      draftDecision: "APPROVE_AS_WRITTEN",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: ["unrelated-evidence"],
    }, session));
    expect(incompleteEvidence.statusCode).toBe(409);
    expect(json(incompleteEvidence).error.code).toBe("REVIEW_EVIDENCE_MISMATCH");

    const review = json(await invoke(apiEvent("POST", "/intake/reviews", {
      inspectionId: firstInspection.inspectionId,
      draftId: firstDraft.draftId,
      reviewerLabel: "Operator 1",
      draftDecision: "APPROVE_AS_WRITTEN",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: firstInspection.evidenceIds,
    }, session))).review;
    const secondInspection = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      fixtureId: "wrongItem",
    }, session))).inspection;
    const secondDraft = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: secondInspection.inspectionId,
      channel: "EMAIL",
    }, session))).draft;

    const mismatched = await invoke(apiEvent("POST", "/intake/communications/queue", {
      draftId: secondDraft.draftId,
      reviewId: review.reviewId,
    }, session));
    expect(mismatched.statusCode).toBe(409);
    expect(json(mismatched).error.code).toBe("REVIEW_CONTEXT_MISMATCH");
  });

  it("charges model-backed intake branches without charging fixtures, direct lookup, review, or test queue", async () => {
    const acquireModelSlot = vi.fn(async () => ({ sessionCount: 1, dayCount: 1 }));
    const invoke = createHandler(new MemoryStore(), {
      resolveOpenAIKey: async () => undefined,
      acquireModelSlot,
      resolveEvidenceImage: async () => "data:image/png;base64,AAAA",
    });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;

    await invoke(apiEvent("POST", "/intake/label-lookup", { fixtureId: "labelRma8821" }, session));
    await invoke(apiEvent("POST", "/intake/label-lookup", { rmaId: "RMA-8821" }, session));
    const inspection = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      fixtureId: "matchReturn",
    }, session))).inspection;
    expect(acquireModelSlot).not.toHaveBeenCalled();

    const draft = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: inspection.inspectionId,
      channel: "EMAIL",
    }, session))).draft;
    expect(acquireModelSlot).toHaveBeenCalledTimes(1);

    await invoke(apiEvent("POST", "/intake/label-lookup", {
      evidenceId: "ev-label-model-quota",
    }, session));
    await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      evidenceId: "ev-package-model-quota",
    }, session));
    expect(acquireModelSlot).toHaveBeenCalledTimes(3);
    expect(acquireModelSlot).toHaveBeenNthCalledWith(1, session);

    const review = json(await invoke(apiEvent("POST", "/intake/reviews", {
      inspectionId: inspection.inspectionId,
      draftId: draft.draftId,
      reviewerLabel: "Quota test reviewer",
      draftDecision: "APPROVE_AS_WRITTEN",
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      evidenceIds: inspection.evidenceIds,
    }, session))).review;
    await invoke(apiEvent("POST", "/intake/communications/queue", {
      draftId: draft.draftId,
      reviewId: review.reviewId,
    }, session));
    expect(acquireModelSlot).toHaveBeenCalledTimes(3);
  });

  it("materializes fresh exact-version evidence URLs without persisting expiring signed URLs", async () => {
    const intakeStore = new MemoryReturnIntakeStore();
    const resolveEvidenceImage = vi.fn()
      .mockResolvedValueOnce("https://signed.example/evidence?versionId=immutable-v1&use=inspection")
      .mockResolvedValueOnce("https://signed.example/evidence?versionId=immutable-v1&use=draft");
    const invoke = createHandler(new MemoryStore(), {
      intakeStore,
      resolveEvidenceImage,
      resolveOpenAIKey: async () => undefined,
    });
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const inspectionResponse = json(await invoke(apiEvent("POST", "/intake/inspections", {
      returnRecordId: "ret-jc-1042",
      evidenceId: "ev-upload-package-v1",
    }, session))).inspection;
    expect(inspectionResponse.warehouseEvidenceImageUrl).toContain("use=inspection");

    const storedInspection = await intakeStore.getInspection(session, inspectionResponse.inspectionId);
    expect(storedInspection?.warehouseEvidenceImageUrl).toBeNull();
    expect(JSON.stringify(storedInspection)).not.toContain("signed.example");

    const draftResponse = json(await invoke(apiEvent("POST", "/intake/communications/draft", {
      inspectionId: inspectionResponse.inspectionId,
      channel: "EMAIL",
    }, session))).draft;
    expect(draftResponse.warehouseEvidenceImageUrl).toContain("use=draft");
    expect(resolveEvidenceImage).toHaveBeenCalledTimes(2);

    const storedDraft = await intakeStore.getDraft(session, draftResponse.draftId);
    expect(storedDraft?.warehouseEvidenceImageUrl).toBeNull();
    expect(storedDraft?.attachments.find((attachment) => attachment.role === "WAREHOUSE_EVIDENCE")?.sourceUrl)
      .toBe("evidence://ev-upload-package-v1");
    expect(JSON.stringify(storedDraft)).not.toContain("signed.example");
  });
});
