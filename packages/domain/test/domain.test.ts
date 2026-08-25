import { describe, expect, it } from "vitest";
import {
  appendActionEvent,
  attachHumanDecision,
  checkpoints,
  cloneFixtureCases,
  collectNativeFacts,
  computeIntegrityMetrics,
  deriveDeterministicSignals,
  deriveInspectionRecommendation,
  enforceInspectionFindingInvariants,
  errorAssessment,
  estimateRandomizedDeterrence,
  estimateCheckpointOpportunity,
  evaluateCheckpoint,
  evidenceAvailableAt,
  fixtureCaseById,
  fixtureInspectionFinding,
  fixtureReturnRecords,
  OperatorReviewRecordSchema,
  type EvidenceArtifact,
  type InspectionModelFinding,
  type OpenAIAssessment,
  type ReturnRecord,
} from "../src/index.js";

const passAssessment: OpenAIAssessment = {
  status: "PASS",
  confidence: 0.8,
  summary: "No unresolved model concern.",
  riskIndicators: [],
  exculpatoryIndicators: [],
  missingInformation: [],
  recommendedDisposition: "PASS_MONITORED",
  imageFindings: [],
};

describe("lifecycle contract", () => {
  it("publishes every checkpoint in strict order", () => {
    expect(checkpoints).toHaveLength(15);
    expect(checkpoints.map((checkpoint) => checkpoint.ordinal)).toEqual([...Array(15)].map((_, index) => index + 1));
    expect(checkpoints[0]?.id).toBe("VISIT_SESSION");
    expect(checkpoints.at(-1)?.id).toBe("CONTEST_APPEAL_RECOVERY");
  });

  it("prevents future-time and later-checkpoint evidence leakage", () => {
    const evidence: EvidenceArtifact[] = [
      {
        evidenceId: "now",
        caseId: "case",
        checkpointId: "CHECKOUT_PAYMENT",
        sourceSystem: "test",
        provenanceTier: "E2",
        observedAt: "2026-01-01T00:00:00.000Z",
        availableAt: "2026-01-01T00:00:00.000Z",
        receivedAt: "2026-01-01T00:00:00.000Z",
        facts: { safe: true },
        protocolVersion: "test",
        piiClass: "NONE",
        useScope: ["RISK_DECISION"],
      },
      {
        evidenceId: "future-available",
        caseId: "case",
        checkpointId: "CHECKOUT_PAYMENT",
        sourceSystem: "test",
        provenanceTier: "E5",
        observedAt: "2026-01-01T00:00:00.000Z",
        availableAt: "2026-01-02T00:00:00.000Z",
        receivedAt: "2026-01-02T00:00:00.000Z",
        facts: { leakedOutcome: true },
        protocolVersion: "test",
        piiClass: "NONE",
        useScope: ["RISK_DECISION"],
      },
      {
        evidenceId: "later-stage",
        caseId: "case",
        checkpointId: "ITEM_INSPECTION",
        sourceSystem: "test",
        provenanceTier: "E4",
        observedAt: "2025-12-31T00:00:00.000Z",
        availableAt: "2025-12-31T00:00:00.000Z",
        receivedAt: "2025-12-31T00:00:00.000Z",
        facts: { futureStage: true },
        protocolVersion: "test",
        piiClass: "NONE",
        useScope: ["RISK_DECISION"],
      },
    ];
    expect(evidenceAvailableAt(evidence, "CHECKOUT_PAYMENT", "2026-01-01T12:00:00.000Z").map((item) => item.evidenceId)).toEqual(["now"]);
  });

  it("never turns identity noncompletion into a fraud-bearing signal", () => {
    const caseData = fixtureCaseById("case-good-actor-checkout")!;
    const decision = evaluateCheckpoint({
      caseId: caseData.caseId,
      checkpointId: "CHECKOUT_PAYMENT",
      evaluatedAt: "2026-08-24T14:06:00.000Z",
      allEvidence: caseData.evidence,
      openAIAssessment: passAssessment,
      modelVersion: "test",
      promptVersion: "test",
    });
    const signal = decision.deterministicSignals.find((candidate) => candidate.code === "ID_VERIFICATION_NOT_COMPLETED");
    expect(signal).toMatchObject({ severity: "INFO", riskBearing: false });
    expect(decision.merchantPolicyResult.action).toBe("REQUEST_EVIDENCE");
    expect(decision.merchantPolicyResult.reasonCodes).toContain("NONCOMPLETION_NOT_FRAUD");
    expect(JSON.stringify(decision).toLowerCase()).not.toContain("inferred fraud");
  });

  it("routes model errors and inconclusive assessments to human review", () => {
    const caseData = fixtureCaseById("case-good-actor-checkout")!;
    const decision = evaluateCheckpoint({
      caseId: caseData.caseId,
      checkpointId: "ORDER_RELEASE",
      evaluatedAt: "2026-08-24T14:11:00.000Z",
      allEvidence: caseData.evidence,
      openAIAssessment: errorAssessment("test outage"),
      modelVersion: "test",
      promptVersion: "test",
    });
    expect(decision.accountableFinalAction).toMatchObject({ action: "HUMAN_REVIEW", actor: "SYSTEM_POLICY", reversible: true });
  });

  it("allows only a human decision to finalize denial", () => {
    const caseData = fixtureCaseById("case-physical-empty-return")!;
    const decision = evaluateCheckpoint({
      caseId: caseData.caseId,
      checkpointId: "ITEM_INSPECTION",
      evaluatedAt: "2026-08-24T16:09:00.000Z",
      allEvidence: caseData.evidence,
      openAIAssessment: { ...passAssessment, status: "CONCERN", recommendedDisposition: "HUMAN_REVIEW" },
      modelVersion: "test",
      promptVersion: "test",
    });
    expect(decision.accountableFinalAction.action).not.toBe("DENY");
    expect(decision.accountableFinalAction.action).toBe("HOLD");

    const human = attachHumanDecision(decision, {
      decisionId: "human-final-1",
      decidedAt: "2026-08-24T16:12:00.000Z",
      operatorId: "operator-2",
      action: "DENY",
      target: "REFUND",
      rationale: "Two protocol inspections and calibrated weights found no returned item; shopper may appeal.",
      evidenceIds: ["ev-physical-receipt", "ev-physical-empty-photo", "ev-physical-second-inspection"],
      supersedesDecisionId: decision.decisionId,
    });
    expect(human.accountableFinalAction).toMatchObject({ action: "DENY", actor: "HUMAN_OPERATOR" });
  });

  it("keeps appeals as superseding append-only events", () => {
    const prior = appendActionEvent([], {
      caseId: "case",
      actor: "HUMAN_OPERATOR",
      action: "DENY",
      target: "REFUND",
      rationale: "Protocol-reviewed evidence",
      evidenceIds: ["e1"],
      priorState: "REFUND_HELD",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    const appealed = appendActionEvent(prior, {
      caseId: "case",
      actor: "SHOPPER",
      action: "HUMAN_REVIEW",
      target: "APPEAL",
      rationale: "New carrier record submitted",
      evidenceIds: ["e2"],
      priorState: "DENIED",
      occurredAt: "2026-01-02T00:00:00.000Z",
      supersedesDecisionId: "human-final-1",
    });
    expect(appealed).toHaveLength(2);
    expect(appealed[0]).toEqual(prior[0]);
    expect(appealed[1]).toMatchObject({ nextState: "APPEALED", supersedesDecisionId: "human-final-1" });
  });
});

describe("deterministic signals", () => {
  it("calculates route, weight, quantity, SKU, and serial contradictions", () => {
    const caseData = fixtureCaseById("case-physical-empty-return")!;
    const snapshot = evidenceAvailableAt(caseData.evidence, "ITEM_INSPECTION", "2026-08-24T16:09:00.000Z");
    const signals = deriveDeterministicSignals(collectNativeFacts(snapshot), snapshot);
    expect(signals.map((signal) => signal.code)).toEqual(expect.arrayContaining([
      "POSSIBLE_EMPTY_PACKAGE_WEIGHT",
      "QUANTITY_MISMATCH",
      "SKU_MISMATCH",
      "SERIAL_MISMATCH",
    ]));

    const logistics = fixtureCaseById("case-impossible-logistics")!;
    const beforeCorrection = evidenceAvailableAt(logistics.evidence, "REVERSE_TRANSIT", "2026-08-24T15:20:00.000Z");
    expect(deriveDeterministicSignals(collectNativeFacts(beforeCorrection), beforeCorrection).map((signal) => signal.code)).toContain("IMPOSSIBLE_REVERSE_LOGISTICS");
    const afterCorrection = evidenceAvailableAt(logistics.evidence, "REVERSE_TRANSIT", "2026-08-24T15:40:00.000Z");
    expect(deriveDeterministicSignals(collectNativeFacts(afterCorrection), afterCorrection).map((signal) => signal.code)).not.toContain("IMPOSSIBLE_REVERSE_LOGISTICS");
  });

  it("ships isolated deep-cloned fixture cases", () => {
    const first = cloneFixtureCases();
    const second = cloneFixtureCases();
    first[0]!.tags.push("mutation");
    expect(second[0]!.tags).not.toContain("mutation");
  });
});

describe("measurement math", () => {
  it("estimates deterrence only from randomized intent-to-treat loss rates", () => {
    const estimate = estimateRandomizedDeterrence({
      experimentId: "exp",
      randomized: true,
      cohort: "BROAD_ADDRESSABLE_200M",
      treatment: { assigned: 1_000, verifiedFraudLossCents: 100_000, legitimatePurchases: 900, legitimateChallengeAbandonments: 18 },
      control: { assigned: 1_000, verifiedFraudLossCents: 180_000, legitimatePurchases: 900, legitimateChallengeAbandonments: 9 },
    });
    expect(estimate.estimatedDeterrenceCents).toBe(80_000);
    expect(estimate.legitimateFrictionDeltaPercentagePoints).toBeCloseTo(1);
    expect(estimate.method).toBe("RANDOMIZED_INTENT_TO_TREAT");
  });

  it("separates cohorts and monetary concepts and refuses duplicate observations", () => {
    const observation = {
      observationId: "one",
      cohort: "MANAGED_WAREHOUSE_80M" as const,
      eligibleExposureCents: 100_000,
      verifiedLossStoppedCents: 80_000,
      unresolvedExposureCents: 20_000,
      actualRecoveryCents: 5_000,
      groundTruthVerified: false,
      shopperKnownLegitimate: true,
      challenged: true,
      challengeCompleted: false,
      baselineReviewMinutes: 20,
      actualReviewMinutes: 5,
      loadedLaborRateDollarsPerHour: 40,
    };
    const metrics = computeIntegrityMetrics([observation], [], "2026-01-01T00:00:00.000Z");
    expect(metrics.byCohort.MANAGED_WAREHOUSE_80M).toMatchObject({
      verifiedLossStoppedCents: 0,
      unresolvedExposureCents: 20_000,
      actualRecoveryCents: 5_000,
      laborSavingsCents: 1_000,
    });
    expect(metrics.byCohort.BROAD_ADDRESSABLE_200M.observations).toBe(0);
    expect(() => computeIntegrityMetrics([observation, observation])).toThrow(/Duplicate outcome/);
  });

  it("quantifies stage opportunity without double counting lifecycle dollars", () => {
    const model = estimateCheckpointOpportunity({
      cohort: "BROAD_ADDRESSABLE_200M",
      annualMerchantGmvDollars: 200_000_000,
      returnRate: 0.2,
      fraudulentReturnValueRate: 0.1,
      scenarioLabel: "User-provided arithmetic example—not a Redo forecast",
      assumptions: [
        { checkpointId: "CHECKOUT_PAYMENT", exclusiveFraudShare: 0.2, evidenceCoverageRate: 1, predictableShare: 0.8, interventionSuccessRate: 0.5 },
        { checkpointId: "ITEM_INSPECTION", exclusiveFraudShare: 0.3, evidenceCoverageRate: 0.4, predictableShare: 0.9, interventionSuccessRate: 0.8 },
      ],
    });
    expect(model.annualFraudulentReturnExposureDollars).toBe(4_000_000);
    expect(model.rows[0]?.scenarioPreventableDollars).toBe(320_000);
    expect(model.unallocatedFraudShare).toBe(0.5);
    expect(() => estimateCheckpointOpportunity({
      cohort: "BROAD_ADDRESSABLE_200M",
      annualMerchantGmvDollars: 1,
      returnRate: 1,
      fraudulentReturnValueRate: 1,
      scenarioLabel: "invalid",
      assumptions: [
        { checkpointId: "VISIT_SESSION", exclusiveFraudShare: 0.6, evidenceCoverageRate: 1, predictableShare: 1, interventionSuccessRate: 1 },
        { checkpointId: "CHECKOUT_PAYMENT", exclusiveFraudShare: 0.6, evidenceCoverageRate: 1, predictableShare: 1, interventionSuccessRate: 1 },
      ],
    })).toThrow(/double count/);
  });
});

describe("return intake recommendations", () => {
  const returnRecord = fixtureReturnRecords[0]!;

  it("computes full and quantity-based partial cents deterministically", () => {
    const full = deriveInspectionRecommendation({
      returnRecord,
      finding: fixtureInspectionFinding(
        "matchReturn",
        returnRecord.product.quantity,
        "ev-matchReturn",
        returnRecord.product.serials,
      ),
    });
    expect(full).toMatchObject({
      nextAction: "APPROVE_FULL",
      refund: {
        recommendedType: "FULL",
        recommendedAmountCents: 184_900,
        withholdAmountCents: 0,
        requiresHumanApproval: true,
      },
    });

    const partial = deriveInspectionRecommendation({
      returnRecord,
      finding: fixtureInspectionFinding("quantityMismatch", returnRecord.product.quantity),
    });
    expect(partial).toMatchObject({
      nextAction: "APPROVE_PARTIAL",
      refund: {
        recommendedType: "PARTIAL",
        recommendedAmountCents: 92_450,
        withholdAmountCents: 92_450,
        requiresHumanApproval: true,
      },
    });
  });

  it("downgrades every classification whose semantic fields contradict it", () => {
    const matching = fixtureInspectionFinding(
      "matchReturn",
      returnRecord.product.quantity,
      "ev-matchReturn",
      returnRecord.product.serials,
    );
    const empty = fixtureInspectionFinding("emptyReturn", returnRecord.product.quantity);
    const quantity = fixtureInspectionFinding("quantityMismatch", returnRecord.product.quantity);
    const wrong = fixtureInspectionFinding("wrongItem", returnRecord.product.quantity);
    const damaged = fixtureInspectionFinding("damagedProduct", returnRecord.product.quantity);
    const imitation = fixtureInspectionFinding("possibleImitation", returnRecord.product.quantity);
    const adversarial: ReadonlyArray<[string, InspectionModelFinding]> = [
      ["MATCH with a false SKU comparison", {
        ...matching,
        comparison: { ...matching.comparison, skuMatch: false },
      }],
      ["MATCH without the required serial assessment or observed serials", {
        ...matching,
        observedItems: matching.observedItems.map((item) => ({ ...item, serials: [] })),
        comparison: { ...matching.comparison, serialMatch: null },
      }],
      ["MATCH with unexpected serial evidence", {
        ...matching,
        observedItems: matching.observedItems.map((item) => ({ ...item, serials: ["UNEXPECTED-SERIAL"] })),
      }],
      ["EMPTY_BOX with a visible item", {
        ...empty,
        observedItems: matching.observedItems,
        comparison: {
          ...empty.comparison,
          observedQuantity: returnRecord.product.quantity,
          quantityMatch: true,
        },
      }],
      ["QUANTITY_MISMATCH at the expected quantity", {
        ...quantity,
        observedItems: matching.observedItems,
        comparison: {
          ...quantity.comparison,
          observedQuantity: returnRecord.product.quantity,
          quantityMatch: true,
        },
      }],
      ["QUANTITY_MISMATCH with the wrong SKU", {
        ...quantity,
        comparison: { ...quantity.comparison, skuMatch: false },
      }],
      ["QUANTITY_MISMATCH with damaged contents", {
        ...quantity,
        observedItems: quantity.observedItems.map((item) => ({ ...item, condition: "DAMAGED" as const })),
        comparison: { ...quantity.comparison, damageObserved: true },
      }],
      ["WRONG_PRODUCT without visible contents", {
        ...wrong,
        observedItems: [],
        comparison: { ...wrong.comparison, observedQuantity: 0, quantityMatch: false },
      }],
      ["DAMAGED_PRODUCT without affirmative damage", {
        ...damaged,
        observedItems: damaged.observedItems.map((item) => ({ ...item, condition: "USED" as const })),
        comparison: { ...damaged.comparison, damageObserved: false },
      }],
      ["POSSIBLE_IMITATION without a visible item", {
        ...imitation,
        observedItems: [],
        comparison: { ...imitation.comparison, observedQuantity: 0, quantityMatch: false },
      }],
    ];

    for (const [label, finding] of adversarial) {
      const invariantSafe = enforceInspectionFindingInvariants({ returnRecord, finding });
      expect(invariantSafe.classification, label).toBe("INCONCLUSIVE");
      expect(invariantSafe.confidence, label).toBe(0);
      expect(invariantSafe.summary, label).toContain("internally inconsistent");
      expect(invariantSafe.missingEvidence.some((reason) => reason.includes("Semantic consistency check")), label).toBe(true);
      expect(deriveInspectionRecommendation({ returnRecord, finding }), label).toMatchObject({
        nextAction: "REQUEST_MORE_EVIDENCE",
        refund: {
          recommendedType: "NO_RECOMMENDATION",
          recommendedAmountCents: null,
          requiresHumanApproval: true,
        },
      });
    }
  });

  it("rejects return-record quantity drift and disagreement between item rows and observed quantity", () => {
    const matching = fixtureInspectionFinding(
      "matchReturn",
      returnRecord.product.quantity,
      "ev-matchReturn",
      returnRecord.product.serials,
    );
    const wrongExpected = enforceInspectionFindingInvariants({
      returnRecord,
      finding: {
        ...matching,
        comparison: { ...matching.comparison, expectedQuantity: returnRecord.product.quantity + 1 },
      },
    });
    expect(wrongExpected).toMatchObject({ classification: "INCONCLUSIVE", confidence: 0 });
    expect(wrongExpected.missingEvidence.join(" ")).toContain("return record quantity");

    const wrongSum = enforceInspectionFindingInvariants({
      returnRecord,
      finding: {
        ...matching,
        observedItems: matching.observedItems.map((item) => ({ ...item, quantity: 1 })),
      },
    });
    expect(wrongSum).toMatchObject({ classification: "INCONCLUSIVE", confidence: 0 });
    expect(wrongSum.missingEvidence.join(" ")).toContain("item-row total");
  });

  it("keeps possible imitation explicitly unproven and subject to qualified authentication", () => {
    const invariantSafe = enforceInspectionFindingInvariants({
      returnRecord,
      finding: fixtureInspectionFinding("possibleImitation", returnRecord.product.quantity),
    });
    expect(invariantSafe.classification).toBe("POSSIBLE_IMITATION");
    expect(invariantSafe.summary).toContain("does not establish authenticity");
    expect(invariantSafe.missingEvidence.join(" ")).toContain("cannot prove imitation or counterfeit status");
  });

  it("caps full, partial, and temporary-hold dollars by both eligibility and the shopper request", () => {
    const requestedRefundCents = 50_000;
    const cappedRecord = {
      ...returnRecord,
      return: { ...returnRecord.return, requestedRefundCents },
    } satisfies ReturnRecord;

    const full = deriveInspectionRecommendation({
      returnRecord: cappedRecord,
      finding: fixtureInspectionFinding(
        "matchReturn",
        cappedRecord.product.quantity,
        "ev-matchReturn-capped",
        cappedRecord.product.serials,
      ),
    });
    const partial = deriveInspectionRecommendation({
      returnRecord: cappedRecord,
      finding: fixtureInspectionFinding("quantityMismatch", cappedRecord.product.quantity),
    });
    const held = deriveInspectionRecommendation({
      returnRecord: cappedRecord,
      finding: fixtureInspectionFinding("emptyReturn", cappedRecord.product.quantity),
    });

    expect(full.refund).toMatchObject({
      recommendedAmountCents: requestedRefundCents,
      withholdAmountCents: 0,
      requiresHumanApproval: true,
    });
    expect(partial.refund).toMatchObject({
      recommendedAmountCents: requestedRefundCents,
      withholdAmountCents: 0,
      requiresHumanApproval: true,
    });
    expect(held.refund).toMatchObject({
      recommendedAmountCents: null,
      withholdAmountCents: requestedRefundCents,
      requiresHumanApproval: true,
    });
  });

  it("uses temporary holds without model-generated dollars for empty, wrong, or possibly imitated contents", () => {
    for (const fixtureId of ["emptyReturn", "wrongItem", "possibleImitation"] as const) {
      const recommendation = deriveInspectionRecommendation({
        returnRecord,
        finding: fixtureInspectionFinding(fixtureId, returnRecord.product.quantity),
      });
      expect(recommendation.refund).toMatchObject({
        recommendedType: "TEMPORARY_HOLD",
        recommendedAmountCents: null,
        withholdAmountCents: 184_900,
        requiresHumanApproval: true,
      });
      expect(recommendation.communication.recommended).toBe(true);
    }
  });

  it("declines to price damage or inconclusive evidence", () => {
    for (const fixtureId of ["damagedProduct", "unknown"] as const) {
      const recommendation = deriveInspectionRecommendation({
        returnRecord,
        finding: fixtureInspectionFinding(fixtureId, returnRecord.product.quantity),
      });
      expect(recommendation.refund).toMatchObject({
        recommendedType: "NO_RECOMMENDATION",
        recommendedAmountCents: null,
        withholdAmountCents: null,
        requiresHumanApproval: true,
      });
    }
  });

  it("requires explicit human acknowledgments while labeling demo reviewer identity honestly", () => {
    const review = OperatorReviewRecordSchema.parse({
      reviewId: "review-1",
      inspectionId: "inspection-1",
      draftId: "draft-1",
      returnRecordId: "ret-jc-1042",
      reviewerLabel: "  Warehouse Operator 7  ",
      reviewerIdentityAssurance: "UNAUTHENTICATED_DISPLAY_LABEL",
      draftDecision: "APPROVE_AS_WRITTEN",
      draftContentSha256: "a".repeat(64),
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      reviewedAt: "2026-08-24T18:00:00.000Z",
      evidenceIds: ["ev-package-1"],
    });
    expect(review.reviewerLabel).toBe("Warehouse Operator 7");
    expect(review.reviewerIdentityAssurance).toBe("UNAUTHENTICATED_DISPLAY_LABEL");
    expect(OperatorReviewRecordSchema.safeParse({ ...review, acknowledgedEvidence: false }).success).toBe(false);
  });
});
