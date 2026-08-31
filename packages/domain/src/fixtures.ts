import { CaseSchema, type EvidenceArtifact, type ReturnIntegrityCase } from "./types.js";

const merchant = { merchantId: "merchant-skims", merchantName: "SKIMS" } as const;

const artifact = (
  evidenceId: string,
  caseId: string,
  checkpointId: EvidenceArtifact["checkpointId"],
  sourceSystem: string,
  provenanceTier: EvidenceArtifact["provenanceTier"],
  observedAt: string,
  facts: Record<string, unknown>,
  options: Partial<Pick<EvidenceArtifact, "availableAt" | "receivedAt" | "objectKey" | "fixtureUrl" | "checksum" | "piiClass" | "useScope">> = {},
): EvidenceArtifact => ({
  evidenceId,
  caseId,
  checkpointId,
  sourceSystem,
  provenanceTier,
  observedAt,
  availableAt: options.availableAt ?? observedAt,
  receivedAt: options.receivedAt ?? options.availableAt ?? observedAt,
  facts,
  objectKey: options.objectKey,
  fixtureUrl: options.fixtureUrl,
  checksum: options.checksum,
  protocolVersion: "skims-fixture-1.0",
  piiClass: options.piiClass ?? "PSEUDONYMOUS",
  useScope: options.useScope ?? ["RISK_DECISION", "MODEL_EVALUATION", "ANALYTICS"],
});

const checkoutCaseId = "case-good-actor-checkout";
const logisticsCaseId = "case-impossible-logistics";
const physicalCaseId = "case-physical-empty-return";

const goodActorCheckout: ReturnIntegrityCase = CaseSchema.parse({
  caseId: checkoutCaseId,
  ...merchant,
  shopperAlias: "Alex R.",
  title: "Good shopper clears proportionate checkout verification",
  journey: "GOOD_ACTOR_CHECKOUT",
  currentCheckpointId: "ORDER_RELEASE",
  state: "ACTIVE",
  orderAmountCents: 249_900,
  expectedLossCents: 0,
  currency: "USD",
  createdAt: "2026-08-24T14:00:00.000Z",
  evidence: [
    artifact("ev-good-session", checkoutCaseId, "VISIT_SESSION", "merchant-web", "E2", "2026-08-24T14:00:00.000Z", {
      sessionAgeSeconds: 185,
      pageViews: 5,
      automationSignals: 0,
      deviceFirstSeenDaysAgo: 410,
      consentedRiskTelemetry: true,
    }),
    artifact("ev-good-history", checkoutCaseId, "IDENTITY_LINK", "redo-identity-graph", "E2", "2026-08-24T14:02:00.000Z", {
      priorPaidOrders: 6,
      priorApprovedReturns: 1,
      priorVerifiedFraudOutcomes: 0,
      accountAgeDays: 412,
      paymentInstrumentPriorSuccesses: 5,
    }),
    artifact("ev-good-auth", checkoutCaseId, "CHECKOUT_PAYMENT", "payment-simulator", "E3", "2026-08-24T14:04:00.000Z", {
      authorizationStatus: "AUTHORIZED",
      threeDsAvailable: true,
      billingShippingMatch: false,
      amountCents: 249_900,
    }),
    artifact("ev-good-id-initial", checkoutCaseId, "CHECKOUT_PAYMENT", "verify-simulator", "E2", "2026-08-24T14:05:00.000Z", {
      idVerificationStatus: "NOT_COMPLETED",
      verificationReason: "CAMERA_PERMISSION_TECHNICAL_FAILURE",
      incentiveVariant: "FIVE_PERCENT_OPTIONAL",
    }),
    artifact("ev-good-alt-verify", checkoutCaseId, "CHECKOUT_PAYMENT", "payment-simulator", "E3", "2026-08-24T14:08:00.000Z", {
      idVerificationStatus: "VERIFIED",
      alternateVerificationMethod: "3DS_AND_PRIOR_PAYMENT_MATCH",
      threeDsStatus: "AUTHENTICATED",
    }),
    artifact("ev-good-release", checkoutCaseId, "ORDER_RELEASE", "merchant-oms", "E2", "2026-08-24T14:10:00.000Z", {
      releaseStatus: "READY",
      orderIdAlias: "SK-10482",
    }),
  ],
  decisions: [],
  events: [],
  tags: ["good-actor", "checkout", "alternate-verification", "no-auto-label"],
});

