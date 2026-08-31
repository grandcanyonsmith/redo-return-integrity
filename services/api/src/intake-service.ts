import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  CallResolutionSchema,
  CommunicationDraftSchema,
  IntakeActionOptionIdSchema,
  IntakeActivityRecordSchema,
  IntakeCallRecordSchema,
  IntakeDispositionRecordSchema,
  IntakeDispositionSchema,
  LabelExtractionSchema,
  LabelLookupResultSchema,
  OperatorReviewRecordSchema,
  OperatorSettingsSchema,
  OperatorSettingsUpdateSchema,
  PackageInspectionSchema,
  RefundPortfolioQuerySchema,
  TestOutboxMessageSchema,
  buildRefundPortfolio,
  defaultOperatorSettings,
  deriveCallResolutionStatus,
  deriveDispositionRecommendation,
  deriveInspectionRecommendation,
  deriveIntakeActionOptions,
  deriveIntakeResolutionStatus,
  enforceInspectionFindingInvariants,
  fixtureInspectionFinding,
  fixtureLabelExtraction,
  simulatedCallScript,
  type CommunicationDraft,
  type InspectionNextAction,
  type IntakeActionOption,
  type IntakeActionOptionId,
  type IntakeActivityRecord,
  type IntakeCallRecord,
  type IntakeDispositionRecord,
  type LabelExtraction,
  type LabelLookupResult,
  type OperatorReviewRecord,
  type OperatorSettings,
  type PackageInspection,
  type RefundPortfolio,
  type SimulatedCallTurn,
  type TestOutboxMessage,
} from "@return-integrity/domain";
import {
  COMMUNICATION_PROMPT_VERSION,
  INSPECTION_PROMPT_VERSION,
  analyzeContentsWithOpenAI,
  draftCommunicationWithOpenAI,
  extractLabelWithOpenAI,
} from "./intake-openai.js";
import { buildRealtimeCallInstructions, mintRealtimeClientSecret } from "./intake-realtime.js";
import type { ReturnIntakeStore, ReturnLookupMatch } from "./intake-store.js";

export const LabelLookupInputSchema = z.object({
  evidenceId: z.string().min(1).max(200).optional(),
  fixtureId: z.literal("labelRma8821").optional(),
  scanValue: z.string().trim().min(1).max(120).optional(),
  labelId: z.string().min(1).max(120).optional(),
  trackingNumber: z.string().min(1).max(120).optional(),
  rmaId: z.string().min(1).max(120).optional(),
  orderId: z.string().min(1).max(120).optional(),
  carrier: z.string().min(1).max(120).optional(),
}).superRefine((input, context) => {
  const hasDirectIdentifier = Boolean(
    input.scanValue || input.labelId || input.trackingNumber || input.rmaId || input.orderId,
  );
  const sourceCount = [input.evidenceId, input.fixtureId, hasDirectIdentifier]
    .filter(Boolean).length;
  if (sourceCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one source: completed evidence, synthetic fixture, or direct identifiers.",
    });
  }
});
export type LabelLookupInput = z.infer<typeof LabelLookupInputSchema>;

export const packageFixtureIds = [
  "matchReturn",
  "emptyReturn",
  "quantityMismatch",
  "wrongItem",
  "damagedProduct",
  "possibleImitation",
] as const;

export const PackageInspectionInputSchema = z.object({
  returnRecordId: z.string().min(1).max(120),
  evidenceId: z.string().min(1).max(200).optional(),
  fixtureId: z.enum(packageFixtureIds).optional(),
  /** Content re-captures already taken; only guides the triage recommendation. */
  retakeCount: z.number().int().min(0).max(10).optional(),
}).refine((input) => [input.fixtureId, input.evidenceId].filter(Boolean).length === 1, {
  message: "Provide exactly one synthetic package fixture or completed-upload evidence ID.",
});
export type PackageInspectionInput = z.infer<typeof PackageInspectionInputSchema>;

export const DraftCommunicationInputSchema = z.object({
  inspectionId: z.string().min(1).max(120),
  channel: z.enum(["EMAIL", "SMS"]),
  actionOptionId: IntakeActionOptionIdSchema.optional(),
});
export type DraftCommunicationInput = z.infer<typeof DraftCommunicationInputSchema>;

export const RecordReturnReviewInputSchema = z.object({
  inspectionId: z.string().min(1).max(120),
  draftId: z.string().min(1).max(120),
  reviewerLabel: z.string().trim().min(2).max(120),
  draftDecision: z.literal("APPROVE_AS_WRITTEN"),
  acknowledgedRecommendation: z.literal(true),
  acknowledgedPolicy: z.literal(true),
  acknowledgedEvidence: z.literal(true),
  evidenceIds: z.array(z.string().min(1).max(200)).min(1).max(30),
});
export type RecordReturnReviewInput = z.infer<typeof RecordReturnReviewInputSchema>;

export const QueueCommunicationInputSchema = z.object({
  draftId: z.string().min(1).max(120),
  reviewId: z.string().min(1).max(120),
});
export type QueueCommunicationInput = z.infer<typeof QueueCommunicationInputSchema>;

export const RecordDispositionInputSchema = z.object({
  inspectionId: z.string().min(1).max(120),
  disposition: IntakeDispositionSchema,
  reason: z.string().trim().min(1).max(500).optional(),
  recordedBy: z.string().trim().min(2).max(120),
});
export type RecordDispositionInput = z.infer<typeof RecordDispositionInputSchema>;

export const RecordCallOutcomeInputSchema = z.object({
  returnRecordId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120),
  mode: z.enum(["OPENAI_REALTIME", "SIMULATED"]),
  startedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int().nonnegative().max(3_600),
  transcript: z.string().min(1).max(50_000),
  resolution: CallResolutionSchema,
  resolutionNote: z.string().trim().min(1).max(500).optional(),
  operatorLabel: z.string().trim().min(2).max(120),
});
export type RecordCallOutcomeInput = z.infer<typeof RecordCallOutcomeInputSchema>;

