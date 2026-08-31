import { z } from "zod";

import { decoyGarment, fitsEverybodyCamiBodysuit } from "./merchant-catalog.js";

const nullableIdentifier = z.string().trim().min(1).max(120).nullable();
const nullableImageUrl = z.string().min(1).max(7_500_000).nullable();

export const ReturnCustomerSchema = z.object({
  customerId: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  phone: z.string().min(7).max(40).nullable(),
});
export type ReturnCustomer = z.infer<typeof ReturnCustomerSchema>;

export const ReturnProductSchema = z.object({
  sku: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  quantity: z.number().int().positive().max(1_000),
  unitPriceCents: z.number().int().nonnegative(),
  totalEligibleRefundCents: z.number().int().nonnegative(),
  imageUrl: z.string().min(1).max(2_000),
  serials: z.array(z.string().min(1).max(200)).max(100),
  attributes: z.record(z.string(), z.string().max(500)),
});
export type ReturnProduct = z.infer<typeof ReturnProductSchema>;

export const ReturnRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  requestedRefundCents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  policyId: z.string().min(1).max(120),
  policyVersion: z.string().min(1).max(100),
  policySnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["AUTHORIZED", "IN_TRANSIT", "RECEIVED", "INSPECTION_PENDING", "REVIEW", "RESOLVED"]),
});
export type ReturnRequest = z.infer<typeof ReturnRequestSchema>;

export const ReturnRecordSchema = z.object({
  returnRecordId: z.string().min(1).max(120),
  merchantId: z.string().min(1).max(120),
  merchantName: z.string().min(1).max(200),
  labelId: z.string().min(1).max(120),
  rmaId: z.string().min(1).max(120),
  orderId: z.string().min(1).max(120),
  trackingNumber: z.string().min(1).max(120),
  carrier: z.string().min(1).max(120),
  customer: ReturnCustomerSchema,
  product: ReturnProductSchema,
  return: ReturnRequestSchema,
});
export type ReturnRecord = z.infer<typeof ReturnRecordSchema>;

export const LabelExtractionSchema = z.object({
  labelId: nullableIdentifier,
  trackingNumber: nullableIdentifier,
  rmaId: nullableIdentifier,
  orderId: nullableIdentifier,
  carrier: nullableIdentifier,
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string().min(1).max(200)).length(1),
});
export type LabelExtraction = z.infer<typeof LabelExtractionSchema>;

export const LabelLookupModeSchema = z.enum([
  "OPENAI",
  "SYNTHETIC_FIXTURE",
  "DIRECT_IDENTIFIERS",
  "SAFE_FALLBACK",
]);
export type LabelLookupMode = z.infer<typeof LabelLookupModeSchema>;

export const LabelLookupResultSchema = z.object({
  mode: LabelLookupModeSchema,
  extraction: LabelExtractionSchema,
  returnRecord: ReturnRecordSchema.nullable(),
  matchedBy: z.enum(["LABEL", "RMA", "ORDER", "TRACKING"]).nullable(),
  warnings: z.array(z.string().min(1).max(500)).max(20),
});
export type LabelLookupResult = z.infer<typeof LabelLookupResultSchema>;

export const inspectionClassifications = [
  "MATCH",
  "EMPTY_BOX",
  "DAMAGED_PRODUCT",
  "QUANTITY_MISMATCH",
  "WRONG_PRODUCT",
  "POSSIBLE_IMITATION",
  /**
   * Garment shows wear against a policy that requires new, unworn, unwashed
   * condition with tags and hygiene liners attached. Condition grading stays a
   * human decision; the model only reports the visible wear signals.
   */
  "WARDROBING",
  "INCONCLUSIVE",
] as const;
export const InspectionClassificationSchema = z.enum(inspectionClassifications);
export type InspectionClassification = z.infer<typeof InspectionClassificationSchema>;

export const ObservedItemSchema = z.object({
  description: z.string().min(1).max(500),
  candidateSku: nullableIdentifier,
  quantity: z.number().int().nonnegative().max(1_000),
  condition: z.enum(["NEW", "OPEN_BOX", "USED", "DAMAGED", "UNKNOWN"]),
  serials: z.array(z.string().min(1).max(200)).max(100),
  evidenceIds: z.array(z.string().min(1).max(200)).max(20),
});
export type ObservedItem = z.infer<typeof ObservedItemSchema>;

export const InspectionComparisonSchema = z.object({
  skuMatch: z.boolean().nullable(),
  quantityMatch: z.boolean().nullable(),
  serialMatch: z.boolean().nullable(),
  damageObserved: z.boolean().nullable(),
  expectedQuantity: z.number().int().positive().max(1_000),
  observedQuantity: z.number().int().nonnegative().max(1_000).nullable(),
});
export type InspectionComparison = z.infer<typeof InspectionComparisonSchema>;

export const InspectionModelFindingSchema = z.object({
  classification: InspectionClassificationSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(1_500),
  observedItems: z.array(ObservedItemSchema).max(50),
  comparison: InspectionComparisonSchema,
  missingEvidence: z.array(z.string().min(1).max(500)).max(30),
  evidenceIds: z.array(z.string().min(1).max(200)).max(30),
});
export type InspectionModelFinding = z.infer<typeof InspectionModelFindingSchema>;

export const InspectionNextActionSchema = z.enum([
  "APPROVE_FULL",
  "APPROVE_PARTIAL",
  "HOLD_FOR_REVIEW",
  "REQUEST_MORE_EVIDENCE",
  "ROUTE_AUTHENTICATION",
]);
export type InspectionNextAction = z.infer<typeof InspectionNextActionSchema>;

export const RefundRecommendationSchema = z.object({
  recommendedType: z.enum(["FULL", "PARTIAL", "TEMPORARY_HOLD", "NO_RECOMMENDATION"]),
  recommendedAmountCents: z.number().int().nonnegative().nullable(),
  withholdAmountCents: z.number().int().nonnegative().nullable(),
  rationale: z.string().min(1).max(1_500),
  requiresHumanApproval: z.boolean(),
});
export type RefundRecommendation = z.infer<typeof RefundRecommendationSchema>;

export const communicationTemplateIntents = [
  "APPROVAL",
  "PARTIAL_REFUND_EXPLANATION",
  "EVIDENCE_REQUEST",
  "REVIEW_HOLD",
  "APPEAL_NOTICE",
  "RETURN_LABEL_OFFER",
  "SHIP_ITEM_BACK_REQUEST",
] as const;
export const DraftableTemplateIntentSchema = z.enum(communicationTemplateIntents);
export type DraftableTemplateIntent = z.infer<typeof DraftableTemplateIntentSchema>;
export const CommunicationTemplateIntentSchema = z.enum([...communicationTemplateIntents, "NONE"]);
export type CommunicationTemplateIntent = z.infer<typeof CommunicationTemplateIntentSchema>;

/**
 * Placeholder token inserted into RETURN_LABEL_OFFER drafts. The server never
 * generates a live URL: the token is materialized by the delivery layer only
 * after the customer-facing claim form exists for the merchant.
 */
export const CLAIM_FORM_LINK_TOKEN = "{{CLAIM_FORM_LINK}}";

export const CommunicationRecommendationSchema = z.object({
  recommended: z.boolean(),
  channel: z.enum(["EMAIL", "SMS", "NONE"]),
  templateIntent: CommunicationTemplateIntentSchema,
});
export type CommunicationRecommendation = z.infer<typeof CommunicationRecommendationSchema>;

export const intakeActionOptionIds = [
  "APPROVE_FULL_REFUND",
  "APPROVE_PARTIAL_REFUND",
  "TEXT_CUSTOMER_FOR_CLARITY",
  "EMAIL_EVIDENCE_REQUEST",
  "REQUEST_ITEM_SHIPPED_BACK",
  "OFFER_NEW_RETURN_LABEL",
  "HOLD_FOR_SUPERVISOR_REVIEW",
  "ROUTE_TO_AUTHENTICATION",
] as const;
export const IntakeActionOptionIdSchema = z.enum(intakeActionOptionIds);
export type IntakeActionOptionId = z.infer<typeof IntakeActionOptionIdSchema>;

