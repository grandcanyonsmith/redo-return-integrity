import { describe, expect, it } from "vitest";
import {
  boardColumnFromResolution,
  buildRefundPortfolio,
  endOfMonth,
  formatMinutesSaved,
  isOnOrBetween,
  refundBoardColumnLabel,
  startOfIsoWeek,
  startOfMonth,
  summarizeRefundIntegrity,
  type IntakeActivityRecord,
} from "../src/index.js";

const activity = (overrides: Partial<IntakeActivityRecord> = {}): IntakeActivityRecord => ({
  activityId: "act-live-1",
  kind: "MESSAGE_QUEUED",
  sessionId: "11111111-1111-1111-1111-111111111111",
  returnRecordId: "ret-sk-1042",
  rmaId: "RMA-8821",
  orderId: "SK-1042",
  customerName: "Ava Morgan",
  productTitle: "Fits Everybody Cami Bodysuit",
  classification: "QUANTITY_MISMATCH",
  nextAction: "APPROVE_PARTIAL",
  resolutionStatus: "PARTIAL_REFUND_PENDING",
  channel: "EMAIL",
  inspectionId: "insp-live",
  recordedAt: "2026-08-29T18:00:00.000Z",
  handledBy: "Station 04 operator",
  ...overrides,
});

describe("refund portfolio calendar", () => {
  it("computes month and ISO-week bounds in UTC", () => {
    expect(startOfMonth("2026-08-29")).toBe("2026-08-01");
    expect(endOfMonth("2026-08-29")).toBe("2026-08-31");
    expect(startOfIsoWeek("2026-08-29")).toBe("2026-08-24");
    expect(isOnOrBetween("2026-08-29T14:00:00.000Z", "2026-08-01", "2026-08-31")).toBe(true);
    expect(isOnOrBetween("2026-08-15T14:00:00.000Z", "2026-08-24", "2026-08-30")).toBe(false);
  });
});

describe("refund portfolio board columns", () => {
  it("labels every column and maps resolution statuses", () => {
    expect(refundBoardColumnLabel("REFUNDED")).toBe("Refunded");
    expect(refundBoardColumnLabel("FRAUDULENT")).toBe("Fraudulent");
    expect(boardColumnFromResolution("REFUND_APPROVAL_PENDING")).toBe("REFUNDED");
    expect(boardColumnFromResolution("ON_HOLD_REVIEW")).toBe("IN_REVIEW");
    expect(boardColumnFromResolution("SET_ASIDE", "EMPTY_BOX")).toBe("FRAUDULENT");
    expect(boardColumnFromResolution("SET_ASIDE", "INCONCLUSIVE")).toBe("SET_ASIDE");
    expect(boardColumnFromResolution("AUTHENTICATION_REVIEW")).toBe("FRAUDULENT");
  });
});

