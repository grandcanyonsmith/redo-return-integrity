import { randomUUID } from "node:crypto";
import { checkpointById } from "./checkpoints.js";
import { assertAssessmentEvidenceReferences, collectNativeFacts, evidenceAvailableAt, highestEvidenceTier } from "./evidence.js";
import { deriveDeterministicSignals } from "./signals.js";
import {
  CheckpointDecisionSchema,
  type AccountableAction,
  type CaseActionEvent,
  type CaseState,
  type CheckpointDecision,
  type CheckpointId,
  type DecisionAction,
  type DecisionActor,
  type DecisionTarget,
  type EvidenceArtifact,
  type HumanDecision,
  type OpenAIAssessment,
  type PolicyResult,
  type RequiredAction,
} from "./types.js";

export const POLICY_VERSION = "juniper-circuit-2026-08-24.1";
export const SCHEMA_VERSION = "checkpoint-decision-1.0";

const policyId = "juniper-circuit-return-integrity";

const cure = (
  owner: RequiredAction["owner"],
  label: string,
  description: string,
  acceptableEvidence: string[],
  optional = false,
): RequiredAction => ({ actionId: randomUUID(), owner, label, description, acceptableEvidence, optional });

const curesFor = (checkpointId: CheckpointId, signalCodes: Set<string>): RequiredAction[] => {
  if (signalCodes.has("ID_VERIFICATION_NOT_COMPLETED") || signalCodes.has("VERIFIED_IDENTITY_MISMATCH")) {
    return [
      cure("SHOPPER", "Choose an alternate verification", "Use a passkey, prior verified payment method, 3DS, or consented identity provider. Noncompletion is not labeled as fraud.", ["PASSKEY", "3DS", "PRIOR_PAYMENT_MATCH", "THIRD_PARTY_ID"]),
      cure("MERCHANT", "Review accessibility or technical failure", "Confirm that a failed or abandoned challenge did not create an adverse fraud label.", ["CHALLENGE_TELEMETRY", "SUPPORT_NOTE"], true),
    ];
  }
  if (signalCodes.has("IMPOSSIBLE_REVERSE_LOGISTICS") || signalCodes.has("LIFECYCLE_TIMESTAMP_CONTRADICTION")) {
    return [
      cure("SHOPPER", "Provide the staffed drop-off receipt", "Upload or select a receipt showing the accepted package, location, and timestamp.", ["CARRIER_RECEIPT", "DROP_OFF_PHOTO"]),
      cure("MERCHANT", "Request a carrier trace", "Allow the carrier to correct an out-of-order or geospatially impossible scan.", ["CARRIER_TRACE", "SCAN_CORRECTION"], true),
    ];
  }
  if (["ITEM_INSPECTION", "WAREHOUSE_RECEIPT"].includes(checkpointId)) {
    return [
      cure("SHOPPER", "Contest with relevant evidence", "Explain the discrepancy and provide existing, relevant photos or records. Do not upload government ID or an unrelated shipping label.", ["SHOPPER_EXPLANATION", "PRE_HANDOFF_PHOTO", "PURCHASE_RECORD"]),
      cure("OPERATOR", "Perform a second protocol inspection", "A second operator may reweigh, recount, rescan, and document any correction.", ["SECOND_INSPECTION", "CALIBRATED_WEIGHT", "SERIAL_SCAN"]),
    ];
  }
  if (checkpointId === "CONTEST_APPEAL_RECOVERY") {
    return [cure("SHOPPER", "Submit appeal evidence", "Add new, relevant evidence for independent review. Prior decisions remain preserved and any correction supersedes them.", ["SHOPPER_EXPLANATION", "CARRIER_RECORD", "PRODUCT_PHOTO"] )];
  }
  return [cure("MERCHANT", "Review available evidence", "Resolve missing or contradictory evidence before taking an adverse action.", ["CASE_EVIDENCE"], true)];
};

