import { checkpointOrdinal } from "./checkpoints.js";
import { evidenceIdsForFacts } from "./evidence.js";
import type { DeterministicSignal, EvidenceArtifact } from "./types.js";

const numberFact = (facts: Record<string, unknown>, key: string): number | undefined => {
  const value = facts[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const stringFact = (facts: Record<string, unknown>, key: string): string | undefined => {
  const value = facts[key];
  return typeof value === "string" ? value : undefined;
};

const stringArrayFact = (facts: Record<string, unknown>, key: string): string[] | undefined => {
  const value = facts[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
};

const observed = (
  code: string,
  label: string,
  severity: DeterministicSignal["severity"],
  riskBearing: boolean,
  explanation: string,
  evidenceIds: string[],
  numeric?: Pick<DeterministicSignal, "value" | "threshold" | "unit">,
): DeterministicSignal => ({
  code,
  label,
  status: "OBSERVED",
  severity,
  riskBearing,
  explanation,
  evidenceIds,
  ...numeric,
});

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const radiusKm = 6_371;
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const deriveDeterministicSignals = (
  facts: Record<string, unknown>,
  evidence: readonly EvidenceArtifact[],
): DeterministicSignal[] => {
  const signals: DeterministicSignal[] = [];

  const idStatus = stringFact(facts, "idVerificationStatus");
  if (["DECLINED", "ABANDONED", "TECHNICAL_FAILURE", "NOT_COMPLETED"].includes(idStatus ?? "")) {
    signals.push(observed(
      "ID_VERIFICATION_NOT_COMPLETED",
      "Identity verification not completed",
      "INFO",
      false,
      "Noncompletion is not evidence of fraud. Offer a proportionate alternate verification path and measure conversion separately.",
      evidenceIdsForFacts(evidence, ["idVerificationStatus"]),
    ));
  } else if (idStatus === "MISMATCH") {
    signals.push(observed(
      "VERIFIED_IDENTITY_MISMATCH",
      "Verified identity mismatch",
      "HIGH",
      true,
      "A completed verification returned a material mismatch; the shopper may cure this with alternate verification or human review.",
      evidenceIdsForFacts(evidence, ["idVerificationStatus"]),
    ));
  } else if (idStatus === "VERIFIED") {
    signals.push(observed(
      "IDENTITY_VERIFIED",
      "Identity verified",
      "INFO",
      false,
      "A consented verification matched the presented identity.",
      evidenceIdsForFacts(evidence, ["idVerificationStatus"]),
    ));
  }

  const expectedWeight = numberFact(facts, "expectedWeightGrams");
  const observedWeight = numberFact(facts, "observedWeightGrams");
  const tolerance = numberFact(facts, "weightToleranceGrams") ?? Math.max(50, (expectedWeight ?? 0) * 0.08);
  if (expectedWeight !== undefined && observedWeight !== undefined) {
    const delta = expectedWeight - observedWeight;
    const ratio = expectedWeight === 0 ? 0 : observedWeight / expectedWeight;
    if (delta > tolerance && ratio < 0.2) {
      signals.push(observed(
        "POSSIBLE_EMPTY_PACKAGE_WEIGHT",
        "Inbound weight consistent with empty packaging",
        "HIGH",
        true,
        `Observed weight ${observedWeight}g is ${(ratio * 100).toFixed(1)}% of the ${expectedWeight}g expected packed weight. Weight alone does not prove contents.`,
        evidenceIdsForFacts(evidence, ["expectedWeightGrams", "observedWeightGrams", "weightToleranceGrams"]),
        { value: observedWeight, threshold: expectedWeight - tolerance, unit: "grams" },
      ));
    } else if (Math.abs(delta) > tolerance) {
      signals.push(observed(
        "PACKAGE_WEIGHT_MISMATCH",
        "Package weight mismatch",
        "MEDIUM",
        true,
        `Observed weight differs from expected packed weight by ${Math.abs(delta)}g, outside the ${Math.round(tolerance)}g tolerance.`,
        evidenceIdsForFacts(evidence, ["expectedWeightGrams", "observedWeightGrams", "weightToleranceGrams"]),
        { value: Math.abs(delta), threshold: tolerance, unit: "grams delta" },
      ));
    } else {
      signals.push(observed(
        "PACKAGE_WEIGHT_MATCH",
        "Package weight within tolerance",
        "INFO",
        false,
        `Observed package weight is within the ${Math.round(tolerance)}g tolerance.`,
        evidenceIdsForFacts(evidence, ["expectedWeightGrams", "observedWeightGrams", "weightToleranceGrams"]),
      ));
    }
  }

  const expectedQuantity = numberFact(facts, "expectedQuantity");
  const observedQuantity = numberFact(facts, "observedQuantity");
  if (expectedQuantity !== undefined && observedQuantity !== undefined && expectedQuantity !== observedQuantity) {
    signals.push(observed(
      "QUANTITY_MISMATCH",
      "Returned quantity mismatch",
      "HIGH",
      true,
      `Inspection recorded ${observedQuantity} unit(s) against ${expectedQuantity} authorized unit(s).`,
      evidenceIdsForFacts(evidence, ["expectedQuantity", "observedQuantity"]),
      { value: observedQuantity, threshold: expectedQuantity, unit: "items" },
    ));
  }

  const expectedSku = stringFact(facts, "expectedSku");
  const observedSku = stringFact(facts, "observedSku");
  if (expectedSku !== undefined && observedSku !== undefined && expectedSku !== observedSku) {
    signals.push(observed(
      "SKU_MISMATCH",
      "Returned SKU differs from authorized SKU",
      "HIGH",
      true,
      "The operator-recorded item identifier differs from the authorized return. A second inspection can correct scanning or catalog errors.",
      evidenceIdsForFacts(evidence, ["expectedSku", "observedSku"]),
    ));
  }

  const expectedSerials = stringArrayFact(facts, "expectedSerials");
  const observedSerials = stringArrayFact(facts, "observedSerials");
  if (expectedSerials !== undefined && observedSerials !== undefined) {
    // Normalize the same way the intake service does (trim + upper-case) so a
    // single physical return cannot yield SERIAL_MISMATCH at the checkpoint
    // while matching at intake purely because of serial casing/whitespace.
    const normalizeSerial = (serial: string): string => serial.trim().toUpperCase();
    const expectedNormalized = expectedSerials.map(normalizeSerial);
    const observedNormalized = observedSerials.map(normalizeSerial);
    const missing = expectedNormalized.filter((serial) => !observedNormalized.includes(serial));
    const unexpected = observedNormalized.filter((serial) => !expectedNormalized.includes(serial));
    if (missing.length > 0 || unexpected.length > 0) {
      signals.push(observed(
        "SERIAL_MISMATCH",
        "Serial number mismatch",
        "HIGH",
        true,
        `${missing.length} expected serial(s) were not observed and ${unexpected.length} unexpected serial(s) were recorded.`,
        evidenceIdsForFacts(evidence, ["expectedSerials", "observedSerials"]),
      ));
    }
  }

  let distanceKm = numberFact(facts, "routeDistanceKm");
  if (distanceKm === undefined) {
    const originLat = numberFact(facts, "handoffLatitude");
    const originLng = numberFact(facts, "handoffLongitude");
    const destinationLat = numberFact(facts, "nextScanLatitude");
    const destinationLng = numberFact(facts, "nextScanLongitude");
    if ([originLat, originLng, destinationLat, destinationLng].every((value) => value !== undefined)) {
      distanceKm = haversineKm(originLat!, originLng!, destinationLat!, destinationLng!);
    }
  }
  const elapsedMinutes = numberFact(facts, "routeElapsedMinutes");
  const allowedKph = numberFact(facts, "maximumPlausibleKph") ?? 900;
  if (distanceKm !== undefined && elapsedMinutes !== undefined && elapsedMinutes > 0) {
    const impliedKph = distanceKm / (elapsedMinutes / 60);
    if (impliedKph > allowedKph) {
      signals.push(observed(
        "IMPOSSIBLE_REVERSE_LOGISTICS",
        "Reverse logistics timing is physically implausible",
        "HIGH",
        true,
        `Carrier events imply ${Math.round(impliedKph)} km/h over ${Math.round(distanceKm)} km. This can reflect a bad scan and is not, by itself, proof against the shopper.`,
        evidenceIdsForFacts(evidence, ["routeDistanceKm", "routeElapsedMinutes", "handoffLatitude", "handoffLongitude", "nextScanLatitude", "nextScanLongitude"]),
        { value: impliedKph, threshold: allowedKph, unit: "km/h" },
      ));
    }
  }

  const label = stringFact(facts, "authorizedReturnLabel");
  const observedLabel = stringFact(facts, "observedReturnLabel");
  if (label !== undefined && observedLabel !== undefined && label !== observedLabel) {
    signals.push(observed(
      "RETURN_LABEL_MISMATCH",
      "Observed label does not match authorization",
      "HIGH",
      true,
      "The received or scanned label differs from the issued return label; carrier or operator correction may resolve it.",
      evidenceIdsForFacts(evidence, ["authorizedReturnLabel", "observedReturnLabel"]),
    ));
  }

  const duplicateUseCount = numberFact(facts, "returnLabelUseCount");
  if (duplicateUseCount !== undefined && duplicateUseCount > 1) {
    signals.push(observed(
      "RETURN_LABEL_REUSED",
      "Return label used more than once",
      "HIGH",
      true,
      `The carrier reported ${duplicateUseCount} acceptance events for a single-use label.`,
      evidenceIdsForFacts(evidence, ["returnLabelUseCount"]),
      { value: duplicateUseCount, threshold: 1, unit: "uses" },
    ));
  }

  const botChallenge = stringFact(facts, "botChallengeStatus");
  if (botChallenge === "FAILED") {
    signals.push(observed(
      "BOT_CHALLENGE_FAILED",
      "Bot challenge failed",
      "MEDIUM",
      true,
      "An automated challenge failed. Permit retry or an accessible alternate challenge before declining checkout.",
      evidenceIdsForFacts(evidence, ["botChallengeStatus"]),
    ));
  }

  // Detect a recorded lifecycle event that appears before an earlier-stage event.
  const ordered = [...evidence].sort((a, b) => checkpointOrdinal(a.checkpointId) - checkpointOrdinal(b.checkpointId));
  for (let index = 1; index < ordered.length; index += 1) {
    const earlier = ordered[index - 1];
    const later = ordered[index];
    if (earlier && later && new Date(later.observedAt).getTime() + 5 * 60_000 < new Date(earlier.observedAt).getTime()) {
      signals.push(observed(
        "LIFECYCLE_TIMESTAMP_CONTRADICTION",
        "Lifecycle timestamp contradiction",
        "MEDIUM",
        true,
        "A later lifecycle event was recorded before an earlier event beyond the five-minute clock-skew tolerance.",
        [earlier.evidenceId, later.evidenceId],
      ));
      break;
    }
  }

  return signals;
};
