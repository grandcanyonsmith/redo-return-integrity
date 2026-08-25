import { z } from "zod";

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

export const CommunicationRecommendationSchema = z.object({
  recommended: z.boolean(),
  channel: z.enum(["EMAIL", "SMS", "NONE"]),
  templateIntent: z.enum([
    "APPROVAL",
    "PARTIAL_REFUND_EXPLANATION",
    "EVIDENCE_REQUEST",
    "REVIEW_HOLD",
    "APPEAL_NOTICE",
    "NONE",
  ]),
});
export type CommunicationRecommendation = z.infer<typeof CommunicationRecommendationSchema>;

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
      if (expectedSerials.size > 0) {
        if (finding.comparison.serialMatch !== true) {
          contradictions.push(semanticContradiction(
            "MATCH for a serial-controlled product requires serialMatch=true.",
          ));
        }
        const exactSerialEvidence = expectedSerials.size === observedSerials.size
          && [...expectedSerials].every((serial) => observedSerials.has(serial));
        if (!exactSerialEvidence) {
          contradictions.push(semanticContradiction(
            "MATCH requires observed serial evidence for every expected product serial and no unexpected serials.",
          ));
        }
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

  return finding;
};

const holdRecommendation = (
  returnRecord: ReturnRecord,
  rationale: string,
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
      };
    }
    case "EMPTY_BOX":
      return holdRecommendation(returnRecord, "No expected item was observed. Hold settlement temporarily while a human reviews calibrated weight, capture protocol, and any shopper evidence.");
    case "WRONG_PRODUCT":
      return holdRecommendation(returnRecord, "The visible item does not match the authorized SKU. Hold settlement temporarily and route the comparison to a human reviewer.");
    case "POSSIBLE_IMITATION":
      return holdRecommendation(
        returnRecord,
        "Photographs alone cannot establish authenticity. Hold settlement temporarily and route the item to qualified authentication.",
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
      };
  }
};

const demoProduct = {
  sku: "JC-ARC-ONE-KIT",
  title: "Juniper Arc One two-camera kit",
  quantity: 2,
  unitPriceCents: 92_450,
  totalEligibleRefundCents: 184_900,
  imageUrl: "/evidence/catalog-juniper-arc-one.png",
  serials: ["JCA1-88K2", "JCA1-91M7"],
  attributes: {
    color: "Graphite",
    expectedContents: "2 Arc One cameras, 2 mounts, 2 USB-C cables",
    expectedPackedWeight: "1.80 kg",
  },
} satisfies ReturnProduct;

export const fixtureReturnRecords: readonly ReturnRecord[] = [
  {
    returnRecordId: "ret-jc-1042",
    merchantId: "juniper-circuit",
    merchantName: "Juniper Circuit",
    labelId: "LBL-8821",
    rmaId: "RMA-8821",
    orderId: "JC-1042",
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
      reason: "Changed mind",
      requestedRefundCents: 184_900,
      currency: "USD",
      policyId: "juniper-returns",
      policyVersion: "juniper-returns-2026-08",
      policySnapshotSha256: "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
      status: "INSPECTION_PENDING",
    },
  },
  ...[
    ["ret-jc-1099", "LBL-RMA-8899", "RMA-8899", "JC-1099", "9400111899223857483920"],
    ["ret-jc-1107", "LBL-RMA-8907", "RMA-8907", "JC-1107", "1Z999AA10123456791"],
    ["ret-jc-1120", "LBL-RMA-8920", "RMA-8920", "JC-1120", "TBA000000000004"],
    ["ret-jc-1131", "LBL-RMA-8931", "RMA-8931", "JC-1131", "9274890241050123456781"],
  ].map(([returnRecordId, labelId, rmaId, orderId, trackingNumber], index): ReturnRecord => ({
    returnRecordId: returnRecordId!,
    merchantId: "juniper-circuit",
    merchantName: "Juniper Circuit",
    labelId: labelId!,
    rmaId: rmaId!,
    orderId: orderId!,
    trackingNumber: trackingNumber!,
    carrier: index === 2 ? "Amazon Shipping" : index === 3 ? "USPS" : "UPS",
    customer: {
      customerId: `cus-demo-${index + 2}`,
      name: ["Noah Chen", "Mia Rivera", "Liam Brooks", "Zoe Patel"][index]!,
      email: `synthetic.shopper.${index + 2}@example.test`,
      phone: null,
    },
    product: { ...demoProduct, serials: [`JCA1-DEMO-${index + 2}A`, `JCA1-DEMO-${index + 2}B`] },
    return: {
      reason: ["No longer needed", "Arrived damaged", "Incorrect item received", "Changed mind"][index]!,
      requestedRefundCents: 184_900,
      currency: "USD",
      policyId: "juniper-returns",
      policyVersion: "juniper-returns-2026-08",
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
    orderId: "JC-1042",
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
      ? "JC-BASIC-MOUSE"
      : "JC-ARC-ONE-KIT";
  return InspectionModelFindingSchema.parse({
    classification,
    confidence: classification === "INCONCLUSIVE" ? 0 : 0.99,
    summary: {
      MATCH: "The expected SKU and authorized quantity are visible in the protocol capture.",
      EMPTY_BOX: "No merchandise is visible inside the opened return package.",
      DAMAGED_PRODUCT: "The expected product is visible with apparent physical damage; cause and policy eligibility are not established by the image.",
      QUANTITY_MISMATCH: "One of the two authorized units is visible in the return package.",
      WRONG_PRODUCT: "The visible product differs from the authorized return SKU.",
      POSSIBLE_IMITATION: "The product has visible differences from the catalog reference, but authenticity cannot be established from photographs alone.",
      INCONCLUSIVE: "The image does not provide a clear view of all package contents.",
    }[classification],
    observedItems: observedQuantity === null || observedQuantity === 0 ? [] : [{
      description: classification === "WRONG_PRODUCT" ? "Basic computer mouse" : "Juniper Arc One camera kit",
      candidateSku,
      quantity: observedQuantity,
      condition: classification === "DAMAGED_PRODUCT" ? "DAMAGED" : classification === "MATCH" ? "OPEN_BOX" : "UNKNOWN",
      serials: classification === "MATCH" ? [...expectedSerials] : [],
      evidenceIds: [evidenceId],
    }],
    comparison: {
      skuMatch: candidateSku === null ? null : candidateSku === "JC-ARC-ONE-KIT",
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
        : classification === "DAMAGED_PRODUCT"
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
  };
  return fixtureFinding(
    classificationByFixture[fixtureId] ?? "INCONCLUSIVE",
    expectedQuantity,
    evidenceId,
    expectedSerials,
  );
};
