import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  CommunicationDraftSchema,
  CompletedIntakeEvidenceSchema,
  IntakeActivityRecordSchema,
  IntakeCallRecordSchema,
  IntakeDispositionRecordSchema,
  OperatorProfileSchema,
  OperatorReviewRecordSchema,
  OperatorSettingsSchema,
  PackageInspectionSchema,
  ReturnRecordSchema,
  TestOutboxMessageSchema,
  fixtureReturnRecords,
  normalizeReturnLookupValue,
  type CommunicationDraft,
  type CompletedIntakeEvidence,
  type IntakeActivityRecord,
  type IntakeCallRecord,
  type IntakeDispositionRecord,
  type LabelExtraction,
  type OperatorProfile,
  type OperatorReviewRecord,
  type OperatorSettings,
  type PackageInspection,
  type ReturnRecord,
  type TestOutboxMessage,
} from "@return-integrity/domain";

export type ReturnLookupKind = "LABEL" | "RMA" | "ORDER" | "TRACKING";

export interface ReturnLookupMatch {
  returnRecord: ReturnRecord;
  matchedBy: ReturnLookupKind;
}

export interface ReturnIntakeStore {
  lookupReturn(extraction: LabelExtraction): Promise<ReturnLookupMatch | undefined>;
  getReturnRecord(returnRecordId: string): Promise<ReturnRecord | undefined>;
  putInspection(sessionId: string, inspection: PackageInspection): Promise<void>;
  getInspection(sessionId: string, inspectionId: string): Promise<PackageInspection | undefined>;
  putDraft(sessionId: string, draft: CommunicationDraft): Promise<void>;
  getDraft(sessionId: string, draftId: string): Promise<CommunicationDraft | undefined>;
  putReview(sessionId: string, review: OperatorReviewRecord): Promise<void>;
  getReview(sessionId: string, reviewId: string): Promise<OperatorReviewRecord | undefined>;
  queueTestMessage(
    sessionId: string,
    draft: CommunicationDraft,
    review: OperatorReviewRecord,
    now?: Date,
  ): Promise<TestOutboxMessage>;
  putCompletedEvidence(sessionId: string, evidence: CompletedIntakeEvidence): Promise<CompletedIntakeEvidence>;
  getCompletedEvidence(sessionId: string, evidenceId: string): Promise<CompletedIntakeEvidence | undefined>;
  putActivity(sessionId: string, activity: IntakeActivityRecord): Promise<void>;
  listActivity(sessionId: string): Promise<IntakeActivityRecord[]>;
  putOperatorProfile(sessionId: string, profile: OperatorProfile): Promise<void>;
  getOperatorProfile(sessionId: string): Promise<OperatorProfile | undefined>;
  putOperatorSettings(sessionId: string, settings: OperatorSettings): Promise<void>;
  getOperatorSettings(sessionId: string): Promise<OperatorSettings | undefined>;
  putDisposition(sessionId: string, record: IntakeDispositionRecord): Promise<void>;
  getDisposition(sessionId: string, dispositionId: string): Promise<IntakeDispositionRecord | undefined>;
  putCallRecord(sessionId: string, record: IntakeCallRecord): Promise<void>;
  getCallRecord(sessionId: string, callId: string): Promise<IntakeCallRecord | undefined>;
}

const extractionCandidates = (extraction: LabelExtraction): ReadonlyArray<[ReturnLookupKind, string]> => {
  const candidates: Array<[ReturnLookupKind, string]> = [
    ["LABEL", extraction.labelId ?? ""],
    ["RMA", extraction.rmaId ?? ""],
    ["ORDER", extraction.orderId ?? ""],
    ["TRACKING", extraction.trackingNumber ?? ""],
  ];
  return candidates.filter(([, value]) => value.length > 0);
};

