import { z } from "zod";
import { CheckpointIdSchema, type CheckpointId } from "./types.js";

export const RevenueCohortSchema = z.enum(["MANAGED_WAREHOUSE_80M", "BROAD_ADDRESSABLE_200M"]);
export type RevenueCohort = z.infer<typeof RevenueCohortSchema>;

export const revenueCohorts: Readonly<Record<RevenueCohort, {
  annualMerchantGmvDollars: number;
  evidenceScope: string;
  canSupplyPhysicalGroundTruth: boolean;
}>> = {
  MANAGED_WAREHOUSE_80M: {
    annualMerchantGmvDollars: 80_000_000,
    evidenceScope: "Returns physically received under Redo-managed warehouse inspection protocols",
    canSupplyPhysicalGroundTruth: true,
  },
  BROAD_ADDRESSABLE_200M: {
    annualMerchantGmvDollars: 200_000_000,
    evidenceScope: "Broader merchant GMV eligible for checkout, authorization, carrier, and merchant-submitted evidence",
    canSupplyPhysicalGroundTruth: false,
  },
};

export const OutcomeObservationSchema = z.object({
  observationId: z.string().min(1),
  cohort: RevenueCohortSchema,
  eligibleExposureCents: z.number().int().nonnegative(),
  verifiedLossStoppedCents: z.number().int().nonnegative(),
  unresolvedExposureCents: z.number().int().nonnegative(),
  actualRecoveryCents: z.number().int().nonnegative(),
  groundTruthVerified: z.boolean(),
  shopperKnownLegitimate: z.boolean(),
  challenged: z.boolean(),
  challengeCompleted: z.boolean(),
  baselineReviewMinutes: z.number().nonnegative(),
  actualReviewMinutes: z.number().nonnegative(),
  loadedLaborRateDollarsPerHour: z.number().nonnegative(),
});
export type OutcomeObservation = z.infer<typeof OutcomeObservationSchema>;

export const ExperimentArmSchema = z.object({
  assigned: z.number().int().positive(),
  verifiedFraudLossCents: z.number().int().nonnegative(),
  legitimatePurchases: z.number().int().nonnegative(),
  legitimateChallengeAbandonments: z.number().int().nonnegative(),
});

export const RandomizedExperimentSchema = z.object({
  experimentId: z.string().min(1),
  randomized: z.literal(true),
  cohort: RevenueCohortSchema,
  treatment: ExperimentArmSchema,
  control: ExperimentArmSchema,
});
export type RandomizedExperiment = z.infer<typeof RandomizedExperimentSchema>;

export interface DeterrenceEstimate {
  experimentId: string;
  cohort: RevenueCohort;
  estimatedDeterrenceCents: number;
  lossRateTreatmentCentsPerAssignment: number;
  lossRateControlCentsPerAssignment: number;
  legitimateFrictionDeltaPercentagePoints: number;
  method: "RANDOMIZED_INTENT_TO_TREAT";
  caveat: string;
}

export const estimateRandomizedDeterrence = (experiment: RandomizedExperiment): DeterrenceEstimate => {
  const parsed = RandomizedExperimentSchema.parse(experiment);
  const treatmentRate = parsed.treatment.verifiedFraudLossCents / parsed.treatment.assigned;
  const controlRate = parsed.control.verifiedFraudLossCents / parsed.control.assigned;
  const estimated = Math.max(0, controlRate - treatmentRate) * parsed.treatment.assigned;
  const treatmentFriction = parsed.treatment.legitimatePurchases === 0
    ? 0
    : parsed.treatment.legitimateChallengeAbandonments / parsed.treatment.legitimatePurchases;
  const controlFriction = parsed.control.legitimatePurchases === 0
    ? 0
    : parsed.control.legitimateChallengeAbandonments / parsed.control.legitimatePurchases;
  return {
    experimentId: parsed.experimentId,
    cohort: parsed.cohort,
    estimatedDeterrenceCents: Math.round(estimated),
    lossRateTreatmentCentsPerAssignment: treatmentRate,
    lossRateControlCentsPerAssignment: controlRate,
    legitimateFrictionDeltaPercentagePoints: (treatmentFriction - controlFriction) * 100,
    method: "RANDOMIZED_INTENT_TO_TREAT",
    caveat: "An intent-to-treat estimate is causal only to the extent random assignment, sample-ratio checks, outcome capture, and experiment integrity hold. Challenge noncompletion is never counted as fraud.",
  };
};