export const IntakeActionOptionSchema = z.object({
  id: IntakeActionOptionIdSchema,
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  channel: z.enum(["EMAIL", "SMS"]),
  templateIntent: DraftableTemplateIntentSchema,
  recommended: z.boolean(),
});
export type IntakeActionOption = z.infer<typeof IntakeActionOptionSchema>;

export const intakeResolutionStatuses = [
  "REFUND_APPROVAL_PENDING",
  "PARTIAL_REFUND_PENDING",
  "ON_HOLD_REVIEW",
  "AWAITING_CUSTOMER",
  "AUTHENTICATION_REVIEW",
  "SET_ASIDE",
  "CALL_RESOLVED",
] as const;
export const IntakeResolutionStatusSchema = z.enum(intakeResolutionStatuses);
export type IntakeResolutionStatus = z.infer<typeof IntakeResolutionStatusSchema>;

export const intakeDispositions = ["PASS", "TAKE_MORE_PHOTOS", "SET_ASIDE"] as const;
export const IntakeDispositionSchema = z.enum(intakeDispositions);
export type IntakeDisposition = z.infer<typeof IntakeDispositionSchema>;

export const dispositionPreferences = [
  "AI_RECOMMEND",
  "FORCE_PASS",
  "FORCE_MORE_PHOTOS",
  "FORCE_SET_ASIDE",
] as const;
export const DispositionPreferenceSchema = z.enum(dispositionPreferences);
export type DispositionPreference = z.infer<typeof DispositionPreferenceSchema>;

const dispositionPreference = DispositionPreferenceSchema.default("AI_RECOMMEND");
export const DispositionOverridesSchema = z.object({
  MATCH: dispositionPreference,
  EMPTY_BOX: dispositionPreference,
  DAMAGED_PRODUCT: dispositionPreference,
  QUANTITY_MISMATCH: dispositionPreference,
  WRONG_PRODUCT: dispositionPreference,
  POSSIBLE_IMITATION: dispositionPreference,
  WARDROBING: dispositionPreference,
  INCONCLUSIVE: dispositionPreference,
});
export type DispositionOverrides = z.infer<typeof DispositionOverridesSchema>;

export const realtimeCallVoices = ["marin", "cedar", "alloy"] as const;

/**
 * Station preferences for how the workstation handles each post-photo
 * situation. Session-scoped like every other intake record; server-side
 * disposition derivation reads these so the recommendation, not just the UI,
 * honors the operator's configuration.
 */
export const OperatorSettingsSchema = z.object({
  passConfidenceThreshold: z.number().min(0.5).max(0.99).default(0.8),
  maxPhotoRetakes: z.number().int().min(1).max(5).default(2),
  defaultChannel: z.enum(["EMAIL", "SMS"]).default("EMAIL"),
  voiceCallsEnabled: z.boolean().default(true),
  voice: z.enum(realtimeCallVoices).default("marin"),
  suggestCallOnSetAside: z.boolean().default(true),
  dispositionOverrides: DispositionOverridesSchema.prefault({}),
  updatedAt: z.string().datetime({ offset: true }).nullable().default(null),
});
export type OperatorSettings = z.infer<typeof OperatorSettingsSchema>;
export const defaultOperatorSettings = (): OperatorSettings => OperatorSettingsSchema.parse({});

/** Client-submitted partial settings update; merged over the stored profile. */
export const OperatorSettingsUpdateSchema = z.object({
  passConfidenceThreshold: z.number().min(0.5).max(0.99).optional(),
  maxPhotoRetakes: z.number().int().min(1).max(5).optional(),
  defaultChannel: z.enum(["EMAIL", "SMS"]).optional(),
  voiceCallsEnabled: z.boolean().optional(),
  voice: z.enum(realtimeCallVoices).optional(),
  suggestCallOnSetAside: z.boolean().optional(),
  dispositionOverrides: DispositionOverridesSchema.partial().optional(),
});
export type OperatorSettingsUpdate = z.infer<typeof OperatorSettingsUpdateSchema>;

export const DispositionRecommendationSchema = z.object({
  disposition: IntakeDispositionSchema,
  reason: z.string().min(1).max(500),
  photoInstructions: z.array(z.string().min(1).max(300)).max(8),
  source: z.enum(["AI_RECOMMEND", "OPERATOR_SETTING"]),
});
export type DispositionRecommendation = z.infer<typeof DispositionRecommendationSchema>;

const dispositionPhotoInstructions: Readonly<Record<InspectionClassification, readonly string[]>> = {
  MATCH: ["One overhead shot with every unit visible", "Close-up of each serial label"],
  EMPTY_BOX: ["Overhead shot of the empty box interior", "All packaging material laid out beside the box"],
  QUANTITY_MISMATCH: ["Line up every returned unit side by side", "Close-up of each readable serial label"],
  WRONG_PRODUCT: ["Close-up of the received item's model and serial markings", "Received item next to the shipping label"],
  DAMAGED_PRODUCT: ["Close-up of the damaged area", "Second angle showing the full unit", "Interior padding and packaging condition"],
  POSSIBLE_IMITATION: ["Macro shot of the care and size labels", "Neckline binding and seam stitching close-up", "Full garment beside the catalog reference"],
  WARDROBING: ["Close-up of the hangtag and hygiene liner attachment points", "Any staining, marking, or discoloration", "Underarm and seam areas showing wear or pilling"],
  INCONCLUSIVE: ["Move every item out of the box and lay them flat", "One overhead shot with all contents visible", "Avoid glare and shadows on labels"],
};

const forcedDisposition = (preference: Exclude<DispositionPreference, "AI_RECOMMEND">): IntakeDisposition => {
  switch (preference) {
    case "FORCE_PASS":
      return "PASS";
    case "FORCE_MORE_PHOTOS":
      return "TAKE_MORE_PHOTOS";
    case "FORCE_SET_ASIDE":
      return "SET_ASIDE";
    default: {
      const exhausted: never = preference;
      throw new Error(`Unhandled disposition preference: ${String(exhausted)}`);
    }
  }
};

export interface DispositionDerivationInput {
  classification: InspectionClassification;
  confidence: number;
  missingEvidence: readonly string[];
  settings?: OperatorSettings;
  /** Content captures already re-taken for this return (0 on the first shot). */
  retakeCount?: number;
}

/**
 * Derives the post-photo triage recommendation (pass / take more photos /
 * set aside) from the vision classification, confidence, and the station's
 * operator settings. Purely advisory: the operator confirms the disposition.
 */
