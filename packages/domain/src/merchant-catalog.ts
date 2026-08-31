/**
 * Demo catalog for the SKIMS return-integrity use case.
 *
 * Style names and price points are the publicly listed skims.com figures captured
 * in research/skims-returns-profile.json (August 2026). SKU strings, barcodes,
 * packed weights, and every shopper in this file are synthetic: SKIMS does not
 * publish SKU or barcode values, so nothing here should be treated as their real
 * item master.
 *
 * Apparel fraud keys on the variant, not the style. The same style name can be a
 * different size, color, price, and inventory state, so the catalog is modeled at
 * variant granularity and the return record carries the variant through.
 */

/** Collections a returned garment can belong to. */
export const skimsCollections = [
  "Fits Everybody",
  "Soft Lounge",
  "Cotton Rib",
  "Sculpting",
  "Swim",
] as const;
export type SkimsCollection = (typeof skimsCollections)[number];

export type CatalogVariant = {
  /** Synthetic variant SKU: brand-collection-style-color-size. */
  sku: string;
  /** Style-level identifier shared by every color and size of one garment. */
  styleId: string;
  title: string;
  collection: SkimsCollection;
  color: string;
  size: string;
  unitPriceCents: number;
  /** Catalog reference capture used as the inspection comparison image. */
  imageUrl: string;
  fabric: string;
  /** Grams for one unit in its polybag. Drives the inbound weight checkpoint. */
  packedGrams: number;
  /** SKIMS policy requires tags and hygiene liners attached on a returnable item. */
  requiresHygieneLiner: boolean;
};

const variant = (input: CatalogVariant): CatalogVariant => input;

/**
 * The hero style for the demo. Fits Everybody is the collection SKIMS describes as
 * its best seller, and a two-unit order in adjacent sizes is the size-bracketing
 * pattern that drives most apparel returns.
 */
export const fitsEverybodyCamiBodysuit = {
  styleId: "SK-FE-CAMI-BODYSUIT",
  title: "Fits Everybody Cami Bodysuit",
  collection: "Fits Everybody",
  unitPriceCents: 5_800,
  fabric: "82% nylon, 18% elastane",
  packedGrams: 190,
} as const;

export const catalogVariants: readonly CatalogVariant[] = [
  variant({
    sku: "SK-FE-CAMI-BODYSUIT-ONX-M",
    styleId: fitsEverybodyCamiBodysuit.styleId,
    title: fitsEverybodyCamiBodysuit.title,
    collection: "Fits Everybody",
    color: "Onyx",
    size: "M",
    unitPriceCents: fitsEverybodyCamiBodysuit.unitPriceCents,
    imageUrl: "/evidence/catalog-fits-everybody-bodysuit.png",
    fabric: fitsEverybodyCamiBodysuit.fabric,
    packedGrams: fitsEverybodyCamiBodysuit.packedGrams,
    requiresHygieneLiner: true,
  }),
  variant({
    sku: "SK-FE-CAMI-BODYSUIT-ONX-L",
    styleId: fitsEverybodyCamiBodysuit.styleId,
    title: fitsEverybodyCamiBodysuit.title,
    collection: "Fits Everybody",
    color: "Onyx",
    size: "L",
    unitPriceCents: fitsEverybodyCamiBodysuit.unitPriceCents,
    imageUrl: "/evidence/catalog-fits-everybody-bodysuit.png",
    fabric: fitsEverybodyCamiBodysuit.fabric,
    packedGrams: fitsEverybodyCamiBodysuit.packedGrams,
    requiresHygieneLiner: true,
  }),
  variant({
    sku: "SK-SL-SLIP-DRESS-MRG-S",
    styleId: "SK-SL-SLIP-DRESS",
    title: "Soft Lounge Long Slip Dress",
    collection: "Soft Lounge",
    color: "Morganite",
    size: "S",
    unitPriceCents: 8_800,
    imageUrl: "/evidence/catalog-soft-lounge-slip-dress.png",
    fabric: "95% modal, 5% elastane",
    packedGrams: 260,
    requiresHygieneLiner: false,
  }),
  variant({
    sku: "SK-SL-ROBE-IRM-M",
    styleId: "SK-SL-ROBE",
    title: "Soft Lounge Robe",
    collection: "Soft Lounge",
    color: "Iris Mica",
    size: "M",
    unitPriceCents: 10_800,
    imageUrl: "/evidence/catalog-soft-lounge-robe.png",
    fabric: "95% modal, 5% elastane",
    packedGrams: 520,
    requiresHygieneLiner: false,
  }),
  variant({
    sku: "SK-SC-MIDTHIGH-BODYSUIT-CLY-L",
    styleId: "SK-SC-MIDTHIGH-BODYSUIT",
    title: "Seamless Sculpt Mid Thigh Bodysuit",
    collection: "Sculpting",
    color: "Clay",
    size: "L",
    unitPriceCents: 7_800,
    imageUrl: "/evidence/catalog-seamless-sculpt-bodysuit.png",
    fabric: "77% nylon, 23% elastane",
    packedGrams: 240,
    requiresHygieneLiner: true,
  }),
  variant({
    sku: "SK-FE-TSHIRT-BRA-COC-34B",
    styleId: "SK-FE-TSHIRT-BRA",
    title: "Fits Everybody T-Shirt Bra",
    collection: "Fits Everybody",
    color: "Cocoa",
    size: "34B",
    unitPriceCents: 5_400,
    imageUrl: "/evidence/catalog-fits-everybody-bra.png",
    fabric: "82% nylon, 18% elastane",
    packedGrams: 150,
    requiresHygieneLiner: true,
  }),
  variant({
    sku: "SK-CR-BOXER-MRB-M",
    styleId: "SK-CR-BOXER",
    title: "Cotton Rib Boxer",
    collection: "Cotton Rib",
    color: "Marble",
    size: "M",
    unitPriceCents: 3_800,
    imageUrl: "/evidence/catalog-cotton-rib-boxer.png",
    fabric: "94% cotton, 6% elastane",
    packedGrams: 130,
    requiresHygieneLiner: true,
  }),
  variant({
    sku: "SK-SW-TRIANGLE-TOP-CUR-S",
    styleId: "SK-SW-TRIANGLE-TOP",
    title: "Iconic Swim Triangle Top",
    collection: "Swim",
    color: "Currant",
    size: "S",
    unitPriceCents: 6_800,
    imageUrl: "/evidence/catalog-swim-triangle-top.png",
    fabric: "80% nylon, 20% elastane",
    packedGrams: 95,
    requiresHygieneLiner: true,
  }),
];

const variantsBySku = new Map(catalogVariants.map((item) => [item.sku, item]));

export const catalogVariantBySku = (sku: string): CatalogVariant | null => variantsBySku.get(sku) ?? null;

/**
 * The decoy a wrong-item return arrives with. Apparel decoys are usually a cheap
 * garment of roughly the right shape and weight, not an obviously unrelated object.
 */
export const decoyGarment = {
  sku: "NON-CATALOG-TEE",
  title: "Unbranded grey cotton t-shirt",
  description: "Faded unbranded grey cotton t-shirt, no SKIMS tags or liner",
} as const;

/** Formats a variant the way a warehouse operator reads it off the pick ticket. */
export const describeVariant = (item: CatalogVariant): string =>
  `${item.title} · ${item.color} · ${item.size}`;

/** Expected packed weight for a line of `quantity` identical units, in kilograms. */
export const expectedPackedKg = (item: CatalogVariant, quantity: number): string =>
  `${((item.packedGrams * quantity) / 1000).toFixed(2)} kg`;