export class MemoryReturnIntakeStore implements ReturnIntakeStore {
  private readonly records = new Map<string, ReturnRecord>();
  private readonly aliases = new Map<string, string>();
  private readonly inspections = new Map<string, PackageInspection>();
  private readonly drafts = new Map<string, CommunicationDraft>();
  private readonly reviews = new Map<string, OperatorReviewRecord>();
  private readonly outbox = new Map<string, TestOutboxMessage>();
  private readonly completedEvidence = new Map<string, CompletedIntakeEvidence>();
  private readonly activity = new Map<string, IntakeActivityRecord>();
  private readonly operators = new Map<string, OperatorProfile>();
  private readonly settings = new Map<string, OperatorSettings>();
  private readonly dispositions = new Map<string, IntakeDispositionRecord>();
  private readonly calls = new Map<string, IntakeCallRecord>();

  constructor(records: readonly ReturnRecord[] = fixtureReturnRecords) {
    for (const candidate of records) {
      const record = ReturnRecordSchema.parse(candidate);
      this.records.set(record.returnRecordId, structuredClone(record));
      for (const [kind, value] of [
        ["LABEL", record.labelId],
        ["RMA", record.rmaId],
        ["ORDER", record.orderId],
        ["TRACKING", record.trackingNumber],
      ] as const) {
        this.aliases.set(`${kind}#${normalizeReturnLookupValue(value)}`, record.returnRecordId);
      }
    }
  }

  async lookupReturn(extraction: LabelExtraction): Promise<ReturnLookupMatch | undefined> {
    const matches: Array<{ kind: ReturnLookupKind; returnRecordId: string }> = [];
    for (const [kind, value] of extractionCandidates(extraction)) {
      const id = this.aliases.get(`${kind}#${normalizeReturnLookupValue(value)}`);
      if (id && this.records.has(id)) matches.push({ kind, returnRecordId: id });
    }

    const uniqueRecordIds = new Set(matches.map(({ returnRecordId }) => returnRecordId));
    if (uniqueRecordIds.size > 1) throw new Error("RETURN_IDENTIFIER_CONFLICT");
    const firstMatch = matches[0];
    if (!firstMatch) return undefined;
    const record = this.records.get(firstMatch.returnRecordId);
    return record ? { returnRecord: structuredClone(record), matchedBy: firstMatch.kind } : undefined;
  }

  async getReturnRecord(returnRecordId: string): Promise<ReturnRecord | undefined> {
    const record = this.records.get(returnRecordId);
    return record ? structuredClone(record) : undefined;
  }

  async putInspection(sessionId: string, inspection: PackageInspection): Promise<void> {
    this.inspections.set(`${sessionId}#${inspection.inspectionId}`, structuredClone(PackageInspectionSchema.parse(inspection)));
  }

  async getInspection(sessionId: string, inspectionId: string): Promise<PackageInspection | undefined> {
    const inspection = this.inspections.get(`${sessionId}#${inspectionId}`);
    return inspection ? structuredClone(inspection) : undefined;
  }

  async putDraft(sessionId: string, draft: CommunicationDraft): Promise<void> {
    this.drafts.set(`${sessionId}#${draft.draftId}`, structuredClone(CommunicationDraftSchema.parse(draft)));
  }

  async getDraft(sessionId: string, draftId: string): Promise<CommunicationDraft | undefined> {
    const draft = this.drafts.get(`${sessionId}#${draftId}`);
    return draft ? structuredClone(draft) : undefined;
  }

  async putReview(sessionId: string, review: OperatorReviewRecord): Promise<void> {
    this.reviews.set(`${sessionId}#${review.reviewId}`, structuredClone(OperatorReviewRecordSchema.parse(review)));
  }

  async getReview(sessionId: string, reviewId: string): Promise<OperatorReviewRecord | undefined> {
    const review = this.reviews.get(`${sessionId}#${reviewId}`);
    return review ? structuredClone(review) : undefined;
  }