export const deriveDispositionRecommendation = (input: DispositionDerivationInput): DispositionRecommendation => {
  const settings = input.settings ?? defaultOperatorSettings();
  const retakeCount = input.retakeCount ?? 0;
  const instructionsFor = (classification: InspectionClassification): string[] => [...new Set([
    ...input.missingEvidence.filter((entry) => /photo|image|capture|angle|view|shot|visible/i.test(entry)),
    ...dispositionPhotoInstructions[classification],
  ])].slice(0, 8);

  const preference = settings.dispositionOverrides[input.classification];
  if (preference !== "AI_RECOMMEND") {
    const disposition = forcedDisposition(preference);
    return DispositionRecommendationSchema.parse({
      disposition,
      reason: `Station settings force "${disposition.replaceAll("_", " ").toLowerCase()}" for ${input.classification.replaceAll("_", " ").toLowerCase()} results.`,
      photoInstructions: disposition === "TAKE_MORE_PHOTOS" ? instructionsFor(input.classification) : [],
      source: "OPERATOR_SETTING",
    });
  }

  const retakesExhausted = retakeCount >= settings.maxPhotoRetakes;
  const moreOrSetAside = (moreReason: string): DispositionRecommendation => DispositionRecommendationSchema.parse(
    retakesExhausted
      ? {
          disposition: "SET_ASIDE",
          reason: `Photo retake limit (${settings.maxPhotoRetakes}) reached without a conclusive capture. Set the box aside for further processing.`,
          photoInstructions: [],
          source: "AI_RECOMMEND",
        }
      : {
          disposition: "TAKE_MORE_PHOTOS",
          reason: moreReason,
          photoInstructions: instructionsFor(input.classification),
          source: "AI_RECOMMEND",
        },
  );
  const setAside = (reason: string): DispositionRecommendation => DispositionRecommendationSchema.parse({
    disposition: "SET_ASIDE",
    reason,
    photoInstructions: [],
    source: "AI_RECOMMEND",
  });
  const confidencePercent = `${Math.round(input.confidence * 100)}%`;
  const thresholdPercent = `${Math.round(settings.passConfidenceThreshold * 100)}%`;

  switch (input.classification) {
    case "MATCH":
    case "QUANTITY_MISMATCH":
      if (input.confidence >= settings.passConfidenceThreshold) {
        return DispositionRecommendationSchema.parse({
          disposition: "PASS",
          reason: `Label, product, and contents photos corroborate ${input.classification.replaceAll("_", " ").toLowerCase()} at ${confidencePercent} confidence. Proceed to the action list.`,
          photoInstructions: [],
          source: "AI_RECOMMEND",
        });
      }
      return moreOrSetAside(`Confidence ${confidencePercent} is below the station pass threshold (${thresholdPercent}). Capture the shots below to confirm.`);
    case "DAMAGED_PRODUCT":
      return moreOrSetAside("Damage needs documented close-ups before a condition grade. Capture the shots below.");
    case "INCONCLUSIVE":
      return moreOrSetAside("The capture does not show the contents clearly enough to classify. Capture the shots below.");
    case "EMPTY_BOX":
      return setAside("No merchandise is visible. Set the box aside for weight verification and supervisor processing.");
    case "WRONG_PRODUCT":
      return setAside("The visible item does not match the authorized SKU. Set the box aside for further processing.");
    case "POSSIBLE_IMITATION":
      return setAside("Authenticity cannot be established from photos. Set the item aside for qualified authentication.");
    case "WARDROBING":
      return setAside("The garment shows wear against a policy that requires new, unworn condition with tags and liners attached. Set it aside for a human condition grade.");
    default: {
      const exhausted: never = input.classification;
      throw new Error(`Unhandled classification: ${String(exhausted)}`);
    }
  }
};

export const IntakeModelAuditSchema = z.object({
  provider: z.enum(["OPENAI", "SYNTHETIC_FIXTURE", "SAFE_FALLBACK"]),
  requestedModel: z.string().min(1).max(200),
  providerModel: z.string().min(1).max(200).nullable(),
  promptVersion: z.string().min(1).max(200),
  schemaName: z.string().min(1).max(200),
  requestId: z.string().min(1).max(500).nullable(),
  latencyMs: z.number().int().nonnegative(),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  outputSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  providerStorageRequested: z.literal(false),
});
export type IntakeModelAudit = z.infer<typeof IntakeModelAuditSchema>;

export const PackageInspectionSchema = InspectionModelFindingSchema.extend({
  inspectionId: z.string().min(1).max(120),
  returnRecordId: z.string().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }),
  nextAction: InspectionNextActionSchema,
  refund: RefundRecommendationSchema,
  communication: CommunicationRecommendationSchema,
  actionOptions: z.array(IntakeActionOptionSchema).max(10).optional(),
  dispositionRecommendation: DispositionRecommendationSchema.optional(),
  warehouseEvidenceImageUrl: nullableImageUrl,
  analysisMode: z.enum(["OPENAI", "SYNTHETIC_FIXTURE", "SAFE_FALLBACK"]),
  modelVersion: z.string().min(1).max(200),
  modelAudit: IntakeModelAuditSchema,
});
export type PackageInspection = z.infer<typeof PackageInspectionSchema>;

export const CommunicationAttachmentSchema = z.object({
  role: z.enum(["ORIGINAL_PRODUCT_REFERENCE", "WAREHOUSE_EVIDENCE"]),
  sourceUrl: z.string().min(1).max(7_500_000),
  altText: z.string().min(1).max(300),
  provenance: z.string().min(1).max(300),
  evidenceId: nullableIdentifier,
});
export type CommunicationAttachment = z.infer<typeof CommunicationAttachmentSchema>;

export const CommunicationDraftSchema = z.object({
  draftId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120),
  returnRecordId: z.string().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }),
  templateIntent: DraftableTemplateIntentSchema.optional(),
  actionOptionId: IntakeActionOptionIdSchema.optional(),
  channel: z.enum(["EMAIL", "SMS"]),
  recipient: z.string().min(3).max(254),
  subject: z.string().min(1).max(300).nullable(),
  body: z.string().min(1).max(8_000),
  originalProductImageUrl: z.string().min(1).max(2_000),
  warehouseEvidenceImageUrl: nullableImageUrl,
  attachments: z.array(CommunicationAttachmentSchema).min(1).max(10),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  modelAudit: IntakeModelAuditSchema,
  generationMode: z.enum(["OPENAI", "SAFE_FALLBACK"]),
  requiresHumanApproval: z.literal(true),
  deliveryStatus: z.literal("DRAFT_NOT_SENT"),
});
export type CommunicationDraft = z.infer<typeof CommunicationDraftSchema>;

/**
 * Demo review acknowledgment captured before a draft can enter the test outbox.
 * `reviewerLabel` is intentionally only a display label: this unauthenticated
 * demo does not establish, verify, or attest to the operator's identity.
 */
export const OperatorReviewRecordSchema = z.object({
  reviewId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120),
  draftId: z.string().min(1).max(120),
  returnRecordId: z.string().min(1).max(120),
  reviewerLabel: z.string().trim().min(2).max(120),
  reviewerIdentityAssurance: z.literal("UNAUTHENTICATED_DISPLAY_LABEL"),
  draftDecision: z.literal("APPROVE_AS_WRITTEN"),
  draftContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgedRecommendation: z.literal(true),
  acknowledgedPolicy: z.literal(true),
  acknowledgedEvidence: z.literal(true),
  reviewedAt: z.string().datetime({ offset: true }),
  evidenceIds: z.array(z.string().min(1).max(200)).min(1).max(30),
});
export type OperatorReviewRecord = z.infer<typeof OperatorReviewRecordSchema>;

export const TestOutboxMessageSchema = z.object({
  messageId: z.string().min(1).max(120),
  draftId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120),
  reviewId: z.string().min(1).max(120),
  draftContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sessionId: z.string().uuid(),
  queuedAt: z.string().datetime({ offset: true }),
  status: z.literal("QUEUED_TEST_OUTBOX"),
  deliveryDisabled: z.literal(true),
  recipient: z.string().min(3).max(254),
  channel: z.enum(["EMAIL", "SMS"]),
});
export type TestOutboxMessage = z.infer<typeof TestOutboxMessageSchema>;

/**
 * Session-scoped intake outcome written when a reviewed message is queued,
 * a box is dispositioned (set aside), or a customer call completes. It feeds
 * the workstation activity feed and records the post-intake return status
 * without mutating the shared synthetic return records.
 */
export const IntakeActivityRecordSchema = z.object({
  activityId: z.string().min(1).max(120),
  kind: z.enum(["MESSAGE_QUEUED", "DISPOSITION_RECORDED", "CALL_COMPLETED"]).default("MESSAGE_QUEUED"),
  sessionId: z.string().uuid(),
  returnRecordId: z.string().min(1).max(120),
  rmaId: z.string().min(1).max(120),
  orderId: z.string().min(1).max(120),
  customerName: z.string().min(1).max(200),
  productTitle: z.string().min(1).max(300),
  classification: InspectionClassificationSchema,
  nextAction: InspectionNextActionSchema,
  resolutionStatus: IntakeResolutionStatusSchema,
  channel: z.enum(["EMAIL", "SMS", "VOICE", "NONE"]),
  templateIntent: DraftableTemplateIntentSchema.optional(),
  disposition: IntakeDispositionSchema.optional(),
  note: z.string().max(500).optional(),
  /** Display label of the logged-in operator who handled this intake. */
  handledBy: z.string().min(1).max(200).optional(),
  inspectionId: z.string().min(1).max(120),
  messageId: z.string().min(1).max(120).optional(),
  recordedAt: z.string().datetime({ offset: true }),
});
export type IntakeActivityRecord = z.infer<typeof IntakeActivityRecordSchema>;

