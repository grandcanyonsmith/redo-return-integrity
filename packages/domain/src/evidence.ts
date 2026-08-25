import { checkpointOrdinal } from "./checkpoints.js";
import type { CheckpointId, EvidenceArtifact, EvidenceTier, OpenAIAssessment } from "./types.js";

const tierRank: Readonly<Record<EvidenceTier, number>> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

const atOrBefore = (value: string, asOf: string): boolean => new Date(value).getTime() <= new Date(asOf).getTime();

/**
 * Produces the only evidence collection that decisioning is allowed to inspect.
 * It blocks both time leakage (received/available in the future) and lifecycle
 * leakage (an artifact assigned to a later checkpoint).
 */
export const evidenceAvailableAt = (
  evidence: readonly EvidenceArtifact[],
  checkpointId: CheckpointId,
  asOf: string,
): EvidenceArtifact[] => {
  const checkpointLimit = checkpointOrdinal(checkpointId);
  return evidence
    .filter((artifact) => checkpointOrdinal(artifact.checkpointId) <= checkpointLimit)
    .filter((artifact) => atOrBefore(artifact.availableAt, asOf) && atOrBefore(artifact.receivedAt, asOf))
    .filter((artifact) => artifact.expiresAt === undefined || new Date(artifact.expiresAt).getTime() > new Date(asOf).getTime())
    .sort((a, b) => a.availableAt.localeCompare(b.availableAt));
};

export const collectNativeFacts = (evidence: readonly EvidenceArtifact[]): Record<string, unknown> => {
  const facts: Record<string, unknown> = {};
  const factEvidence: Record<string, string> = {};
  for (const artifact of evidence) {
    for (const [key, value] of Object.entries(artifact.facts)) {
      facts[key] = value;
      factEvidence[key] = artifact.evidenceId;
    }
  }
  facts._factEvidence = factEvidence;
  facts._evidenceCount = evidence.length;
  return facts;
};

export const evidenceIdsForFacts = (
  evidence: readonly EvidenceArtifact[],
  keys: readonly string[],
): string[] => evidence
  .filter((artifact) => keys.some((key) => Object.hasOwn(artifact.facts, key)))
  .map((artifact) => artifact.evidenceId);

export const highestEvidenceTier = (evidence: readonly EvidenceArtifact[]): EvidenceTier => {
  let highest: EvidenceTier = "E0";
  for (const artifact of evidence) {
    if (tierRank[artifact.provenanceTier] > tierRank[highest]) highest = artifact.provenanceTier;
  }
  return highest;
};

export const assertAssessmentEvidenceReferences = (
  assessment: OpenAIAssessment,
  snapshot: readonly EvidenceArtifact[],
): void => {
  const validIds = new Set(snapshot.map((artifact) => artifact.evidenceId));
  const referenced = [
    ...assessment.riskIndicators.flatMap((indicator) => indicator.evidenceIds),
    ...assessment.exculpatoryIndicators.flatMap((indicator) => indicator.evidenceIds),
    ...assessment.imageFindings.map((finding) => finding.evidenceId),
  ];
  const invalid = referenced.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new Error(`Assessment referenced evidence outside the point-in-time snapshot: ${[...new Set(invalid)].join(", ")}`);
  }
};

export const redactFactsForModel = (facts: Record<string, unknown>): Record<string, unknown> => {
  const blocked = /(email|phone|full.?name|street|address.?line|government|passport|driver.?license|raw.?id)/i;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(facts)) {
    if (key.startsWith("_")) continue;
    if (blocked.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") redacted[key] = value.slice(0, 500);
    else if (Array.isArray(value)) redacted[key] = value.slice(0, 30);
    else redacted[key] = value;
  }
  return redacted;
};
