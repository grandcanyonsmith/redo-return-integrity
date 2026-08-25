import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createHandler } from "../src/handler.js";
import { MemoryStore } from "../src/store.js";

const apiEvent = (
  method: string,
  path: string,
  body?: unknown,
  sessionId?: string,
  origin?: string,
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "$default",
  rawPath: `/api${path}`,
  rawQueryString: "",
  headers: {
    ...(sessionId ? { "x-demo-session": sessionId } : {}),
    ...(origin ? { origin } : {}),
  },
  requestContext: {
    accountId: "test",
    apiId: "test",
    domainName: "test",
    domainPrefix: "test",
    http: { method, path: `/api${path}`, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
    requestId: "test",
    routeKey: "$default",
    stage: "$default",
    time: "",
    timeEpoch: Date.now(),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
  isBase64Encoded: false,
});

const json = (result: Awaited<ReturnType<ReturnType<typeof createHandler>>>): any => JSON.parse(String(result.body));

describe("Lambda API", () => {
  it("creates isolated anonymous sessions and resets only the selected session", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const firstResult = await invoke(apiEvent("POST", "/sessions"));
    const secondResult = await invoke(apiEvent("POST", "/sessions"));
    const first = json(firstResult).sessionToken as string;
    const second = json(secondResult).sessionToken as string;
    expect(first).not.toBe(second);
    expect(firstResult.cookies?.[0]).toContain("HttpOnly; Secure; SameSite=Strict");

    const attached = await invoke(apiEvent("POST", "/cases/case-good-actor-checkout/uploads", {
      fixtureId: "wrongItem",
      checkpointId: "ITEM_INSPECTION",
    }, first));
    expect(attached.statusCode).toBe(201);
    const firstCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, first))).case;
    const secondCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, second))).case;
    expect(firstCase.evidence).toHaveLength(secondCase.evidence.length + 1);

    await invoke(apiEvent("POST", "/session/reset", {}, first));
    const resetCase = json(await invoke(apiEvent("GET", "/cases/case-good-actor-checkout", undefined, first))).case;
    expect(resetCase.evidence).toHaveLength(secondCase.evidence.length);
  });

  it("evaluates the visible contract and never auto-denies on model failure", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const result = await invoke(apiEvent("POST", "/cases/case-good-actor-checkout/checkpoints/ORDER_RELEASE/evaluate", {
      evaluatedAt: "2026-08-24T14:11:00.000Z",
      simulate: false,
    }, session));
    const payload = json(result);
    expect(result.statusCode).toBe(200);
    expect(payload.decision.openAIAssessment.status).toBe("ERROR");
    expect(payload.decision.accountableFinalAction).toMatchObject({ action: "HUMAN_REVIEW", actor: "SYSTEM_POLICY" });
    expect(payload.contract.flow).toEqual([
      "nativeFacts",
      "deterministicSignals",
      "openAIAssessment",
      "merchantPolicyResult",
      "accountableFinalAction",
      "shopperCure",
      "nextState",
    ]);
  });

  it("requires a human with cited evidence to deny, then preserves an append-only shopper appeal", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const evaluated = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:09:00.000Z",
      simulate: true,
    }, session))).decision;
    expect(evaluated.accountableFinalAction.action).toBe("HOLD");

    const invalid = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "SYSTEM_POLICY",
      action: "DENY",
      target: "REFUND",
      rationale: "System attempted denial",
      evidenceIds: ["ev-physical-empty-photo"],
      decisionId: evaluated.decisionId,
    }, session));
    expect(invalid.statusCode).toBe(409);

    const deniedResult = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "HUMAN_OPERATOR",
      action: "DENY",
      target: "REFUND",
      rationale: "Two protocol inspections found no returned item; appeal remains available.",
      evidenceIds: ["ev-physical-empty-photo", "ev-physical-second-inspection"],
      decisionId: evaluated.decisionId,
    }, session));
    const denied = json(deniedResult);
    expect(deniedResult.statusCode).toBe(201);
    expect(denied.event).toMatchObject({ actor: "HUMAN_OPERATOR", action: "DENY", nextState: "DENIED" });

    const beforeAppeal = json(await invoke(apiEvent("GET", "/cases/case-physical-empty-return", undefined, session))).case;
    const humanDecisionId = beforeAppeal.decisions.at(-1).decisionId;
    const appealResult = await invoke(apiEvent("POST", "/cases/case-physical-empty-return/actions", {
      actor: "SHOPPER",
      action: "HUMAN_REVIEW",
      target: "APPEAL",
      rationale: "Please review the carrier weight and my packing record.",
      evidenceIds: ["ev-physical-appeal-assertion"],
      supersedesDecisionId: humanDecisionId,
    }, session));
    expect(json(appealResult).event).toMatchObject({ nextState: "APPEALED", supersedesDecisionId: humanDecisionId });
    const afterAppeal = json(await invoke(apiEvent("GET", "/cases/case-physical-empty-return", undefined, session))).case;
    expect(afterAppeal.decisions).toEqual(beforeAppeal.decisions);
    expect(afterAppeal.events).toHaveLength(beforeAppeal.events.length + 1);
  });

  it("binds each physical fixture branch to internally consistent quantity, SKU, weight, and image evidence", async () => {
    const store = new MemoryStore();
    const invoke = createHandler(store);
    const session = json(await invoke(apiEvent("POST", "/sessions"))).sessionToken;
    const wrongItem = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:20:00.000Z",
      simulate: true,
      physicalFinding: "wrong-item",
    }, session))).decision;
    expect(wrongItem.nativeFacts).toMatchObject({
      expectedSku: "JC-ARC-ONE-KIT",
      expectedQuantity: 2,
      observedSku: "JC-BASIC-MOUSE",
      observedQuantity: 1,
      observedWeightGrams: 430,
    });
    expect(wrongItem.deterministicSignals.map((signal: { code: string }) => signal.code)).toEqual(expect.arrayContaining(["SKU_MISMATCH", "QUANTITY_MISMATCH", "SERIAL_MISMATCH"]));
    expect(wrongItem.evidenceSnapshot.some((artifact: { fixtureUrl?: string }) => artifact.fixtureUrl === "/evidence/return-wrong-item.png")).toBe(true);

    const inconclusive = json(await invoke(apiEvent("POST", "/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate", {
      evaluatedAt: "2026-08-24T16:21:00.000Z",
      simulate: true,
      physicalFinding: "inconclusive",
    }, session))).decision;
    expect(inconclusive.openAIAssessment.status).toBe("INCONCLUSIVE");
    expect(inconclusive.accountableFinalAction.action).toBe("HUMAN_REVIEW");
  });

  it("enforces evaluation limits and does not expose a waitlist read route", async () => {
    const store = new MemoryStore();
    const session = await store.createSession();
    for (let index = 0; index < 30; index += 1) await store.acquireEvaluationSlot(session.sessionId, new Date("2026-08-24T12:00:00.000Z"));
    await expect(store.acquireEvaluationSlot(session.sessionId, new Date("2026-08-24T12:00:00.000Z"))).rejects.toThrow("SESSION_EVALUATION_LIMIT");

    const invoke = createHandler(new MemoryStore());
    const getWaitlist = await invoke(apiEvent("GET", "/waitlist"));
    expect([401, 404]).toContain(getWaitlist.statusCode);
  });

  it("records consented waitlist leads idempotently without sending email", async () => {
    const invoke = createHandler(new MemoryStore());
    const lead = { email: "test@example.com", role: "Merchant", consent: true, noticeVersion: "2026-08-24" };
    const created = await invoke(apiEvent("POST", "/waitlist", lead));
    const duplicate = await invoke(apiEvent("POST", "/waitlist", lead));
    expect(created.statusCode).toBe(201);
    expect(json(created)).toMatchObject({ state: "CREATED", retentionDays: 30, controller: "Canyon" });
    expect(json(duplicate).state).toBe("EXISTING");
    expect(json(created).message).toContain("does not send email");
  });

  it("rejects unconfigured cross-origin mutation requests", async () => {
    const result = await createHandler(new MemoryStore())(apiEvent("POST", "/sessions", {}, undefined, "https://evil.example"));
    expect(result.statusCode).toBe(403);
    expect(result.headers?.["access-control-allow-origin"]).toBeUndefined();
  });
});
