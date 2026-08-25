import type { CheckpointId } from "./types.js";

export interface CheckpointDataCatalogEntry {
  checkpointId: CheckpointId;
  dataSources: readonly string[];
  dataPoints: readonly string[];
  escalationTriggers: readonly string[];
  shopperCures: readonly string[];
}

export const checkpointDataCatalog: Readonly<Record<CheckpointId, CheckpointDataCatalogEntry>> = {
  VISIT_SESSION: {
    checkpointId: "VISIT_SESSION",
    dataSources: ["Merchant storefront", "Consent manager", "Bot-defense telemetry", "Redo identity graph"],
    dataPoints: ["Session age", "Page/checkout velocity", "Automation challenge result", "Coarse network region", "Device tenure", "Consent scope", "Prior pseudonymous sessions"],
    escalationTriggers: ["Automated challenge failure", "Impossible interaction velocity", "Known compromised session token"],
    shopperCures: ["Accessible bot challenge", "New secure session", "Guest checkout with monitored fulfillment"],
  },
  IDENTITY_LINK: {
    checkpointId: "IDENTITY_LINK",
    dataSources: ["Merchant account", "Redo identity graph", "Payment token history", "Optional identity provider"],
    dataPoints: ["Account age", "Prior paid orders", "Verified outcomes", "Tokenized instrument continuity", "Passkey status", "Consent", "Verification outcome—not raw ID"],
    escalationTriggers: ["Completed verification mismatch", "Verified account takeover evidence", "Conflicting prior identity binding"],
    shopperCures: ["Passkey", "Prior payment verification", "3DS", "Optional third-party identity verification", "Human support"],
  },
  CHECKOUT_PAYMENT: {
    checkpointId: "CHECKOUT_PAYMENT",
    dataSources: ["Merchant checkout", "Payment processor", "3DS provider", "Address verification", "Redo order history"],
    dataPoints: ["Authorization status", "AVS/CVV result", "3DS result", "Order value", "SKU risk", "Instrument tenure", "Shipping/billing relationship", "Velocity"],
    escalationTriggers: ["Processor decline", "Verified identity contradiction", "High-value novel instrument plus corroborating risk"],
    shopperCures: ["3DS", "Alternate verified instrument", "Passkey", "Pickup/signature option", "Proportionate ID choice"],
  },
  ORDER_RELEASE: {
    checkpointId: "ORDER_RELEASE",
    dataSources: ["Order management", "Payment processor", "Merchant policy", "Inventory system"],
    dataPoints: ["Authorization validity", "Challenge completion", "Inventory allocation", "Address edits", "Release deadline", "Review outcome"],
    escalationTriggers: ["Post-authorization identity change", "Authorization expired", "Unresolved high-risk checkout contradiction"],
    shopperCures: ["Confirm order change", "Reauthorize", "Merchant human review"],
  },
  OUTBOUND_PACK: {
    checkpointId: "OUTBOUND_PACK",
    dataSources: ["Warehouse management", "Barcode/serial scanner", "Calibrated scale", "Protocol cameras"],
    dataPoints: ["SKU", "Quantity", "Serial", "Item and packed weight", "Tare", "Top/side photos", "Operator", "Station", "Calibration"],
    escalationTriggers: ["Pick mismatch", "Serial mismatch", "Weight outside tolerance", "Missing protocol capture"],
    shopperCures: ["Not shopper-facing; re-pick, rescan, reweigh, or retake before shipment"],
  },
  OUTBOUND_CUSTODY: {
    checkpointId: "OUTBOUND_CUSTODY",
    dataSources: ["Warehouse manifest", "Carrier acceptance", "Label service", "Dock camera"],
    dataPoints: ["Label", "Package ID", "Manifest", "Acceptance timestamp/location", "Carrier weight", "Seal", "Custody actor"],
    escalationTriggers: ["No carrier acceptance", "Label mismatch", "Large carrier/warehouse weight delta"],
    shopperCures: ["Not shopper-facing; warehouse/carrier reconciliation"],
  },
  DELIVERY_POSSESSION: {
    checkpointId: "DELIVERY_POSSESSION",
    dataSources: ["Carrier", "Delivery photo/signature", "Locker or pickup provider", "Shopper report"],
    dataPoints: ["Delivery status", "Timestamp", "Coarse location", "Signature/locker release", "Package condition", "Delivery dispute"],
    escalationTriggers: ["Possession contradiction", "Delivery damage", "Carrier proof unavailable"],
    shopperCures: ["Report nonreceipt", "Provide delivery context", "Carrier trace", "Signed pickup evidence"],
  },
  RETURN_REQUEST: {
    checkpointId: "RETURN_REQUEST",
    dataSources: ["Redo return portal", "Order catalog", "Merchant return policy", "Customer support", "Return history"],
    dataPoints: ["Selected items/quantity", "Reason", "Condition assertion", "Photos", "Policy window", "Requested remedy", "Prior verified outcomes"],
    escalationTriggers: ["Item not on order", "Quantity exceeds purchase", "Policy exception", "Contradictory reason/evidence"],
    shopperCures: ["Correct item/quantity", "Condition photos", "Explanation", "Human exception review"],
  },
  RETURN_AUTHORIZATION: {
    checkpointId: "RETURN_AUTHORIZATION",
    dataSources: ["Redo returns", "Merchant policy", "Carrier rates/routes", "Warehouse routing"],
    dataPoints: ["RMA", "Authorized SKU/quantity", "Label", "Route", "Method", "Deadline", "Refund timing", "Verification requirement"],
    escalationTriggers: ["High-value return needs staffed scan", "Unsupported destination", "Policy exception"],
    shopperCures: ["Choose supported method", "Use assigned label", "Staffed drop-off", "Pre-handoff photos"],
  },
  REVERSE_HANDOFF: {
    checkpointId: "REVERSE_HANDOFF",
    dataSources: ["Carrier acceptance", "Drop-off kiosk/store", "Shopper receipt", "Label service"],
    dataPoints: ["Acceptance scan", "Timestamp", "Coarse location", "Label", "Weight", "Receipt", "Package photo", "Custody method"],
    escalationTriggers: ["No acceptance", "Wrong label", "Duplicate label use", "Weight contradiction"],
    shopperCures: ["Staffed receipt", "Drop-off photo", "Correct label", "Carrier trace"],
  },
  REVERSE_TRANSIT: {
    checkpointId: "REVERSE_TRANSIT",
    dataSources: ["Carrier event stream", "Route model", "Weather/service alerts", "Shopper receipt"],
    dataPoints: ["Scan sequence", "Timestamps", "Locations", "Implied speed", "Weight changes", "Reroutes", "Exceptions", "Corrections"],
    escalationTriggers: ["Impossible time/distance", "Duplicate route", "Package weight discontinuity", "Delivery to wrong node"],
    shopperCures: ["Receipt", "Carrier trace", "Wait for scan correction", "Merchant review"],
  },
  WAREHOUSE_RECEIPT: {
    checkpointId: "WAREHOUSE_RECEIPT",
    dataSources: ["Redo warehouse WMS", "Calibrated scale", "Dock/inspection cameras", "Carrier manifest"],
    dataPoints: ["Receipt time", "Label", "Seal/tamper state", "Inbound weight", "Dimensions", "Top/sides photos", "Calibration", "Operator/station"],
    escalationTriggers: ["Empty-weight range", "Label mismatch", "Tampered seal", "Missing protocol evidence"],
    shopperCures: ["Shopper explanation", "Pre-handoff photo", "Second calibrated measurement", "Supervisor protocol check"],
  },
  ITEM_INSPECTION: {
    checkpointId: "ITEM_INSPECTION",
    dataSources: ["Redo operator workstation", "Protocol camera", "Scale", "Serial scanner", "Product catalog", "Outbound ground truth", "OpenAI vision assessment"],
    dataPoints: ["Observed SKU/quantity", "Serial", "Contents", "Condition", "Weight", "Packaging", "Authenticity indicators", "Image quality", "Operator notes", "Model uncertainty"],
    escalationTriggers: ["Empty package", "Decoy/wrong item", "Quantity mismatch", "Serial mismatch", "Possible imitation", "Inconclusive imagery"],
    shopperCures: ["Explanation", "Existing packing photos", "Purchase/serial record", "Second inspection", "Independent authentication"],
  },
  REFUND_SETTLEMENT: {
    checkpointId: "REFUND_SETTLEMENT",
    dataSources: ["Merchant portal", "Redo policy engine", "Payment processor", "Protection ledger", "Case evidence"],
    dataPoints: ["Human decision", "Approved/held/partial amount", "Cure deadline", "Refund status", "Protection payout", "Reason codes", "Notice delivery"],
    escalationTriggers: ["Adverse decision requested", "Deadline expired without review", "Evidence contradiction", "Settlement failure"],
    shopperCures: ["Contest before deadline", "Correct missing evidence", "Appeal", "Payment status support"],
  },
  CONTEST_APPEAL_RECOVERY: {
    checkpointId: "CONTEST_APPEAL_RECOVERY",
    dataSources: ["Shopper portal", "Independent reviewer", "Redo Reclaim handoff", "Payment inquiry/alert/dispute channel", "Carrier", "Protection ledger"],
    dataPoints: ["Contested decision ID", "New evidence", "Prior immutable events", "Appeal outcome", "Recovery status", "Authorized submission status", "Cash recovered", "Correction"],
    escalationTriggers: ["New material evidence", "Conflicting ground truth", "Payment inquiry", "Appeal SLA breach"],
    shopperCures: ["Submit relevant new evidence", "Independent review", "Corrected superseding decision"],
  },
};