export const RealtimeCallSessionInputSchema = z.object({
  returnRecordId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120).optional(),
});
export type RealtimeCallSessionInput = z.infer<typeof RealtimeCallSessionInputSchema>;

export type RealtimeCallSessionResult =
  | {
      mode: "OPENAI_REALTIME";
      testMode: true;
      clientSecret: string;
      expiresAt: string | null;
      model: string;
      voice: string;
      instructions: string;
    }
  | {
      mode: "SIMULATED";
      testMode: true;
      reason: string;
      script: SimulatedCallTurn[];
      voice: string;
      instructions: string;
    };

const fixtureImageUrls: Readonly<Record<(typeof packageFixtureIds)[number], string>> = {
  matchReturn: "/evidence/return-matching-contents.png",
  emptyReturn: "/evidence/return-empty-box.png",
  quantityMismatch: "/evidence/return-quantity-mismatch.png",
  wrongItem: "/evidence/return-wrong-item.png",
  damagedProduct: "/evidence/return-damaged-product.png",
  possibleImitation: "/evidence/return-imitation.png",
};

const labelFixtureImageUrl = "/evidence/return-label-rma-8821.png";
const sha256Json = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value), "utf8")
  .digest("hex");

const communicationContentSha256 = (draft: Pick<
  CommunicationDraft,
  "channel" | "recipient" | "subject" | "body" | "attachments"
>): string => createHash("sha256")
  .update(JSON.stringify({
    channel: draft.channel,
    recipient: draft.recipient,
    subject: draft.subject,
    body: draft.body,
    attachments: draft.attachments.map(({ role, sourceUrl, evidenceId, provenance }) => ({
      role,
      sourceUrl,
      evidenceId,
      provenance,
    })),
  }), "utf8")
  .digest("hex");

export interface ReturnIntakeServiceOptions {
  store: ReturnIntakeStore;
  resolveApiKey?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  model?: string;
  publicBaseUrl?: string;
  now?: () => Date;
  resolveEvidenceImage?: (
    sessionId: string,
    evidenceId: string,
    expectedPurpose: "RETURN_LABEL" | "PACKAGE_CONTENTS",
  ) => Promise<string | undefined>;
  acquireModelSlot?: (sessionId: string) => Promise<unknown>;
}

export class ReturnIntakeService {
  private readonly store: ReturnIntakeStore;
  private readonly resolveApiKey: () => Promise<string | undefined>;
  private readonly fetchImpl?: typeof fetch;
  private readonly model?: string;
  private readonly publicBaseUrl?: string;
  private readonly now: () => Date;
  private readonly resolveEvidenceImage?: ReturnIntakeServiceOptions["resolveEvidenceImage"];
  private readonly acquireModelSlot: (sessionId: string) => Promise<unknown>;

  constructor(options: ReturnIntakeServiceOptions) {
    this.store = options.store;
    this.resolveApiKey = options.resolveApiKey ?? (async () => process.env.OPENAI_API_KEY);
    this.fetchImpl = options.fetchImpl;
    this.model = options.model;
    this.publicBaseUrl = options.publicBaseUrl;
    this.now = options.now ?? (() => new Date());
    this.resolveEvidenceImage = options.resolveEvidenceImage;
    this.acquireModelSlot = options.acquireModelSlot ?? (async () => undefined);
  }

