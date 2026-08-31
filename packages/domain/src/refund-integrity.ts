import type { InspectionClassification } from "./return-intake.js";
import type { RefundPortfolioCase } from "./refund-portfolio.js";

/**
 * NRF/Happy Returns 2025: 9% of all returns are reported fraudulent. This is an
 * all-retail industry benchmark, not an apparel-specific or merchant-specific
 * rate, and the UI labels it that way.
 */
export const industryFraudulentRefundRate = 0.09;

/**
 * Loop Returns observed 23.2% across 22M Shopify apparel returns. Apparel runs
 * materially hotter than the ~13-17% all-retail benchmarks, which is why a
 * physical inspection checkpoint pays for itself faster here.
 */
export const apparelReturnRate = 0.232;

/**
 * Minutes a station saves when the model does the first-pass inspect instead of a
 * full manual grade. No authoritative per-return labor figure is published for
 * apparel, so this is a demo assumption, not a measured result.
 */
export const aiMinutesSavedPerReturn = 6;

export const refundSchemeIds = [
  "WARDROBING",
  "EMPTY_BOX",
  "WRONG_PRODUCT",
  "POSSIBLE_IMITATION",
  "QUANTITY_MISMATCH",
  "DAMAGED_PRODUCT",
] as const;

export type RefundSchemeId = (typeof refundSchemeIds)[number];

export type RefundSchemeSlice = {
  scheme: RefundSchemeId
  label: string
  detail: string
  attemptCount: number
  productCents: number
  caseIds: string[]
};

export type RefundIntegrityImpact = {
  timeSavedMinutes: number
  wrongfulRefundsSaved: number
  wrongfulProductCents: number
  fraudulentAttempts: number
  industryRate: number
  schemes: RefundSchemeSlice[]
};

export const refundSchemeLabel = (scheme: RefundSchemeId): string => {
  switch (scheme) {
    case "WARDROBING":
      return "Wardrobing";
    case "EMPTY_BOX":
      return "Empty mailers";
    case "WRONG_PRODUCT":
      return "Decoy returns";
    case "DAMAGED_PRODUCT":
      return "Damage claims";
    case "QUANTITY_MISMATCH":
      return "Short-shipped returns";
    case "POSSIBLE_IMITATION":
      return "Imitation attempts";
    default: {
      const exhausted: never = scheme;
      return exhausted;
    }
  }
};

export const refundSchemeDetail = (scheme: RefundSchemeId): string => {
  switch (scheme) {
    case "WARDROBING":
      return "Worn, then returned as new with the tag or liner detached";
    case "EMPTY_BOX":
      return "Mailer arrived with no garment inside";
    case "WRONG_PRODUCT":
      return "A different, lower-value garment sent back in its place";
    case "DAMAGED_PRODUCT":
      return "Damage claimed against a garment that arrived wearable";
    case "QUANTITY_MISMATCH":
      return "Fewer pieces in the mailer than the return claims";
    case "POSSIBLE_IMITATION":
      return "Construction and care labels differ from the catalog reference";
    default: {
      const exhausted: never = scheme;
      return exhausted;
    }
  }
};

export const refundSchemeIdFor = (classification: InspectionClassification | null): RefundSchemeId | null => {
  switch (classification) {
    case "EMPTY_BOX":
      return "EMPTY_BOX";
    case "WRONG_PRODUCT":
      return "WRONG_PRODUCT";
    case "DAMAGED_PRODUCT":
      return "DAMAGED_PRODUCT";
    case "QUANTITY_MISMATCH":
      return "QUANTITY_MISMATCH";
    case "POSSIBLE_IMITATION":
      return "POSSIBLE_IMITATION";
    case "WARDROBING":
      return "WARDROBING";
    case "MATCH":
    case "INCONCLUSIVE":
    case null:
      return null;
    default: {
      const exhausted: never = classification;
      return exhausted;
    }
  }
};

export const productValueCents = (item: RefundPortfolioCase): number =>
  item.returnRecord.product.totalEligibleRefundCents;

export const formatMinutesSaved = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

const emptySlice = (scheme: RefundSchemeId): RefundSchemeSlice => ({
  scheme,
  label: refundSchemeLabel(scheme),
  detail: refundSchemeDetail(scheme),
  attemptCount: 0,
  productCents: 0,
  caseIds: [],
});

/** Time saved, wrongful payouts held, and scheme mix from the real case book. */
export const summarizeRefundIntegrity = (cases: readonly RefundPortfolioCase[]): RefundIntegrityImpact => {
  const byScheme = new Map<RefundSchemeId, RefundSchemeSlice>(
    refundSchemeIds.map((scheme) => [scheme, emptySlice(scheme)]),
  );
  let wrongfulRefundsSaved = 0;
  let wrongfulProductCents = 0;

  for (const item of cases) {
    const scheme = refundSchemeIdFor(item.classification);
    if (scheme) {
      const slice = byScheme.get(scheme);
      if (slice) {
        slice.attemptCount += 1;
        slice.productCents += productValueCents(item);
        slice.caseIds.push(item.caseId);
      }
    }
    if (item.boardColumn === "FRAUDULENT") {
      wrongfulRefundsSaved += 1;
      wrongfulProductCents += productValueCents(item);
    }
  }

  return {
    timeSavedMinutes: cases.length * aiMinutesSavedPerReturn,
    wrongfulRefundsSaved,
    wrongfulProductCents,
    fraudulentAttempts: [...byScheme.values()].reduce((sum, slice) => sum + slice.attemptCount, 0),
    industryRate: industryFraudulentRefundRate,
    schemes: refundSchemeIds.map((scheme) => byScheme.get(scheme) ?? emptySlice(scheme)),
  };
};
