import { describe, expect, it, vi } from "vitest";
import {
  fixtureInspectionFinding,
  fixtureReturnRecords,
  type InspectionModelFinding,
} from "@return-integrity/domain";
import { ReturnIntakeService } from "../src/intake-service.js";
import { MemoryReturnIntakeStore } from "../src/intake-store.js";

const requestEvidenceId = (init?: RequestInit): string => {
  const request = JSON.parse(String(init?.body)) as {
    input: Array<{ content: Array<{ type: string; text?: string }> }>;
  };
  const text = request.input[1]?.content.find((part) => part.type === "input_text")?.text;
  const payload = JSON.parse(String(text).replace(/^Untrusted evidence payload:\n/, "")) as { evidenceId: string };
  return payload.evidenceId;
};

describe("return intake semantic invariant boundary", () => {
  it("does not load a return from a low-confidence label extraction", async () => {
    const record = fixtureReturnRecords[0]!;
    const fetchImpl = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({
      output_text: JSON.stringify({
        labelId: null,
        trackingNumber: null,
        rmaId: record.rmaId,
        orderId: null,
        carrier: null,
        confidence: 0.74,
        evidenceIds: [requestEvidenceId(init)],
      }),
    }), { status: 200 })) as unknown as typeof fetch;
    const service = new ReturnIntakeService({
      store: new MemoryReturnIntakeStore(),
      resolveApiKey: async () => "sk-test",
      fetchImpl,
      acquireModelSlot: async () => undefined,
      resolveEvidenceImage: async () => "data:image/png;base64,AAAA",
    });

    const result = await service.lookupReturnByLabel(
      "00000000-0000-4000-8000-000000000005",
      { evidenceId: "ev-label-low-confidence" },
    );

    expect(result).toMatchObject({ mode: "SAFE_FALLBACK", returnRecord: null, matchedBy: null });
    expect(result.warnings.join(" ")).toContain("below the 0.75 lookup threshold");
  });

  it("does not select a record when extracted identifiers disagree", async () => {
    const [first, second] = fixtureReturnRecords;
    const fetchImpl = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({
      output_text: JSON.stringify({
        labelId: first!.labelId,
        trackingNumber: null,
        rmaId: second!.rmaId,
        orderId: null,
        carrier: null,
        confidence: 0.99,
        evidenceIds: [requestEvidenceId(init)],
      }),
    }), { status: 200 })) as unknown as typeof fetch;
    const service = new ReturnIntakeService({
      store: new MemoryReturnIntakeStore(),
      resolveApiKey: async () => "sk-test",
      fetchImpl,
      acquireModelSlot: async () => undefined,
      resolveEvidenceImage: async () => "data:image/png;base64,AAAA",
    });

    const result = await service.lookupReturnByLabel(
      "00000000-0000-4000-8000-000000000006",
      { evidenceId: "ev-label-conflict" },
    );

    expect(result).toMatchObject({ mode: "SAFE_FALLBACK", returnRecord: null, matchedBy: null });
    expect(result.warnings.join(" ")).toContain("different return records");
  });

  it("persists contradictory model output only as an inconclusive safe fallback", async () => {
    const returnRecord = fixtureReturnRecords[0]!;
    const fetchImpl = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => {
      const evidenceId = requestEvidenceId(init);
      const matching = fixtureInspectionFinding(
        "matchReturn",
        returnRecord.product.quantity,
        evidenceId,
        returnRecord.product.serials,
      );
      const contradictoryMatch = {
        ...matching,
        observedItems: matching.observedItems.map((item) => ({ ...item, quantity: 1 })),
      };
      return new Response(JSON.stringify({ output_text: JSON.stringify(contradictoryMatch) }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req-adversarial" },
      });
    }) as unknown as typeof fetch;
    const store = new MemoryReturnIntakeStore();
    const service = new ReturnIntakeService({
      store,
      resolveApiKey: async () => "sk-test",
      fetchImpl,
      publicBaseUrl: "https://demo.example.test",
      acquireModelSlot: async () => undefined,
      resolveEvidenceImage: async () => "data:image/png;base64,AAAA",
      now: () => new Date("2026-08-24T20:00:00.000Z"),
    });

    const result = await service.analyzeReturnContents(
      "00000000-0000-4000-8000-000000000004",
      {
        returnRecordId: returnRecord.returnRecordId,
        evidenceId: "ev-package-contradictory",
      },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      mode: "SAFE_FALLBACK",
      inspection: {
        classification: "INCONCLUSIVE",
        confidence: 0,
        nextAction: "REQUEST_MORE_EVIDENCE",
        refund: {
          recommendedType: "NO_RECOMMENDATION",
          recommendedAmountCents: null,
          requiresHumanApproval: true,
        },
      },
    });
    expect(result.inspection.missingEvidence.join(" ")).toContain("item-row total");

    const persisted = await store.getInspection(
      "00000000-0000-4000-8000-000000000004",
      result.inspection.inspectionId,
    );
    expect(persisted).toEqual({ ...result.inspection, warehouseEvidenceImageUrl: null });
  });

  it("fails closed instead of refunding wrong, damaged, or serial-unverified contents", async () => {
    const returnRecord = fixtureReturnRecords[0]!;
    const quantity = fixtureInspectionFinding("quantityMismatch", returnRecord.product.quantity);
    const matching = fixtureInspectionFinding(
      "matchReturn",
      returnRecord.product.quantity,
      "ev-placeholder",
      returnRecord.product.serials,
    );
    const cases: ReadonlyArray<{
      label: string;
      finding: InspectionModelFinding;
      expectedReason: string;
    }> = [
      {
        label: "wrong SKU presented as quantity mismatch",
        finding: { ...quantity, comparison: { ...quantity.comparison, skuMatch: false } },
        expectedReason: "requires skuMatch=true",
      },
      {
        label: "damaged item presented as quantity mismatch",
        finding: {
          ...quantity,
          observedItems: quantity.observedItems.map((item) => ({ ...item, condition: "DAMAGED" as const })),
          comparison: { ...quantity.comparison, damageObserved: true },
        },
        expectedReason: "no damage was observed",
      },
      {
        label: "serial-controlled match without serial evidence",
        finding: {
          ...matching,
          observedItems: matching.observedItems.map((item) => ({ ...item, serials: [] })),
          comparison: { ...matching.comparison, serialMatch: null },
        },
        expectedReason: "serialMatch=true",
      },
    ];

    for (const testCase of cases) {
      const fetchImpl = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => {
        const evidenceId = requestEvidenceId(init);
        const modelFinding = {
          ...testCase.finding,
          evidenceIds: [evidenceId],
          observedItems: testCase.finding.observedItems.map((item) => ({
            ...item,
            evidenceIds: [evidenceId],
          })),
        };
        return new Response(JSON.stringify({ output_text: JSON.stringify(modelFinding) }), { status: 200 });
      }) as unknown as typeof fetch;
      const service = new ReturnIntakeService({
        store: new MemoryReturnIntakeStore(),
        resolveApiKey: async () => "sk-test",
        fetchImpl,
        publicBaseUrl: "https://demo.example.test",
        acquireModelSlot: async () => undefined,
        resolveEvidenceImage: async () => "data:image/png;base64,AAAA",
      });

      const result = await service.analyzeReturnContents(
        "00000000-0000-4000-8000-000000000007",
        {
          returnRecordId: returnRecord.returnRecordId,
          evidenceId: `ev-package-${testCase.label.replaceAll(" ", "-")}`,
        },
      );

      expect(result.inspection.classification, testCase.label).toBe("INCONCLUSIVE");
      expect(result.mode, testCase.label).toBe("SAFE_FALLBACK");
      expect(result.inspection.refund, testCase.label).toMatchObject({
        recommendedType: "NO_RECOMMENDATION",
        recommendedAmountCents: null,
        requiresHumanApproval: true,
      });
      expect(result.inspection.missingEvidence.join(" "), testCase.label).toContain(testCase.expectedReason);
    }
  });
});
