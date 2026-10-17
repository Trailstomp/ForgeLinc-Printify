import { z } from "zod";
import { teams as builtInTeams, type Team } from "./catalog";

export const CATALOG_TEMPLATE_ID = "catalog-manager-v1";
export const CATALOG_VERSION = 1 as const;
export const MAX_VARIANTS_PER_PRODUCT = 2500;

export const catalogModeSchema = z.enum(["merch", "3d-print"]);
export type CatalogMode = z.infer<typeof catalogModeSchema>;

export const catalogProviderSchema = z.enum(["printify", "manual", "in-house"]);
export type CatalogProvider = z.infer<typeof catalogProviderSchema>;

export const productPresetSchema = z.enum([
  "team-jersey",
  "team-shirt",
  "team-hat",
  "drinkware",
  "3d-print",
  "blank",
]);
export type ProductPresetId = z.infer<typeof productPresetSchema>;

export const productRegionSchema = z.enum([
  "front",
  "back",
  "left-sleeve",
  "right-sleeve",
  "collar",
  "wrap",
  "front-panel",
  "model",
]);
export type ProductRegion = z.infer<typeof productRegionSchema>;

const uuidSchema = z.string().uuid();
const isoSchema = z.string().min(20).max(40);
const nameSchema = z.string().trim().min(1).max(100);
const descriptionSchema = z.string().trim().max(800).default("");
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const catalogLineInputSchema = z
  .object({
    id: uuidSchema.optional(),
    name: nameSchema,
    slug: z.union([slugSchema, z.literal("")]).default(""),
    description: descriptionSchema,
    mode: catalogModeSchema,
    status: z.enum(["active", "archived"]).default("active"),
  })
  .strict();
export type CatalogLineInput = z.infer<typeof catalogLineInputSchema>;

export const catalogLineSchema = catalogLineInputSchema
  .extend({
    id: uuidSchema,
    slug: slugSchema,
    createdAt: isoSchema,
    updatedAt: isoSchema,
  })
  .strict();
export type CatalogLine = z.infer<typeof catalogLineSchema>;

export const catalogCollectionInputSchema = z
  .object({
    id: uuidSchema.optional(),
    lineId: uuidSchema,
    name: nameSchema,
    slug: z.union([slugSchema, z.literal("")]).default(""),
    description: descriptionSchema,
    status: z.enum(["active", "archived"]).default("active"),
  })
  .strict();
export type CatalogCollectionInput = z.infer<typeof catalogCollectionInputSchema>;

export const catalogCollectionSchema = catalogCollectionInputSchema
  .extend({
    id: uuidSchema,
    slug: slugSchema,
    createdAt: isoSchema,
    updatedAt: isoSchema,
  })
  .strict();
export type CatalogCollection = z.infer<typeof catalogCollectionSchema>;

export const optionValueSchema = z
  .object({
    id: optionIdSchema,
    label: z.string().trim().min(1).max(100),
  })
  .strict();
export type OptionValue = z.infer<typeof optionValueSchema>;

