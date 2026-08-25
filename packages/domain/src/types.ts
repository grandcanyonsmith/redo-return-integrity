import { z } from "zod";

export const checkpointIds = [
  "VISIT_SESSION",
  "IDENTITY_LINK",
  "CHECKOUT_PAYMENT",
  "ORDER_RELEASE",
  "OUTBOUND_PACK",
  "OUTBOUND_CUSTODY",
  "DELIVERY_POSSESSION",
  "RETURN_REQUEST",
  "RETURN_AUTHORIZATION",
  "REVERSE_HANDOFF",
  "REVERSE_TRANSIT",
  "WAREHOUSE_RECEIPT",
  "ITEM_INSPECTION",
  "REFUND_SETTLEMENT",
  "CONTEST_APPEAL_RECOVERY",
] as const;

export const CheckpointIdSchema = z.enum(checkpointIds);
export type CheckpointId = z.infer<typeof CheckpointIdSchema>;

export const evidenceTiers = ["E0", "E1", "E2", "E3", "E4", "E5"] as const;
export const EvidenceTierSchema = z.enum(evidenceTiers);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export const evidenceTierDescriptions: Readonly<Record<EvidenceTier, string>> = {
  E0: "Unverified assertion or self-reported information",
  E1: "Captured metadata with known provenance",
  E2: "System-observed first-party event",
  E3: "Independent carrier, payment, or partner corroboration",
  E4: "Protocol-controlled physical inspection or measurement",
  E5: "Adjudicated outcome or confirmed loss/recovery",
};

export const PiiClassSchema = z.enum(["NONE", "PSEUDONYMOUS", "PERSONAL", "SENSITIVE"]);
export type PiiClass = z.infer<typeof PiiClassSchema>;

export const UseScopeSchema = z.enum([
  "RISK_DECISION",
  "CUSTOMER_SUPPORT",
  "DISPUTE_EVIDENCE",
  "MODEL_EVALUATION",
  "ANALYTICS",
]);
export type UseScope = z.infer<typeof UseScopeSchema>;

export const EvidenceArtifactSchema = z.object({
  evidenceId: z.string().min(1),
  caseId: z.string().min(1),
  checkpointId: CheckpointIdSchema,
  sourceSystem: z.string().min(1),
  provenanceTier: EvidenceTierSchema,
  observedAt: z.string().datetime({ offset: true }),
  availableAt: z.string().datetime({ offset: true }),
  receivedAt: z.string().datetime({ offset: true }),
  facts: z.record(z.string(), z.unknown()),
  objectKey: z.string().min(1).optional(),
  fixtureUrl: z.string().min(1).optional(),
  checksum: z.string().min(1).optional(),
  protocolVersion: z.string().min(1),
  piiClass: PiiClassSchema,
  useScope: z.array(UseScopeSchema).min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;

export const SignalSeveritySchema = z.enum(["INFO", "LOW", "MEDIUM", "HIGH"]);
export const SignalStatusSchema = z.enum(["OBSERVED", "NOT_OBSERVED", "UNKNOWN"]);
export const DeterministicSignalSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  status: SignalStatusSchema,
  severity: SignalSeveritySchema,
  riskBearing: z.boolean(),
  explanation: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  value: z.number().finite().optional(),
  threshold: z.number().finite().optional(),
  unit: z.string().optional(),
});
export type DeterministicSignal = z.infer<typeof DeterministicSignalSchema>;

export const IndicatorSchema = z.object({
  code: z.string().min(1),
  explanation: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
});

export const ModelAssessmentStatusSchema = z.enum(["PASS", "CONCERN", "INCONCLUSIVE", "ERROR"]);
export const ModelRecommendationSchema = z.enum([
  "PASS",
  "PASS_MONITORED",
  "REQUEST_EVIDENCE",
  "HUMAN_REVIEW",
]);

export const ImageFindingSchema = z.object({
  evidenceId: z.string().min(1),
  packageState: z.enum(["SEALED", "OPEN", "DAMAGED", "UNKNOWN"]),
  contentsAssessment: z.enum([
    "EXPECTED_ITEM_VISIBLE",
    "EMPTY",
    "POSSIBLE_DECOY",
    "POSSIBLE_WRONG_ITEM",
    "POSSIBLE_IMITATION",
    "QUANTITY_MISMATCH",
    "INCONCLUSIVE",
  ]),
  labelReadable: z.boolean(),
  serialReadable: z.boolean(),
  notes: z.string().max(500),
});

export const OpenAIAssessmentSchema = z.object({
  status: ModelAssessmentStatusSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(1_000),
  riskIndicators: z.array(IndicatorSchema).max(12),
  exculpatoryIndicators: z.array(IndicatorSchema).max(12),
  missingInformation: z.array(z.string().max(200)).max(12),
  recommendedDisposition: ModelRecommendationSchema,
  imageFindings: z.array(ImageFindingSchema).max(12),
});
export type OpenAIAssessment = z.infer<typeof OpenAIAssessmentSchema>;

export const decisionActions = [
  "PASS",
  "PASS_MONITORED",
  "CHALLENGE",
  "REQUEST_EVIDENCE",
  "HOLD",
  "HUMAN_REVIEW",
  "APPROVE",
  "PARTIAL_APPROVE",
  "DENY",
  "OVERTURN",
  "CLOSE",
] as const;
export const DecisionActionSchema = z.enum(decisionActions);
export type DecisionAction = z.infer<typeof DecisionActionSchema>;