export const deriveIntakeResolutionStatus = (actionOptionId: IntakeActionOptionId): IntakeResolutionStatus => {
  switch (actionOptionId) {
    case "APPROVE_FULL_REFUND":
      return "REFUND_APPROVAL_PENDING";
    case "APPROVE_PARTIAL_REFUND":
      return "PARTIAL_REFUND_PENDING";
    case "TEXT_CUSTOMER_FOR_CLARITY":
    case "EMAIL_EVIDENCE_REQUEST":
    case "REQUEST_ITEM_SHIPPED_BACK":
    case "OFFER_NEW_RETURN_LABEL":
      return "AWAITING_CUSTOMER";
    case "HOLD_FOR_SUPERVISOR_REVIEW":
      return "ON_HOLD_REVIEW";
    case "ROUTE_TO_AUTHENTICATION":
      return "AUTHENTICATION_REVIEW";
    default: {
      const exhausted: never = actionOptionId;
      throw new Error(`Unhandled intake action option: ${String(exhausted)}`);
    }
  }
};

/**
 * Demo-grade workstation identity. This is a display profile bound to a demo
 * session after a seeded station-ID + PIN check; it is not verified identity,
 * and no real credentials exist anywhere in this system.
 */
export const OperatorProfileSchema = z.object({
  operatorId: z.string().min(1).max(120),
  stationId: z.string().min(1).max(40),
  displayName: z.string().min(1).max(200),
  role: z.enum(["OPERATOR", "SUPERVISOR"]),
  identityAssurance: z.literal("DEMO_STATION_PIN"),
  loggedInAt: z.string().datetime({ offset: true }),
});
export type OperatorProfile = z.infer<typeof OperatorProfileSchema>;

/** Seeded demo logins. The PINs are public synthetic fixtures by design. */
export const demoOperatorDirectory = [
  { stationId: "STN-04", pin: "0404", displayName: "Station 04 operator", role: "OPERATOR" },
  { stationId: "STN-07", pin: "0707", displayName: "Station 07 operator", role: "OPERATOR" },
  { stationId: "SUP-01", pin: "1111", displayName: "Shift supervisor", role: "SUPERVISOR" },
] as const satisfies ReadonlyArray<{ stationId: string; pin: string; displayName: string; role: "OPERATOR" | "SUPERVISOR" }>;

/** Audit record of the operator-confirmed post-photo triage decision. */
export const IntakeDispositionRecordSchema = z.object({
  dispositionId: z.string().min(1).max(120),
  sessionId: z.string().uuid(),
  inspectionId: z.string().min(1).max(120),
  returnRecordId: z.string().min(1).max(120),
  disposition: IntakeDispositionSchema,
  recommendedDisposition: IntakeDispositionSchema,
  followedRecommendation: z.boolean(),
  reason: z.string().min(1).max(500),
  recordedBy: z.string().trim().min(2).max(120),
  recordedAt: z.string().datetime({ offset: true }),
});
export type IntakeDispositionRecord = z.infer<typeof IntakeDispositionRecordSchema>;

export const callResolutions = [
  "RESOLVED_REFUND_CONFIRMED",
  "CUSTOMER_WILL_SHIP_ITEM_BACK",
  "FOLLOW_UP_EMAIL_NEEDED",
  "NO_RESOLUTION_ESCALATE",
] as const;
export const CallResolutionSchema = z.enum(callResolutions);
export type CallResolution = z.infer<typeof CallResolutionSchema>;

/**
 * Outcome of a test-mode customer voice call (OpenAI Realtime over WebSocket,
 * or the deterministic simulated console). No real telephone call is placed;
 * the record keeps a transcript digest plus a bounded preview for the feed.
 */
export const IntakeCallRecordSchema = z.object({
  callId: z.string().min(1).max(120),
  sessionId: z.string().uuid(),
  returnRecordId: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120).nullable(),
  mode: z.enum(["OPENAI_REALTIME", "SIMULATED"]),
  testMode: z.literal(true),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int().nonnegative().max(3_600),
  transcriptSha256: z.string().regex(/^[a-f0-9]{64}$/),
  transcriptPreview: z.string().max(2_000),
  resolution: CallResolutionSchema,
  resolutionNote: z.string().max(500).nullable(),
  operatorLabel: z.string().trim().min(2).max(120),
});
export type IntakeCallRecord = z.infer<typeof IntakeCallRecordSchema>;

export const deriveCallResolutionStatus = (resolution: CallResolution): IntakeResolutionStatus => {
  switch (resolution) {
    case "RESOLVED_REFUND_CONFIRMED":
      return "CALL_RESOLVED";
    case "CUSTOMER_WILL_SHIP_ITEM_BACK":
    case "FOLLOW_UP_EMAIL_NEEDED":
      return "AWAITING_CUSTOMER";
    case "NO_RESOLUTION_ESCALATE":
      return "ON_HOLD_REVIEW";
    default: {
      const exhausted: never = resolution;
      throw new Error(`Unhandled call resolution: ${String(exhausted)}`);
    }
  }
};

export interface SimulatedCallTurn {
  speaker: "AGENT" | "CUSTOMER";
  text: string;
}

const centsToDollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * Deterministic scripted call used when no OpenAI key is configured (and by
 * tests). The same guardrails as the live realtime instructions apply: the
 * agent explains, never commits funds, and defers final decisions to a human.
 */