const policyActionFor = (
  checkpointId: CheckpointId,
  assessment: OpenAIAssessment,
  signals: ReturnType<typeof deriveDeterministicSignals>,
): PolicyResult => {
  const definition = checkpointById[checkpointId];
  const riskSignals = signals.filter((signal) => signal.riskBearing && signal.status === "OBSERVED");
  const highRisk = riskSignals.some((signal) => signal.severity === "HIGH");
  const idNoncompletionOnly = riskSignals.length === 0 && signals.some((signal) => signal.code === "ID_VERIFICATION_NOT_COMPLETED");

  let action: PolicyResult["action"] = "PASS";
  let explanation = "No policy threshold requiring friction was met with the evidence available at this checkpoint.";

  if (assessment.status === "ERROR" || assessment.status === "INCONCLUSIVE") {
    action = "HUMAN_REVIEW";
    explanation = "The model did not return a reliable assessment, so policy requires human review and prohibits an automatic adverse outcome.";
  } else if (idNoncompletionOnly) {
    action = "REQUEST_EVIDENCE";
    explanation = "Verification was not completed. Policy offers proportionate alternate verification and does not infer fraud from abandonment, refusal, or technical failure.";
  } else if (highRisk) {
    if (["VISIT_SESSION", "IDENTITY_LINK", "CHECKOUT_PAYMENT"].includes(checkpointId)) action = "CHALLENGE";
    else if (["RETURN_REQUEST", "RETURN_AUTHORIZATION", "REVERSE_HANDOFF", "REVERSE_TRANSIT"].includes(checkpointId)) action = "REQUEST_EVIDENCE";
    else action = "HOLD";
    explanation = "A deterministic contradiction crossed a configured threshold. The action is reversible and provides a shopper cure before human adjudication.";
  } else if (assessment.status === "CONCERN" || riskSignals.length > 0) {
    action = ["VISIT_SESSION", "IDENTITY_LINK", "CHECKOUT_PAYMENT"].includes(checkpointId) ? "CHALLENGE" : "HUMAN_REVIEW";
    explanation = "Evidence warrants proportionate review, but the assessment is not itself a finding of fraud.";
  } else if (["RETURN_REQUEST", "RETURN_AUTHORIZATION", "ITEM_INSPECTION", "REFUND_SETTLEMENT"].includes(checkpointId)) {
    action = "APPROVE";
    explanation = "Available evidence supports the requested return or refund under the merchant policy.";
  } else if (checkpointId === "CONTEST_APPEAL_RECOVERY") {
    action = "HUMAN_REVIEW";
    explanation = "Appeals receive accountable human review; any correction is recorded as a superseding event.";
  }

  return {
    policyId,
    policyVersion: POLICY_VERSION,
    action,
    target: definition.target,
    reasonCodes: [
      ...riskSignals.map((signal) => signal.code),
      ...(assessment.status === "ERROR" ? ["MODEL_ERROR"] : []),
      ...(assessment.status === "INCONCLUSIVE" ? ["MODEL_INCONCLUSIVE"] : []),
      ...(idNoncompletionOnly ? ["NONCOMPLETION_NOT_FRAUD"] : []),
    ],
    explanation,
  };
};

const nextStateFor = (action: DecisionAction): CaseState => {
  switch (action) {
    case "CHALLENGE":
    case "REQUEST_EVIDENCE": return "AWAITING_SHOPPER";
    case "HOLD": return "REFUND_HELD";
    case "HUMAN_REVIEW": return "AWAITING_MERCHANT";
    case "APPROVE": return "APPROVED";
    case "PARTIAL_APPROVE": return "PARTIAL_REFUND";
    case "DENY": return "DENIED";
    case "OVERTURN": return "OVERTURNED";
    case "CLOSE": return "CLOSED";
    default: return "ACTIVE";
  }
};

export interface EvaluateCheckpointInput {
  caseId: string;
  checkpointId: CheckpointId;
  evaluatedAt: string;
  allEvidence: readonly EvidenceArtifact[];
  openAIAssessment: OpenAIAssessment;
  modelVersion: string;
  promptVersion: string;
  simulated?: boolean;
  decisionId?: string;
}