export const optionAxisSchema = z
  .object({
    id: optionIdSchema,
    label: z.string().trim().min(1).max(60),
    values: z.array(optionValueSchema).min(1).max(100),
  })
  .strict()
  .superRefine((axis, ctx) => {
    if (new Set(axis.values.map((value) => value.id)).size !== axis.values.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${axis.label} option.` });
    }
  });
export type OptionAxis = z.infer<typeof optionAxisSchema>;

export const priceAdjustmentSchema = z
  .object({
    axisId: optionIdSchema,
    valueId: optionIdSchema,
    amountMinor: z.number().int().min(-100000).max(100000),
  })
  .strict();
export type PriceAdjustment = z.infer<typeof priceAdjustmentSchema>;

const providerMappingSchema = z
  .object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().min(1).max(200),
  })
  .strict();

const commerceMappingSchema = z
  .object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().min(1).max(200),
  })
  .strict();

export const catalogVariantSchema = z
  .object({
    id: uuidSchema,
    key: z.string().min(1).max(1200),
    options: z.record(z.string(), z.string()),
    sku: z.string().trim().min(1).max(160),
    priceMinor: z.number().int().min(0).max(10000000),
    priceOverrideMinor: z.number().int().min(0).max(10000000).nullable().default(null),
    readiness: z.enum(["draft", "needs-review", "ready", "unavailable"]),
    provider: providerMappingSchema.nullable().default(null),
    commerce: commerceMappingSchema.nullable().default(null),
    updatedAt: isoSchema,
  })
  .strict();
export type CatalogVariant = z.infer<typeof catalogVariantSchema>;

export const personalizationSchema = z
  .object({
    playerName: z.boolean(),
    playerNumber: z.boolean(),
    customerUploads: z.boolean(),
  })
  .strict();
export type ProductPersonalization = z.infer<typeof personalizationSchema>;

export const productPricingSchema = z
  .object({
    currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
    basePriceMinor: z.number().int().min(0).max(10000000),
    adjustments: z.array(priceAdjustmentSchema).max(500),
  })
  .strict();
export type ProductPricing = z.infer<typeof productPricingSchema>;

export const catalogProductInputSchema = z
  .object({
    id: uuidSchema.optional(),
    collectionId: uuidSchema,
    name: nameSchema,
    slug: z.union([slugSchema, z.literal("")]).default(""),
    description: descriptionSchema,
    preset: productPresetSchema,
    mode: catalogModeSchema,
    provider: catalogProviderSchema,
    providerBlueprintId: z.string().trim().max(200).default(""),
    providerPrintProviderId: z.string().trim().max(200).default(""),
    regions: z.array(productRegionSchema).max(12),
    personalization: personalizationSchema,
    axes: z.array(optionAxisSchema).max(12),
    providerProductAxes: z.array(optionIdSchema).max(12),
    pricing: productPricingSchema,
    status: z.enum(["draft", "ready", "archived"]).default("draft"),
  })
  .strict()
  .superRefine((product, ctx) => {
    if (new Set(product.regions).size !== product.regions.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each print region can be selected once." });
    }
    if (new Set(product.axes.map((axis) => axis.id)).size !== product.axes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each option group must have a unique name." });
    }
    const axisIds = new Set(product.axes.map((axis) => axis.id));
    if (new Set(product.providerProductAxes).size !== product.providerProductAxes.length || product.providerProductAxes.some((axisId) => !axisIds.has(axisId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provider product grouping must use available option groups." });
    }
    const values = new Set(product.axes.flatMap((axis) => axis.values.map((value) => `${axis.id}:${value.id}`)));
    for (const adjustment of product.pricing.adjustments) {
      if (!axisIds.has(adjustment.axisId) || !values.has(`${adjustment.axisId}:${adjustment.valueId}`)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A price adjustment points to an unavailable option." });
      }
    }
  });
export type CatalogProductInput = z.infer<typeof catalogProductInputSchema>;

export const catalogProductSchema = catalogProductInputSchema
  .extend({
    id: uuidSchema,
    slug: slugSchema,
    variants: z.array(catalogVariantSchema).max(MAX_VARIANTS_PER_PRODUCT),
    createdAt: isoSchema,
    updatedAt: isoSchema,
  })
  .strict();
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

export const catalogStateSchema = z
  .object({
    version: z.literal(CATALOG_VERSION),
    revision: z.number().int().min(0),
    lines: z.array(catalogLineSchema).max(100),
    collections: z.array(catalogCollectionSchema).max(500),
    products: z.array(catalogProductSchema).max(500),
    updatedAt: isoSchema,
  })
  .strict()
  .superRefine((state, ctx) => {
    const lineIds = new Set(state.lines.map((line) => line.id));
    const collectionIds = new Set(state.collections.map((collection) => collection.id));
    if (lineIds.size !== state.lines.length || collectionIds.size !== state.collections.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog IDs must be unique." });
    }
    for (const collection of state.collections) {
      if (!lineIds.has(collection.lineId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Collection ${collection.name} is missing its product line.` });
      }
    }
    const productIds = new Set<string>();
    for (const product of state.products) {
      if (productIds.has(product.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Product IDs must be unique." });
      }
      productIds.add(product.id);
      if (!collectionIds.has(product.collectionId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Product ${product.name} is missing its collection.` });
      }
    }
  });
export type CatalogState = z.infer<typeof catalogStateSchema>;

const expectedRevisionSchema = z.number().int().min(0);
export const catalogMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-line"), expectedRevision: expectedRevisionSchema, line: catalogLineInputSchema }).strict(),
  z.object({ action: z.literal("delete-line"), expectedRevision: expectedRevisionSchema, lineId: uuidSchema }).strict(),
  z.object({ action: z.literal("save-collection"), expectedRevision: expectedRevisionSchema, collection: catalogCollectionInputSchema }).strict(),
  z.object({ action: z.literal("delete-collection"), expectedRevision: expectedRevisionSchema, collectionId: uuidSchema }).strict(),
  z.object({ action: z.literal("save-product"), expectedRevision: expectedRevisionSchema, product: catalogProductInputSchema }).strict(),
  z.object({ action: z.literal("delete-product"), expectedRevision: expectedRevisionSchema, productId: uuidSchema }).strict(),
  z.object({
    action: z.literal("duplicate-product"),
    expectedRevision: expectedRevisionSchema,
    productId: uuidSchema,
    collectionId: uuidSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("save-variant"),
    expectedRevision: expectedRevisionSchema,
    productId: uuidSchema,
    variantId: uuidSchema,
    variant: z
      .object({
        sku: z.string().trim().min(1).max(160),
        priceOverrideMinor: z.number().int().min(0).max(10000000).nullable(),
        readiness: z.enum(["draft", "needs-review", "ready", "unavailable"]),
        provider: providerMappingSchema.nullable(),
        commerce: commerceMappingSchema.nullable(),
      })
      .strict(),
  }).strict(),
  z.object({ action: z.literal("restore-starter"), expectedRevision: expectedRevisionSchema }).strict(),
]);
export type CatalogMutation = z.infer<typeof catalogMutationSchema>;

export type TeamChoice = Pick<Team, "id" | "name">;

export type ProductPresetDefinition = {
  id: ProductPresetId;
  label: string;
  description: string;
  mode: CatalogMode;
  provider: CatalogProvider;
  regions: ProductRegion[];
  personalization: ProductPersonalization;
};

export const PRODUCT_PRESETS: ProductPresetDefinition[] = [
  {
    id: "team-jersey",
    label: "Team jersey",
    description: "Full-sublimation jersey with team, theme and size variants.",
    mode: "merch",
    provider: "printify",
    regions: ["front", "back", "left-sleeve", "right-sleeve", "collar"],
    personalization: { playerName: true, playerNumber: true, customerUploads: false },
  },
  {
    id: "team-shirt",
    label: "Shirt or hoodie",
    description: "Team apparel with front/back artwork and standard apparel sizes.",
    mode: "merch",
    provider: "printify",
    regions: ["front", "back"],
    personalization: { playerName: false, playerNumber: false, customerUploads: false },
  },
  {
    id: "team-hat",
    label: "Hat",
    description: "Team hat with one front decoration area.",
    mode: "merch",
    provider: "printify",
    regions: ["front-panel"],
    personalization: { playerName: false, playerNumber: false, customerUploads: false },
  },
  {
    id: "drinkware",
    label: "Drinkware",
    description: "Mug, tumbler or bottle with a wrap decoration area.",
    mode: "merch",
    provider: "printify",
    regions: ["wrap"],
    personalization: { playerName: false, playerNumber: false, customerUploads: false },
  },
  {
    id: "3d-print",
    label: "3D-printed product",
    description: "Manual production item with material, color and size options.",
    mode: "3d-print",
    provider: "in-house",
    regions: ["model"],
    personalization: { playerName: true, playerNumber: true, customerUploads: false },
  },
  {
    id: "blank",
    label: "Blank product",
    description: "Start without suggested options or decoration regions.",
    mode: "merch",
    provider: "manual",
    regions: [],
    personalization: { playerName: false, playerNumber: false, customerUploads: false },
  },
];

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;

export function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || "item";
}

export function uniqueSlug(preferred: string, used: Iterable<string>) {
  const taken = new Set(used);
  const base = slugify(preferred);
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function optionValues(values: readonly string[]): OptionValue[] {
  return values.map((label) => ({ id: slugify(label), label }));
}

export function presetAxes(preset: ProductPresetId, teamChoices: TeamChoice[]): OptionAxis[] {
  const teams = teamChoices.map((team) => ({ id: optionIdSchema.parse(team.id), label: team.name }));
  switch (preset) {
    case "team-jersey":
      return [
        { id: "team", label: "Team", values: teams },
        { id: "theme", label: "Theme", values: optionValues(["Light", "Dark"]) },
        { id: "size", label: "Size", values: optionValues(APPAREL_SIZES) },
      ];
    case "team-shirt":
      return [
        { id: "team", label: "Team", values: teams },
        { id: "style", label: "Style", values: optionValues(["Light", "Dark"]) },
        { id: "size", label: "Size", values: optionValues(APPAREL_SIZES) },
      ];
    case "team-hat":
      return [
        { id: "team", label: "Team", values: teams },
        { id: "fit", label: "Fit", values: optionValues(["Adjustable"]) },
      ];
    case "drinkware":
      return [
        { id: "team", label: "Team", values: teams },
        { id: "capacity", label: "Capacity", values: optionValues(["20 oz"]) },
      ];
    case "3d-print":
      return [
        { id: "material", label: "Material", values: optionValues(["PLA", "PETG"]) },
        { id: "color", label: "Color", values: optionValues(["Team colors"]) },
        { id: "size", label: "Size", values: optionValues(["Standard"]) },
      ];
    case "blank":
      return [];
  }
}

function presetProviderProductAxes(preset: ProductPresetId) {
  switch (preset) {
    case "team-jersey": return ["team", "theme"];
    case "team-shirt": return ["team", "style"];
    case "team-hat":
    case "drinkware": return ["team"];
    default: return [];
  }
}

export function presetProductInput(
  presetId: ProductPresetId,
  collectionId: string,
  teamChoices: TeamChoice[],
): CatalogProductInput {
  const preset = PRODUCT_PRESETS.find((item) => item.id === presetId) ?? PRODUCT_PRESETS[0];
  const suggestedName = presetId === "team-jersey" ? "Brotherhood Jersey" : preset.label;
  return {
    collectionId,
    name: suggestedName,
    slug: slugify(suggestedName),
    description: preset.description,
    preset: preset.id,
    mode: preset.mode,
    provider: preset.provider,
    providerBlueprintId: "",
    providerPrintProviderId: "",
    regions: [...preset.regions],
    personalization: { ...preset.personalization },
    axes: presetAxes(preset.id, teamChoices),
    providerProductAxes: presetProviderProductAxes(preset.id),
    pricing: { currency: "USD", basePriceMinor: preset.id === "team-jersey" ? 5500 : 0, adjustments: [] },
    status: "draft",
  };
}

export function variantCount(axes: OptionAxis[]) {
  return axes.reduce((count, axis) => count * axis.values.length, 1);
}

export function providerProductCount(axes: OptionAxis[], providerProductAxes: string[]) {
  const grouping = new Set(providerProductAxes);
  return axes.filter((axis) => grouping.has(axis.id)).reduce((count, axis) => count * axis.values.length, 1);
}

export function variantsPerProviderProduct(axes: OptionAxis[], providerProductAxes: string[]) {
  return Math.max(1, Math.ceil(variantCount(axes) / providerProductCount(axes, providerProductAxes)));
}

function optionCombinations(axes: OptionAxis[]) {
  if (!axes.length) return [{}] as Record<string, string>[];
  return axes.reduce<Record<string, string>[]>((combinations, axis) => {
    const next: Record<string, string>[] = [];
    for (const combination of combinations) {
      for (const value of axis.values) next.push({ ...combination, [axis.id]: value.id });
    }
    return next;
  }, [{}]);
}

export function variantKey(axes: OptionAxis[], options: Record<string, string>) {
  return axes.map((axis) => `${axis.id}:${options[axis.id] ?? ""}`).join("|");
}

function adjustmentTotal(pricing: ProductPricing, options: Record<string, string>) {
  return pricing.adjustments.reduce(
    (total, adjustment) => total + (options[adjustment.axisId] === adjustment.valueId ? adjustment.amountMinor : 0),
    0,
  );
}

function skuPart(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 14) || "VAR";
}

function generatedSku(productSlug: string, axes: OptionAxis[], options: Record<string, string>) {
  const suffix = axes.map((axis) => skuPart(options[axis.id] ?? axis.id)).join("-");
  return [`FL`, skuPart(productSlug), suffix].filter(Boolean).join("-").slice(0, 160);
}

export function buildVariants(
  productId: string,
  productSlug: string,
  axes: OptionAxis[],
  pricing: ProductPricing,
  existing: CatalogVariant[] = [],
  now = new Date().toISOString(),
  makeId: () => string = () => crypto.randomUUID(),
): CatalogVariant[] {
  const count = variantCount(axes);
  if (count > MAX_VARIANTS_PER_PRODUCT) throw new Error(`This product would create ${count} variants. The limit is ${MAX_VARIANTS_PER_PRODUCT}.`);
  const previous = new Map(existing.map((variant) => [variant.key, variant]));
  return optionCombinations(axes).map((options) => {
    const key = variantKey(axes, options);
    const saved = previous.get(key);
    const calculatedPrice = Math.max(0, pricing.basePriceMinor + adjustmentTotal(pricing, options));
    const override = saved?.priceOverrideMinor ?? null;
    return {
      id: saved?.id ?? makeId(),
      key,
      options,
      sku: saved?.sku ?? generatedSku(productSlug, axes, options),
      priceMinor: override ?? calculatedPrice,
      priceOverrideMinor: override,
      readiness: saved?.readiness ?? "needs-review",
      provider: saved?.provider ?? null,
      commerce: saved?.commerce ?? null,
      updatedAt: now,
    };
  });
}

export function productBlockers(product: Pick<CatalogProduct, "mode" | "provider" | "providerBlueprintId" | "providerPrintProviderId" | "regions" | "pricing" | "variants">) {
  const blockers: string[] = [];
  if (product.pricing.basePriceMinor <= 0) blockers.push("Set the base retail price.");
  if (product.mode === "merch" && product.regions.length === 0) blockers.push("Choose at least one decoration region.");
  if (product.provider === "printify" && !product.providerBlueprintId) blockers.push("Add the Printify blueprint ID.");
  if (product.provider === "printify" && !product.providerPrintProviderId) blockers.push("Add the Printify print-provider ID.");
  const activeVariants = product.variants.filter((variant) => variant.readiness !== "unavailable");
  if (product.variants.length === 0) blockers.push("Add at least one sellable variant.");
  if (product.variants.length > 0 && activeVariants.length === 0) blockers.push("Keep at least one variant available for sale.");
  if (activeVariants.some((variant) => variant.priceMinor <= 0)) blockers.push("Every active variant needs a retail price.");
  if (product.variants.some((variant) => variant.readiness !== "ready")) blockers.push("Review each variant before publication.");
  if (product.provider !== "manual" && product.variants.some((variant) => variant.readiness !== "unavailable" && !variant.provider)) blockers.push("Map every active variant to its production provider.");
  if (product.variants.some((variant) => variant.readiness !== "unavailable" && !variant.commerce)) blockers.push("Map every active variant to Shopify before publication.");
  return [...new Set(blockers)];
}

export function catalogSummary(state: CatalogState) {
  const variants = state.products.reduce((count, product) => count + product.variants.length, 0);
  const readyProducts = state.products.filter((product) => product.status === "ready" && productBlockers(product).length === 0).length;
  return {
    lines: state.lines.length,
    collections: state.collections.length,
    products: state.products.length,
    variants,
    readyProducts,
  };
}

function starterTeams() {
  return builtInTeams.map(({ id, name }) => ({ id, name }));
}

export function createStarterCatalog(now = new Date().toISOString(), makeId: () => string = () => crypto.randomUUID()): CatalogState {
  const lineId = "11111111-1111-4111-8111-111111111111";
  const collectionId = "22222222-2222-4222-8222-222222222222";
  const productId = "33333333-3333-4333-8333-333333333333";
  const input = presetProductInput("team-jersey", collectionId, starterTeams());
  const product: CatalogProduct = {
    ...input,
    id: productId,
    slug: "brotherhood-jersey",
    variants: buildVariants(productId, "brotherhood-jersey", input.axes, input.pricing, [], now, makeId),
    createdAt: now,
    updatedAt: now,
  };
  return catalogStateSchema.parse({
    version: CATALOG_VERSION,
    revision: 0,
    lines: [
      {
        id: lineId,
        name: "MLBL Team Wear",
        slug: "mlbl-team-wear",
        description: "League and team apparel produced through ForgeLinc.",
        mode: "merch",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    collections: [
      {
        id: collectionId,
        lineId,
        name: "Brotherhood Collection",
        slug: "brotherhood-collection",
        description: "Your team up front. The whole league behind you.",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    products: [product],
    updatedAt: now,
  });
}

function nextRevision(state: CatalogState, now: string): CatalogState {
  return { ...state, revision: state.revision + 1, updatedAt: now };
}

function lineSlug(state: CatalogState, input: CatalogLineInput) {
  const used = state.lines.filter((line) => line.id !== input.id).map((line) => line.slug);
  return input.slug ? uniqueSlug(input.slug, used) : uniqueSlug(input.name, used);
}

function collectionSlug(state: CatalogState, input: CatalogCollectionInput) {
  const used = state.collections
    .filter((collection) => collection.lineId === input.lineId && collection.id !== input.id)
    .map((collection) => collection.slug);
  return input.slug ? uniqueSlug(input.slug, used) : uniqueSlug(input.name, used);
}

function productSlug(state: CatalogState, input: CatalogProductInput) {
  const used = state.products
    .filter((product) => product.collectionId === input.collectionId && product.id !== input.id)
    .map((product) => product.slug);
  return input.slug ? uniqueSlug(input.slug, used) : uniqueSlug(input.name, used);
}

export function applyCatalogMutation(
  state: CatalogState,
  mutation: CatalogMutation,
  teamIds: Set<string>,
  now = new Date().toISOString(),
  makeId: () => string = () => crypto.randomUUID(),
): { state: CatalogState; selectedId?: string } {
  const current = catalogStateSchema.parse(state);
  switch (mutation.action) {
    case "save-line": {
      const existing = mutation.line.id ? current.lines.find((line) => line.id === mutation.line.id) : undefined;
      if (mutation.line.id && !existing) throw new Error("That product line no longer exists. Refresh and try again.");
      if (existing && existing.mode !== mutation.line.mode) {
        const collectionIds = new Set(current.collections.filter((collection) => collection.lineId === existing.id).map((collection) => collection.id));
        if (current.products.some((product) => collectionIds.has(product.collectionId))) {
          throw new Error("Move or delete this line’s products before changing its production mode.");
        }
      }
      const line: CatalogLine = {
        ...mutation.line,
        id: existing?.id ?? makeId(),
        slug: lineSlug(current, mutation.line),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const lines = existing ? current.lines.map((item) => (item.id === line.id ? line : item)) : [...current.lines, line];
      return { state: catalogStateSchema.parse(nextRevision({ ...current, lines }, now)), selectedId: line.id };
    }
    case "delete-line": {
      if (current.collections.some((collection) => collection.lineId === mutation.lineId)) {
        throw new Error("Move or delete this line's collections first.");
      }
      if (!current.lines.some((line) => line.id === mutation.lineId)) throw new Error("That product line is already gone.");
      return { state: catalogStateSchema.parse(nextRevision({ ...current, lines: current.lines.filter((line) => line.id !== mutation.lineId) }, now)) };
    }
    case "save-collection": {
      if (!current.lines.some((line) => line.id === mutation.collection.lineId)) throw new Error("Choose an existing product line.");
      const existing = mutation.collection.id ? current.collections.find((collection) => collection.id === mutation.collection.id) : undefined;
      if (mutation.collection.id && !existing) throw new Error("That collection no longer exists. Refresh and try again.");
      if (existing && existing.lineId !== mutation.collection.lineId) {
        const targetLine = current.lines.find((line) => line.id === mutation.collection.lineId);
        const products = current.products.filter((product) => product.collectionId === existing.id);
        if (products.some((product) => product.mode !== targetLine?.mode)) {
          throw new Error("Move this collection only to a product line with the same production mode.");
        }
      }
      const collection: CatalogCollection = {
        ...mutation.collection,
        id: existing?.id ?? makeId(),
        slug: collectionSlug(current, mutation.collection),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const collections = existing
        ? current.collections.map((item) => (item.id === collection.id ? collection : item))
        : [...current.collections, collection];
      return { state: catalogStateSchema.parse(nextRevision({ ...current, collections }, now)), selectedId: collection.id };
    }
    case "delete-collection": {
      if (current.products.some((product) => product.collectionId === mutation.collectionId)) {
        throw new Error("Move or delete this collection's products first.");
      }
      if (!current.collections.some((collection) => collection.id === mutation.collectionId)) throw new Error("That collection is already gone.");
      return {
        state: catalogStateSchema.parse(
          nextRevision({ ...current, collections: current.collections.filter((collection) => collection.id !== mutation.collectionId) }, now),
        ),
      };
    }
    case "save-product": {
      const collection = current.collections.find((item) => item.id === mutation.product.collectionId);
      if (!collection) throw new Error("Choose an existing collection.");
      const line = current.lines.find((item) => item.id === collection.lineId);
      if (!line) throw new Error("This collection is missing its product line.");
      if (line.mode !== mutation.product.mode) throw new Error(`This collection belongs to a ${line.mode} line. Choose a matching product type.`);
      const teamAxis = mutation.product.axes.find((axis) => axis.id === "team");
      if (teamAxis?.values.some((value) => !teamIds.has(value.id))) throw new Error("One or more selected teams are no longer available.");
      const count = variantCount(mutation.product.axes);
      if (count > MAX_VARIANTS_PER_PRODUCT) throw new Error(`This setup creates ${count} variants. Reduce the options below ${MAX_VARIANTS_PER_PRODUCT}.`);
      const existing = mutation.product.id ? current.products.find((product) => product.id === mutation.product.id) : undefined;
      if (mutation.product.id && !existing) throw new Error("That product no longer exists. Refresh and try again.");
      const id = existing?.id ?? makeId();
      const slug = productSlug(current, mutation.product);
      const variants = buildVariants(id, slug, mutation.product.axes, mutation.product.pricing, existing?.variants ?? [], now, makeId);
      const product: CatalogProduct = {
        ...mutation.product,
        id,
        slug,
        variants,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (product.status === "ready" && productBlockers(product).length) {
        throw new Error("Finish the readiness checklist before marking this product ready.");
      }
      const products = existing ? current.products.map((item) => (item.id === id ? product : item)) : [...current.products, product];
      return { state: catalogStateSchema.parse(nextRevision({ ...current, products }, now)), selectedId: id };
    }
    case "delete-product": {
      if (!current.products.some((product) => product.id === mutation.productId)) throw new Error("That product is already gone.");
      return {
        state: catalogStateSchema.parse(
          nextRevision({ ...current, products: current.products.filter((product) => product.id !== mutation.productId) }, now),
        ),
      };
    }
    case "duplicate-product": {
      const source = current.products.find((product) => product.id === mutation.productId);
      if (!source) throw new Error("That product no longer exists.");
      const collectionId = mutation.collectionId ?? source.collectionId;
      const collection = current.collections.find((item) => item.id === collectionId);
      if (!collection) throw new Error("Choose an existing destination collection.");
      const line = current.lines.find((item) => item.id === collection.lineId);
      if (!line || line.mode !== source.mode) throw new Error("The destination collection must use the same production mode.");
      const id = makeId();
      const name = `Copy of ${source.name}`.slice(0, 100);
      const slug = uniqueSlug(name, current.products.filter((product) => product.collectionId === collectionId).map((product) => product.slug));
      const variants = buildVariants(id, slug, source.axes, source.pricing, [], now, makeId);
      const copy: CatalogProduct = {
        ...source,
        id,
        collectionId,
        name,
        slug,
        status: "draft",
        variants,
        createdAt: now,
        updatedAt: now,
      };
      return { state: catalogStateSchema.parse(nextRevision({ ...current, products: [...current.products, copy] }, now)), selectedId: id };
    }
    case "save-variant": {
      const product = current.products.find((item) => item.id === mutation.productId);
      if (!product) throw new Error("That product no longer exists.");
      const existing = product.variants.find((variant) => variant.id === mutation.variantId);
      if (!existing) throw new Error("That variant no longer exists.");
      const calculated = Math.max(0, product.pricing.basePriceMinor + adjustmentTotal(product.pricing, existing.options));
      const variant: CatalogVariant = {
        ...existing,
        ...mutation.variant,
        priceMinor: mutation.variant.priceOverrideMinor ?? calculated,
        updatedAt: now,
      };
      if (variant.readiness === "ready") {
        if (variant.priceMinor <= 0) throw new Error("Set a retail price before marking this variant ready.");
        if (product.provider !== "manual" && !variant.provider) throw new Error("Add the provider mapping before marking this variant ready.");
        if (!variant.commerce) throw new Error("Add the Shopify mapping before marking this variant ready.");
      }
      const updatedProduct = {
        ...product,
        variants: product.variants.map((item) => (item.id === variant.id ? variant : item)),
        updatedAt: now,
      };
      return {
        state: catalogStateSchema.parse(
          nextRevision({ ...current, products: current.products.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)) }, now),
        ),
        selectedId: product.id,
      };
    }
    case "restore-starter": {
      if (current.lines.length || current.collections.length || current.products.length) {
        throw new Error("Starter data can only be restored to an empty catalog.");
      }
      const starter = createStarterCatalog(now, makeId);
      return { state: { ...starter, revision: current.revision + 1 }, selectedId: starter.products[0]?.id };
    }
  }
}