  async queueTestMessage(
    sessionId: string,
    draft: CommunicationDraft,
    review: OperatorReviewRecord,
    now = new Date(),
  ): Promise<TestOutboxMessage> {
    const key = `${sessionId}#${draft.draftId}`;
    const existing = this.outbox.get(key);
    if (existing) {
      if (existing.reviewId !== review.reviewId) throw new Error("REVIEW_CONTEXT_MISMATCH");
      return structuredClone(existing);
    }
    const message = TestOutboxMessageSchema.parse({
      messageId: randomUUID(),
      draftId: draft.draftId,
      inspectionId: draft.inspectionId,
      reviewId: review.reviewId,
      draftContentSha256: draft.contentSha256,
      sessionId,
      queuedAt: now.toISOString(),
      status: "QUEUED_TEST_OUTBOX",
      deliveryDisabled: true,
      recipient: draft.recipient,
      channel: draft.channel,
    });
    this.outbox.set(key, structuredClone(message));
    return message;
  }

  async putCompletedEvidence(sessionId: string, evidence: CompletedIntakeEvidence): Promise<CompletedIntakeEvidence> {
    const valid = CompletedIntakeEvidenceSchema.parse(evidence);
    if (valid.sessionId !== sessionId) throw new Error("EVIDENCE_SESSION_MISMATCH");
    const key = `${sessionId}#${valid.evidenceId}`;
    const existing = this.completedEvidence.get(key);
    if (existing) {
      if (
        existing.objectKey !== valid.objectKey
        || existing.versionId !== valid.versionId
        || existing.sha256 !== valid.sha256
        || existing.purpose !== valid.purpose
      ) throw new Error("EVIDENCE_CONTEXT_MISMATCH");
      return structuredClone(existing);
    }
    this.completedEvidence.set(key, structuredClone(valid));
    return structuredClone(valid);
  }

  async getCompletedEvidence(sessionId: string, evidenceId: string): Promise<CompletedIntakeEvidence | undefined> {
    const evidence = this.completedEvidence.get(`${sessionId}#${evidenceId}`);
    if (!evidence || new Date(evidence.expiresAt).getTime() <= Date.now()) return undefined;
    return structuredClone(evidence);
  }

  async putActivity(sessionId: string, activity: IntakeActivityRecord): Promise<void> {
    const valid = IntakeActivityRecordSchema.parse(activity);
    if (valid.sessionId !== sessionId) throw new Error("ACTIVITY_SESSION_MISMATCH");
    this.activity.set(`${sessionId}#${valid.activityId}`, structuredClone(valid));
  }