export const DecisionTargetSchema = z.enum([
  "CHECKOUT",
  "ORDER",
  "RETURN_AUTHORIZATION",
  "REFUND",
  "APPEAL",
  "PAYMENT_CASE",
]);
export type DecisionTarget = z.infer<typeof DecisionTargetSchema>;

export const DecisionActorSchema = z.enum([
  "SYSTEM_POLICY",
  "OPENAI_ASSESSMENT",
  "HUMAN_OPERATOR",
  "SHOPPER",
]);
export type DecisionActor = z.infer<typeof DecisionActorSchema>;

export const CaseStateSchema = z.enum([
  "ACTIVE",
  "AWAITING_SHOPPER",
  "AWAITING_MERCHANT",
  "REFUND_HELD",
  "APPROVED",
  "PARTIAL_REFUND",
  "DENIED",
  "APPEALED",
  "OVERTURNED",
  "CLOSED",
]);
export type CaseState = z.infer<typeof CaseStateSchema>;

export const RequiredActionSchema = z.object({
  actionId: z.string().min(1),
  owner: z.enum(["SHOPPER", "MERCHANT", "OPERATOR", "SYSTEM"]),
  label: z.string().min(1),
  description: z.string().min(1),
  acceptableEvidence: z.array(z.string()),
  optional: z.boolean().default(false),
});
export type RequiredAction = z.infer<typeof RequiredActionSchema>;

export const PolicyResultSchema = z.object({
  policyId: z.string().min(1),
  policyVersion: z.string().min(1),
  action: DecisionActionSchema.exclude(["DENY", "OVERTURN"]),
  target: DecisionTargetSchema,
  reasonCodes: z.array(z.string()),
  explanation: z.string().min(1),
});
export type PolicyResult = z.infer<typeof PolicyResultSchema>;

export const HumanDecisionSchema = z.object({
  decisionId: z.string().min(1),
  decidedAt: z.string().datetime({ offset: true }),
  operatorId: z.string().min(1),
  action: DecisionActionSchema,
  target: DecisionTargetSchema,
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()),
  supersedesDecisionId: z.string().min(1).optional(),
});
export type HumanDecision = z.infer<typeof HumanDecisionSchema>;

export const AccountableActionSchema = z.object({
  action: DecisionActionSchema,
  target: DecisionTargetSchema,
  actor: DecisionActorSchema,
  rationale: z.string().min(1),
  reversible: z.boolean(),
});
export type AccountableAction = z.infer<typeof AccountableActionSchema>;

export const CheckpointDecisionSchema = z.object({
  decisionId: z.string().min(1),
  caseId: z.string().min(1),
  checkpointId: CheckpointIdSchema,
  evaluatedAt: z.string().datetime({ offset: true }),
  evidenceSnapshot: z.array(EvidenceArtifactSchema),
  nativeFacts: z.record(z.string(), z.unknown()),
  deterministicSignals: z.array(DeterministicSignalSchema),
  openAIAssessment: OpenAIAssessmentSchema,
  merchantPolicyResult: PolicyResultSchema,
  humanDecision: HumanDecisionSchema.optional(),
  accountableFinalAction: AccountableActionSchema,
  shopperCure: z.array(RequiredActionSchema),
  nextState: CaseStateSchema,
  deadlineAt: z.string().datetime({ offset: true }).optional(),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  highestEvidenceTier: EvidenceTierSchema,
  simulated: z.boolean(),
});
export type CheckpointDecision = z.infer<typeof CheckpointDecisionSchema>;

export const CaseActionEventSchema = z.object({
  eventId: z.string().min(1),
  caseId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  actor: DecisionActorSchema,
  action: DecisionActionSchema,
  target: DecisionTargetSchema,
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()),
  priorState: CaseStateSchema,
  nextState: CaseStateSchema,
  supersedesDecisionId: z.string().min(1).optional(),
});
export type CaseActionEvent = z.infer<typeof CaseActionEventSchema>;

export const CaseSchema = z.object({
  caseId: z.string().min(1),
  merchantId: z.string().min(1),
  merchantName: z.string().min(1),
  shopperAlias: z.string().min(1),
  title: z.string().min(1),
  journey: z.enum(["GOOD_ACTOR_CHECKOUT", "IMPOSSIBLE_LOGISTICS", "PHYSICAL_RETURN"]),
  currentCheckpointId: CheckpointIdSchema,
  state: CaseStateSchema,
  orderAmountCents: z.number().int().nonnegative(),
  expectedLossCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.string().datetime({ offset: true }),
  evidence: z.array(EvidenceArtifactSchema),
  decisions: z.array(CheckpointDecisionSchema),
  events: z.array(CaseActionEventSchema),
  tags: z.array(z.string()),
});
export type ReturnIntegrityCase = z.infer<typeof CaseSchema>;

export const errorAssessment = (summary: string): OpenAIAssessment => ({
  status: "ERROR",
  confidence: 0,
  summary,
  riskIndicators: [],
  exculpatoryIndicators: [],
  missingInformation: ["A human reviewer must assess the evidence because the model was unavailable."],
  recommendedDisposition: "HUMAN_REVIEW",
  imageFindings: [],
});

export const inconclusiveAssessment = (summary: string): OpenAIAssessment => ({
  status: "INCONCLUSIVE",
  confidence: 0,
  summary,
  riskIndicators: [],
  exculpatoryIndicators: [],
  missingInformation: ["More corroborating evidence is required."],
  recommendedDisposition: "HUMAN_REVIEW",
  imageFindings: [],
});