export const simulatedCallScript = (input: {
  classification: InspectionClassification;
  customerName: string;
  productTitle: string;
  rmaId: string;
  recommendedAmountCents: number | null;
  merchantName?: string;
}): SimulatedCallTurn[] => {
  const firstName = input.customerName.split(" ")[0] ?? input.customerName;
  const merchantName = input.merchantName ?? "SKIMS";
  const opening: SimulatedCallTurn[] = [
    { speaker: "AGENT", text: `Hi ${firstName}, this is the ${merchantName} returns desk calling about return ${input.rmaId} for your ${input.productTitle}. Do you have a moment?` },
    { speaker: "CUSTOMER", text: "Oh — yes, sure. Is something wrong with my return?" },
  ];
  const closing: SimulatedCallTurn[] = [
    { speaker: "CUSTOMER", text: "Okay, that makes sense. Thanks for calling to explain it." },
    { speaker: "AGENT", text: "Thank you. A summary of this call will be emailed to you, and a human reviewer signs off on every final decision. Have a great day." },
  ];
  const middle: Record<InspectionClassification, SimulatedCallTurn[]> = {
    MATCH: [
      { speaker: "AGENT", text: "Good news — the box arrived complete and matches your order, so the refund is queued for standard human approval. I'm calling to confirm nothing else is outstanding on your side." },
      { speaker: "CUSTOMER", text: "No, that was everything. Great to hear it arrived fine." },
    ],
    EMPTY_BOX: [
      { speaker: "AGENT", text: "When our intake station opened the mailer today, no garment was visible inside — only the polybag. I'm not making any accusation; shipping issues happen. Can you walk me through how it was packed?" },
      { speaker: "CUSTOMER", text: "That's really strange. I put both pieces back in the polybag and sealed the mailer. Could it have been opened in transit?" },
      { speaker: "AGENT", text: "That's one possibility we investigate. I'll note your packing description, hold the refund temporarily, and a human reviewer will follow up with a claim path within one business day." },
    ],
    QUANTITY_MISMATCH: [
      { speaker: "AGENT", text: `Our intake photos show one of the two pieces in the mailer. The refund math for what arrived is ${input.recommendedAmountCents === null ? "being reviewed" : centsToDollars(input.recommendedAmountCents)}. Did you mean to send both sizes back together?` },
      { speaker: "CUSTOMER", text: "Ah — I'm still deciding on the other size, it's at home. I can ship it this week if you can send a label." },
      { speaker: "AGENT", text: "Absolutely. I'll note that the second piece is coming back, and we can either wait for it or process the partial amount now — a human reviewer will confirm whichever you prefer." },
    ],
    WRONG_PRODUCT: [
      { speaker: "AGENT", text: "The garment in the mailer doesn't match the return — it's a different item entirely, with no tags or liner. Could the wrong piece have gone in by mistake?" },
      { speaker: "CUSTOMER", text: "Oh no, I think I mixed up two returns going out the same day. Yours probably went to the other retailer." },
      { speaker: "AGENT", text: "That happens more than you'd think. I'll hold this return open, and we can send a fresh label for the correct item once you have it back." },
    ],
    DAMAGED_PRODUCT: [
      { speaker: "AGENT", text: "The piece arrived with a visible snag and a small hole in the fabric. A human grader still has to assess it against the return policy — was it like that before you shipped it?" },
      { speaker: "CUSTOMER", text: "It was fine when I packed it, though I just folded it straight into the mailer." },
      { speaker: "AGENT", text: "Thanks — that detail helps the reviewer. Nothing is decided yet; you'll get the grading outcome and a contest path by email." },
    ],
    POSSIBLE_IMITATION: [
      { speaker: "AGENT", text: "Routine check on this one: the stitching and care label differ from our catalog reference, so the piece goes to authentication before settlement. Photos alone never decide this. Where was it purchased?" },
      { speaker: "CUSTOMER", text: "Directly from your site, last month. I still have the order confirmation." },
      { speaker: "AGENT", text: "Perfect — reply to the follow-up email with that confirmation and authentication usually clears quickly. The refund is only paused, not denied." },
    ],
    WARDROBING: [
      { speaker: "AGENT", text: "Our intake photos show the piece has been worn — there's makeup on the neckline and the hangtag and liner are detached. Our policy needs items back new and unworn with tags and liners attached. Can you tell me more?" },
      { speaker: "CUSTOMER", text: "I only tried it on once to check the fit before an event. I didn't think that counted as wearing it." },
      { speaker: "AGENT", text: "I understand, and trying on is fine — the tag and liner staying attached is what the policy turns on. Nothing is decided yet; a human grader reviews it and you'll get the outcome and a contest path by email." },
    ],
    INCONCLUSIVE: [
      { speaker: "AGENT", text: "Our photos of the mailer contents were inconclusive, so before anything else I wanted to confirm directly: what did you place in the mailer when you shipped it?" },
      { speaker: "CUSTOMER", text: "Both pieces, still in the polybag with the tags on — everything from the original order." },
      { speaker: "AGENT", text: "Understood. I'll record that, our team will re-photograph the contents under protocol, and a human reviewer will reconcile the difference." },
    ],
  };
  return [...opening, ...middle[input.classification], ...closing];
};

export const IntakeEvidencePurposeSchema = z.enum(["RETURN_LABEL", "PACKAGE_CONTENTS"]);
export type IntakeEvidencePurpose = z.infer<typeof IntakeEvidencePurposeSchema>;