  async listActivity(sessionId: string): Promise<IntakeActivityRecord[]> {
    return [...this.activity.values()]
      .filter((record) => record.sessionId === sessionId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((record) => structuredClone(record));
  }

  async putOperatorProfile(sessionId: string, profile: OperatorProfile): Promise<void> {
    this.operators.set(sessionId, structuredClone(OperatorProfileSchema.parse(profile)));
  }

  async getOperatorProfile(sessionId: string): Promise<OperatorProfile | undefined> {
    const profile = this.operators.get(sessionId);
    return profile ? structuredClone(profile) : undefined;
  }

  async putOperatorSettings(sessionId: string, settings: OperatorSettings): Promise<void> {
    this.settings.set(sessionId, structuredClone(OperatorSettingsSchema.parse(settings)));
  }

  async getOperatorSettings(sessionId: string): Promise<OperatorSettings | undefined> {
    const settings = this.settings.get(sessionId);
    return settings ? structuredClone(settings) : undefined;
  }

  async putDisposition(sessionId: string, record: IntakeDispositionRecord): Promise<void> {
    const valid = IntakeDispositionRecordSchema.parse(record);
    if (valid.sessionId !== sessionId) throw new Error("DISPOSITION_SESSION_MISMATCH");
    this.dispositions.set(`${sessionId}#${valid.dispositionId}`, structuredClone(valid));
  }

  async getDisposition(sessionId: string, dispositionId: string): Promise<IntakeDispositionRecord | undefined> {
    const record = this.dispositions.get(`${sessionId}#${dispositionId}`);
    return record ? structuredClone(record) : undefined;
  }

  async putCallRecord(sessionId: string, record: IntakeCallRecord): Promise<void> {
    const valid = IntakeCallRecordSchema.parse(record);
    if (valid.sessionId !== sessionId) throw new Error("CALL_SESSION_MISMATCH");
    this.calls.set(`${sessionId}#${valid.callId}`, structuredClone(valid));
  }

  async getCallRecord(sessionId: string, callId: string): Promise<IntakeCallRecord | undefined> {
    const record = this.calls.get(`${sessionId}#${callId}`);
    return record ? structuredClone(record) : undefined;
  }
}

export interface DynamoReturnIntakeStoreOptions {
  tableName: string;
  client?: DynamoDBDocumentClient;
}

export class DynamoReturnIntakeStore implements ReturnIntakeStore {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: DynamoReturnIntakeStoreOptions) {
    this.tableName = options.tableName;
    this.client = options.client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private async getItem(PK: string, SK: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK, SK } }));
    return result.Item;
  }

  private parseReturnRecord(item: Record<string, unknown> | undefined): ReturnRecord | undefined {
    if (!item) return undefined;
    const parsed = ReturnRecordSchema.safeParse(item.returnRecord ?? item);
    if (parsed.success) return parsed.data;

    // Accept the richer, source-shaped synthetic seed profile produced by infra.
    // This adapter keeps storage independent from the public API contract.
    const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : {};
    const merchant = record(item.merchant);
    const identifiers = record(item.identifiers);
    const order = record(item.order);
    const customer = record(item.customer);
    const expectedItems = Array.isArray(item.expectedItems) ? item.expectedItems : [];
    const expectedItem = expectedItems.length === 1 ? record(expectedItems[0]) : {};
    const shipping = record(item.shipping);
    const returnRequest = record(item.returnRequest);
    const refundPolicy = record(item.refundPolicy);
    const policySnapshotForHash = {
      policyId: refundPolicy.policyId,
      policyVersion: refundPolicy.policyVersion,
      currency: refundPolicy.currency,
      maxEligibleRefundCents: refundPolicy.maxEligibleRefundCents,
      allowPartialRefund: refundPolicy.allowPartialRefund,
      quantityProration: refundPolicy.quantityProration,
      damagedItemRefundPercent: refundPolicy.damagedItemRefundPercent,
      adverseActionRequiresHumanApproval: refundPolicy.adverseActionRequiresHumanApproval,
      customerContestWindowHours: refundPolicy.customerContestWindowHours,
    };
    const calculatedPolicySnapshotSha256 = createHash("sha256")
      .update(JSON.stringify(policySnapshotForHash), "utf8")
      .digest("hex");
    // The public intake contract currently supports one USD return line with
    // quantity proration. Refuse richer or different policy records rather
    // than silently dropping lines, currency, or rules and deriving wrong money.
    if (
      expectedItems.length !== 1
      || order.currency !== "USD"
      || returnRequest.currency !== "USD"
      || refundPolicy.currency !== "USD"
      || typeof returnRequest.requestedRefundCents !== "number"
      || !Number.isInteger(returnRequest.requestedRefundCents)
      || returnRequest.requestedRefundCents < 0
      || typeof refundPolicy.maxEligibleRefundCents !== "number"
      || returnRequest.requestedRefundCents > refundPolicy.maxEligibleRefundCents
      || typeof refundPolicy.policyId !== "string"
      || typeof refundPolicy.policyVersion !== "string"
      || typeof refundPolicy.snapshotSha256 !== "string"
      || refundPolicy.snapshotSha256 !== calculatedPolicySnapshotSha256
      || refundPolicy.allowPartialRefund !== true
      || refundPolicy.quantityProration !== true
      || refundPolicy.adverseActionRequiresHumanApproval !== true
    ) return undefined;
    const trackingNumber = typeof identifiers.trackingNumber === "string" ? identifiers.trackingNumber : "";
    const returnRecordId = typeof item.returnRecordId === "string"
      ? item.returnRecordId
      : typeof item.PK === "string" && item.PK.startsWith("RETURN#")
        ? item.PK.slice("RETURN#".length)
        : "";
    const adapted = ReturnRecordSchema.safeParse({
      returnRecordId,
      merchantId: merchant.merchantId,
      merchantName: merchant.name,
      labelId: identifiers.labelId,
      rmaId: identifiers.rma,
      orderId: order.orderId,
      trackingNumber,
      carrier: typeof shipping.carrier === "string"
        ? shipping.carrier
        : trackingNumber.toUpperCase().startsWith("1Z") ? "UPS" : "Demo carrier",
      customer: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: typeof customer.phone === "string" ? customer.phone : null,
      },
      product: {
        sku: expectedItem.sku,
        title: expectedItem.title,
        quantity: expectedItem.quantity,
        unitPriceCents: expectedItem.unitRefundableCents,
        totalEligibleRefundCents: expectedItem.totalRefundableCents,
        imageUrl: expectedItem.catalogImageUrl,
        serials: Array.isArray(expectedItem.expectedSerials) ? expectedItem.expectedSerials : [],
        attributes: {
          ...(typeof expectedItem.variant === "string" ? { variant: expectedItem.variant } : {}),
          ...(typeof shipping.expectedPackedWeightGrams === "number"
            ? { expectedPackedWeight: `${shipping.expectedPackedWeightGrams} g` }
            : {}),
        },
      },
      return: {
        reason: item.returnReason,
        requestedRefundCents: returnRequest.requestedRefundCents,
        currency: returnRequest.currency,
        policyId: refundPolicy.policyId,
        policyVersion: refundPolicy.policyVersion,
        policySnapshotSha256: refundPolicy.snapshotSha256,
        status: "INSPECTION_PENDING",
      },
    });
    return adapted.success ? adapted.data : undefined;
  }

  async lookupReturn(extraction: LabelExtraction): Promise<ReturnLookupMatch | undefined> {
    const aliases = await Promise.all(extractionCandidates(extraction).map(async ([kind, value]) => {
      const alias = await this.getItem(`LOOKUP#${kind}#${normalizeReturnLookupValue(value)}`, "POINTER");
      return {
        kind,
        returnRecordId: typeof alias?.returnRecordId === "string" ? alias.returnRecordId : undefined,
      };
    }));
    const matches = aliases.filter(
      (candidate): candidate is { kind: ReturnLookupKind; returnRecordId: string } => Boolean(candidate.returnRecordId),
    );
    const uniqueRecordIds = new Set(matches.map(({ returnRecordId }) => returnRecordId));
    if (uniqueRecordIds.size > 1) throw new Error("RETURN_IDENTIFIER_CONFLICT");
    const firstMatch = matches[0];
    if (!firstMatch) return undefined;
    const returnRecord = await this.getReturnRecord(firstMatch.returnRecordId);
    return returnRecord ? { returnRecord, matchedBy: firstMatch.kind } : undefined;
  }

  async getReturnRecord(returnRecordId: string): Promise<ReturnRecord | undefined> {
    return this.parseReturnRecord(await this.getItem(`RETURN#${returnRecordId}`, "PROFILE"));
  }

  async putInspection(sessionId: string, inspection: PackageInspection): Promise<void> {
    const valid = PackageInspectionSchema.parse(inspection);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `INSPECTION#${valid.inspectionId}`,
        entity: "PackageInspection",
        inspection: valid,
        ttl: Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
      },
    }));
  }

  async getInspection(sessionId: string, inspectionId: string): Promise<PackageInspection | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `INSPECTION#${inspectionId}`);
    const parsed = PackageInspectionSchema.safeParse(item?.inspection);
    return parsed.success ? parsed.data : undefined;
  }

  async putDraft(sessionId: string, draft: CommunicationDraft): Promise<void> {
    const valid = CommunicationDraftSchema.parse(draft);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `DRAFT#${valid.draftId}`,
        entity: "CommunicationDraft",
        draft: valid,
        ttl: Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
      },
    }));
  }

  async getDraft(sessionId: string, draftId: string): Promise<CommunicationDraft | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `DRAFT#${draftId}`);
    const parsed = CommunicationDraftSchema.safeParse(item?.draft);
    return parsed.success ? parsed.data : undefined;
  }

  async putReview(sessionId: string, review: OperatorReviewRecord): Promise<void> {
    const valid = OperatorReviewRecordSchema.parse(review);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `REVIEW#${valid.reviewId}`,
        entity: "OperatorReviewRecord",
        review: valid,
        ttl: Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
      },
    }));
  }

  async getReview(sessionId: string, reviewId: string): Promise<OperatorReviewRecord | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `REVIEW#${reviewId}`);
    const parsed = OperatorReviewRecordSchema.safeParse(item?.review);
    return parsed.success ? parsed.data : undefined;
  }

  async queueTestMessage(
    sessionId: string,
    draft: CommunicationDraft,
    review: OperatorReviewRecord,
    now = new Date(),
  ): Promise<TestOutboxMessage> {
    const key = { PK: `SESSION#${sessionId}`, SK: `OUTBOX#DRAFT#${draft.draftId}` };
    const existing = await this.getItem(key.PK, key.SK);
    const existingParsed = TestOutboxMessageSchema.safeParse(existing?.message);
    if (existingParsed.success) {
      if (existingParsed.data.reviewId !== review.reviewId) throw new Error("REVIEW_CONTEXT_MISMATCH");
      return existingParsed.data;
    }
    if (existing) throw new Error("REVIEW_CONTEXT_MISMATCH");

    const message = TestOutboxMessageSchema.parse({
      messageId: randomUUID(),
      draftId: draft.draftId,
      inspectionId: draft.inspectionId,
      reviewId: review.reviewId,
      draftContentSha256: draft.contentSha256,
      sessionId,
      queuedAt: now.toISOString(),
      status: "QUEUED_TEST_OUTBOX",
      deliveryDisabled: true,
      recipient: draft.recipient,
      channel: draft.channel,
    });
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          ...key,
          entity: "TestOutboxMessage",
          message,
          ttl: Math.floor(now.getTime() / 1_000) + 24 * 60 * 60,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }));
      return message;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      const raced = await this.getItem(key.PK, key.SK);
      const racedParsed = TestOutboxMessageSchema.safeParse(raced?.message);
      if (!racedParsed.success || racedParsed.data.reviewId !== review.reviewId) {
        throw new Error("REVIEW_CONTEXT_MISMATCH");
      }
      return racedParsed.data;
    }
  }

  async putCompletedEvidence(sessionId: string, evidence: CompletedIntakeEvidence): Promise<CompletedIntakeEvidence> {
    const valid = CompletedIntakeEvidenceSchema.parse(evidence);
    if (valid.sessionId !== sessionId) throw new Error("EVIDENCE_SESSION_MISMATCH");
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `SESSION#${sessionId}`,
          SK: `EVIDENCE#${valid.evidenceId}`,
          entity: "CompletedIntakeEvidence",
          evidence: valid,
          ttl: Math.floor(new Date(valid.expiresAt).getTime() / 1_000),
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }));
      return valid;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      const existingItem = await this.getItem(`SESSION#${sessionId}`, `EVIDENCE#${valid.evidenceId}`);
      const existing = CompletedIntakeEvidenceSchema.safeParse(existingItem?.evidence);
      if (!existing.success) throw new Error("EVIDENCE_CONTEXT_MISMATCH");
      if (
        existing.data.objectKey !== valid.objectKey
        || existing.data.versionId !== valid.versionId
        || existing.data.sha256 !== valid.sha256
        || existing.data.purpose !== valid.purpose
      ) throw new Error("EVIDENCE_CONTEXT_MISMATCH");
      return existing.data;
    }
  }

  async getCompletedEvidence(sessionId: string, evidenceId: string): Promise<CompletedIntakeEvidence | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `EVIDENCE#${evidenceId}`);
    const parsed = CompletedIntakeEvidenceSchema.safeParse(item?.evidence);
    if (!parsed.success || new Date(parsed.data.expiresAt).getTime() <= Date.now()) return undefined;
    return parsed.data;
  }

  async putActivity(sessionId: string, activity: IntakeActivityRecord): Promise<void> {
    const valid = IntakeActivityRecordSchema.parse(activity);
    if (valid.sessionId !== sessionId) throw new Error("ACTIVITY_SESSION_MISMATCH");
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `ACTIVITY#${valid.activityId}`,
        entity: "IntakeActivityRecord",
        activity: valid,
        ttl: Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
      },
    }));
  }

  async listActivity(sessionId: string): Promise<IntakeActivityRecord[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":sk": "ACTIVITY#" },
      Limit: 100,
    }));
    return (result.Items ?? [])
      .map((item) => IntakeActivityRecordSchema.safeParse(item.activity))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  private async putSessionItem(sessionId: string, sk: string, entity: string, payload: Record<string, unknown>): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: sk,
        entity,
        ...payload,
        ttl: Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
      },
    }));
  }

  async putOperatorProfile(sessionId: string, profile: OperatorProfile): Promise<void> {
    await this.putSessionItem(sessionId, "OPERATOR#PROFILE", "OperatorProfile", { profile: OperatorProfileSchema.parse(profile) });
  }

  async getOperatorProfile(sessionId: string): Promise<OperatorProfile | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, "OPERATOR#PROFILE");
    const parsed = OperatorProfileSchema.safeParse(item?.profile);
    return parsed.success ? parsed.data : undefined;
  }

  async putOperatorSettings(sessionId: string, settings: OperatorSettings): Promise<void> {
    await this.putSessionItem(sessionId, "SETTINGS#PROFILE", "OperatorSettings", { settings: OperatorSettingsSchema.parse(settings) });
  }

  async getOperatorSettings(sessionId: string): Promise<OperatorSettings | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, "SETTINGS#PROFILE");
    const parsed = OperatorSettingsSchema.safeParse(item?.settings);
    return parsed.success ? parsed.data : undefined;
  }

  async putDisposition(sessionId: string, record: IntakeDispositionRecord): Promise<void> {
    const valid = IntakeDispositionRecordSchema.parse(record);
    if (valid.sessionId !== sessionId) throw new Error("DISPOSITION_SESSION_MISMATCH");
    await this.putSessionItem(sessionId, `DISPOSITION#${valid.dispositionId}`, "IntakeDispositionRecord", { disposition: valid });
  }

  async getDisposition(sessionId: string, dispositionId: string): Promise<IntakeDispositionRecord | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `DISPOSITION#${dispositionId}`);
    const parsed = IntakeDispositionRecordSchema.safeParse(item?.disposition);
    return parsed.success ? parsed.data : undefined;
  }

  async putCallRecord(sessionId: string, record: IntakeCallRecord): Promise<void> {
    const valid = IntakeCallRecordSchema.parse(record);
    if (valid.sessionId !== sessionId) throw new Error("CALL_SESSION_MISMATCH");
    await this.putSessionItem(sessionId, `CALL#${valid.callId}`, "IntakeCallRecord", { call: valid });
  }

  async getCallRecord(sessionId: string, callId: string): Promise<IntakeCallRecord | undefined> {
    const item = await this.getItem(`SESSION#${sessionId}`, `CALL#${callId}`);
    const parsed = IntakeCallRecordSchema.safeParse(item?.call);
    return parsed.success ? parsed.data : undefined;
  }
}

let sharedStore: ReturnIntakeStore | undefined;

export const createReturnIntakeStoreFromEnvironment = (): ReturnIntakeStore => {
  if (sharedStore) return sharedStore;
  const tableName = process.env.RETURN_LOOKUP_TABLE_NAME;
  sharedStore = tableName
    ? new DynamoReturnIntakeStore({ tableName })
    : new MemoryReturnIntakeStore();
  return sharedStore;
};

export const setReturnIntakeStoreForTests = (store: ReturnIntakeStore | undefined): void => {
  sharedStore = store;
};
