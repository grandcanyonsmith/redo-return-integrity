import type { CheckpointId } from "./types.js";
import type { RefundSchemeId } from "./refund-integrity.js";

export const verifyTabs = ["checkout", "delivery", "returns", "refunds"] as const;
export type VerifyTab = (typeof verifyTabs)[number];

export const verifyModuleIds = [
  "checkout",
  "delivery",
  "condition",
  "claims",
  "item",
  "dropoff",
  "transit",
  "authentic",
  "refund",
  "resolve",
] as const;
export type VerifyModuleId = (typeof verifyModuleIds)[number];

export const verifyRiskLevels = ["HIGH", "MEDIUM"] as const;
export type VerifyRiskLevel = (typeof verifyRiskLevels)[number];

export const verifyCarrierMarks = ["ups-access", "fedex-auth"] as const;
export type VerifyCarrierMark = (typeof verifyCarrierMarks)[number];

export type VerifyChoice = {
  id: string
  label: string
  detail: string
  kind: "primary" | "alternate"
};

export type VerifyThenRoute = {
  id: string
  label: string
  carrierMark?: VerifyCarrierMark
};

export type VerifyImpact = {
  completionLabel: string
  protectedLabel: string
};

export type VerifyModule = {
  id: VerifyModuleId
  tab: VerifyTab
  productName: string
  trigger: string
  risk: VerifyRiskLevel
  intervention: string
  completionRate: number
  ifConditions: readonly [string, string]
  thenRoutes: readonly [VerifyThenRoute, VerifyThenRoute]
  customerEyebrow: string
  customerStep: { current: 1 | 2 | 3; of: 3 }
  customerTitle: string
  customerBody: string
  choices: readonly [VerifyChoice, VerifyChoice]
  checkpointId: CheckpointId
  relatedSchemes?: readonly RefundSchemeId[]
  impact: VerifyImpact
};

export const defaultVerifyTab: VerifyTab = "delivery";
export const defaultVerifyModuleId: VerifyModuleId = "delivery";

const choice = (
  id: string,
  label: string,
  detail: string,
  kind: VerifyChoice["kind"] = "primary",
): VerifyChoice => ({ id, label, detail, kind });

const route = (id: string, label: string, carrierMark?: VerifyCarrierMark): VerifyThenRoute => ({
  id,
  label,
  ...(carrierMark ? { carrierMark } : {}),
});

