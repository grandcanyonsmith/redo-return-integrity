import { describe, expect, it } from "vitest";
import {
  appendActionEvent,
  attachHumanDecision,
  checkpoints,
  cloneFixtureCases,
  collectNativeFacts,
  computeIntegrityMetrics,
  deriveDeterministicSignals,
  errorAssessment,
  estimateRandomizedDeterrence,
  estimateCheckpointOpportunity,
  evaluateCheckpoint,
  evidenceAvailableAt,
  fixtureCaseById,
  type EvidenceArtifact,
  type OpenAIAssessment,
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