export interface CohortMetrics {
  cohort: RevenueCohort;
  annualMerchantGmvDollars: number;
  observations: number;
  eligibleExposureCents: number;
  verifiedLossStoppedCents: number;
  estimatedDeterrenceCents: number;
  unresolvedExposureCents: number;
  actualRecoveryCents: number;
  legitimateChallenges: number;
  legitimateChallengeAbandonments: number;
  legitimateFrictionRate: number | null;
  laborHoursSaved: number;
  laborSavingsCents: number;
}

export interface IntegrityMetrics {
  generatedAt: string;
  byCohort: Record<RevenueCohort, CohortMetrics>;
  definitions: Record<string, string>;
  warning: string;
  experiments: DeterrenceEstimate[];
}

const emptyCohort = (cohort: RevenueCohort): CohortMetrics => ({
  cohort,
  annualMerchantGmvDollars: revenueCohorts[cohort].annualMerchantGmvDollars,
  observations: 0,
  eligibleExposureCents: 0,
  verifiedLossStoppedCents: 0,
  estimatedDeterrenceCents: 0,
  unresolvedExposureCents: 0,
  actualRecoveryCents: 0,
  legitimateChallenges: 0,
  legitimateChallengeAbandonments: 0,
  legitimateFrictionRate: null,
  laborHoursSaved: 0,
  laborSavingsCents: 0,
});

export const computeIntegrityMetrics = (
  observations: readonly OutcomeObservation[],
  experiments: readonly RandomizedExperiment[] = [],
  generatedAt = new Date().toISOString(),
): IntegrityMetrics => {
  const parsed = observations.map((observation) => OutcomeObservationSchema.parse(observation));
  const ids = new Set<string>();
  for (const observation of parsed) {
    if (ids.has(observation.observationId)) throw new Error(`Duplicate outcome observation ${observation.observationId}; monetary outcomes must not be double counted.`);
    ids.add(observation.observationId);
  }

  const byCohort: IntegrityMetrics["byCohort"] = {
    MANAGED_WAREHOUSE_80M: emptyCohort("MANAGED_WAREHOUSE_80M"),
    BROAD_ADDRESSABLE_200M: emptyCohort("BROAD_ADDRESSABLE_200M"),
  };
  for (const observation of parsed) {
    const metric = byCohort[observation.cohort];
    metric.observations += 1;
    metric.eligibleExposureCents += observation.eligibleExposureCents;
    metric.verifiedLossStoppedCents += observation.groundTruthVerified ? observation.verifiedLossStoppedCents : 0;
    metric.unresolvedExposureCents += observation.unresolvedExposureCents;
    metric.actualRecoveryCents += observation.actualRecoveryCents;
    if (observation.shopperKnownLegitimate && observation.challenged) {
      metric.legitimateChallenges += 1;
      if (!observation.challengeCompleted) metric.legitimateChallengeAbandonments += 1;
    }
    const savedMinutes = Math.max(0, observation.baselineReviewMinutes - observation.actualReviewMinutes);
    metric.laborHoursSaved += savedMinutes / 60;
    metric.laborSavingsCents += Math.round(savedMinutes / 60 * observation.loadedLaborRateDollarsPerHour * 100);
  }

  const estimates = experiments.map(estimateRandomizedDeterrence);
  for (const estimate of estimates) byCohort[estimate.cohort].estimatedDeterrenceCents += estimate.estimatedDeterrenceCents;
  for (const cohort of Object.values(byCohort)) {
    cohort.laborHoursSaved = Math.round(cohort.laborHoursSaved * 100) / 100;
    cohort.legitimateFrictionRate = cohort.legitimateChallenges === 0
      ? null
      : cohort.legitimateChallengeAbandonments / cohort.legitimateChallenges;
  }

  return {
    generatedAt,
    byCohort,
    definitions: {
      verifiedLossStoppedCents: "Observed loss blocked only when a subsequent E4/E5 ground-truth or adjudicated outcome verifies the attempted loss.",
      estimatedDeterrenceCents: "Incremental loss reduction estimated from randomized intent-to-treat comparisons; never the count or value of shoppers who decline verification.",
      unresolvedExposureCents: "Value still awaiting cure, inspection, review, appeal, or adjudication.",
      actualRecoveryCents: "Cash or liability actually recovered through an authorized dispute, carrier, merchant, or protection process.",
      legitimateFrictionRate: "Known-legitimate challenged shoppers who did not complete the challenge divided by all known-legitimate challenged shoppers.",
      laborSavingsCents: "Measured handling-time reduction multiplied by a declared loaded labor rate; it is not fraud prevention.",
    },
    warning: "The $80M managed-warehouse and $200M broader addressable cohorts are displayed separately. They are planning denominators, not additive revenue and not evidence that a stated percentage of Redo revenue is fraudulent.",
    experiments: estimates,
  };
};