const impossibleLogistics: ReturnIntegrityCase = CaseSchema.parse({
  caseId: logisticsCaseId,
  ...merchant,
  shopperAlias: "Morgan T.",
  title: "Impossible carrier scan cured by a staffed drop-off receipt",
  journey: "IMPOSSIBLE_LOGISTICS",
  currentCheckpointId: "REVERSE_TRANSIT",
  state: "AWAITING_SHOPPER",
  orderAmountCents: 89_900,
  expectedLossCents: 89_900,
  currency: "USD",
  createdAt: "2026-08-24T15:00:00.000Z",
  evidence: [
    artifact("ev-log-order", logisticsCaseId, "ORDER_RELEASE", "merchant-oms", "E2", "2026-08-17T16:00:00.000Z", {
      expectedSku: "SK-SL-SLIP-DRESS",
      expectedQuantity: 1,
      orderIdAlias: "SK-10319",
    }),
    artifact("ev-log-delivery", logisticsCaseId, "DELIVERY_POSSESSION", "carrier-simulator", "E3", "2026-08-20T19:25:00.000Z", {
      deliveryStatus: "DELIVERED",
      deliveryRegion: "UT",
    }),
    artifact("ev-log-request", logisticsCaseId, "RETURN_REQUEST", "redo-returns-simulator", "E0", "2026-08-24T15:00:00.000Z", {
      returnReason: "KEY_FEEL_NOT_PREFERRED",
      requestedQuantity: 1,
    }),
    artifact("ev-log-auth", logisticsCaseId, "RETURN_AUTHORIZATION", "redo-returns-simulator", "E2", "2026-08-24T15:03:00.000Z", {
      authorizedReturnLabel: "RMA-SK-10319-A",
      returnMethod: "STAFFED_CARRIER_DROPOFF",
      expectedSku: "SK-SL-SLIP-DRESS",
      expectedQuantity: 1,
    }),
    artifact("ev-log-handoff", logisticsCaseId, "REVERSE_HANDOFF", "carrier-simulator", "E3", "2026-08-24T15:10:00.000Z", {
      observedReturnLabel: "RMA-SK-10319-A",
      handoffLatitude: 40.7608,
      handoffLongitude: -111.891,
      handoffRegion: "Salt Lake City, UT",
      carrierAcceptanceStatus: "ACCEPTED",
    }),
    artifact("ev-log-impossible-scan", logisticsCaseId, "REVERSE_TRANSIT", "carrier-simulator", "E3", "2026-08-24T15:18:00.000Z", {
      nextScanLatitude: 25.7617,
      nextScanLongitude: -80.1918,
      nextScanRegion: "Miami, FL",
      routeDistanceKm: 3340,
      routeElapsedMinutes: 8,
      maximumPlausibleKph: 900,
      carrierEventStatus: "IN_TRANSIT",
    }),
    artifact("ev-log-receipt", logisticsCaseId, "REVERSE_HANDOFF", "shopper-upload-fixture", "E1", "2026-08-24T15:11:00.000Z", {
      receiptCarrier: "ParcelCo",
      receiptDropoffRegion: "Salt Lake City, UT",
      receiptAcceptedAt: "2026-08-24T15:10:00.000Z",
      receiptLabelAlias: "RMA-SK-10319-A",
    }, {
      availableAt: "2026-08-24T15:30:00.000Z",
      receivedAt: "2026-08-24T15:30:00.000Z",
      useScope: ["RISK_DECISION", "CUSTOMER_SUPPORT", "DISPUTE_EVIDENCE", "MODEL_EVALUATION"],
    }),
    artifact("ev-log-carrier-correction", logisticsCaseId, "REVERSE_TRANSIT", "carrier-simulator", "E3", "2026-08-24T15:37:00.000Z", {
      routeDistanceKm: 17,
      routeElapsedMinutes: 27,
      nextScanRegion: "West Valley City, UT",
      carrierEventStatus: "SCAN_CORRECTED",
      correctedEventId: "ev-log-impossible-scan",
    }, {
      availableAt: "2026-08-24T15:37:00.000Z",
      receivedAt: "2026-08-24T15:37:00.000Z",
    }),
  ],
  decisions: [],
  events: [],
  tags: ["carrier-anomaly", "shopper-cure", "receipt", "correction"],
});