export const evaluateCheckpoint = (input: EvaluateCheckpointInput): CheckpointDecision => {
  const snapshot = evidenceAvailableAt(input.allEvidence, input.checkpointId, input.evaluatedAt);
  assertAssessmentEvidenceReferences(input.openAIAssessment, snapshot);
  const nativeFacts = collectNativeFacts(snapshot);
  const signals = deriveDeterministicSignals(nativeFacts, snapshot);
  const merchantPolicyResult = policyActionFor(input.checkpointId, input.openAIAssessment, signals);
  const signalCodes = new Set(signals.map((signal) => signal.code));
  const shopperCure = ["CHALLENGE", "REQUEST_EVIDENCE", "HOLD", "HUMAN_REVIEW"].includes(merchantPolicyResult.action)
    ? curesFor(input.checkpointId, signalCodes)
    : [];
  const accountableFinalAction: AccountableAction = {
    action: merchantPolicyResult.action,
    target: merchantPolicyResult.target,
    actor: "SYSTEM_POLICY",
    rationale: merchantPolicyResult.explanation,
    reversible: !["CLOSE"].includes(merchantPolicyResult.action),
  };
  const deadlineAt = shopperCure.length > 0
    ? new Date(new Date(input.evaluatedAt).getTime() + 72 * 60 * 60 * 1_000).toISOString()
    : undefined;

  const decision = CheckpointDecisionSchema.parse({
    decisionId: input.decisionId ?? randomUUID(),
    caseId: input.caseId,
    checkpointId: input.checkpointId,
    evaluatedAt: input.evaluatedAt,
    evidenceSnapshot: snapshot,
    nativeFacts,
    deterministicSignals: signals,
    openAIAssessment: input.openAIAssessment,
    merchantPolicyResult,
    accountableFinalAction,
    shopperCure,
    nextState: nextStateFor(merchantPolicyResult.action),
    deadlineAt,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    schemaVersion: SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    highestEvidenceTier: highestEvidenceTier(snapshot),
    simulated: input.simulated ?? false,
  });
  assertDecisionInvariant(decision);
  return decision;
};

export const assertDecisionInvariant = (decision: CheckpointDecision): void => {
  const policyAction = (decision.merchantPolicyResult as { action: string }).action;
  if (policyAction === "DENY") {
    throw new Error("Merchant policy and model assessment cannot directly deny a shopper.");
  }
  if (decision.accountableFinalAction.action === "DENY") {
    if (decision.accountableFinalAction.actor !== "HUMAN_OPERATOR" || decision.humanDecision?.action !== "DENY") {
      throw new Error("Only a recorded HumanDecision can finalize DENY.");
    }
  }
};

export const attachHumanDecision = (
  decision: CheckpointDecision,
  humanDecision: HumanDecision,
): CheckpointDecision => {
  const evidenceIds = new Set(decision.evidenceSnapshot.map((artifact) => artifact.evidenceId));
  const unknownIds = humanDecision.evidenceIds.filter((id) => !evidenceIds.has(id));
  if (unknownIds.length > 0) throw new Error(`Human decision referenced unknown evidence: ${unknownIds.join(", ")}`);
  const updated = CheckpointDecisionSchema.parse({
    ...decision,
    humanDecision,
    accountableFinalAction: {
      action: humanDecision.action,
      target: humanDecision.target,
      actor: "HUMAN_OPERATOR",
      rationale: humanDecision.rationale,
      reversible: !["CLOSE"].includes(humanDecision.action),
    },
    nextState: nextStateFor(humanDecision.action),
  });
  assertDecisionInvariant(updated);
  return updated;
};

export interface AppendActionInput {
  caseId: string;
  actor: DecisionActor;
  action: DecisionAction;
  target: DecisionTarget;
  rationale: string;
  evidenceIds: string[];
  priorState: CaseState;
  occurredAt: string;
  supersedesDecisionId?: string;
}

export const appendActionEvent = (
  priorEvents: readonly CaseActionEvent[],
  input: AppendActionInput,
): CaseActionEvent[] => {
  if (["DENY", "OVERTURN", "PARTIAL_APPROVE"].includes(input.action) && input.actor !== "HUMAN_OPERATOR") {
    throw new Error(`${input.action} requires an accountable human operator.`);
  }
  if (input.target === "APPEAL" && input.action === "HUMAN_REVIEW" && !input.supersedesDecisionId) {
    throw new Error("An appeal must reference the decision it contests; it never overwrites that decision.");
  }
  const event: CaseActionEvent = {
    eventId: randomUUID(),
    caseId: input.caseId,
    occurredAt: input.occurredAt,
    actor: input.actor,
    action: input.action,
    target: input.target,
    rationale: input.rationale,
    evidenceIds: [...input.evidenceIds],
    priorState: input.priorState,
    nextState: input.target === "APPEAL" && input.action === "HUMAN_REVIEW" ? "APPEALED" : nextStateFor(input.action),
    supersedesDecisionId: input.supersedesDecisionId,
  };
  return [...priorEvents, event];
};