export const CompletedIntakeEvidenceSchema = z.object({
  evidenceId: z.string().min(1).max(200),
  sessionId: z.string().uuid(),
  purpose: IntakeEvidencePurposeSchema,
  objectKey: z.string().min(1).max(1_024),
  versionId: z.string().min(1).max(1_024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  verifiedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
});
export type CompletedIntakeEvidence = z.infer<typeof CompletedIntakeEvidenceSchema>;

export interface RecommendationInput {
  returnRecord: ReturnRecord;
  finding: InspectionModelFinding;
}

export interface InspectionRecommendation {
  nextAction: InspectionNextAction;
  refund: RefundRecommendation;
  communication: CommunicationRecommendation;
  actionOptions: IntakeActionOption[];
}

const refundExposureCap = (returnRecord: ReturnRecord): number => Math.min(
  returnRecord.product.totalEligibleRefundCents,
  returnRecord.return.requestedRefundCents,
);

const semanticContradiction = (message: string): string => `Semantic consistency check: ${message}`;

/**
 * Treats model fields as mutually corroborating observations rather than
 * independent claims. Any contradiction is converted to INCONCLUSIVE before
 * policy or money is derived, with the exact conflict retained for human cure.
 */
export const enforceInspectionFindingInvariants = ({
  returnRecord,
  finding,
}: RecommendationInput): InspectionModelFinding => {
  const contradictions: string[] = [];
  const expectedQuantity = returnRecord.product.quantity;
  const observedQuantity = finding.comparison.observedQuantity;
  const summedObservedQuantity = finding.observedItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasVisibleItem = summedObservedQuantity > 0;
  const hasDamagedItem = finding.observedItems.some((item) => item.condition === "DAMAGED");
  const expectedSerials = new Set(returnRecord.product.serials.map((serial) => serial.trim().toUpperCase()));
  const observedSerials = new Set(
    finding.observedItems.flatMap((item) => item.serials).map((serial) => serial.trim().toUpperCase()),
  );

  if (finding.comparison.expectedQuantity !== expectedQuantity) {
    contradictions.push(semanticContradiction(
      `expected quantity ${finding.comparison.expectedQuantity} conflicts with the return record quantity ${expectedQuantity}.`,
    ));
  }

  if (observedQuantity === null) {
    if (hasVisibleItem) {
      contradictions.push(semanticContradiction(
        `observed quantity is unknown while item rows total ${summedObservedQuantity}.`,
      ));
    }
  } else if (observedQuantity !== summedObservedQuantity) {
    contradictions.push(semanticContradiction(
      `observed quantity ${observedQuantity} conflicts with the item-row total ${summedObservedQuantity}.`,
    ));
  }

  if (observedQuantity !== null && finding.comparison.quantityMatch !== null) {
    const quantityActuallyMatches = observedQuantity === expectedQuantity;
    if (finding.comparison.quantityMatch !== quantityActuallyMatches) {
      contradictions.push(semanticContradiction(
        `quantityMatch=${finding.comparison.quantityMatch} conflicts with observed ${observedQuantity} versus expected ${expectedQuantity}.`,
      ));
    }
  }

  if (finding.comparison.damageObserved === false && hasDamagedItem) {
    contradictions.push(semanticContradiction(
      "damageObserved=false conflicts with an observed item marked DAMAGED.",
    ));
  }

  switch (finding.classification) {
    case "MATCH":
      if (finding.comparison.skuMatch !== true) {
        contradictions.push(semanticContradiction("MATCH requires skuMatch=true."));
      }
      if (finding.comparison.quantityMatch !== true) {
        contradictions.push(semanticContradiction("MATCH requires quantityMatch=true."));
      }
      if (observedQuantity !== expectedQuantity) {
        contradictions.push(semanticContradiction(
          `MATCH requires exactly ${expectedQuantity} observed unit(s).`,
        ));
      }
      if (finding.comparison.damageObserved !== false || hasDamagedItem) {
        contradictions.push(semanticContradiction("MATCH requires an affirmative finding that no damage was observed."));
      }
      if (finding.comparison.serialMatch === false) {
        contradictions.push(semanticContradiction("MATCH cannot have serialMatch=false."));
      }
      if (expectedSerials.size > 0 && finding.comparison.serialMatch !== true) {
        contradictions.push(semanticContradiction(
          "MATCH for a serial-controlled product requires serialMatch=true.",
        ));
      }
      // Runs for unserialized apparel too: serials the product never had are as
      // inconsistent as missing ones.
      if (
        expectedSerials.size !== observedSerials.size
        || ![...expectedSerials].every((serial) => observedSerials.has(serial))
      ) {
        contradictions.push(semanticContradiction(
          "MATCH requires observed serial evidence for every expected product serial and no unexpected serials.",
        ));
      }
      break;
    case "EMPTY_BOX":
      if (observedQuantity !== 0) {
        contradictions.push(semanticContradiction("EMPTY_BOX requires observedQuantity=0."));
      }
      if (finding.observedItems.length !== 0) {
        contradictions.push(semanticContradiction("EMPTY_BOX requires no observed item rows."));
      }
      break;
    case "QUANTITY_MISMATCH":
      if (observedQuantity === null || observedQuantity >= expectedQuantity) {
        contradictions.push(semanticContradiction(
          `QUANTITY_MISMATCH requires a known observed quantity below ${expectedQuantity}.`,
        ));
      }
      if (finding.comparison.quantityMatch !== false) {
        contradictions.push(semanticContradiction("QUANTITY_MISMATCH requires quantityMatch=false."));
      }
      if (finding.comparison.skuMatch !== true) {
        contradictions.push(semanticContradiction("QUANTITY_MISMATCH requires skuMatch=true before any partial-refund recommendation."));
      }
      if (finding.comparison.damageObserved !== false || hasDamagedItem) {
        contradictions.push(semanticContradiction(
          "QUANTITY_MISMATCH requires an affirmative finding that no damage was observed before any partial-refund recommendation.",
        ));
      }
      break;
    case "WRONG_PRODUCT":
      if (observedQuantity === null || observedQuantity <= 0 || !hasVisibleItem) {
        contradictions.push(semanticContradiction("WRONG_PRODUCT requires a positive quantity of visible returned contents."));
      }
      if (finding.comparison.skuMatch !== false) {
        contradictions.push(semanticContradiction("WRONG_PRODUCT requires skuMatch=false."));
      }
      break;
    case "DAMAGED_PRODUCT":
      if (observedQuantity === null || observedQuantity <= 0 || !hasVisibleItem) {
        contradictions.push(semanticContradiction("DAMAGED_PRODUCT requires a positive quantity of visible returned contents."));
      }
      if (finding.comparison.damageObserved !== true) {
        contradictions.push(semanticContradiction("DAMAGED_PRODUCT requires damageObserved=true."));
      }
      break;
    case "POSSIBLE_IMITATION":
      if (observedQuantity === null || observedQuantity <= 0 || !hasVisibleItem) {
        contradictions.push(semanticContradiction("POSSIBLE_IMITATION requires a positive quantity of visible returned contents."));
      }
      break;
    case "WARDROBING":
      if (observedQuantity === null || observedQuantity <= 0 || !hasVisibleItem) {
        contradictions.push(semanticContradiction("WARDROBING requires a positive quantity of visible returned contents."));
      }
      if (finding.comparison.skuMatch !== true) {
        contradictions.push(semanticContradiction("WARDROBING requires skuMatch=true; a garment that is not the authorized SKU is a wrong-item finding."));
      }
      break;
    case "INCONCLUSIVE":
      break;
  }

  if (contradictions.length > 0) {
    const reason = contradictions.join(" ").slice(0, 500);
    return InspectionModelFindingSchema.parse({
      ...finding,
      classification: "INCONCLUSIVE",
      confidence: 0,
      summary: `The inspection fields are internally inconsistent, so no match or monetary conclusion can be made. ${reason}`.slice(0, 1_500),
      missingEvidence: [...new Set([
        ...finding.missingEvidence.slice(0, 29),
        reason,
      ])].slice(0, 30),
    });
  }

  if (finding.classification === "POSSIBLE_IMITATION") {
    const authenticationRequirement = "Qualified authentication is required; image evidence alone cannot prove imitation or counterfeit status.";
    return InspectionModelFindingSchema.parse({
      ...finding,
      summary: "A visible item may differ from the catalog reference, but image evidence alone does not establish authenticity.",
      missingEvidence: [...new Set([
        ...finding.missingEvidence.slice(0, 29),
        authenticationRequirement,
      ])].slice(0, 30),
    });
  }

  if (finding.classification === "WARDROBING") {
    const gradeRequirement = "A human condition grade against the merchant's returnable-condition policy is required; images show wear signals but do not establish policy eligibility.";
    return InspectionModelFindingSchema.parse({
      ...finding,
      summary: "The garment shows visible wear signals against a policy that requires new, unworn condition with tags and liners attached. Images do not establish policy eligibility.",
      missingEvidence: [...new Set([
        ...finding.missingEvidence.slice(0, 29),
        gradeRequirement,
      ])].slice(0, 30),
    });
  }

  return finding;
};

const actionOptionCatalog: Record<IntakeActionOptionId, Omit<IntakeActionOption, "recommended">> = {
  APPROVE_FULL_REFUND: {
    id: "APPROVE_FULL_REFUND",
    label: "Approve full refund",
    description: "Email the customer that the return matched and the full refund is queued for approval.",
    channel: "EMAIL",
    templateIntent: "APPROVAL",
  },
  APPROVE_PARTIAL_REFUND: {
    id: "APPROVE_PARTIAL_REFUND",
    label: "Approve partial refund",
    description: "Email the customer the received-quantity refund math and queue the partial amount for approval.",
    channel: "EMAIL",
    templateIntent: "PARTIAL_REFUND_EXPLANATION",
  },
  TEXT_CUSTOMER_FOR_CLARITY: {
    id: "TEXT_CUSTOMER_FOR_CLARITY",
    label: "Text customer for clarity",
    description: "Send a short SMS asking the customer to confirm what they shipped before any settlement.",
    channel: "SMS",
    templateIntent: "EVIDENCE_REQUEST",
  },
  EMAIL_EVIDENCE_REQUEST: {
    id: "EMAIL_EVIDENCE_REQUEST",
    label: "Request more evidence",
    description: "Email the customer for packing photos, serial numbers, or proof of contents.",
    channel: "EMAIL",
    templateIntent: "EVIDENCE_REQUEST",
  },
  REQUEST_ITEM_SHIPPED_BACK: {
    id: "REQUEST_ITEM_SHIPPED_BACK",
    label: "Ask customer to ship the item back",
    description: "Email the customer asking them to send the missing or incorrect item before settlement.",
    channel: "EMAIL",
    templateIntent: "SHIP_ITEM_BACK_REQUEST",
  },
  OFFER_NEW_RETURN_LABEL: {
    id: "OFFER_NEW_RETURN_LABEL",
    label: "Offer a new return label",
    description: "Email a claim form the customer completes first; a fresh return label follows automatically.",
    channel: "EMAIL",
    templateIntent: "RETURN_LABEL_OFFER",
  },
  HOLD_FOR_SUPERVISOR_REVIEW: {
    id: "HOLD_FOR_SUPERVISOR_REVIEW",
    label: "Hold for supervisor review",
    description: "Notify the customer of a short review hold and route the case to a supervisor.",
    channel: "EMAIL",
    templateIntent: "REVIEW_HOLD",
  },
  ROUTE_TO_AUTHENTICATION: {
    id: "ROUTE_TO_AUTHENTICATION",
    label: "Route to authentication",
    description: "Notify the customer of a review hold while the item goes to qualified authentication.",
    channel: "EMAIL",
    templateIntent: "REVIEW_HOLD",
  },
};

const buildActionOptions = (
  recommendedId: IntakeActionOptionId,
  otherIds: IntakeActionOptionId[],
): IntakeActionOption[] => [
  { ...actionOptionCatalog[recommendedId], recommended: true },
  ...otherIds.map((id) => ({ ...actionOptionCatalog[id], recommended: false })),
];

/**
 * Server-owned next-action list per classification. The workstation UI renders
 * these verbatim so operators never see options the policy layer did not offer.
 */
export const deriveIntakeActionOptions = (
  classification: InspectionClassification,
): IntakeActionOption[] => {
  switch (classification) {
    case "MATCH":
      return buildActionOptions("APPROVE_FULL_REFUND", [
        "TEXT_CUSTOMER_FOR_CLARITY",
        "HOLD_FOR_SUPERVISOR_REVIEW",
      ]);
    case "QUANTITY_MISMATCH":
      return buildActionOptions("APPROVE_PARTIAL_REFUND", [
        "TEXT_CUSTOMER_FOR_CLARITY",
        "REQUEST_ITEM_SHIPPED_BACK",
        "OFFER_NEW_RETURN_LABEL",
        "HOLD_FOR_SUPERVISOR_REVIEW",
      ]);
    case "EMPTY_BOX":
      return buildActionOptions("HOLD_FOR_SUPERVISOR_REVIEW", [
        "EMAIL_EVIDENCE_REQUEST",
        "TEXT_CUSTOMER_FOR_CLARITY",
      ]);
    case "WRONG_PRODUCT":
      return buildActionOptions("HOLD_FOR_SUPERVISOR_REVIEW", [
        "REQUEST_ITEM_SHIPPED_BACK",
        "OFFER_NEW_RETURN_LABEL",
        "TEXT_CUSTOMER_FOR_CLARITY",
      ]);
    case "POSSIBLE_IMITATION":
      return buildActionOptions("ROUTE_TO_AUTHENTICATION", [
        "HOLD_FOR_SUPERVISOR_REVIEW",
        "EMAIL_EVIDENCE_REQUEST",
      ]);
    case "DAMAGED_PRODUCT":
      return buildActionOptions("EMAIL_EVIDENCE_REQUEST", [
        "TEXT_CUSTOMER_FOR_CLARITY",
        "OFFER_NEW_RETURN_LABEL",
        "HOLD_FOR_SUPERVISOR_REVIEW",
      ]);
    case "WARDROBING":
      return buildActionOptions("HOLD_FOR_SUPERVISOR_REVIEW", [
        "EMAIL_EVIDENCE_REQUEST",
        "TEXT_CUSTOMER_FOR_CLARITY",
        "REQUEST_ITEM_SHIPPED_BACK",
      ]);
    case "INCONCLUSIVE":
      return buildActionOptions("EMAIL_EVIDENCE_REQUEST", [
        "TEXT_CUSTOMER_FOR_CLARITY",
        "HOLD_FOR_SUPERVISOR_REVIEW",
      ]);
    default: {
      const exhausted: never = classification;
      throw new Error(`Unhandled classification: ${String(exhausted)}`);
    }
  }
};

const holdRecommendation = (
  returnRecord: ReturnRecord,
  rationale: string,
  classification: InspectionClassification,
  nextAction: InspectionNextAction = "HOLD_FOR_REVIEW",
  intent: CommunicationRecommendation["templateIntent"] = "REVIEW_HOLD",
): InspectionRecommendation => ({
  nextAction,
  refund: {
    recommendedType: "TEMPORARY_HOLD",
    recommendedAmountCents: null,
    withholdAmountCents: refundExposureCap(returnRecord),
    rationale,
    requiresHumanApproval: true,
  },
  communication: { recommended: true, channel: "EMAIL", templateIntent: intent },
  actionOptions: deriveIntakeActionOptions(classification),
});

/**
 * Computes money from catalog price and observed quantity only. The model never
 * chooses a dollar amount, and every recommendation remains subject to human review.
 */
export const deriveInspectionRecommendation = ({
  returnRecord,
  finding,
}: RecommendationInput): InspectionRecommendation => {
  const invariantSafeFinding = enforceInspectionFindingInvariants({ returnRecord, finding });
  const total = refundExposureCap(returnRecord);
  switch (invariantSafeFinding.classification) {
    case "MATCH":
      return {
        nextAction: "APPROVE_FULL",
        refund: {
          recommendedType: "FULL",
          recommendedAmountCents: total,
          withholdAmountCents: 0,
          rationale: "The protocol-captured contents match the authorized SKU and quantity. The amount is capped at the lower of eligible and requested refund cents. Human approval is still required before settlement.",
          requiresHumanApproval: true,
        },
        communication: { recommended: true, channel: "EMAIL", templateIntent: "APPROVAL" },
        actionOptions: deriveIntakeActionOptions("MATCH"),
      };
    case "QUANTITY_MISMATCH": {
      const observed = Math.max(0, Math.min(
        invariantSafeFinding.comparison.observedQuantity ?? 0,
        returnRecord.product.quantity,
      ));
      const amount = Math.min(total, observed * returnRecord.product.unitPriceCents);
      return {
        nextAction: "APPROVE_PARTIAL",
        refund: {
          recommendedType: "PARTIAL",
          recommendedAmountCents: amount,
          withholdAmountCents: total - amount,
          rationale: `Catalog price multiplied by ${observed} observed unit(s), capped at the lower of eligible and requested refund cents; no model-generated pricing was used. Human approval and shopper contest rights remain required.`,
          requiresHumanApproval: true,
        },
        communication: { recommended: true, channel: "EMAIL", templateIntent: "PARTIAL_REFUND_EXPLANATION" },
        actionOptions: deriveIntakeActionOptions("QUANTITY_MISMATCH"),
      };
    }
    case "EMPTY_BOX":
      return holdRecommendation(returnRecord, "No expected item was observed. Hold settlement temporarily while a human reviews calibrated weight, capture protocol, and any shopper evidence.", "EMPTY_BOX");
    case "WRONG_PRODUCT":
      return holdRecommendation(returnRecord, "The visible item does not match the authorized SKU. Hold settlement temporarily and route the comparison to a human reviewer.", "WRONG_PRODUCT");
    case "POSSIBLE_IMITATION":
      return holdRecommendation(
        returnRecord,
        "Photographs alone cannot establish authenticity. Hold settlement temporarily and route the item to qualified authentication.",
        "POSSIBLE_IMITATION",
        "ROUTE_AUTHENTICATION",
      );
    case "DAMAGED_PRODUCT":
      return {
        nextAction: "HOLD_FOR_REVIEW",
        refund: {
          recommendedType: "NO_RECOMMENDATION",
          recommendedAmountCents: null,
          withholdAmountCents: null,
          rationale: "A photograph cannot determine merchant-policy eligibility, causation, or salvage value. A human must inspect the item and policy before choosing full or partial refund cents.",
          requiresHumanApproval: true,
        },
        communication: { recommended: true, channel: "EMAIL", templateIntent: "EVIDENCE_REQUEST" },
        actionOptions: deriveIntakeActionOptions("DAMAGED_PRODUCT"),
      };
    case "WARDROBING":
      return {
        nextAction: "HOLD_FOR_REVIEW",
        refund: {
          recommendedType: "NO_RECOMMENDATION",
          recommendedAmountCents: null,
          withholdAmountCents: null,
          rationale: "Returnable condition is a merchant-policy judgement. A human must grade wear, tag, and liner state against the policy before choosing refund, store credit, or denial cents.",
          requiresHumanApproval: true,
        },
        communication: { recommended: true, channel: "EMAIL", templateIntent: "REVIEW_HOLD" },
        actionOptions: deriveIntakeActionOptions("WARDROBING"),
      };
    case "INCONCLUSIVE":
      return {
        nextAction: "REQUEST_MORE_EVIDENCE",
        refund: {
          recommendedType: "NO_RECOMMENDATION",
          recommendedAmountCents: null,
          withholdAmountCents: null,
          rationale: "The available evidence is insufficient for a monetary recommendation. Request a clearer protocol capture and preserve human review.",
          requiresHumanApproval: true,
        },
        communication: { recommended: true, channel: "EMAIL", templateIntent: "EVIDENCE_REQUEST" },
        actionOptions: deriveIntakeActionOptions("INCONCLUSIVE"),
      };
  }
};

/**
 * Two units of the hero style in adjacent sizes: the size-bracketing order that
 * drives most apparel returns. Apparel carries no unit serials, which is exactly
 * why the physical inspection checkpoint matters more here than in electronics.
 */
const demoProduct = {
  sku: fitsEverybodyCamiBodysuit.styleId,
  title: fitsEverybodyCamiBodysuit.title,
  quantity: 2,
  unitPriceCents: fitsEverybodyCamiBodysuit.unitPriceCents,
  totalEligibleRefundCents: fitsEverybodyCamiBodysuit.unitPriceCents * 2,
  imageUrl: "/evidence/catalog-fits-everybody-bodysuit.png",
  serials: [],
  attributes: {
    collection: "Fits Everybody",
    color: "Onyx",
    sizes: "M, L",
    variantSkus: "SK-FE-CAMI-BODYSUIT-ONX-M, SK-FE-CAMI-BODYSUIT-ONX-L",
    fabric: fitsEverybodyCamiBodysuit.fabric,
    expectedContents: "2 Fits Everybody Cami Bodysuits (Onyx · M and L) in sealed polybags",
    expectedPackedWeight: "0.38 kg",
    returnableCondition: "New, unworn and unwashed with tags and hygiene liners attached",
  },
} satisfies ReturnProduct;

export const fixtureReturnRecords: readonly ReturnRecord[] = [
  {
    returnRecordId: "ret-sk-1042",
    merchantId: "skims",
    merchantName: "SKIMS",
    labelId: "LBL-8821",
    rmaId: "RMA-8821",
    orderId: "SK-1042",
    trackingNumber: "1Z-REDO-8821",
    carrier: "UPS",
    customer: {
      customerId: "cus-demo-ava",
      name: "Ava Morgan",
      email: "ava.morgan@example.test",
      phone: "+1-555-010-8821",
    },
    product: demoProduct,
    return: {
      reason: "Ordered two sizes",
      requestedRefundCents: demoProduct.totalEligibleRefundCents,
      currency: "USD",
      policyId: "skims-returns",
      policyVersion: "skims-returns-2026-08",
      policySnapshotSha256: "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
      status: "INSPECTION_PENDING",
    },
  },
  ...[
    ["ret-sk-1099", "LBL-RMA-8899", "RMA-8899", "SK-1099", "9400111899223857483920"],
    ["ret-sk-1107", "LBL-RMA-8907", "RMA-8907", "SK-1107", "1Z999AA10123456791"],
    ["ret-sk-1120", "LBL-RMA-8920", "RMA-8920", "SK-1120", "TBA000000000004"],
    ["ret-sk-1131", "LBL-RMA-8931", "RMA-8931", "SK-1131", "9274890241050123456781"],
  ].map(([returnRecordId, labelId, rmaId, orderId, trackingNumber], index): ReturnRecord => ({
    returnRecordId: returnRecordId!,
    merchantId: "skims",
    merchantName: "SKIMS",
    labelId: labelId!,
    rmaId: rmaId!,
    orderId: orderId!,
    trackingNumber: trackingNumber!,
    carrier: index === 2 ? "Happy Returns" : index === 3 ? "USPS" : "UPS",
    customer: {
      customerId: `cus-demo-${index + 2}`,
      name: ["Noah Chen", "Mia Rivera", "Liam Brooks", "Zoe Patel"][index]!,
      email: `synthetic.shopper.${index + 2}@example.test`,
      phone: null,
    },
    product: demoProduct,
    return: {
      reason: ["Too small", "Arrived damaged", "Incorrect item received", "Ordered two sizes"][index]!,
      requestedRefundCents: demoProduct.totalEligibleRefundCents,
      currency: "USD",
      policyId: "skims-returns",
      policyVersion: "skims-returns-2026-08",
      policySnapshotSha256: "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
      status: "INSPECTION_PENDING",
    },
  })),
].map((record) => ReturnRecordSchema.parse(record));

export const normalizeReturnLookupValue = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, "");

