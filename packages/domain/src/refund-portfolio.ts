import { z } from "zod";
import { fitsEverybodyCamiBodysuit } from "./merchant-catalog.js";
import {
  InspectionClassificationSchema,
  IntakeActivityRecordSchema,
  IntakeResolutionStatusSchema,
  ReturnRecordSchema,
  type InspectionClassification,
  type IntakeActivityRecord,
  type IntakeResolutionStatus,
  type ReturnRecord,
} from "./return-intake.js";

export const refundBoardColumns = [
  "RECEIVED",
  "IN_REVIEW",
  "AWAITING_CUSTOMER",
  "SET_ASIDE",
  "FRAUDULENT",
  "REFUNDED",
] as const;
export const RefundBoardColumnSchema = z.enum(refundBoardColumns);
export type RefundBoardColumn = z.infer<typeof RefundBoardColumnSchema>;

export const refundJourneyStages = [
  "BROWSE",
  "CHECKOUT",
  "PAYMENT",
  "PICK_PACK_LABEL",
  "OUTBOUND_SHIPPING",
  "RETURN_REQUEST",
  "INBOUND_SHIPPING",
  "WAREHOUSE_WEIGHT",
  "PHOTOS",
  "AI_ASSESSMENT",
  "EMAIL",
  "VOICE_CALL",
  "STATUS",
] as const;
export const RefundJourneyStageSchema = z.enum(refundJourneyStages);
export type RefundJourneyStage = z.infer<typeof RefundJourneyStageSchema>;

export const RefundJourneyEventSchema = z.object({
  eventId: z.string().min(1).max(120),
  at: z.string().datetime({ offset: true }),
  stage: RefundJourneyStageSchema,
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(1_500),
  metric: z.string().min(1).max(200).optional(),
  imageUrl: z.string().min(1).max(2_000).optional(),
  amountCents: z.number().int().nonnegative().nullable().optional(),
  status: z.string().min(1).max(120).optional(),
});
export type RefundJourneyEvent = z.infer<typeof RefundJourneyEventSchema>;

export const RefundPortfolioCaseSchema = z.object({
  caseId: z.string().min(1).max(120),
  returnRecordId: z.string().min(1).max(120),
  boardColumn: RefundBoardColumnSchema,
  lastActivityAt: z.string().datetime({ offset: true }),
  processedAmountCents: z.number().int().nonnegative().nullable(),
  classification: InspectionClassificationSchema.nullable(),
  resolutionStatus: IntakeResolutionStatusSchema.nullable(),
  handledBy: z.string().min(1).max(200).nullable(),
  liveSession: z.boolean(),
  returnRecord: ReturnRecordSchema,
  journey: z.array(RefundJourneyEventSchema).min(1).max(80),
});
export type RefundPortfolioCase = z.infer<typeof RefundPortfolioCaseSchema>;

export const RefundPortfolioStatsSchema = z.object({
  caseCount: z.number().int().nonnegative(),
  totalRefunds: z.number().int().nonnegative(),
  totalAmountCents: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  inReview: z.number().int().nonnegative(),
  awaitingCustomer: z.number().int().nonnegative(),
  setAside: z.number().int().nonnegative(),
  fraudulent: z.number().int().nonnegative(),
  refunded: z.number().int().nonnegative(),
});
export type RefundPortfolioStats = z.infer<typeof RefundPortfolioStatsSchema>;

export const RefundPortfolioSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cases: z.array(RefundPortfolioCaseSchema).max(100),
  stats: RefundPortfolioStatsSchema,
});
export type RefundPortfolio = z.infer<typeof RefundPortfolioSchema>;

export const RefundPortfolioQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type RefundPortfolioQuery = z.infer<typeof RefundPortfolioQuerySchema>;

const calendarDay = /^\d{4}-\d{2}-\d{2}$/;

export const isCalendarDay = (value: string): boolean => calendarDay.test(value);

export const addCalendarDays = (day: string, amount: number): string => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

export const startOfMonth = (day: string): string => `${day.slice(0, 7)}-01`;

export const endOfMonth = (day: string): string => {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
};

