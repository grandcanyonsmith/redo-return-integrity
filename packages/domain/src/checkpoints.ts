import type { CheckpointId, DecisionTarget } from "./types.js";

export interface CheckpointDefinition {
  id: CheckpointId;
  ordinal: number;
  stage: "PRE_PURCHASE" | "FULFILLMENT" | "POSSESSION" | "RETURN" | "INSPECTION" | "RESOLUTION";
  label: string;
  description: string;
  target: DecisionTarget;
  availableDecisions: readonly string[];
  commonCures: readonly string[];
}

const define = (
  id: CheckpointId,
  ordinal: number,
  stage: CheckpointDefinition["stage"],
  label: string,
  description: string,
  target: DecisionTarget,
  availableDecisions: readonly string[],
  commonCures: readonly string[],
): CheckpointDefinition => ({ id, ordinal, stage, label, description, target, availableDecisions, commonCures });

export const checkpoints = [
  define("VISIT_SESSION", 1, "PRE_PURCHASE", "Visit & session", "Observe consented session, device, network, and behavior facts.", "CHECKOUT", ["PASS", "PASS_MONITORED", "CHALLENGE"], ["Complete a bot challenge", "Retry without privacy relay if desired"]),
  define("IDENTITY_LINK", 2, "PRE_PURCHASE", "Identity link", "Link the present shopper to prior account, order, and verified identity facts.", "CHECKOUT", ["PASS", "PASS_MONITORED", "CHALLENGE", "REQUEST_EVIDENCE"], ["Use a passkey", "Verify a prior payment method", "Complete optional third-party identity verification"]),
  define("CHECKOUT_PAYMENT", 3, "PRE_PURCHASE", "Checkout & payment", "Evaluate payment authorization and consolidated identity without treating challenge abandonment as fraud.", "CHECKOUT", ["PASS", "PASS_MONITORED", "CHALLENGE", "REQUEST_EVIDENCE"], ["Complete 3DS", "Use a verified payment method", "Choose an alternate fulfillment method"]),
  define("ORDER_RELEASE", 4, "FULFILLMENT", "Order release", "Release, pause, or review an authorized order before pick-and-pack.", "ORDER", ["PASS", "PASS_MONITORED", "HOLD", "HUMAN_REVIEW"], ["Confirm delivery details", "Merchant review"]),
  define("OUTBOUND_PACK", 5, "FULFILLMENT", "Outbound pack", "Record SKU, quantity, serial, weight, and pack imagery as outbound ground truth.", "ORDER", ["PASS", "HOLD", "HUMAN_REVIEW"], ["Re-scan item", "Reweigh package", "Retake protocol photo"]),
  define("OUTBOUND_CUSTODY", 6, "FULFILLMENT", "Outbound custody", "Bind warehouse handoff to carrier acceptance and package measurements.", "ORDER", ["PASS", "PASS_MONITORED", "HOLD", "HUMAN_REVIEW"], ["Obtain carrier acceptance scan", "Reconcile label"]),
  define("DELIVERY_POSSESSION", 7, "POSSESSION", "Delivery & possession", "Record delivery evidence and authorized recipient context.", "ORDER", ["PASS", "PASS_MONITORED", "REQUEST_EVIDENCE"], ["Provide delivery detail", "Report delivery issue"]),
  define("RETURN_REQUEST", 8, "RETURN", "Return request", "Compare the stated reason and requested items with order, policy, and history.", "RETURN_AUTHORIZATION", ["APPROVE", "PARTIAL_APPROVE", "REQUEST_EVIDENCE", "HUMAN_REVIEW"], ["Select exact item and quantity", "Add condition photos", "Explain mismatch"]),
  define("RETURN_AUTHORIZATION", 9, "RETURN", "Return authorization", "Issue the right return method, routing, refund timing, and verification requirements.", "RETURN_AUTHORIZATION", ["APPROVE", "PARTIAL_APPROVE", "REQUEST_EVIDENCE", "HOLD"], ["Use assigned label", "Choose verified drop-off", "Upload pre-handoff photos"]),
  define("REVERSE_HANDOFF", 10, "RETURN", "Reverse handoff", "Capture shopper-to-carrier custody, timestamp, location, label, weight, and receipt.", "REFUND", ["PASS", "PASS_MONITORED", "REQUEST_EVIDENCE", "HOLD"], ["Upload a carrier receipt", "Confirm drop-off location", "Use a staffed scan"]),
  define("REVERSE_TRANSIT", 11, "RETURN", "Reverse transit", "Detect route, timing, label, and package-weight contradictions while allowing carrier correction.", "REFUND", ["PASS", "PASS_MONITORED", "REQUEST_EVIDENCE", "HOLD", "HUMAN_REVIEW"], ["Upload drop-off receipt", "Wait for carrier scan correction", "Carrier trace"]),
  define("WAREHOUSE_RECEIPT", 12, "INSPECTION", "Warehouse receipt", "Record inbound seal, label, weight, photos, and receipt protocol before opening.", "REFUND", ["PASS", "HOLD", "HUMAN_REVIEW"], ["Reweigh on calibrated scale", "Retake label and seal photos", "Supervisor verification"]),
  define("ITEM_INSPECTION", 13, "INSPECTION", "Item inspection", "Compare contents, identity, serial, quantity, condition, and authenticity with outbound truth.", "REFUND", ["APPROVE", "PARTIAL_APPROVE", "HOLD", "HUMAN_REVIEW", "REQUEST_EVIDENCE"], ["Shopper explanation", "Additional unboxing evidence", "Second operator inspection"]),
  define("REFUND_SETTLEMENT", 14, "RESOLUTION", "Refund settlement", "Apply the accountable human decision, policy deadline, protection, and payment status.", "REFUND", ["APPROVE", "PARTIAL_APPROVE", "HOLD", "HUMAN_REVIEW"], ["Merchant decision", "Shopper appeal", "Correct settlement amount"]),
  define("CONTEST_APPEAL_RECOVERY", 15, "RESOLUTION", "Contest, appeal & recovery", "Preserve corrections, issue appeal outcomes, and prepare authorized payment-case evidence.", "APPEAL", ["OVERTURN", "APPROVE", "PARTIAL_APPROVE", "CLOSE", "HUMAN_REVIEW"], ["Submit new evidence", "Independent review", "Correct or supersede prior decision"]),
] as const satisfies readonly CheckpointDefinition[];

export const checkpointById: Readonly<Record<CheckpointId, CheckpointDefinition>> = Object.fromEntries(
  checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]),
) as Record<CheckpointId, CheckpointDefinition>;

export const checkpointOrdinal = (id: CheckpointId): number => checkpointById[id].ordinal;

export const nextCheckpoint = (id: CheckpointId): CheckpointId | undefined => {
  const next = checkpoints.find((candidate) => candidate.ordinal === checkpointOrdinal(id) + 1);
  return next?.id;
};