export const demoMetrics = computeIntegrityMetrics([
  {
    observationId: "obs-empty-box-001",
    cohort: "MANAGED_WAREHOUSE_80M",
    eligibleExposureCents: 184_900,
    verifiedLossStoppedCents: 184_900,
    unresolvedExposureCents: 0,
    actualRecoveryCents: 0,
    groundTruthVerified: true,
    shopperKnownLegitimate: false,
    challenged: false,
    challengeCompleted: false,
    baselineReviewMinutes: 24,
    actualReviewMinutes: 7,
    loadedLaborRateDollarsPerHour: 32,
  },
  {
    observationId: "obs-logistics-001",
    cohort: "BROAD_ADDRESSABLE_200M",
    eligibleExposureCents: 24_900,
    verifiedLossStoppedCents: 0,
    unresolvedExposureCents: 24_900,
    actualRecoveryCents: 0,
    groundTruthVerified: false,
    shopperKnownLegitimate: true,
    challenged: true,
    challengeCompleted: true,
    baselineReviewMinutes: 12,
    actualReviewMinutes: 4,
    loadedLaborRateDollarsPerHour: 32,
  },
], [{
  experimentId: "checkout-stepup-demo",
  randomized: true,
  cohort: "BROAD_ADDRESSABLE_200M",
  treatment: { assigned: 1_000, verifiedFraudLossCents: 220_000, legitimatePurchases: 860, legitimateChallengeAbandonments: 19 },
  control: { assigned: 1_000, verifiedFraudLossCents: 310_000, legitimatePurchases: 875, legitimateChallengeAbandonments: 7 },
}], "2026-08-24T00:00:00.000Z");

export const CheckpointOpportunityAssumptionSchema = z.object({
  checkpointId: CheckpointIdSchema,
  exclusiveFraudShare: z.number().min(0).max(1),
  predictableShare: z.number().min(0).max(1),
  interventionSuccessRate: z.number().min(0).max(1),
  evidenceCoverageRate: z.number().min(0).max(1),
});

export interface CheckpointOpportunityInput {
  cohort: RevenueCohort;
  annualMerchantGmvDollars: number;
  returnRate: number;
  fraudulentReturnValueRate: number;
  assumptions: Array<z.infer<typeof CheckpointOpportunityAssumptionSchema>>;
  scenarioLabel: string;
}

export interface CheckpointOpportunityRow {
  checkpointId: CheckpointId;
  baselineExclusiveFraudExposureDollars: number;
  evidenceEligibleExposureDollars: number;
  modelDetectableExposureDollars: number;
  scenarioPreventableDollars: number;
  scenarioPreventableShareOfFraud: number;
}

