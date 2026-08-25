import { describe, expect, it, vi } from "vitest";
import {
  LabelExtractionSchema,
  OperatorReviewRecordSchema,
  fixtureReturnRecords,
  normalizeReturnLookupValue,
} from "@return-integrity/domain";
import { DynamoReturnIntakeStore, MemoryReturnIntakeStore } from "../src/intake-store.js";

const operatorReview = OperatorReviewRecordSchema.parse({
  reviewId: "review-1",
  inspectionId: "inspection-1",
  draftId: "draft-1",
  returnRecordId: "ret-jc-1042",
  reviewerLabel: "Warehouse Operator 7",
  reviewerIdentityAssurance: "UNAUTHENTICATED_DISPLAY_LABEL",
  draftDecision: "APPROVE_AS_WRITTEN",
  draftContentSha256: "a".repeat(64),
  acknowledgedRecommendation: true,
  acknowledgedPolicy: true,
  acknowledgedEvidence: true,
  reviewedAt: "2026-08-24T18:00:00.000Z",
  evidenceIds: ["ev-package-1"],
});

describe("Dynamo return intake storage adapter", () => {
  it("rejects mutually inconsistent identifiers instead of accepting the first alias", async () => {
    const [first, second] = fixtureReturnRecords;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const extraction = LabelExtractionSchema.parse({
      labelId: first!.labelId,
      trackingNumber: null,
      rmaId: second!.rmaId,
      orderId: null,
      carrier: null,
      confidence: 0.99,
      evidenceIds: ["ev-label-conflict"],
    });

    await expect(new MemoryReturnIntakeStore().lookupReturn(extraction))
      .rejects.toThrow("RETURN_IDENTIFIER_CONFLICT");

    const pointers = new Map([
      [`LOOKUP#LABEL#${normalizeReturnLookupValue(first!.labelId)}`, first!.returnRecordId],
      [`LOOKUP#RMA#${normalizeReturnLookupValue(second!.rmaId)}`, second!.returnRecordId],
    ]);
    const client = {
      send: vi.fn(async (command: unknown) => {
        const input = (command as { input: { Key?: { PK?: unknown } } }).input;
        const returnRecordId = pointers.get(String(input.Key?.PK));
        return returnRecordId ? { Item: { returnRecordId } } : {};
      }),
    };
    await expect(new DynamoReturnIntakeStore({ tableName: "returns", client: client as never }).lookupReturn(extraction))
      .rejects.toThrow("RETURN_IDENTIFIER_CONFLICT");
  });

  it("adapts the richer AWS seed profile to the strict public return-record contract", async () => {
    const client = {
      send: vi.fn(async () => ({
        Item: {
          PK: "RETURN#ret-jc-1042",
          SK: "PROFILE",
          schemaVersion: 1,
          merchant: { merchantId: "juniper-circuit-demo", name: "Juniper Circuit" },
          identifiers: {
            rma: "RMA-8821",
            trackingNumber: "1Z-REDO-8821",
            labelId: "LBL-8821",
          },
          order: { orderId: "JC-1042", currency: "USD" },
          returnRequest: { requestedRefundCents: 184_900, currency: "USD" },
          customer: {
            customerId: "demo-shopper-001",
            name: "Avery Demo",
            email: "avery.return@example.test",
            phone: "+1-555-010-8821",
            lifetimeOrders: 4,
          },
          expectedItems: [{
            sku: "JC-ARC-ONE-KIT",
            title: "Juniper Arc One two-camera kit",
            variant: "Matte black / two pack",
            quantity: 2,
            unitRefundableCents: 92_450,
            totalRefundableCents: 184_900,
            expectedSerials: ["JCA1-88K2", "JCA1-91M7"],
            catalogImageUrl: "https://demo.example/evidence/catalog-juniper-arc-one.png",
          }],
          shipping: { expectedPackedWeightGrams: 1_800 },
          refundPolicy: {
            policyId: "juniper-return-policy",
            policyVersion: "2026-08-24.v1",
            currency: "USD",
            maxEligibleRefundCents: 184_900,
            allowPartialRefund: true,
            quantityProration: true,
            damagedItemRefundPercent: 50,
            adverseActionRequiresHumanApproval: true,
            customerContestWindowHours: 72,
            snapshotSha256: "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
          },
          returnReason: "Changed mind",
        },
      })),
    };
    const store = new DynamoReturnIntakeStore({ tableName: "returns", client: client as never });
    const result = await store.getReturnRecord("ret-jc-1042");
    expect(result).toMatchObject({
      returnRecordId: "ret-jc-1042",
      rmaId: "RMA-8821",
      orderId: "JC-1042",
      carrier: "UPS",
      customer: { name: "Avery Demo" },
      product: {
        sku: "JC-ARC-ONE-KIT",
        quantity: 2,
        unitPriceCents: 92_450,
        totalEligibleRefundCents: 184_900,
        attributes: { expectedPackedWeight: "1800 g" },
      },
      return: {
        status: "INSPECTION_PENDING",
        requestedRefundCents: 184_900,
        currency: "USD",
        policyId: "juniper-return-policy",
        policyVersion: "2026-08-24.v1",
        policySnapshotSha256: "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
      },
    });
  });

  it("fails closed for unsupported multi-line or non-USD seeded profiles", async () => {
    const profile = {
      PK: "RETURN#ret-unsupported",
      SK: "PROFILE",
      schemaVersion: 1,
      merchant: { merchantId: "juniper-circuit-demo", name: "Juniper Circuit" },
      identifiers: { rma: "RMA-X", trackingNumber: "TRACK-X", labelId: "LBL-X" },
      order: { orderId: "ORDER-X", currency: "EUR" },
      customer: { customerId: "customer-x", name: "Test Customer", email: "test@example.test", phone: null },
      expectedItems: [{
        sku: "SKU-X",
        title: "Synthetic product",
        quantity: 1,
        unitRefundableCents: 1_000,
        totalRefundableCents: 1_000,
        expectedSerials: [],
        catalogImageUrl: "https://demo.example/evidence/product.png",
      }],
      shipping: {},
      refundPolicy: {
        currency: "USD",
        maxEligibleRefundCents: 1_000,
        allowPartialRefund: true,
        quantityProration: true,
        adverseActionRequiresHumanApproval: true,
      },
      returnReason: "Synthetic test",
    };
    const client = { send: vi.fn(async () => ({ Item: profile })) };
    const store = new DynamoReturnIntakeStore({ tableName: "returns", client: client as never });

    await expect(store.getReturnRecord("ret-unsupported")).resolves.toBeUndefined();

    profile.order.currency = "USD";
    profile.expectedItems.push({ ...profile.expectedItems[0]!, sku: "SKU-Y" });
    await expect(store.getReturnRecord("ret-unsupported")).resolves.toBeUndefined();
  });

  it("keeps operator review records isolated to the originating memory session", async () => {
    const store = new MemoryReturnIntakeStore();
    await store.putReview("00000000-0000-4000-8000-000000000001", operatorReview);
    await expect(store.getReview("00000000-0000-4000-8000-000000000001", operatorReview.reviewId))
      .resolves.toEqual(operatorReview);
    await expect(store.getReview("00000000-0000-4000-8000-000000000002", operatorReview.reviewId))
      .resolves.toBeUndefined();
  });

  it("keeps first-completion provenance immutable when the same object version is replayed", async () => {
    const store = new MemoryReturnIntakeStore();
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const first = {
      evidenceId: "ev-upload-immutable",
      sessionId,
      purpose: "PACKAGE_CONTENTS" as const,
      objectKey: "ephemeral/intake-package-contents/object.png",
      versionId: "version-1",
      mimeType: "image/png" as const,
      sizeBytes: 8,
      sha256: "a".repeat(64),
      verifiedAt: "2026-08-24T18:00:00.000Z",
      expiresAt: "2026-08-25T18:00:00.000Z",
    };
    await expect(store.putCompletedEvidence(sessionId, first)).resolves.toEqual(first);
    await expect(store.putCompletedEvidence(sessionId, {
      ...first,
      verifiedAt: "2026-08-24T19:00:00.000Z",
      expiresAt: "2026-08-25T19:00:00.000Z",
    })).resolves.toEqual(first);
  });

  it("persists operator review records under a session-scoped DynamoDB key", async () => {
    const items = new Map<string, Record<string, unknown>>();
    const client = {
      send: vi.fn(async (command: unknown) => {
        const input = (command as { input: {
          Item?: Record<string, unknown>;
          Key?: { PK?: unknown; SK?: unknown };
        } }).input;
        if (input.Item) {
          items.set(`${String(input.Item.PK)}|${String(input.Item.SK)}`, structuredClone(input.Item));
          return {};
        }
        if (input.Key) {
          return { Item: items.get(`${String(input.Key.PK)}|${String(input.Key.SK)}`) };
        }
        return {};
      }),
    };
    const store = new DynamoReturnIntakeStore({ tableName: "returns", client: client as never });
    const sessionId = "00000000-0000-4000-8000-000000000001";
    await store.putReview(sessionId, operatorReview);
    await expect(store.getReview(sessionId, operatorReview.reviewId)).resolves.toEqual(operatorReview);
    expect(items.get(`SESSION#${sessionId}|REVIEW#${operatorReview.reviewId}`)).toMatchObject({
      entity: "OperatorReviewRecord",
      review: operatorReview,
    });
  });
});