export const fixtureLabelExtraction = (fixtureId: string, evidenceId = "ev-label-rma-8821"): LabelExtraction => {
  if (fixtureId !== "labelRma8821") {
    return LabelExtractionSchema.parse({
      labelId: null,
      trackingNumber: null,
      rmaId: null,
      orderId: null,
      carrier: null,
      confidence: 0,
      evidenceIds: [evidenceId],
    });
  }
  return LabelExtractionSchema.parse({
    labelId: "LBL-8821",
    trackingNumber: "1Z-REDO-8821",
    rmaId: "RMA-8821",
    orderId: "SK-1042",
    carrier: "UPS",
    confidence: 1,
    evidenceIds: [evidenceId],
  });
};

const fixtureFinding = (
  classification: InspectionClassification,
  expectedQuantity: number,
  evidenceId: string,
  expectedSerials: readonly string[],
): InspectionModelFinding => {
  const observedQuantity = classification === "EMPTY_BOX"
    ? 0
    : classification === "QUANTITY_MISMATCH"
      ? Math.max(0, expectedQuantity - 1)
      : classification === "INCONCLUSIVE"
        ? null
        : expectedQuantity;
  const candidateSku = classification === "EMPTY_BOX" || classification === "INCONCLUSIVE"
    ? null
    : classification === "WRONG_PRODUCT"
      ? decoyGarment.sku
      : fitsEverybodyCamiBodysuit.styleId;
  return InspectionModelFindingSchema.parse({
    classification,
    confidence: classification === "INCONCLUSIVE" ? 0 : 0.99,
    summary: {
      MATCH: "The expected style and authorized quantity are visible in the protocol capture, tags and liners attached.",
      EMPTY_BOX: "No garment is visible inside the opened return mailer.",
      DAMAGED_PRODUCT: "The expected garment is visible with apparent fabric damage; cause and policy eligibility are not established by the image.",
      QUANTITY_MISMATCH: "One of the two authorized pieces is visible in the return mailer.",
      WRONG_PRODUCT: "The visible garment differs from the authorized return style.",
      POSSIBLE_IMITATION: "The garment has visible construction and label differences from the catalog reference, but authenticity cannot be established from photographs alone.",
      WARDROBING: "The garment shows visible wear signals and a detached hangtag against a policy requiring new, unworn condition with tags and liners attached.",
      INCONCLUSIVE: "The image does not provide a clear view of all mailer contents.",
    }[classification],
    observedItems: observedQuantity === null || observedQuantity === 0 ? [] : [{
      description: classification === "WRONG_PRODUCT" ? decoyGarment.title : fitsEverybodyCamiBodysuit.title,
      candidateSku,
      quantity: observedQuantity,
      condition: classification === "DAMAGED_PRODUCT"
        ? "DAMAGED"
        : classification === "WARDROBING"
          ? "USED"
          : classification === "MATCH"
            ? "NEW"
            : "UNKNOWN",
      serials: classification === "MATCH" ? [...expectedSerials] : [],
      evidenceIds: [evidenceId],
    }],
    comparison: {
      skuMatch: candidateSku === null ? null : candidateSku === fitsEverybodyCamiBodysuit.styleId,
      quantityMatch: observedQuantity === null ? null : observedQuantity === expectedQuantity,
      serialMatch: classification === "MATCH" && expectedSerials.length > 0 ? true : null,
      damageObserved: classification === "INCONCLUSIVE" ? null : classification === "DAMAGED_PRODUCT",
      expectedQuantity,
      observedQuantity,
    },
    missingEvidence: classification === "POSSIBLE_IMITATION"
      ? ["Qualified authentication result"]
      : classification === "INCONCLUSIVE"
        ? ["Unobstructed overhead capture", "All returned items visible together"]
        : classification === "DAMAGED_PRODUCT" || classification === "WARDROBING"
          ? ["Human condition grade", "Merchant policy eligibility review"]
          : [],
    evidenceIds: [evidenceId],
  });
};

export const fixtureInspectionFinding = (
  fixtureId: string,
  expectedQuantity: number,
  evidenceId = `ev-${fixtureId}`,
  expectedSerials: readonly string[] = [],
): InspectionModelFinding => {
  const classificationByFixture: Readonly<Record<string, InspectionClassification>> = {
    matchReturn: "MATCH",
    emptyReturn: "EMPTY_BOX",
    quantityMismatch: "QUANTITY_MISMATCH",
    wrongItem: "WRONG_PRODUCT",
    damagedProduct: "DAMAGED_PRODUCT",
    possibleImitation: "POSSIBLE_IMITATION",
    wardrobing: "WARDROBING",
  };
  return fixtureFinding(
    classificationByFixture[fixtureId] ?? "INCONCLUSIVE",
    expectedQuantity,
    evidenceId,
    expectedSerials,
  );
};