  async lookupReturnByLabel(sessionId: string, rawInput: unknown): Promise<LabelLookupResult> {
    const input = LabelLookupInputSchema.parse(rawInput);
    const evidenceId = input.fixtureId
      ? `fixture:label:${input.fixtureId}`
      : input.evidenceId ?? `ev-label-${randomUUID()}`;
    let extraction: LabelExtraction;
    let mode: LabelLookupResult["mode"];
    const warnings: string[] = [];

    if (input.fixtureId) {
      extraction = fixtureLabelExtraction(input.fixtureId, evidenceId);
      mode = "SYNTHETIC_FIXTURE";
    } else if (input.scanValue || input.labelId || input.trackingNumber || input.rmaId || input.orderId) {
      const scanValue = input.scanValue?.trim();
      const scanLabelId = scanValue && /^LBL-/i.test(scanValue) ? scanValue : undefined;
      const scanRmaId = scanValue && /^RMA-/i.test(scanValue) ? scanValue : undefined;
      const scanOrderId = scanValue && /^JC-/i.test(scanValue) ? scanValue : undefined;
      const scanTrackingNumber = scanValue && !scanLabelId && !scanRmaId && !scanOrderId ? scanValue : undefined;
      extraction = LabelExtractionSchema.parse({
        labelId: input.labelId ?? scanLabelId ?? null,
        trackingNumber: input.trackingNumber ?? scanTrackingNumber ?? null,
        rmaId: input.rmaId ?? scanRmaId ?? null,
        orderId: input.orderId ?? scanOrderId ?? null,
        carrier: input.carrier ?? null,
        confidence: 1,
        evidenceIds: [evidenceId],
      });
      mode = "DIRECT_IDENTIFIERS";
    } else {
      const evidenceImage = input.evidenceId && this.resolveEvidenceImage
        ? await this.resolveEvidenceImage(sessionId, input.evidenceId, "RETURN_LABEL")
        : undefined;
      if (!evidenceImage) {
        extraction = LabelExtractionSchema.parse({
          labelId: null,
          trackingNumber: null,
          rmaId: null,
          orderId: null,
          carrier: null,
          confidence: 0,
          evidenceIds: [evidenceId],
        });
        mode = "SAFE_FALLBACK";
        warnings.push("The completed-upload evidence ID could not be resolved in this session.");
      } else {
        await this.acquireModelSlot(sessionId);
        const result = await extractLabelWithOpenAI({
          sessionId,
          imageUrl: evidenceImage,
          evidenceId,
          apiKey: await this.resolveApiKey(),
          fetchImpl: this.fetchImpl,
          model: this.model,
          publicBaseUrl: this.publicBaseUrl,
        });
        extraction = result.extraction;
        mode = result.mode;
        if (result.mode === "SAFE_FALLBACK") {
          warnings.push("The label model was unavailable or inconclusive; no return record was inferred from the image.");
        }
      }
    }

    let match: ReturnLookupMatch | undefined;
    if (extraction.confidence < 0.75) {
      mode = "SAFE_FALLBACK";
      warnings.push(
        `Label confidence ${extraction.confidence.toFixed(2)} is below the 0.75 lookup threshold; confirm an identifier manually.`,
      );
    } else {
      try {
        match = await this.store.lookupReturn(extraction);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "RETURN_IDENTIFIER_CONFLICT") throw error;
        mode = "SAFE_FALLBACK";
        warnings.push("Extracted label identifiers resolve to different return records; no record was selected.");
      }
      if (!match && mode !== "SAFE_FALLBACK") {
        warnings.push("No synthetic return record matched the extracted identifiers.");
      }
    }
    return LabelLookupResultSchema.parse({
      mode,
      extraction,
      returnRecord: match?.returnRecord ?? null,
      matchedBy: match?.matchedBy ?? null,
      warnings,
    });
  }

  async analyzeReturnContents(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ mode: PackageInspection["analysisMode"]; inspection: PackageInspection }> {
    const input = PackageInspectionInputSchema.parse(rawInput);
    const returnRecord = await this.store.getReturnRecord(input.returnRecordId);
    if (!returnRecord) throw new Error("RETURN_RECORD_NOT_FOUND");
    const evidenceId = input.fixtureId
      ? `fixture:package:${input.fixtureId}`
      : input.evidenceId ?? `ev-package-${randomUUID()}`;
    const fixtureUrl = input.fixtureId ? fixtureImageUrls[input.fixtureId] : undefined;
    const resolvedUploadUrl = !input.fixtureId && input.evidenceId && this.resolveEvidenceImage
      ? await this.resolveEvidenceImage(sessionId, input.evidenceId, "PACKAGE_CONTENTS")
      : undefined;
    const warehouseEvidenceImageUrl = fixtureUrl ?? resolvedUploadUrl;

    let finding;
    let analysisMode: PackageInspection["analysisMode"];
    let modelVersion: string;
    let modelAudit: PackageInspection["modelAudit"];
    if (input.fixtureId) {
      finding = fixtureInspectionFinding(
        input.fixtureId,
        returnRecord.product.quantity,
        evidenceId,
        returnRecord.product.serials,
      );
      analysisMode = "SYNTHETIC_FIXTURE";
      modelVersion = "synthetic-fixture-inspector-1.0";
      modelAudit = {
        provider: "SYNTHETIC_FIXTURE",
        requestedModel: modelVersion,
        providerModel: null,
        promptVersion: "synthetic-package-fixture-1.0",
        schemaName: "return_package_inspection",
        requestId: null,
        latencyMs: 0,
        inputSha256: sha256Json({ returnRecordId: returnRecord.returnRecordId, fixtureId: input.fixtureId, evidenceId }),
        outputSha256: sha256Json(finding),
        providerStorageRequested: false,
      };
    } else if (warehouseEvidenceImageUrl) {
      await this.acquireModelSlot(sessionId);
      const modelResult = await analyzeContentsWithOpenAI({
        sessionId,
        returnRecord,
        warehouseEvidenceImageUrl,
        evidenceId,
        apiKey: await this.resolveApiKey(),
        fetchImpl: this.fetchImpl,
        model: this.model,
        publicBaseUrl: this.publicBaseUrl,
      });
      finding = modelResult.finding;
      analysisMode = modelResult.mode;
      modelVersion = modelResult.modelVersion;
      modelAudit = {
        provider: modelResult.mode === "OPENAI" ? "OPENAI" : "SAFE_FALLBACK",
        requestedModel: modelResult.modelVersion,
        providerModel: modelResult.providerModel ?? null,
        promptVersion: INSPECTION_PROMPT_VERSION,
        schemaName: "return_package_inspection",
        requestId: modelResult.requestId ?? null,
        latencyMs: modelResult.latencyMs,
        inputSha256: modelResult.inputSha256,
        outputSha256: modelResult.outputSha256 ?? null,
        providerStorageRequested: false,
      };
    } else {
      finding = fixtureInspectionFinding(
        "unresolved-evidence",
        returnRecord.product.quantity,
        evidenceId,
        returnRecord.product.serials,
      );
      analysisMode = "SAFE_FALLBACK";
      modelVersion = this.model ?? process.env.OPENAI_PRIMARY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-terra";
      modelAudit = {
        provider: "SAFE_FALLBACK",
        requestedModel: modelVersion,
        providerModel: null,
        promptVersion: INSPECTION_PROMPT_VERSION,
        schemaName: "return_package_inspection",
        requestId: null,
        latencyMs: 0,
        inputSha256: sha256Json({ returnRecordId: returnRecord.returnRecordId, evidenceId, reason: "unresolved-evidence" }),
        outputSha256: sha256Json(finding),
        providerStorageRequested: false,
      };
    }

    // The service, not the model, binds every persisted inspection to the
    // concrete capture it analyzed so a later reviewer always has an auditable
    // evidence set to acknowledge.
    finding = {
      ...finding,
      evidenceIds: [...new Set([...finding.evidenceIds, evidenceId])],
    };

    const modelClassification = finding.classification;
    finding = enforceInspectionFindingInvariants({ returnRecord, finding });
    if (modelClassification !== "INCONCLUSIVE" && finding.classification === "INCONCLUSIVE") {
      analysisMode = "SAFE_FALLBACK";
    }

    if (finding.classification !== "INCONCLUSIVE" && finding.confidence < 0.65) {
      finding = {
        ...finding,
        classification: "INCONCLUSIVE" as const,
        summary: `Low-confidence visual result (${finding.confidence.toFixed(2)}): ${finding.summary}`,
        missingEvidence: [...new Set([...finding.missingEvidence, "Human protocol inspection due to low model confidence"])],
      };
      analysisMode = "SAFE_FALLBACK";
    }
    const recommendation = deriveInspectionRecommendation({ returnRecord, finding });
    const operatorSettings = (await this.store.getOperatorSettings(sessionId)) ?? defaultOperatorSettings();
    const dispositionRecommendation = deriveDispositionRecommendation({
      classification: finding.classification,
      confidence: finding.confidence,
      missingEvidence: finding.missingEvidence,
      settings: operatorSettings,
      retakeCount: input.retakeCount,
    });
    const inspection = PackageInspectionSchema.parse({
      ...finding,
      inspectionId: randomUUID(),
      returnRecordId: returnRecord.returnRecordId,
      createdAt: this.now().toISOString(),
      ...recommendation,
      dispositionRecommendation,
      // Persist only stable fixture references. Uploaded evidence is persisted
      // by evidence ID + immutable S3 version and materialized as a fresh URL
      // only for the current response/model call.
      warehouseEvidenceImageUrl: fixtureUrl ?? null,
      analysisMode,
      modelVersion,
      modelAudit,
    });
    await this.store.putInspection(sessionId, inspection);
    return {
      mode: analysisMode,
      inspection: PackageInspectionSchema.parse({
        ...inspection,
        warehouseEvidenceImageUrl: fixtureUrl ?? resolvedUploadUrl ?? null,
      }),
    };
  }

  async draftReturnCommunication(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ draft: CommunicationDraft }> {
    const input = DraftCommunicationInputSchema.parse(rawInput);
    const inspection = await this.store.getInspection(sessionId, input.inspectionId);
    if (!inspection) throw new Error("INSPECTION_NOT_FOUND");
    const returnRecord = await this.store.getReturnRecord(inspection.returnRecordId);
    if (!returnRecord) throw new Error("RETURN_RECORD_NOT_FOUND");
    if (!inspection.communication.recommended) throw new Error("COMMUNICATION_NOT_RECOMMENDED");
    if (input.channel === "SMS" && !returnRecord.customer.phone) throw new Error("RECIPIENT_NOT_AVAILABLE");

    // The intent must come from the server-derived option list for this
    // classification; a client cannot request an intent the policy layer
    // did not offer for this inspection.
    let chosenOption: IntakeActionOption | undefined;
    if (input.actionOptionId) {
      const offeredOptions = inspection.actionOptions
        ?? deriveIntakeActionOptions(inspection.classification);
      chosenOption = offeredOptions.find((option) => option.id === input.actionOptionId);
      if (!chosenOption) throw new Error("ACTION_OPTION_NOT_OFFERED");
    }

    const warehouseEvidenceId = inspection.evidenceIds[0];
    const freshWarehouseEvidenceImageUrl = inspection.warehouseEvidenceImageUrl
      ?? (warehouseEvidenceId && this.resolveEvidenceImage
        ? await this.resolveEvidenceImage(sessionId, warehouseEvidenceId, "PACKAGE_CONTENTS")
        : undefined);
    const inspectionForGeneration = freshWarehouseEvidenceImageUrl
      ? PackageInspectionSchema.parse({ ...inspection, warehouseEvidenceImageUrl: freshWarehouseEvidenceImageUrl })
      : inspection;

    await this.acquireModelSlot(sessionId);
    const copy = await draftCommunicationWithOpenAI({
      sessionId,
      returnRecord,
      inspection: inspectionForGeneration,
      channel: input.channel,
      templateIntent: chosenOption?.templateIntent,
      apiKey: await this.resolveApiKey(),
      fetchImpl: this.fetchImpl,
      model: this.model,
      publicBaseUrl: this.publicBaseUrl,
    });
    const attachments = [
      {
        role: "ORIGINAL_PRODUCT_REFERENCE" as const,
        sourceUrl: returnRecord.product.imageUrl,
        altText: `Catalog reference for ${returnRecord.product.title}`,
        provenance: "Merchant product catalog reference; not warehouse ground truth",
        evidenceId: null,
      },
      ...(inspection.warehouseEvidenceImageUrl || warehouseEvidenceId ? [{
        role: "WAREHOUSE_EVIDENCE" as const,
        sourceUrl: inspection.warehouseEvidenceImageUrl ?? `evidence://${warehouseEvidenceId}`,
        altText: `Warehouse intake evidence for ${returnRecord.rmaId}`,
        provenance: "Protocol-captured warehouse return evidence",
        evidenceId: warehouseEvidenceId ?? null,
      }] : []),
    ];
    const draftContent = {
      channel: input.channel,
      recipient: input.channel === "EMAIL" ? returnRecord.customer.email : returnRecord.customer.phone!,
      subject: copy.subject,
      body: copy.body,
      attachments,
    };
    const draftModelAudit: CommunicationDraft["modelAudit"] = {
      provider: copy.mode === "OPENAI" ? "OPENAI" : "SAFE_FALLBACK",
      requestedModel: copy.modelVersion,
      providerModel: copy.providerModel ?? null,
      promptVersion: COMMUNICATION_PROMPT_VERSION,
      schemaName: "return_communication_copy",
      requestId: copy.requestId ?? null,
      latencyMs: copy.latencyMs,
      inputSha256: copy.inputSha256,
      outputSha256: copy.outputSha256 ?? null,
      providerStorageRequested: false,
    };
    const draft = CommunicationDraftSchema.parse({
      draftId: randomUUID(),
      inspectionId: inspection.inspectionId,
      returnRecordId: returnRecord.returnRecordId,
      createdAt: this.now().toISOString(),
      ...(chosenOption ? {
        templateIntent: chosenOption.templateIntent,
        actionOptionId: chosenOption.id,
      } : {}),
      ...draftContent,
      originalProductImageUrl: returnRecord.product.imageUrl,
      // A short-lived signed URL is never written to DynamoDB.
      warehouseEvidenceImageUrl: inspection.warehouseEvidenceImageUrl,
      contentSha256: communicationContentSha256(draftContent),
      modelAudit: draftModelAudit,
      generationMode: copy.mode,
      requiresHumanApproval: true,
      deliveryStatus: "DRAFT_NOT_SENT",
    });
    await this.store.putDraft(sessionId, draft);
    const responseAttachments = draft.attachments.map((attachment) => (
      attachment.role === "WAREHOUSE_EVIDENCE" && freshWarehouseEvidenceImageUrl
        ? { ...attachment, sourceUrl: freshWarehouseEvidenceImageUrl }
        : attachment
    ));
    return {
      draft: CommunicationDraftSchema.parse({
        ...draft,
        warehouseEvidenceImageUrl: freshWarehouseEvidenceImageUrl ?? null,
        attachments: responseAttachments,
      }),
    };
  }

  async recordReturnReview(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ review: OperatorReviewRecord }> {
    const input = RecordReturnReviewInputSchema.parse(rawInput);
    const inspection = await this.store.getInspection(sessionId, input.inspectionId);
    if (!inspection) throw new Error("INSPECTION_NOT_FOUND");
    const draft = await this.store.getDraft(sessionId, input.draftId);
    if (!draft) throw new Error("DRAFT_NOT_FOUND");
    if (
      draft.inspectionId !== inspection.inspectionId
      || draft.returnRecordId !== inspection.returnRecordId
    ) {
      throw new Error("REVIEW_CONTEXT_MISMATCH");
    }

    const expectedEvidenceIds = [...new Set(inspection.evidenceIds)];
    const acknowledgedEvidenceIds = [...new Set(input.evidenceIds)];
    if (
      expectedEvidenceIds.length !== acknowledgedEvidenceIds.length
      || expectedEvidenceIds.some((evidenceId) => !acknowledgedEvidenceIds.includes(evidenceId))
    ) {
      throw new Error("REVIEW_EVIDENCE_MISMATCH");
    }

    const review = OperatorReviewRecordSchema.parse({
      reviewId: randomUUID(),
      inspectionId: inspection.inspectionId,
      draftId: draft.draftId,
      returnRecordId: inspection.returnRecordId,
      reviewerLabel: input.reviewerLabel,
      reviewerIdentityAssurance: "UNAUTHENTICATED_DISPLAY_LABEL",
      draftDecision: input.draftDecision,
      draftContentSha256: draft.contentSha256,
      acknowledgedRecommendation: input.acknowledgedRecommendation,
      acknowledgedPolicy: input.acknowledgedPolicy,
      acknowledgedEvidence: input.acknowledgedEvidence,
      reviewedAt: this.now().toISOString(),
      evidenceIds: expectedEvidenceIds,
    });
    await this.store.putReview(sessionId, review);
    return { review };
  }

  async queueTestCommunication(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ status: TestOutboxMessage["status"]; messageId: string; deliveryDisabled: true; message: TestOutboxMessage }> {
    const input = QueueCommunicationInputSchema.parse(rawInput);
    const draft = await this.store.getDraft(sessionId, input.draftId);
    if (!draft) throw new Error("DRAFT_NOT_FOUND");
    const review = await this.store.getReview(sessionId, input.reviewId);
    if (!review) throw new Error("REVIEW_NOT_FOUND");
    const inspection = await this.store.getInspection(sessionId, draft.inspectionId);
    if (!inspection) throw new Error("INSPECTION_NOT_FOUND");
    if (
      review.draftId !== draft.draftId
      || review.inspectionId !== draft.inspectionId
      || review.returnRecordId !== draft.returnRecordId
      || inspection.returnRecordId !== draft.returnRecordId
      || review.draftDecision !== "APPROVE_AS_WRITTEN"
      || review.draftContentSha256 !== draft.contentSha256
      || communicationContentSha256(draft) !== draft.contentSha256
    ) {
      throw new Error("REVIEW_CONTEXT_MISMATCH");
    }
    const message = TestOutboxMessageSchema.parse(await this.store.queueTestMessage(
      sessionId,
      draft,
      review,
      this.now(),
    ));

    const activity = await this.recordIntakeActivity(sessionId, draft, inspection, message);
    return {
      status: message.status,
      messageId: message.messageId,
      deliveryDisabled: true,
      message,
      ...(activity ? { activity } : {}),
    };
  }

  /**
   * Writes the session-scoped intake outcome that powers the workstation
   * activity feed and the post-intake resolution status. Keyed by draft ID so
   * queue retries stay idempotent.
   */
  private async recordIntakeActivity(
    sessionId: string,
    draft: CommunicationDraft,
    inspection: PackageInspection,
    message: TestOutboxMessage,
  ): Promise<IntakeActivityRecord | undefined> {
    const returnRecord = await this.store.getReturnRecord(draft.returnRecordId);
    if (!returnRecord) return undefined;
    const actionOptionId = draft.actionOptionId
      ?? fallbackActionOptionId(inspection.nextAction);
    const templateIntent = draft.templateIntent
      ?? (inspection.communication.templateIntent === "NONE"
        ? "REVIEW_HOLD"
        : inspection.communication.templateIntent);
    const operator = await this.store.getOperatorProfile(sessionId);
    const activity = IntakeActivityRecordSchema.parse({
      activityId: `act-${draft.draftId}`,
      sessionId,
      returnRecordId: returnRecord.returnRecordId,
      rmaId: returnRecord.rmaId,
      orderId: returnRecord.orderId,
      customerName: returnRecord.customer.name,
      productTitle: returnRecord.product.title,
      classification: inspection.classification,
      nextAction: inspection.nextAction,
      resolutionStatus: deriveIntakeResolutionStatus(actionOptionId),
      channel: draft.channel,
      templateIntent,
      ...(operator ? { handledBy: operator.displayName } : {}),
      inspectionId: inspection.inspectionId,
      messageId: message.messageId,
      recordedAt: this.now().toISOString(),
    });
    await this.store.putActivity(sessionId, activity);
    return activity;
  }

  async listIntakeActivity(sessionId: string): Promise<{ activity: IntakeActivityRecord[] }> {
    return { activity: await this.store.listActivity(sessionId) };
  }

  async listRefundPortfolio(sessionId: string, rawQuery: unknown = {}): Promise<RefundPortfolio> {
    const query = RefundPortfolioQuerySchema.parse(rawQuery ?? {});
    return buildRefundPortfolio({
      activity: await this.store.listActivity(sessionId),
      from: query.from,
      to: query.to,
    });
  }

  async getOperatorSettings(sessionId: string): Promise<{ settings: OperatorSettings }> {
    return { settings: (await this.store.getOperatorSettings(sessionId)) ?? defaultOperatorSettings() };
  }

  async updateOperatorSettings(sessionId: string, rawInput: unknown): Promise<{ settings: OperatorSettings }> {
    const patch = OperatorSettingsUpdateSchema.parse(rawInput);
    const current = (await this.store.getOperatorSettings(sessionId)) ?? defaultOperatorSettings();
    const settings = OperatorSettingsSchema.parse({
      ...current,
      ...patch,
      dispositionOverrides: { ...current.dispositionOverrides, ...(patch.dispositionOverrides ?? {}) },
      updatedAt: this.now().toISOString(),
    });
    await this.store.putOperatorSettings(sessionId, settings);
    return { settings };
  }

  /**
   * Persists the operator-confirmed post-photo triage decision. A SET_ASIDE
   * disposition also lands in the activity feed since it resolves the intake
   * without a queued message; PASS and TAKE_MORE_PHOTOS remain audit records
   * because the intake continues.
   */
  async recordIntakeDisposition(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ record: IntakeDispositionRecord; activity?: IntakeActivityRecord }> {
    const input = RecordDispositionInputSchema.parse(rawInput);
    const inspection = await this.store.getInspection(sessionId, input.inspectionId);
    if (!inspection) throw new Error("INSPECTION_NOT_FOUND");
    const returnRecord = await this.store.getReturnRecord(inspection.returnRecordId);
    if (!returnRecord) throw new Error("RETURN_RECORD_NOT_FOUND");
    const recommended = inspection.dispositionRecommendation ?? deriveDispositionRecommendation({
      classification: inspection.classification,
      confidence: inspection.confidence,
      missingEvidence: inspection.missingEvidence,
      settings: (await this.store.getOperatorSettings(sessionId)) ?? defaultOperatorSettings(),
    });
    const record = IntakeDispositionRecordSchema.parse({
      dispositionId: randomUUID(),
      sessionId,
      inspectionId: inspection.inspectionId,
      returnRecordId: inspection.returnRecordId,
      disposition: input.disposition,
      recommendedDisposition: recommended.disposition,
      followedRecommendation: input.disposition === recommended.disposition,
      reason: input.reason ?? recommended.reason,
      recordedBy: input.recordedBy,
      recordedAt: this.now().toISOString(),
    });
    await this.store.putDisposition(sessionId, record);
    if (input.disposition !== "SET_ASIDE") return { record };
    const activity = IntakeActivityRecordSchema.parse({
      activityId: `act-disposition-${record.dispositionId}`,
      kind: "DISPOSITION_RECORDED",
      sessionId,
      returnRecordId: returnRecord.returnRecordId,
      rmaId: returnRecord.rmaId,
      orderId: returnRecord.orderId,
      customerName: returnRecord.customer.name,
      productTitle: returnRecord.product.title,
      classification: inspection.classification,
      nextAction: inspection.nextAction,
      resolutionStatus: "SET_ASIDE",
      channel: "NONE",
      disposition: "SET_ASIDE",
      note: record.reason,
      handledBy: record.recordedBy,
      inspectionId: inspection.inspectionId,
      recordedAt: record.recordedAt,
    });
    await this.store.putActivity(sessionId, activity);
    return { record, activity };
  }

  /**
   * Persists the outcome of a completed test-mode customer call and its
   * activity entry. Stores a transcript digest plus a bounded preview only.
   */
  async recordCallOutcome(
    sessionId: string,
    rawInput: unknown,
  ): Promise<{ call: IntakeCallRecord; activity: IntakeActivityRecord }> {
    const input = RecordCallOutcomeInputSchema.parse(rawInput);
    const returnRecord = await this.store.getReturnRecord(input.returnRecordId);
    if (!returnRecord) throw new Error("RETURN_RECORD_NOT_FOUND");
    const inspection = await this.store.getInspection(sessionId, input.inspectionId);
    if (!inspection) throw new Error("INSPECTION_NOT_FOUND");
    if (inspection.returnRecordId !== returnRecord.returnRecordId) throw new Error("CALL_CONTEXT_MISMATCH");
    const endedAt = new Date(new Date(input.startedAt).getTime() + input.durationSeconds * 1_000).toISOString();
    const call = IntakeCallRecordSchema.parse({
      callId: randomUUID(),
      sessionId,
      returnRecordId: returnRecord.returnRecordId,
      inspectionId: inspection.inspectionId,
      mode: input.mode,
      testMode: true,
      startedAt: input.startedAt,
      endedAt,
      durationSeconds: input.durationSeconds,
      transcriptSha256: createHash("sha256").update(input.transcript, "utf8").digest("hex"),
      transcriptPreview: input.transcript.slice(0, 2_000),
      resolution: input.resolution,
      resolutionNote: input.resolutionNote ?? null,
      operatorLabel: input.operatorLabel,
    });
    await this.store.putCallRecord(sessionId, call);
    const activity = IntakeActivityRecordSchema.parse({
      activityId: `act-call-${call.callId}`,
      kind: "CALL_COMPLETED",
      sessionId,
      returnRecordId: returnRecord.returnRecordId,
      rmaId: returnRecord.rmaId,
      orderId: returnRecord.orderId,
      customerName: returnRecord.customer.name,
      productTitle: returnRecord.product.title,
      classification: inspection.classification,
      nextAction: inspection.nextAction,
      resolutionStatus: deriveCallResolutionStatus(input.resolution),
      channel: "VOICE",
      note: input.resolutionNote ?? `Call outcome: ${input.resolution.replaceAll("_", " ").toLowerCase()}`,
      handledBy: input.operatorLabel,
      inspectionId: inspection.inspectionId,
      recordedAt: endedAt,
    });
    await this.store.putActivity(sessionId, activity);
    return { call, activity };
  }

  /**
   * Prepares a test-mode customer resolution call. With an OpenAI key this
   * mints a short-lived Realtime client secret so the browser can open its
   * own WebSocket to the Realtime API; without one it returns the
   * deterministic scripted call. Real telephony is never used.
   */
  async createRealtimeCallSession(sessionId: string, rawInput: unknown): Promise<RealtimeCallSessionResult> {
    const input = RealtimeCallSessionInputSchema.parse(rawInput);
    const returnRecord = await this.store.getReturnRecord(input.returnRecordId);
    if (!returnRecord) throw new Error("RETURN_RECORD_NOT_FOUND");
    const inspection = input.inspectionId
      ? await this.store.getInspection(sessionId, input.inspectionId)
      : undefined;
    if (input.inspectionId && !inspection) throw new Error("INSPECTION_NOT_FOUND");
    const settings = (await this.store.getOperatorSettings(sessionId)) ?? defaultOperatorSettings();
    if (!settings.voiceCallsEnabled) throw new Error("VOICE_CALLS_DISABLED");
    const instructions = buildRealtimeCallInstructions(returnRecord, inspection, settings);
    const simulated = (reason: string): RealtimeCallSessionResult => ({
      mode: "SIMULATED",
      testMode: true,
      reason,
      script: simulatedCallScript({
        classification: inspection?.classification ?? "INCONCLUSIVE",
        customerName: returnRecord.customer.name,
        productTitle: returnRecord.product.title,
        rmaId: returnRecord.rmaId,
        recommendedAmountCents: inspection?.refund.recommendedAmountCents ?? null,
      }),
      voice: settings.voice,
      instructions,
    });
    const apiKey = await this.resolveApiKey();
    if (!apiKey) return simulated("No OpenAI API key is configured; using the deterministic scripted call.");
    await this.acquireModelSlot(sessionId);
    try {
      const minted = await mintRealtimeClientSecret({
        apiKey,
        sessionId,
        instructions,
        voice: settings.voice,
        fetchImpl: this.fetchImpl,
      });
      return {
        mode: "OPENAI_REALTIME",
        testMode: true,
        clientSecret: minted.clientSecret,
        expiresAt: minted.expiresAt,
        model: minted.model,
        voice: settings.voice,
        instructions,
      };
    } catch {
      return simulated("The Realtime session could not be created; using the deterministic scripted call.");
    }
  }
}