const physicalReturn: ReturnIntegrityCase = CaseSchema.parse({
  caseId: physicalCaseId,
  ...merchant,
  shopperAlias: "Taylor S.",
  title: "Protocol inspection finds an empty high-value return",
  journey: "PHYSICAL_RETURN",
  currentCheckpointId: "ITEM_INSPECTION",
  state: "REFUND_HELD",
  orderAmountCents: 11_600,
  expectedLossCents: 11_600,
  currency: "USD",
  createdAt: "2026-08-21T17:00:00.000Z",
  evidence: [
    artifact("ev-physical-order", physicalCaseId, "ORDER_RELEASE", "merchant-oms", "E2", "2026-08-21T17:00:00.000Z", {
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      expectedQuantity: 2,
      expectedSerials: ["SK-EPC-88K2", "SK-EPC-91M7"],
      orderIdAlias: "SK-1042",
      itemDescription: "Fits Everybody Cami Bodysuit (Onyx) · sizes M and L",
      itemRetailValueCents: 11_600,
    }),
    artifact("ev-physical-outbound-weight", physicalCaseId, "OUTBOUND_PACK", "redo-warehouse-scale", "E4", "2026-08-21T17:25:00.000Z", {
      expectedWeightGrams: 380,
      weightToleranceGrams: 25,
      scaleCalibrationStatus: "PASS",
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      expectedQuantity: 2,
      expectedSerials: ["SK-EPC-88K2", "SK-EPC-91M7"],
    }),
    artifact("ev-physical-outbound-photo-top", physicalCaseId, "OUTBOUND_PACK", "redo-warehouse-camera", "E4", "2026-08-21T17:25:10.000Z", {
      captureProtocol: "OUTBOUND_TOP_AND_SIDE",
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      imageRole: "OUTBOUND_PACK_TOP",
    }, {
      fixtureUrl: "/evidence/outbound-two-bodysuits.png",
      piiClass: "NONE",
    }),
    artifact("ev-physical-outbound-photo-side", physicalCaseId, "OUTBOUND_PACK", "redo-warehouse-camera", "E4", "2026-08-21T17:25:12.000Z", {
      captureProtocol: "OUTBOUND_TOP_AND_SIDE",
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      imageRole: "OUTBOUND_PACK_SIDE",
    }, {
      fixtureUrl: "/evidence/outbound-two-bodysuits.png",
      piiClass: "NONE",
    }),
    artifact("ev-physical-label", physicalCaseId, "RETURN_AUTHORIZATION", "redo-returns-simulator", "E2", "2026-08-23T18:00:00.000Z", {
      authorizedReturnLabel: "RMA-8821",
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      expectedQuantity: 2,
    }),
    artifact("ev-physical-carrier", physicalCaseId, "REVERSE_HANDOFF", "carrier-simulator", "E3", "2026-08-23T19:15:00.000Z", {
      observedReturnLabel: "RMA-8821",
      carrierAcceptanceStatus: "ACCEPTED",
      carrierWeightGrams: 42,
    }),
    artifact("ev-physical-receipt", physicalCaseId, "WAREHOUSE_RECEIPT", "redo-warehouse-scale", "E4", "2026-08-24T16:00:00.000Z", {
      observedWeightGrams: 38,
      expectedWeightGrams: 380,
      weightToleranceGrams: 25,
      sealCondition: "INTACT",
      scaleCalibrationStatus: "PASS",
      observedReturnLabel: "RMA-8821",
    }),
    artifact("ev-physical-empty-photo", physicalCaseId, "ITEM_INSPECTION", "redo-warehouse-camera", "E4", "2026-08-24T16:03:00.000Z", {
      captureProtocol: "INBOUND_OPEN_BOX_OVERHEAD",
      expectedSku: "SK-FE-CAMI-BODYSUIT",
      observedSku: "NONE",
      expectedQuantity: 2,
      observedQuantity: 0,
      expectedSerials: ["SK-EPC-88K2", "SK-EPC-91M7"],
      observedSerials: [],
      operatorObservation: "No garments or polybags visible after protocol opening; packing slip only.",
      imageRole: "INBOUND_OPEN_BOX",
    }, {
      fixtureUrl: "/evidence/return-empty-box.png",
      piiClass: "NONE",
      useScope: ["RISK_DECISION", "CUSTOMER_SUPPORT", "DISPUTE_EVIDENCE", "MODEL_EVALUATION", "ANALYTICS"],
    }),
    artifact("ev-physical-second-inspection", physicalCaseId, "ITEM_INSPECTION", "redo-warehouse-operator", "E4", "2026-08-24T16:08:00.000Z", {
      expectedQuantity: 2,
      observedQuantity: 0,
      expectedSerials: ["SK-EPC-88K2", "SK-EPC-91M7"],
      observedSerials: [],
      secondOperatorConfirmed: true,
      inspectionDisposition: "EMPTY_OR_MISSING_CONTENTS",
    }),
    artifact("ev-physical-appeal-assertion", physicalCaseId, "CONTEST_APPEAL_RECOVERY", "shopper-portal", "E0", "2026-08-24T18:10:00.000Z", {
      shopperExplanation: "I put both bodysuits back in the mailer before drop-off. Please review the carrier weight and packing photos.",
      appealSubmitted: true,
    }, {
      useScope: ["RISK_DECISION", "CUSTOMER_SUPPORT", "DISPUTE_EVIDENCE"],
    }),
  ],
  decisions: [],
  events: [],
  tags: ["managed-warehouse", "empty-box", "weight", "multimodal", "human-final"],
});

export const fixtureCases: readonly ReturnIntegrityCase[] = [goodActorCheckout, impossibleLogistics, physicalReturn];

export const syntheticImageFixtures = {
  outboundProtocol: "/evidence/outbound-two-bodysuits.png",
  emptyReturn: "/evidence/return-empty-box.png",
  wrongItem: "/evidence/return-wrong-item.png",
  possibleImitation: "/evidence/return-imitation.png",
  manifest: "/evidence/manifest.json",
} as const;

export const cloneFixtureCases = (): ReturnIntegrityCase[] => fixtureCases.map((fixture) => CaseSchema.parse(structuredClone(fixture)));

export const fixtureCaseById = (caseId: string): ReturnIntegrityCase | undefined => {
  const found = fixtureCases.find((fixture) => fixture.caseId === caseId);
  return found ? CaseSchema.parse(structuredClone(found)) : undefined;
};