export const verifyModules: readonly VerifyModule[] = [
  {
    id: "checkout",
    tab: "checkout",
    productName: "Redo Verify Checkout",
    trigger: "Serial return behavior",
    risk: "HIGH",
    intervention: "Verify identity",
    completionRate: 0.942,
    ifConditions: ["Linked accounts", "Abnormal return velocity"],
    thenRoutes: [route("verify-identity", "Verify identity"), route("secure-pickup", "Secure pickup")],
    customerEyebrow: "ORDER VERIFICATION",
    customerStep: { current: 1, of: 3 },
    customerTitle: "Let’s verify your order.",
    customerBody: "Choose a secure option to complete your order.",
    choices: [
      choice("verify-identity", "Verify my identity", "Confirm the payment method on this order."),
      choice("secure-pickup", "Use secure pickup", "Collect the order at a staffed location.", "alternate"),
    ],
    checkpointId: "CHECKOUT_PAYMENT",
    impact: { completionLabel: "91% complete checkout", protectedLabel: "$18.4K protected / month" },
  },
  {
    id: "delivery",
    tab: "delivery",
    productName: "Redo Verify Delivery",
    trigger: "Repeated delivery claims",
    risk: "HIGH",
    intervention: "Secure delivery",
    completionRate: 0.968,
    ifConditions: ["Repeat delivery claim", "Order over $150"],
    thenRoutes: [
      route("secure-pickup", "Secure pickup", "ups-access"),
      route("authenticated-delivery", "Authenticated delivery", "fedex-auth"),
    ],
    customerEyebrow: "DELIVERY VERIFICATION",
    customerStep: { current: 2, of: 3 },
    customerTitle: "Let’s verify your delivery.",
    customerBody: "Choose a secure option to complete your order.",
    choices: [
      choice("pickup-near-me", "Pickup near me", "Show ID at a staffed location."),
      choice("authenticated-home", "Authenticated home delivery", "Present a secure QR code to the driver.", "alternate"),
    ],
    checkpointId: "DELIVERY_POSSESSION",
    impact: { completionLabel: "87% complete checkout", protectedLabel: "$42.3K protected / month" },
  },
  {
    id: "condition",
    tab: "returns",
    productName: "Redo Verify Condition",
    trigger: "Wardrobing pattern",
    risk: "MEDIUM",
    intervention: "Condition tag",
    completionRate: 0.934,
    ifConditions: ["Wardrobing history", "Eligible apparel"],
    thenRoutes: [route("keep-tag", "Keep the return tag on"), route("another-way", "Another secure option")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "This item includes a return tag.",
    customerBody: "Keep it attached while trying the item on.",
    choices: [
      choice("i-understand", "I understand", "Leave the tag on while you try it on."),
      choice("need-another-way", "Need another way?", "Open an independent review.", "alternate"),
    ],
    checkpointId: "ITEM_INSPECTION",
    relatedSchemes: ["WARDROBING"],
    impact: { completionLabel: "93% complete the try-on", protectedLabel: "$11.6K protected / month" },
  },
  {
    id: "claims",
    tab: "returns",
    productName: "Redo Verify Claims",
    trigger: "Policy exploitation",
    risk: "HIGH",
    intervention: "Evidence review",
    completionRate: 0.911,
    ifConditions: ["Changing return reasons", "Inconsistent evidence"],
    thenRoutes: [route("live-photos", "Guided photographs"), route("return-point", "Visit a return point")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Help us verify the item.",
    customerBody: "A few guided photos, or a staffed return, keeps this request moving.",
    choices: [
      choice("take-photos", "Take photos", "Guided, live item-condition photographs."),
      choice("visit-return-point", "Visit a return point", "A teammate accepts the item in person.", "alternate"),
    ],
    checkpointId: "RETURN_REQUEST",
    relatedSchemes: ["DAMAGED_PRODUCT"],
    impact: { completionLabel: "90% finish the claim", protectedLabel: "$9.2K protected / month" },
  },
  {
    id: "item",
    tab: "returns",
    productName: "Redo Verify Item",
    trigger: "High-value item risk",
    risk: "HIGH",
    intervention: "Inspected return",
    completionRate: 0.896,
    ifConditions: ["High-value item", "Previous wrong-item return"],
    thenRoutes: [route("staffed-point", "Staffed return point"), route("mail-inspect", "Mail for inspection")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Choose a verified return.",
    customerBody: "This item needs a matched, inspected return before we settle.",
    choices: [
      choice("staffed-return-point", "Staffed return point", "Hand the item to a teammate with your code."),
      choice("mail-for-inspection", "Mail for inspection", "We inspect the unit before we settle.", "alternate"),
    ],
    checkpointId: "ITEM_INSPECTION",
    relatedSchemes: ["WRONG_PRODUCT"],
    impact: { completionLabel: "88% choose a verified return", protectedLabel: "$14.8K protected / month" },
  },
  {
    id: "dropoff",
    tab: "returns",
    productName: "Redo Verify Drop-Off",
    trigger: "Empty-box risk",
    risk: "HIGH",
    intervention: "Visible item acceptance",
    completionRate: 0.927,
    ifConditions: ["Empty-box or partial return", "Unverified drop-box"],
    thenRoutes: [route("melrose", "SKIMS Melrose"), route("third-st", "Staffed locker · 3rd St")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Return this item without packaging.",
    customerBody: "Select a nearby return point and present the item with its QR code.",
    choices: [
      choice("skims-melrose", "SKIMS Melrose", "Present the garment and QR code to staff."),
      choice("third-street", "Staffed locker · 3rd St", "A teammate accepts the visible item.", "alternate"),
    ],
    checkpointId: "REVERSE_HANDOFF",
    relatedSchemes: ["EMPTY_BOX", "QUANTITY_MISMATCH"],
    impact: { completionLabel: "92% complete drop-off", protectedLabel: "$16.1K protected / month" },
  },
  {
    id: "transit",
    tab: "returns",
    productName: "Redo Verify Transit",
    trigger: "Label route anomaly",
    risk: "HIGH",
    intervention: "Location-locked QR",
    completionRate: 0.903,
    ifConditions: ["Reused or invalid scan", "Route mismatch"],
    thenRoutes: [route("select-location", "Select location"), route("get-qr", "Get QR code")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Use your secure return QR.",
    customerBody: "Choose a location, then collect a single-use code for that stop.",
    choices: [
      choice("select-location", "Select location", "Lock the code to one staffed stop."),
      choice("need-another-way", "Need another way?", "Open an independent review.", "alternate"),
    ],
    checkpointId: "REVERSE_TRANSIT",
    impact: { completionLabel: "89% scan at the locked stop", protectedLabel: "$8.7K protected / month" },
  },
  {
    id: "authentic",
    tab: "returns",
    productName: "Redo Verify Authentic",
    trigger: "Exact-unit risk",
    risk: "HIGH",
    intervention: "Authenticate unit",
    completionRate: 0.918,
    ifConditions: ["Luxury or exact-unit item", "Possible imitation"],
    thenRoutes: [route("auth-return", "Return for authentication"), route("support", "Contact support")],
    customerEyebrow: "RETURN VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Authentication is required.",
    customerBody: "A qualified review of this unit happens before we settle.",
    choices: [
      choice("return-for-auth", "Return for authentication", "We inspect the unit before we settle."),
      choice("contact-support", "Contact support", "Talk with a teammate about another route.", "alternate"),
    ],
    checkpointId: "ITEM_INSPECTION",
    relatedSchemes: ["POSSIBLE_IMITATION"],
    impact: { completionLabel: "90% start authentication", protectedLabel: "$12.4K protected / month" },
  },
  {
    id: "refund",
    tab: "refunds",
    productName: "Redo Verify Refund",
    trigger: "Refund duplication",
    risk: "MEDIUM",
    intervention: "Original-tender path",
    completionRate: 0.955,
    ifConditions: ["Prior refund or chargeback", "Alternate-payment request"],
    thenRoutes: [route("exchange", "Exchange now"), route("refund-after", "Refund after verification")],
    customerEyebrow: "REFUND VERIFICATION",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Choose your refund path.",
    customerBody: "We send value back on the original tender after this step.",
    choices: [
      choice("exchange-now", "Exchange now", "Swap for the same item, same size."),
      choice("refund-after", "Refund after verification", "Original tender, after this check.", "alternate"),
    ],
    checkpointId: "REFUND_SETTLEMENT",
    impact: { completionLabel: "95% pick a refund path", protectedLabel: "$21.0K protected / month" },
  },
  {
    id: "resolve",
    tab: "refunds",
    productName: "Redo Verify Resolve",
    trigger: "Inconclusive verification",
    risk: "MEDIUM",
    intervention: "Human review",
    completionRate: 0.887,
    ifConditions: ["Automatic check inconclusive", "Customer asked for review"],
    thenRoutes: [route("request-review", "Request review"), route("another-option", "Another secure option")],
    customerEyebrow: "REVIEW",
    customerStep: { current: 3, of: 3 },
    customerTitle: "Need another way?",
    customerBody: "A teammate can review this, or you can pick another secure option.",
    choices: [
      choice("request-review", "Request review", "An independent teammate reads the file."),
      choice("another-secure-option", "Choose another secure option", "Go back to a verified route.", "alternate"),
    ],
    checkpointId: "CONTEST_APPEAL_RECOVERY",
    impact: { completionLabel: "86% finish review", protectedLabel: "$6.5K protected / month" },
  },
];

export const verifyTabLabel = (tab: VerifyTab): string => {
  switch (tab) {
    case "checkout":
      return "Checkout";
    case "delivery":
      return "Delivery";
    case "returns":
      return "Returns";
    case "refunds":
      return "Refunds";
    default: {
      const exhausted: never = tab;
      return exhausted;
    }
  }
};

export const verifyModuleById = Object.fromEntries(
  verifyModules.map((module) => [module.id, module]),
) as Readonly<Record<VerifyModuleId, VerifyModule>>;

export const isVerifyTab = (value: string | null | undefined): value is VerifyTab =>
  value === "checkout" || value === "delivery" || value === "returns" || value === "refunds";

export const isVerifyModuleId = (value: string | null | undefined): value is VerifyModuleId =>
  Boolean(value && (verifyModuleIds as readonly string[]).includes(value));

export const modulesForTab = (tab: VerifyTab): readonly VerifyModule[] =>
  verifyModules.filter((module) => module.tab === tab);

export const carrierMarkLabel = (mark: VerifyCarrierMark): string => {
  switch (mark) {
    case "ups-access":
      return "UPS Access Point";
    case "fedex-auth":
      return "FedEx Authenticated";
    default: {
      const exhausted: never = mark;
      return exhausted;
    }
  }
};

export type VerifyRouteDecision = {
  action: "continue" | "secure_route"
  moduleId?: VerifyModuleId
};

/**
 * Least-friction secure route when risk is elevated. One signal never denies —
 * that matches `policyActionFor`, which cannot emit DENY.
 */
export const decideVerifyRoute = (input: {
  elevated: boolean
  moduleId?: VerifyModuleId
}): VerifyRouteDecision => {
  if (!input.elevated) return { action: "continue" };
  return { action: "secure_route", moduleId: input.moduleId ?? defaultVerifyModuleId };
};

const customerCopy = (module: VerifyModule): string =>
  [
    module.customerTitle,
    module.customerBody,
    ...module.choices.flatMap((item) => [item.label, item.detail]),
  ].join(" ");

export const customerCopyHasForbiddenLanguage = (module: VerifyModule): boolean =>
  /\b(fraud|deny|denied|denial)\b/i.test(customerCopy(module));