export interface CheckpointOpportunityModel {
  scenarioLabel: string;
  assumptionsAreIllustrative: true;
  cohort: RevenueCohort;
  annualMerchantGmvDollars: number;
  annualReturnExposureDollars: number;
  annualFraudulentReturnExposureDollars: number;
  rows: CheckpointOpportunityRow[];
  totalScenarioPreventableDollars: number;
  unallocatedFraudShare: number;
  caveat: string;
}

/**
 * A non-overlapping planning funnel. `exclusiveFraudShare` must sum to at most
 * one so the same attempted loss cannot be claimed as prevented at multiple
 * lifecycle stages.
 */
export const estimateCheckpointOpportunity = (input: CheckpointOpportunityInput): CheckpointOpportunityModel => {
  if (!Number.isFinite(input.annualMerchantGmvDollars) || input.annualMerchantGmvDollars < 0) throw new Error("Annual merchant GMV must be nonnegative.");
  if (input.returnRate < 0 || input.returnRate > 1 || input.fraudulentReturnValueRate < 0 || input.fraudulentReturnValueRate > 1) {
    throw new Error("Return and fraudulent-return rates must be between zero and one.");
  }
  const assumptions = input.assumptions.map((assumption) => CheckpointOpportunityAssumptionSchema.parse(assumption));
  const ids = new Set<CheckpointId>();
  for (const assumption of assumptions) {
    if (ids.has(assumption.checkpointId)) throw new Error(`Duplicate checkpoint assumption ${assumption.checkpointId}.`);
    ids.add(assumption.checkpointId);
  }
  const allocatedShare = assumptions.reduce((sum, assumption) => sum + assumption.exclusiveFraudShare, 0);
  if (allocatedShare > 1 + Number.EPSILON * 10) throw new Error("Exclusive checkpoint fraud shares cannot sum above 100%; that would double count preventable loss.");
  const annualReturnExposureDollars = input.annualMerchantGmvDollars * input.returnRate;
  const annualFraudulentReturnExposureDollars = annualReturnExposureDollars * input.fraudulentReturnValueRate;
  const rows = assumptions.map((assumption): CheckpointOpportunityRow => {
    const baseline = annualFraudulentReturnExposureDollars * assumption.exclusiveFraudShare;
    const evidenceEligible = baseline * assumption.evidenceCoverageRate;
    const detectable = evidenceEligible * assumption.predictableShare;
    const preventable = detectable * assumption.interventionSuccessRate;
    return {
      checkpointId: assumption.checkpointId,
      baselineExclusiveFraudExposureDollars: Math.round(baseline),
      evidenceEligibleExposureDollars: Math.round(evidenceEligible),
      modelDetectableExposureDollars: Math.round(detectable),
      scenarioPreventableDollars: Math.round(preventable),
      scenarioPreventableShareOfFraud: annualFraudulentReturnExposureDollars === 0 ? 0 : preventable / annualFraudulentReturnExposureDollars,
    };
  });
  return {
    scenarioLabel: input.scenarioLabel,
    assumptionsAreIllustrative: true,
    cohort: input.cohort,
    annualMerchantGmvDollars: input.annualMerchantGmvDollars,
    annualReturnExposureDollars: Math.round(annualReturnExposureDollars),
    annualFraudulentReturnExposureDollars: Math.round(annualFraudulentReturnExposureDollars),
    rows,
    totalScenarioPreventableDollars: rows.reduce((sum, row) => sum + row.scenarioPreventableDollars, 0),
    unallocatedFraudShare: Math.max(0, 1 - allocatedShare),
    caveat: "This is a scenario calculator, not a Redo forecast. Every rate requires an observed denominator, cohort, time window, and confidence interval before commercial use. Stage shares are mutually exclusive to prevent double counting.",
  };
};