describe("buildRefundPortfolio", () => {
  it("defaults to the month of the newest case and reports refund totals", () => {
    const portfolio = buildRefundPortfolio();
    expect(portfolio.from).toBe("2026-08-01");
    expect(portfolio.to).toBe("2026-08-31");
    expect(portfolio.stats.totalRefunds).toBe(3);
    expect(portfolio.stats.totalAmountCents).toBe(11_600 + 5_800 + 11_600);
    expect(portfolio.cases.some((item) => item.returnRecord.rmaId === "RMA-8821")).toBe(true);
    expect(portfolio.cases.find((item) => item.returnRecord.rmaId === "RMA-8821")?.boardColumn).toBe("RECEIVED");
    const noah = portfolio.cases.find((item) => item.returnRecord.rmaId === "RMA-8899");
    expect(noah?.journey.some((event) => event.stage === "CHECKOUT")).toBe(true);
    expect(noah?.journey.some((event) => event.stage === "PICK_PACK_LABEL")).toBe(true);
    expect(noah?.journey.some((event) => event.stage === "WAREHOUSE_WEIGHT")).toBe(true);
    expect(noah?.journey.some((event) => event.stage === "PHOTOS")).toBe(true);
    expect(noah?.journey.some((event) => event.stage === "EMAIL")).toBe(true);
  });

  it("filters by inclusive calendar range", () => {
    const week = buildRefundPortfolio({ from: "2026-08-24", to: "2026-08-29" });
    expect(week.cases.some((item) => item.returnRecord.rmaId === "RMA-8980")).toBe(false);
    expect(week.cases.some((item) => item.returnRecord.rmaId === "RMA-8899")).toBe(true);
    const day = buildRefundPortfolio({ from: "2026-08-15", to: "2026-08-15" });
    expect(day.cases).toHaveLength(1);
    expect(day.cases[0]?.returnRecord.rmaId).toBe("RMA-8980");
    expect(day.stats.totalRefunds).toBe(1);
    expect(day.stats.totalAmountCents).toBe(11_600);
  });

  it("overlays live session activity onto the matching seeded case", () => {
    const portfolio = buildRefundPortfolio({ activity: [activity()] });
    const ava = portfolio.cases.find((item) => item.returnRecord.rmaId === "RMA-8821");
    expect(ava?.liveSession).toBe(true);
    expect(ava?.boardColumn).toBe("REFUNDED");
    expect(ava?.processedAmountCents).toBe(5_800);
    expect(ava?.journey.some((event) => event.eventId.startsWith("live-"))).toBe(true);
    expect(portfolio.stats.totalRefunds).toBe(4);
  });

  it("keeps a live session visible even when the calendar day does not match", () => {
    const portfolio = buildRefundPortfolio({
      activity: [activity()],
      from: "2026-08-15",
      to: "2026-08-15",
    });
    const ava = portfolio.cases.find((item) => item.returnRecord.rmaId === "RMA-8821");
    expect(ava?.liveSession).toBe(true);
    expect(portfolio.cases.some((item) => item.returnRecord.rmaId === "RMA-8980")).toBe(true);
  });
});

describe("refund integrity impact", () => {
  it("formats saved minutes", () => {
    expect(formatMinutesSaved(0)).toBe("0m");
    expect(formatMinutesSaved(14)).toBe("14m");
    expect(formatMinutesSaved(60)).toBe("1h");
    expect(formatMinutesSaved(140)).toBe("2h 20m");
  });

  it("derives time saved, wrongful product dollars, and scheme mix from the real book", () => {
    const portfolio = buildRefundPortfolio();
    const impact = summarizeRefundIntegrity(portfolio.cases);
    expect(impact.industryRate).toBe(0.09);
    expect(impact.timeSavedMinutes).toBe(66);
    expect(impact.wrongfulRefundsSaved).toBe(4);
    expect(impact.wrongfulProductCents).toBe(11_600 * 4);
    expect(impact.fraudulentAttempts).toBe(7);
    const wardrobing = impact.schemes.find((slice) => slice.scheme === "WARDROBING");
    const empty = impact.schemes.find((slice) => slice.scheme === "EMPTY_BOX");
    const decoy = impact.schemes.find((slice) => slice.scheme === "WRONG_PRODUCT");
    const damaged = impact.schemes.find((slice) => slice.scheme === "DAMAGED_PRODUCT");
    const quantity = impact.schemes.find((slice) => slice.scheme === "QUANTITY_MISMATCH");
    expect(wardrobing?.attemptCount).toBe(1);
    expect(wardrobing?.productCents).toBe(11_600);
    expect(empty?.attemptCount).toBe(1);
    expect(empty?.productCents).toBe(11_600);
    expect(decoy?.attemptCount).toBe(1);
    expect(damaged?.attemptCount).toBe(1);
    expect(quantity?.attemptCount).toBe(2);
    expect(quantity?.productCents).toBe(11_600 * 2);
  });
});