/** Monday of the ISO week that contains `day` (UTC). */
export const startOfIsoWeek = (day: string): string => {
  const date = new Date(`${day}T00:00:00.000Z`);
  const dow = date.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

export const calendarDayOf = (iso: string): string => iso.slice(0, 10);

export const isOnOrBetween = (iso: string, from: string, to: string): boolean => {
  const day = calendarDayOf(iso);
  return day >= from && day <= to;
};

export const refundBoardColumnLabel = (column: RefundBoardColumn): string => {
  switch (column) {
    case "RECEIVED":
      return "Received";
    case "IN_REVIEW":
      return "In review";
    case "AWAITING_CUSTOMER":
      return "Awaiting customer";
    case "SET_ASIDE":
      return "Set aside";
    case "FRAUDULENT":
      return "Fraudulent";
    case "REFUNDED":
      return "Refunded";
    default: {
      const exhausted: never = column;
      return exhausted;
    }
  }
};

export const boardColumnFromResolution = (
  status: IntakeResolutionStatus,
  classification?: InspectionClassification | null,
): RefundBoardColumn => {
  switch (status) {
    case "REFUND_APPROVAL_PENDING":
    case "PARTIAL_REFUND_PENDING":
    case "CALL_RESOLVED":
      return "REFUNDED";
    case "ON_HOLD_REVIEW":
      return "IN_REVIEW";
    case "AWAITING_CUSTOMER":
      return "AWAITING_CUSTOMER";
    case "AUTHENTICATION_REVIEW":
      return "FRAUDULENT";
    case "SET_ASIDE":
      return classification === "EMPTY_BOX"
        || classification === "WRONG_PRODUCT"
        || classification === "POSSIBLE_IMITATION"
        || classification === "WARDROBING"
        ? "FRAUDULENT"
        : "SET_ASIDE";
    default: {
      const exhausted: never = status;
      return exhausted;
    }
  }
};

const POLICY_SHA = "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6";

const kit = {
  sku: fitsEverybodyCamiBodysuit.styleId,
  title: fitsEverybodyCamiBodysuit.title,
  quantity: 2,
  unitPriceCents: fitsEverybodyCamiBodysuit.unitPriceCents,
  totalEligibleRefundCents: fitsEverybodyCamiBodysuit.unitPriceCents * 2,
  imageUrl: "/evidence/catalog-fits-everybody-bodysuit.png",
  attributes: {
    collection: "Fits Everybody",
    color: "Onyx",
    sizes: "M, L",
    variantSkus: "SK-FE-CAMI-BODYSUIT-ONX-M, SK-FE-CAMI-BODYSUIT-ONX-L",
    fabric: fitsEverybodyCamiBodysuit.fabric,
    expectedContents: "2 Fits Everybody Cami Bodysuits (Onyx · M and L) in sealed polybags",
    expectedPackedWeight: "0.38 kg",
    returnableCondition: "New, unworn and unwashed with tags and hygiene liners attached",
  },
} as const;

const makeReturn = (input: {
  returnRecordId: string;
  labelId: string;
  rmaId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  reason: string;
  requestedRefundCents: number;
  status: ReturnRecord["return"]["status"];
}): ReturnRecord => ReturnRecordSchema.parse({
  returnRecordId: input.returnRecordId,
  merchantId: "skims",
  merchantName: "SKIMS",
  labelId: input.labelId,
  rmaId: input.rmaId,
  orderId: input.orderId,
  trackingNumber: input.trackingNumber,
  carrier: input.carrier,
  customer: {
    customerId: input.customerId,
    name: input.name,
    email: input.email,
    phone: input.phone,
  },
  product: { ...kit, serials: [] },
  return: {
    reason: input.reason,
    requestedRefundCents: input.requestedRefundCents,
    currency: "USD",
    policyId: "skims-returns",
    policyVersion: "skims-returns-2026-08",
    policySnapshotSha256: POLICY_SHA,
    status: input.status,
  },
});

const at = (day: string, time: string): string => `${day}T${time}.000Z`;

type JourneyDraft = {
  prefix: string;
  customerName: string;
  orderId: string;
  rmaId: string;
  productTitle: string;
  browse: { day: string; pdpSeconds: number; clicks: number; pages: number };
  checkoutAt: string;
  payment: { brand: string; last4: string };
  pllAt: string;
  outbound: { carrier: string; tracking: string; shippedAt: string; deliveredAt: string };
  returnRequestedAt: string;
  inbound?: { carrier: string; tracking: string; receivedAt: string };
  weight?: { expectedKg: string; receivedKg: string; scaleId: string; at: string };
  photos?: ReadonlyArray<{ at: string; label: string; imageUrl: string }>;
  assessment?: { at: string; classification: InspectionClassification; confidence: number; summary: string };
  emails?: ReadonlyArray<{ at: string; subject: string; snippet: string; inbound?: boolean }>;
  calls?: ReadonlyArray<{ at: string; durationSeconds: number; mode: string; resolution: string; excerpt: string }>;
  status: { at: string; label: string; amountCents: number | null };
};

const event = (
  prefix: string,
  index: number,
  stage: RefundJourneyStage,
  when: string,
  title: string,
  detail: string,
  extra: Partial<Pick<RefundJourneyEvent, "metric" | "imageUrl" | "amountCents" | "status">> = {},
): RefundJourneyEvent => RefundJourneyEventSchema.parse({
  eventId: `${prefix}-ev-${String(index).padStart(2, "0")}`,
  at: when,
  stage,
  title,
  detail,
  ...extra,
});

const buildJourney = (draft: JourneyDraft): RefundJourneyEvent[] => {
  const rows: RefundJourneyEvent[] = [];
  let n = 1;
  const push = (
    stage: RefundJourneyStage,
    when: string,
    title: string,
    detail: string,
    extra?: Partial<Pick<RefundJourneyEvent, "metric" | "imageUrl" | "amountCents" | "status">>,
  ) => {
    rows.push(event(draft.prefix, n, stage, when, title, detail, extra));
    n += 1;
  };

  push(
    "BROWSE",
    at(draft.browse.day, "15:08:11"),
    "Product session",
    `${draft.customerName} viewed ${draft.productTitle} across ${draft.browse.pages} pages before adding both sizes to cart.`,
    { metric: `${draft.browse.pdpSeconds}s on PDP · ${draft.browse.clicks} clicks` },
  );
  push(
    "CHECKOUT",
    draft.checkoutAt,
    `Checkout ${draft.orderId}`,
    "Completed guest checkout with the shipping address on file. No challenge was issued.",
    { metric: "Checkout 1m 42s" },
  );
  push(
    "PAYMENT",
    draft.checkoutAt,
    "Payment authorized",
    `${draft.payment.brand} ···· ${draft.payment.last4} authorized for the order. AVS matched.`,
    { metric: `${draft.payment.brand} · ${draft.payment.last4}` },
  );
  push(
    "PICK_PACK_LABEL",
    draft.pllAt,
    "Pick · pack · label",
    `Romeoville station ROM-04 picked both sizes, sealed each in its own polybag, and printed the outbound label for ${draft.orderId}.`,
    { metric: "PLL complete · 2m 35s", imageUrl: "/evidence/outbound-two-bodysuits.png" },
  );
  push(
    "OUTBOUND_SHIPPING",
    draft.outbound.shippedAt,
    `Shipped via ${draft.outbound.carrier}`,
    `Tracking ${draft.outbound.tracking}. Delivered ${calendarDayOf(draft.outbound.deliveredAt)}.`,
    { metric: draft.outbound.tracking },
  );
  push(
    "RETURN_REQUEST",
    draft.returnRequestedAt,
    `RMA ${draft.rmaId} opened`,
    `${draft.customerName} started a return for ${draft.productTitle}.`,
  );
  if (draft.inbound) {
    push(
      "INBOUND_SHIPPING",
      draft.inbound.receivedAt,
      "Return in transit",
      `${draft.inbound.carrier} ${draft.inbound.tracking} scanned at the Romeoville returns dock.`,
      { metric: draft.inbound.tracking },
    );
  }
  if (draft.weight) {
    push(
      "WAREHOUSE_WEIGHT",
      draft.weight.at,
      "Inbound weight",
      `Scale ${draft.weight.scaleId} recorded ${draft.weight.receivedKg} against expected packed weight ${draft.weight.expectedKg}.`,
      { metric: `${draft.weight.receivedKg} / ${draft.weight.expectedKg}` },
    );
  }
  for (const photo of draft.photos ?? []) {
    push("PHOTOS", photo.at, photo.label, "Warehouse capture retained on the case with the operator who took it.", {
      imageUrl: photo.imageUrl,
    });
  }
  if (draft.assessment) {
    push(
      "AI_ASSESSMENT",
      draft.assessment.at,
      draft.assessment.classification.replaceAll("_", " "),
      draft.assessment.summary,
      { metric: `${Math.round(draft.assessment.confidence * 100)}% confidence` },
    );
  }
  for (const mail of draft.emails ?? []) {
    push(
      "EMAIL",
      mail.at,
      mail.inbound ? "Customer reply" : "AI email queued",
      `${mail.subject} — ${mail.snippet}`,
      { metric: mail.inbound ? "Inbound" : "AI outbound · test outbox" },
    );
  }
  for (const call of draft.calls ?? []) {
    push(
      "VOICE_CALL",
      call.at,
      `${call.mode === "OPENAI_REALTIME" ? "Realtime" : "Simulated"} voice call`,
      `${call.resolution.replaceAll("_", " ").toLowerCase()}. ${call.excerpt}`,
      { metric: `${call.durationSeconds}s · test mode` },
    );
  }
  push(
    "STATUS",
    draft.status.at,
    draft.status.label,
    draft.status.amountCents === null
      ? "No refund amount has been approved yet."
      : `Running total on this return is ${(draft.status.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}.`,
    { amountCents: draft.status.amountCents, status: draft.status.label },
  );
  return rows;
};

const seededCases = (): RefundPortfolioCase[] => {
  const ava = makeReturn({
    returnRecordId: "ret-sk-1042",
    labelId: "LBL-8821",
    rmaId: "RMA-8821",
    orderId: "SK-1042",
    trackingNumber: "1Z-REDO-8821",
    carrier: "UPS",
    customerId: "cus-demo-ava",
    name: "Ava Morgan",
    email: "ava.morgan@example.test",
    phone: "+1-555-010-8821",
    reason: "Changed mind",
    requestedRefundCents: 11_600,
    status: "RECEIVED",
  });
  const noah = makeReturn({
    returnRecordId: "ret-sk-1099",
    labelId: "LBL-RMA-8899",
    rmaId: "RMA-8899",
    orderId: "SK-1099",
    trackingNumber: "9400111899223857483920",
    carrier: "UPS",
    customerId: "cus-demo-2",
    name: "Noah Chen",
    email: "synthetic.shopper.2@example.test",
    phone: null,
    reason: "No longer needed",
    requestedRefundCents: 11_600,
    status: "RESOLVED",
  });
  const mia = makeReturn({
    returnRecordId: "ret-sk-1107",
    labelId: "LBL-RMA-8907",
    rmaId: "RMA-8907",
    orderId: "SK-1107",
    trackingNumber: "1Z999AA10123456791",
    carrier: "UPS",
    customerId: "cus-demo-3",
    name: "Mia Rivera",
    email: "synthetic.shopper.3@example.test",
    phone: null,
    reason: "Wrong size ordered",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });
  const liam = makeReturn({
    returnRecordId: "ret-sk-1120",
    labelId: "LBL-RMA-8920",
    rmaId: "RMA-8920",
    orderId: "SK-1120",
    trackingNumber: "TBA000000000004",
    carrier: "Amazon Shipping",
    customerId: "cus-demo-4",
    name: "Liam Brooks",
    email: "synthetic.shopper.4@example.test",
    phone: null,
    reason: "Arrived with a snag",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });
  const zoe = makeReturn({
    returnRecordId: "ret-sk-1131",
    labelId: "LBL-RMA-8931",
    rmaId: "RMA-8931",
    orderId: "SK-1131",
    trackingNumber: "9274890241050123456781",
    carrier: "USPS",
    customerId: "cus-demo-5",
    name: "Zoe Patel",
    email: "synthetic.shopper.5@example.test",
    phone: null,
    reason: "Changed mind",
    requestedRefundCents: 11_600,
    status: "INSPECTION_PENDING",
  });
  const jordan = makeReturn({
    returnRecordId: "ret-sk-1144",
    labelId: "LBL-RMA-8944",
    rmaId: "RMA-8944",
    orderId: "SK-1144",
    trackingNumber: "1Z-REDO-8944",
    carrier: "UPS",
    customerId: "cus-demo-jordan",
    name: "Jordan Hale",
    email: "jordan.hale@example.test",
    phone: "+1-555-010-8944",
    reason: "Fit was off",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });
  const priya = makeReturn({
    returnRecordId: "ret-sk-1150",
    labelId: "LBL-RMA-8950",
    rmaId: "RMA-8950",
    orderId: "SK-1150",
    trackingNumber: "1Z-REDO-8950",
    carrier: "UPS",
    customerId: "cus-demo-priya",
    name: "Priya Shah",
    email: "priya.shah@example.test",
    phone: null,
    reason: "Keeping one size",
    requestedRefundCents: 5_800,
    status: "RESOLVED",
  });
  const eli = makeReturn({
    returnRecordId: "ret-sk-1162",
    labelId: "LBL-RMA-8962",
    rmaId: "RMA-8962",
    orderId: "SK-1162",
    trackingNumber: "1Z-REDO-8962",
    carrier: "UPS",
    customerId: "cus-demo-eli",
    name: "Eli Park",
    email: "eli.park@example.test",
    phone: null,
    reason: "Item not as described",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });
  const sam = makeReturn({
    returnRecordId: "ret-sk-1171",
    labelId: "LBL-RMA-8971",
    rmaId: "RMA-8971",
    orderId: "SK-1171",
    trackingNumber: "1Z-REDO-8971",
    carrier: "UPS",
    customerId: "cus-demo-sam",
    name: "Sam Ortiz",
    email: "sam.ortiz@example.test",
    phone: null,
    reason: "Fabric feels wrong",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });
  const casey = makeReturn({
    returnRecordId: "ret-sk-1180",
    labelId: "LBL-RMA-8980",
    rmaId: "RMA-8980",
    orderId: "SK-1180",
    trackingNumber: "1Z-REDO-8980",
    carrier: "FedEx",
    customerId: "cus-demo-casey",
    name: "Casey Nguyen",
    email: "casey.nguyen@example.test",
    phone: null,
    reason: "Changed mind",
    requestedRefundCents: 11_600,
    status: "RESOLVED",
  });
  const taylor = makeReturn({
    returnRecordId: "ret-sk-1193",
    labelId: "LBL-RMA-8993",
    rmaId: "RMA-8993",
    orderId: "SK-1193",
    trackingNumber: "1Z-REDO-8993",
    carrier: "UPS",
    customerId: "cus-demo-taylor",
    name: "Taylor Reed",
    email: "taylor.reed@example.test",
    phone: null,
    reason: "Didn't work for the event",
    requestedRefundCents: 11_600,
    status: "REVIEW",
  });

  const cases: RefundPortfolioCase[] = [
    RefundPortfolioCaseSchema.parse({
      caseId: "port-ava",
      returnRecordId: ava.returnRecordId,
      boardColumn: "RECEIVED",
      lastActivityAt: at("2026-08-29", "14:10:00"),
      processedAmountCents: null,
      classification: null,
      resolutionStatus: null,
      handledBy: null,
      liveSession: false,
      returnRecord: ava,
      journey: buildJourney({
        prefix: "ava",
        customerName: ava.customer.name,
        orderId: ava.orderId,
        rmaId: ava.rmaId,
        productTitle: ava.product.title,
        browse: { day: "2026-08-02", pdpSeconds: 214, clicks: 11, pages: 4 },
        checkoutAt: at("2026-08-02", "16:22:08"),
        payment: { brand: "Visa", last4: "4242" },
        pllAt: at("2026-08-03", "09:14:22"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1042", shippedAt: at("2026-08-03", "17:40:00"), deliveredAt: at("2026-08-06", "13:05:00") },
        returnRequestedAt: at("2026-08-27", "19:11:00"),
        inbound: { carrier: "UPS", tracking: "1Z-REDO-8821", receivedAt: at("2026-08-29", "14:10:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.37 kg", scaleId: "SCL-04", at: at("2026-08-29", "14:12:40") },
        status: { at: at("2026-08-29", "14:12:40"), label: "Received — ready to scan", amountCents: null },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-noah",
      returnRecordId: noah.returnRecordId,
      boardColumn: "REFUNDED",
      lastActivityAt: at("2026-08-29", "11:05:00"),
      processedAmountCents: 11_600,
      classification: "MATCH",
      resolutionStatus: "REFUND_APPROVAL_PENDING",
      handledBy: "Station 04 operator",
      liveSession: false,
      returnRecord: noah,
      journey: buildJourney({
        prefix: "noah",
        customerName: noah.customer.name,
        orderId: noah.orderId,
        rmaId: noah.rmaId,
        productTitle: noah.product.title,
        browse: { day: "2026-07-28", pdpSeconds: 96, clicks: 6, pages: 3 },
        checkoutAt: at("2026-07-28", "20:04:11"),
        payment: { brand: "Mastercard", last4: "4444" },
        pllAt: at("2026-07-29", "08:40:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1099", shippedAt: at("2026-07-29", "16:10:00"), deliveredAt: at("2026-08-01", "11:22:00") },
        returnRequestedAt: at("2026-08-20", "10:02:00"),
        inbound: { carrier: "UPS", tracking: noah.trackingNumber, receivedAt: at("2026-08-28", "09:15:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.38 kg", scaleId: "SCL-04", at: at("2026-08-28", "09:18:00") },
        photos: [
          { at: at("2026-08-28", "09:21:00"), label: "Return label", imageUrl: "/evidence/return-label-rma-8821.png" },
          { at: at("2026-08-28", "09:24:00"), label: "Matching contents", imageUrl: "/evidence/return-matching-contents.png" },
        ],
        assessment: {
          at: at("2026-08-28", "09:25:30"),
          classification: "MATCH",
          confidence: 0.97,
          summary: "Style, color, sizes, and quantity match the authorized return. Tags and hygiene liners still attached.",
        },
        emails: [{
          at: at("2026-08-29", "11:05:00"),
          subject: "Update on return RMA-8899",
          snippet: "We confirmed both bodysuits and queued the full refund for human approval.",
        }],
        status: { at: at("2026-08-29", "11:05:00"), label: "Refunded — full approval pending", amountCents: 11_600 },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-mia",
      returnRecordId: mia.returnRecordId,
      boardColumn: "FRAUDULENT",
      lastActivityAt: at("2026-08-28", "16:40:00"),
      processedAmountCents: 0,
      classification: "WRONG_PRODUCT",
      resolutionStatus: "SET_ASIDE",
      handledBy: "Station 07 operator",
      liveSession: false,
      returnRecord: mia,
      journey: buildJourney({
        prefix: "mia",
        customerName: mia.customer.name,
        orderId: mia.orderId,
        rmaId: mia.rmaId,
        productTitle: mia.product.title,
        browse: { day: "2026-08-04", pdpSeconds: 41, clicks: 18, pages: 7 },
        checkoutAt: at("2026-08-04", "22:51:00"),
        payment: { brand: "Visa", last4: "1111" },
        pllAt: at("2026-08-05", "07:55:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1107", shippedAt: at("2026-08-05", "15:20:00"), deliveredAt: at("2026-08-08", "09:40:00") },
        returnRequestedAt: at("2026-08-18", "08:12:00"),
        inbound: { carrier: "UPS", tracking: mia.trackingNumber, receivedAt: at("2026-08-28", "15:50:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.21 kg", scaleId: "SCL-07", at: at("2026-08-28", "15:54:00") },
        photos: [
          { at: at("2026-08-28", "16:01:00"), label: "Return label", imageUrl: "/evidence/return-label-rma-8821.png" },
          { at: at("2026-08-28", "16:06:00"), label: "Wrong product in box", imageUrl: "/evidence/return-wrong-item.png" },
        ],
        assessment: {
          at: at("2026-08-28", "16:08:00"),
          classification: "WRONG_PRODUCT",
          confidence: 0.94,
          summary: "Mailer holds an unbranded grey t-shirt, not the authorized Fits Everybody bodysuits. No SKIMS tags or liners, and weight is far below packed expectation.",
        },
        emails: [{
          at: at("2026-08-28", "16:40:00"),
          subject: "We need to review return RMA-8907",
          snippet: "The contents do not match the authorized SKU. A specialist is reviewing before any refund.",
        }],
        calls: [{
          at: at("2026-08-28", "16:22:00"),
          durationSeconds: 186,
          mode: "SIMULATED",
          resolution: "NO_RESOLUTION_ESCALATE",
          excerpt: "Customer said the warehouse must have mixed the box. Operator logged the mismatch and ended the test call.",
        }],
        status: { at: at("2026-08-28", "16:40:00"), label: "Fraudulent — no refund", amountCents: 0 },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-liam",
      returnRecordId: liam.returnRecordId,
      boardColumn: "IN_REVIEW",
      lastActivityAt: at("2026-08-29", "09:48:00"),
      processedAmountCents: null,
      classification: "DAMAGED_PRODUCT",
      resolutionStatus: "ON_HOLD_REVIEW",
      handledBy: "Shift supervisor",
      liveSession: false,
      returnRecord: liam,
      journey: buildJourney({
        prefix: "liam",
        customerName: liam.customer.name,
        orderId: liam.orderId,
        rmaId: liam.rmaId,
        productTitle: liam.product.title,
        browse: { day: "2026-08-01", pdpSeconds: 180, clicks: 9, pages: 3 },
        checkoutAt: at("2026-08-01", "18:10:00"),
        payment: { brand: "Amex", last4: "0005" },
        pllAt: at("2026-08-02", "10:05:00"),
        outbound: { carrier: "Amazon Shipping", tracking: "TBA-OUT-1120", shippedAt: at("2026-08-02", "19:00:00"), deliveredAt: at("2026-08-05", "16:30:00") },
        returnRequestedAt: at("2026-08-21", "14:44:00"),
        inbound: { carrier: "Amazon Shipping", tracking: liam.trackingNumber, receivedAt: at("2026-08-29", "08:20:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.36 kg", scaleId: "SCL-04", at: at("2026-08-29", "08:24:00") },
        photos: [
          { at: at("2026-08-29", "08:30:00"), label: "Damaged product", imageUrl: "/evidence/return-damaged-product.png" },
        ],
        assessment: {
          at: at("2026-08-29", "08:32:00"),
          classification: "DAMAGED_PRODUCT",
          confidence: 0.88,
          summary: "Both bodysuits are present, one with a snagged seam and a run in the leg opening. Cause and policy eligibility need a human grade.",
        },
        emails: [{
          at: at("2026-08-29", "09:48:00"),
          subject: "Your return is with a reviewer",
          snippet: "A supervisor is grading the damage photos before we confirm any refund amount.",
        }],
        status: { at: at("2026-08-29", "09:48:00"), label: "In review — supervisor hold", amountCents: null },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-zoe",
      returnRecordId: zoe.returnRecordId,
      boardColumn: "AWAITING_CUSTOMER",
      lastActivityAt: at("2026-08-27", "17:20:00"),
      processedAmountCents: null,
      classification: "QUANTITY_MISMATCH",
      resolutionStatus: "AWAITING_CUSTOMER",
      handledBy: "Station 04 operator",
      liveSession: false,
      returnRecord: zoe,
      journey: buildJourney({
        prefix: "zoe",
        customerName: zoe.customer.name,
        orderId: zoe.orderId,
        rmaId: zoe.rmaId,
        productTitle: zoe.product.title,
        browse: { day: "2026-07-30", pdpSeconds: 130, clicks: 8, pages: 4 },
        checkoutAt: at("2026-07-30", "12:15:00"),
        payment: { brand: "Visa", last4: "1881" },
        pllAt: at("2026-07-31", "09:00:00"),
        outbound: { carrier: "USPS", tracking: "9400-OUT-1131", shippedAt: at("2026-07-31", "14:00:00"), deliveredAt: at("2026-08-04", "10:10:00") },
        returnRequestedAt: at("2026-08-19", "21:03:00"),
        inbound: { carrier: "USPS", tracking: zoe.trackingNumber, receivedAt: at("2026-08-26", "11:40:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.19 kg", scaleId: "SCL-04", at: at("2026-08-26", "11:45:00") },
        photos: [
          { at: at("2026-08-26", "11:50:00"), label: "Quantity mismatch", imageUrl: "/evidence/return-quantity-mismatch.png" },
        ],
        assessment: {
          at: at("2026-08-26", "11:52:00"),
          classification: "QUANTITY_MISMATCH",
          confidence: 0.91,
          summary: "Only the size M bodysuit is in the mailer. Weight matches a single polybag.",
        },
        emails: [
          {
            at: at("2026-08-27", "17:20:00"),
            subject: "We only received one bodysuit",
            snippet: "Please ship the size L bodysuit or reply with a photo of the missing piece.",
          },
          {
            at: at("2026-08-27", "18:02:00"),
            subject: "Re: We only received one bodysuit",
            snippet: "The size L is still at home — sending it tomorrow.",
            inbound: true,
          },
        ],
        status: { at: at("2026-08-27", "18:02:00"), label: "Awaiting customer — second piece", amountCents: null },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-jordan",
      returnRecordId: jordan.returnRecordId,
      boardColumn: "SET_ASIDE",
      lastActivityAt: at("2026-08-29", "13:15:00"),
      processedAmountCents: null,
      classification: "INCONCLUSIVE",
      resolutionStatus: "SET_ASIDE",
      handledBy: "Station 04 operator",
      liveSession: false,
      returnRecord: jordan,
      journey: buildJourney({
        prefix: "jordan",
        customerName: jordan.customer.name,
        orderId: jordan.orderId,
        rmaId: jordan.rmaId,
        productTitle: jordan.product.title,
        browse: { day: "2026-08-08", pdpSeconds: 70, clicks: 5, pages: 2 },
        checkoutAt: at("2026-08-08", "11:30:00"),
        payment: { brand: "Visa", last4: "9012" },
        pllAt: at("2026-08-08", "16:20:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1144", shippedAt: at("2026-08-08", "20:00:00"), deliveredAt: at("2026-08-11", "15:00:00") },
        returnRequestedAt: at("2026-08-25", "09:00:00"),
        inbound: { carrier: "UPS", tracking: jordan.trackingNumber, receivedAt: at("2026-08-29", "12:50:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.35 kg", scaleId: "SCL-04", at: at("2026-08-29", "12:55:00") },
        photos: [
          { at: at("2026-08-29", "13:02:00"), label: "Glare on contents", imageUrl: "/evidence/return-matching-contents.png" },
        ],
        assessment: {
          at: at("2026-08-29", "13:04:00"),
          classification: "INCONCLUSIVE",
          confidence: 0.41,
          summary: "Glare hides the care label and hygiene liner. Set aside after the retake cap for a cleaner overhead shot.",
        },
        status: { at: at("2026-08-29", "13:15:00"), label: "Set aside — recapture later", amountCents: null },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-priya",
      returnRecordId: priya.returnRecordId,
      boardColumn: "REFUNDED",
      lastActivityAt: at("2026-08-26", "15:30:00"),
      processedAmountCents: 5_800,
      classification: "QUANTITY_MISMATCH",
      resolutionStatus: "PARTIAL_REFUND_PENDING",
      handledBy: "Station 07 operator",
      liveSession: false,
      returnRecord: priya,
      journey: buildJourney({
        prefix: "priya",
        customerName: priya.customer.name,
        orderId: priya.orderId,
        rmaId: priya.rmaId,
        productTitle: priya.product.title,
        browse: { day: "2026-07-22", pdpSeconds: 155, clicks: 7, pages: 3 },
        checkoutAt: at("2026-07-22", "19:40:00"),
        payment: { brand: "Visa", last4: "7331" },
        pllAt: at("2026-07-23", "08:10:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1150", shippedAt: at("2026-07-23", "17:00:00"), deliveredAt: at("2026-07-26", "12:00:00") },
        returnRequestedAt: at("2026-08-12", "16:00:00"),
        inbound: { carrier: "UPS", tracking: priya.trackingNumber, receivedAt: at("2026-08-25", "10:00:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.19 kg", scaleId: "SCL-07", at: at("2026-08-25", "10:06:00") },
        photos: [
          { at: at("2026-08-25", "10:12:00"), label: "One bodysuit returned", imageUrl: "/evidence/return-quantity-mismatch.png" },
        ],
        assessment: {
          at: at("2026-08-25", "10:14:00"),
          classification: "QUANTITY_MISMATCH",
          confidence: 0.93,
          summary: "One bodysuit is present, unworn, with tags and liner attached. Partial refund matches a single piece.",
        },
        emails: [{
          at: at("2026-08-26", "15:30:00"),
          subject: "Partial refund for RMA-8950",
          snippet: "We received one bodysuit and queued $58.00 for approval. Keep the second piece.",
        }],
        calls: [{
          at: at("2026-08-26", "15:05:00"),
          durationSeconds: 142,
          mode: "OPENAI_REALTIME",
          resolution: "RESOLVED_REFUND_CONFIRMED",
          excerpt: "Priya agreed the partial amount matches the single returned bodysuit.",
        }],
        status: { at: at("2026-08-26", "15:30:00"), label: "Refunded — partial", amountCents: 5_800 },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-eli",
      returnRecordId: eli.returnRecordId,
      boardColumn: "FRAUDULENT",
      lastActivityAt: at("2026-08-22", "12:10:00"),
      processedAmountCents: 0,
      classification: "EMPTY_BOX",
      resolutionStatus: "SET_ASIDE",
      handledBy: "Station 07 operator",
      liveSession: false,
      returnRecord: eli,
      journey: buildJourney({
        prefix: "eli",
        customerName: eli.customer.name,
        orderId: eli.orderId,
        rmaId: eli.rmaId,
        productTitle: eli.product.title,
        browse: { day: "2026-08-09", pdpSeconds: 28, clicks: 22, pages: 9 },
        checkoutAt: at("2026-08-09", "23:58:00"),
        payment: { brand: "Visa", last4: "0002" },
        pllAt: at("2026-08-10", "08:00:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1162", shippedAt: at("2026-08-10", "16:00:00"), deliveredAt: at("2026-08-13", "14:20:00") },
        returnRequestedAt: at("2026-08-14", "07:30:00"),
        inbound: { carrier: "UPS", tracking: eli.trackingNumber, receivedAt: at("2026-08-22", "10:40:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.04 kg", scaleId: "SCL-07", at: at("2026-08-22", "10:44:00") },
        photos: [
          { at: at("2026-08-22", "10:50:00"), label: "Empty mailer", imageUrl: "/evidence/return-empty-box.png" },
        ],
        assessment: {
          at: at("2026-08-22", "10:52:00"),
          classification: "EMPTY_BOX",
          confidence: 0.99,
          summary: "Opened mailer contains the packing slip only. No polybags and no garments are visible.",
        },
        emails: [{
          at: at("2026-08-22", "12:10:00"),
          subject: "Empty return RMA-8962",
          snippet: "The mailer arrived empty. No refund will be issued until the garments are received.",
        }],
        status: { at: at("2026-08-22", "12:10:00"), label: "Fraudulent — empty mailer", amountCents: 0 },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-sam",
      returnRecordId: sam.returnRecordId,
      boardColumn: "FRAUDULENT",
      lastActivityAt: at("2026-08-29", "10:20:00"),
      processedAmountCents: null,
      classification: "POSSIBLE_IMITATION",
      resolutionStatus: "AUTHENTICATION_REVIEW",
      handledBy: "Shift supervisor",
      liveSession: false,
      returnRecord: sam,
      journey: buildJourney({
        prefix: "sam",
        customerName: sam.customer.name,
        orderId: sam.orderId,
        rmaId: sam.rmaId,
        productTitle: sam.product.title,
        browse: { day: "2026-08-06", pdpSeconds: 240, clicks: 14, pages: 5 },
        checkoutAt: at("2026-08-06", "21:12:00"),
        payment: { brand: "Mastercard", last4: "5100" },
        pllAt: at("2026-08-07", "09:30:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1171", shippedAt: at("2026-08-07", "18:00:00"), deliveredAt: at("2026-08-10", "13:45:00") },
        returnRequestedAt: at("2026-08-23", "11:11:00"),
        inbound: { carrier: "UPS", tracking: sam.trackingNumber, receivedAt: at("2026-08-29", "09:40:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.33 kg", scaleId: "SCL-01", at: at("2026-08-29", "09:46:00") },
        photos: [
          { at: at("2026-08-29", "09:55:00"), label: "Lookalike garment", imageUrl: "/evidence/return-imitation.png" },
        ],
        assessment: {
          at: at("2026-08-29", "09:58:00"),
          classification: "POSSIBLE_IMITATION",
          confidence: 0.72,
          summary: "Neck tag font, care-label layout, and seam finish differ from the catalog reference. Authenticity is not established from photos.",
        },
        emails: [{
          at: at("2026-08-29", "10:20:00"),
          subject: "Authentication review for RMA-8971",
          snippet: "A qualified reviewer is comparing the returned garment to a known-genuine piece.",
        }],
        status: { at: at("2026-08-29", "10:20:00"), label: "Fraudulent — authentication review", amountCents: null },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-casey",
      returnRecordId: casey.returnRecordId,
      boardColumn: "REFUNDED",
      lastActivityAt: at("2026-08-15", "14:00:00"),
      processedAmountCents: 11_600,
      classification: "MATCH",
      resolutionStatus: "CALL_RESOLVED",
      handledBy: "Station 04 operator",
      liveSession: false,
      returnRecord: casey,
      journey: buildJourney({
        prefix: "casey",
        customerName: casey.customer.name,
        orderId: casey.orderId,
        rmaId: casey.rmaId,
        productTitle: casey.product.title,
        browse: { day: "2026-07-10", pdpSeconds: 88, clicks: 4, pages: 2 },
        checkoutAt: at("2026-07-10", "13:00:00"),
        payment: { brand: "Visa", last4: "5512" },
        pllAt: at("2026-07-10", "16:45:00"),
        outbound: { carrier: "FedEx", tracking: "FX-OUT-1180", shippedAt: at("2026-07-11", "09:00:00"), deliveredAt: at("2026-07-14", "11:00:00") },
        returnRequestedAt: at("2026-08-08", "08:00:00"),
        inbound: { carrier: "FedEx", tracking: casey.trackingNumber, receivedAt: at("2026-08-14", "13:20:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.38 kg", scaleId: "SCL-04", at: at("2026-08-14", "13:25:00") },
        photos: [
          { at: at("2026-08-14", "13:30:00"), label: "Matching contents", imageUrl: "/evidence/return-matching-contents.png" },
        ],
        assessment: {
          at: at("2026-08-14", "13:32:00"),
          classification: "MATCH",
          confidence: 0.96,
          summary: "Both bodysuits match the authorized shipment, unworn with tags and hygiene liners attached.",
        },
        calls: [{
          at: at("2026-08-15", "13:40:00"),
          durationSeconds: 95,
          mode: "SIMULATED",
          resolution: "RESOLVED_REFUND_CONFIRMED",
          excerpt: "Casey confirmed the refund path on the test-mode call. No live telephony was used.",
        }],
        emails: [{
          at: at("2026-08-15", "14:00:00"),
          subject: "Refund confirmed for RMA-8980",
          snippet: "Full refund queued after the call recap.",
        }],
        status: { at: at("2026-08-15", "14:00:00"), label: "Refunded — call resolved", amountCents: 11_600 },
      }),
    }),
    RefundPortfolioCaseSchema.parse({
      caseId: "port-taylor",
      returnRecordId: taylor.returnRecordId,
      boardColumn: "FRAUDULENT",
      lastActivityAt: at("2026-08-27", "11:35:00"),
      processedAmountCents: 0,
      classification: "WARDROBING",
      resolutionStatus: "SET_ASIDE",
      handledBy: "Station 07 operator",
      liveSession: false,
      returnRecord: taylor,
      journey: buildJourney({
        prefix: "taylor",
        customerName: taylor.customer.name,
        orderId: taylor.orderId,
        rmaId: taylor.rmaId,
        productTitle: taylor.product.title,
        browse: { day: "2026-08-11", pdpSeconds: 62, clicks: 12, pages: 5 },
        checkoutAt: at("2026-08-11", "22:06:00"),
        payment: { brand: "Visa", last4: "6021" },
        pllAt: at("2026-08-12", "08:20:00"),
        outbound: { carrier: "UPS", tracking: "1Z-OUT-1193", shippedAt: at("2026-08-12", "17:15:00"), deliveredAt: at("2026-08-15", "12:30:00") },
        returnRequestedAt: at("2026-08-24", "23:41:00"),
        inbound: { carrier: "UPS", tracking: taylor.trackingNumber, receivedAt: at("2026-08-27", "10:15:00") },
        weight: { expectedKg: "0.38 kg", receivedKg: "0.38 kg", scaleId: "SCL-07", at: at("2026-08-27", "10:19:00") },
        photos: [
          { at: at("2026-08-27", "10:26:00"), label: "Worn garment", imageUrl: "/evidence/return-wardrobing.png" },
        ],
        assessment: {
          at: at("2026-08-27", "10:29:00"),
          classification: "WARDROBING",
          confidence: 0.9,
          summary: "Both bodysuits are the authorized style and size, but one shows makeup transfer at the neckline, a detached hygiene liner, and a tag reattached with a safety pin.",
        },
        emails: [{
          at: at("2026-08-27", "11:35:00"),
          subject: "Return RMA-8993 does not meet the condition policy",
          snippet: "The garments arrived worn with the hygiene liner removed, so they are outside the returnable condition policy.",
        }],
        status: { at: at("2026-08-27", "11:35:00"), label: "Fraudulent — worn and returned", amountCents: 0 },
      }),
    }),
  ];

  return cases;
};

/** Fields the dashboard needs to pin a live intake onto a seeded case. */
export type RefundPortfolioActivityOverlay = Pick<
  IntakeActivityRecord,
  | "activityId"
  | "returnRecordId"
  | "recordedAt"
  | "kind"
  | "channel"
  | "disposition"
  | "note"
  | "customerName"
  | "rmaId"
  | "resolutionStatus"
  | "handledBy"
  | "classification"
>;

const overlayActivity = (
  cases: RefundPortfolioCase[],
  activity: readonly RefundPortfolioActivityOverlay[],
): RefundPortfolioCase[] => {
  if (activity.length === 0) return cases;
  const byReturn = new Map<string, RefundPortfolioActivityOverlay[]>();
  for (const record of activity) {
    const list = byReturn.get(record.returnRecordId) ?? [];
    list.push(record);
    byReturn.set(record.returnRecordId, list);
  }
  return cases.map((item) => {
    const records = byReturn.get(item.returnRecordId);
    if (!records || records.length === 0) return item;
    const latest = [...records].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1)!;
    const extras = records.map((record, index) => {
      const stage: RefundJourneyStage = record.kind === "CALL_COMPLETED"
        ? "VOICE_CALL"
        : record.kind === "DISPOSITION_RECORDED"
          ? "STATUS"
          : record.channel === "EMAIL"
            ? "EMAIL"
            : record.channel === "VOICE"
              ? "VOICE_CALL"
              : "STATUS";
      const title = record.kind === "CALL_COMPLETED"
        ? "Station voice call logged"
        : record.kind === "DISPOSITION_RECORDED"
          ? `Disposition ${record.disposition ?? "recorded"}`
          : record.channel === "SMS"
            ? "AI text queued"
            : "AI email queued";
      return RefundJourneyEventSchema.parse({
        eventId: `live-${record.activityId}-${index}`,
        at: record.recordedAt,
        stage,
        title,
        detail: record.note?.trim() || `${record.customerName} · ${record.rmaId} · ${record.resolutionStatus.replaceAll("_", " ")}`,
        metric: record.handledBy ? `by ${record.handledBy}` : "This session",
        status: record.resolutionStatus,
        amountCents: record.resolutionStatus === "PARTIAL_REFUND_PENDING"
          ? Math.round(item.returnRecord.product.unitPriceCents)
          : record.resolutionStatus === "REFUND_APPROVAL_PENDING" || record.resolutionStatus === "CALL_RESOLVED"
            ? item.returnRecord.return.requestedRefundCents
            : null,
      });
    });
    const processedAmountCents = latest.resolutionStatus === "PARTIAL_REFUND_PENDING"
      ? Math.round(item.returnRecord.product.unitPriceCents)
      : latest.resolutionStatus === "REFUND_APPROVAL_PENDING" || latest.resolutionStatus === "CALL_RESOLVED"
        ? item.returnRecord.return.requestedRefundCents
        : item.processedAmountCents;
    return RefundPortfolioCaseSchema.parse({
      ...item,
      boardColumn: boardColumnFromResolution(latest.resolutionStatus, latest.classification),
      lastActivityAt: latest.recordedAt,
      processedAmountCents,
      classification: latest.classification,
      resolutionStatus: latest.resolutionStatus,
      handledBy: latest.handledBy ?? item.handledBy,
      liveSession: true,
      journey: [...item.journey, ...extras],
    });
  });
};

export const summarizeRefundPortfolio = (cases: readonly RefundPortfolioCase[]): RefundPortfolioStats => {
  const count = (column: RefundBoardColumn) => cases.filter((item) => item.boardColumn === column).length;
  const refunded = cases.filter((item) => item.boardColumn === "REFUNDED");
  return RefundPortfolioStatsSchema.parse({
    caseCount: cases.length,
    totalRefunds: refunded.length,
    totalAmountCents: refunded.reduce((sum, item) => sum + (item.processedAmountCents ?? 0), 0),
    received: count("RECEIVED"),
    inReview: count("IN_REVIEW"),
    awaitingCustomer: count("AWAITING_CUSTOMER"),
    setAside: count("SET_ASIDE"),
    fraudulent: count("FRAUDULENT"),
    refunded: refunded.length,
  });
};

export const filterRefundPortfolioCases = (
  cases: readonly RefundPortfolioCase[],
  from: string,
  to: string,
): RefundPortfolioCase[] => cases
  .filter((item) => item.liveSession || isOnOrBetween(item.lastActivityAt, from, to))
  .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

/**
 * Seeded warehouse refund book plus this session's live intake overlays.
 * Date bounds are inclusive calendar days in UTC.
 */
export const buildRefundPortfolio = (input: {
  activity?: readonly RefundPortfolioActivityOverlay[];
  from?: string;
  to?: string;
} = {}): RefundPortfolio => {
  const query = RefundPortfolioQuerySchema.parse({ from: input.from, to: input.to });
  const merged = overlayActivity(seededCases(), input.activity ?? []);
  const newest = merged.reduce((latest, item) => (item.lastActivityAt > latest ? item.lastActivityAt : latest), merged[0]?.lastActivityAt ?? "2026-08-29T00:00:00.000Z");
  const from = query.from ?? startOfMonth(calendarDayOf(newest));
  const to = query.to ?? endOfMonth(from);
  const cases = filterRefundPortfolioCases(merged, from, to);
  return RefundPortfolioSchema.parse({
    from,
    to,
    cases,
    stats: summarizeRefundPortfolio(cases),
  });
};

export {
  aiMinutesSavedPerReturn,
  formatMinutesSaved,
  industryFraudulentRefundRate,
  productValueCents,
  refundSchemeDetail,
  refundSchemeIdFor,
  refundSchemeIds,
  refundSchemeLabel,
  summarizeRefundIntegrity,
  type RefundIntegrityImpact,
  type RefundSchemeId,
  type RefundSchemeSlice,
} from "./refund-integrity.js";

export const RefundPortfolioActivityInputSchema = z.object({
  activity: z.array(IntakeActivityRecordSchema).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