/** Legacy drafts predate operator-chosen action options; map the inspection's
 * own recommendation to the equivalent option for status derivation. */
const fallbackActionOptionId = (nextAction: InspectionNextAction): IntakeActionOptionId => {
  switch (nextAction) {
    case "APPROVE_FULL":
      return "APPROVE_FULL_REFUND";
    case "APPROVE_PARTIAL":
      return "APPROVE_PARTIAL_REFUND";
    case "HOLD_FOR_REVIEW":
      return "HOLD_FOR_SUPERVISOR_REVIEW";
    case "REQUEST_MORE_EVIDENCE":
      return "EMAIL_EVIDENCE_REQUEST";
    case "ROUTE_AUTHENTICATION":
      return "ROUTE_TO_AUTHENTICATION";
    default: {
      const exhausted: never = nextAction;
      throw new Error(`Unhandled inspection next action: ${String(exhausted)}`);
    }
  }
};

export const returnIntakeMcpTools = [
  {
    name: "lookup_return_by_label",
    description: "Extract privacy-minimized routing identifiers from a return-label image and look up the matching return record.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        evidenceId: { type: "string" },
        fixtureId: { type: "string", enum: ["labelRma8821"] },
        imageDataUrl: { type: "string" },
        scanValue: { type: "string" },
        labelId: { type: "string" },
        trackingNumber: { type: "string" },
        rmaId: { type: "string" },
        orderId: { type: "string" },
        carrier: { type: "string" },
      },
    },
  },
  {
    name: "analyze_return_contents",
    description: "Compare warehouse package evidence with the authorized SKU and quantity, then compute a bounded human-review refund recommendation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["returnRecordId"],
      properties: {
        returnRecordId: { type: "string" },
        evidenceId: { type: "string" },
        fixtureId: { type: "string", enum: [...packageFixtureIds] },
        imageDataUrl: { type: "string" },
      },
    },
  },
  {
    name: "draft_return_communication",
    description: "Draft neutral shopper email or SMS copy with a catalog-reference and warehouse-evidence manifest. Does not send it. Optionally targets one of the server-derived action options from the inspection (e.g. return-label offer, ship-item-back request).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["inspectionId", "channel"],
      properties: {
        inspectionId: { type: "string" },
        channel: { type: "string", enum: ["EMAIL", "SMS"] },
        actionOptionId: {
          type: "string",
          description: "One of the inspection's server-derived actionOptions ids; sets the drafted message's template intent.",
        },
      },
    },
  },
  {
    name: "record_return_review",
    description: "Persist an unauthenticated demo operator display label and explicit acknowledgment of the recommendation, policy, and complete inspection evidence set. Does not establish operator identity or send a message.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "inspectionId",
        "draftId",
        "reviewerLabel",
        "acknowledgedRecommendation",
        "acknowledgedPolicy",
        "acknowledgedEvidence",
        "evidenceIds",
      ],
      properties: {
        inspectionId: { type: "string" },
        draftId: { type: "string" },
        reviewerLabel: { type: "string", description: "Unauthenticated display label only; not a verified operator identity." },
        acknowledgedRecommendation: { type: "boolean", const: true },
        acknowledgedPolicy: { type: "boolean", const: true },
        acknowledgedEvidence: { type: "boolean", const: true },
        evidenceIds: { type: "array", minItems: 1, maxItems: 30, items: { type: "string" } },
      },
    },
  },
  {
    name: "queue_test_communication",
    description: "Queue a human-reviewed draft in the delivery-disabled synthetic outbox and record the session intake activity/resolution status. The review must be session-scoped and bound to this exact draft and inspection. This tool never sends email or SMS.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["draftId", "reviewId"],
      properties: {
        draftId: { type: "string" },
        reviewId: { type: "string" },
      },
    },
  },
  {
    name: "list_intake_activity",
    description: "List this session's completed intake activity records (newest first): matched return, classification, chosen action, resolution status, and queued message reference. Starts empty for a fresh session.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "list_refund_portfolio",
    description: "List the seeded warehouse refund book for the station dashboard and board, overlaid with this session's live intake activity. Optional from/to calendar days (UTC, inclusive) filter last activity.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", description: "Inclusive start calendar day YYYY-MM-DD (UTC)." },
        to: { type: "string", description: "Inclusive end calendar day YYYY-MM-DD (UTC)." },
      },
    },
  },
  {
    name: "record_intake_disposition",
    description: "Persist the operator-confirmed post-photo triage decision (pass, take more photos, or set aside) against a session inspection. SET_ASIDE also records a resolution activity entry.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["inspectionId", "disposition", "recordedBy"],
      properties: {
        inspectionId: { type: "string" },
        disposition: { type: "string", enum: ["PASS", "TAKE_MORE_PHOTOS", "SET_ASIDE"] },
        reason: { type: "string" },
        recordedBy: { type: "string", description: "Unauthenticated display label only." },
      },
    },
  },
  {
    name: "record_call_outcome",
    description: "Persist the outcome of a completed test-mode customer resolution call (OpenAI Realtime or simulated): transcript digest, duration, chosen resolution, and the resulting activity/status entry. No real telephone call is placed by this system.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["returnRecordId", "inspectionId", "mode", "startedAt", "durationSeconds", "transcript", "resolution", "operatorLabel"],
      properties: {
        returnRecordId: { type: "string" },
        inspectionId: { type: "string" },
        mode: { type: "string", enum: ["OPENAI_REALTIME", "SIMULATED"] },
        startedAt: { type: "string" },
        durationSeconds: { type: "number" },
        transcript: { type: "string" },
        resolution: { type: "string", enum: ["RESOLVED_REFUND_CONFIRMED", "CUSTOMER_WILL_SHIP_ITEM_BACK", "FOLLOW_UP_EMAIL_NEEDED", "NO_RESOLUTION_ESCALATE"] },
        resolutionNote: { type: "string" },
        operatorLabel: { type: "string", description: "Unauthenticated display label only." },
      },
    },
  },
] as const;

export type ReturnIntakeMcpToolName = (typeof returnIntakeMcpTools)[number]["name"];

export const callReturnIntakeMcpTool = async (
  service: ReturnIntakeService,
  sessionId: string,
  name: ReturnIntakeMcpToolName,
  args: unknown,
): Promise<unknown> => {
  switch (name) {
    case "lookup_return_by_label":
      return service.lookupReturnByLabel(sessionId, args);
    case "analyze_return_contents":
      return service.analyzeReturnContents(sessionId, args);
    case "draft_return_communication":
      return service.draftReturnCommunication(sessionId, args);
    case "record_return_review":
      return service.recordReturnReview(sessionId, args);
    case "queue_test_communication":
      return service.queueTestCommunication(sessionId, args);
    case "list_intake_activity":
      return service.listIntakeActivity(sessionId);
    case "list_refund_portfolio":
      return service.listRefundPortfolio(sessionId, args);
    case "record_intake_disposition":
      return service.recordIntakeDisposition(sessionId, args);
    case "record_call_outcome":
      return service.recordCallOutcome(sessionId, args);
    default: {
      const exhausted: never = name;
      throw new Error(`Unhandled intake MCP tool: ${String(exhausted)}`);
    }
  }
};
