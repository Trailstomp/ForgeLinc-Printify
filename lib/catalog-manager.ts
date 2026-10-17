import { z } from "zod";
import { teams as builtInTeams, type Team } from "./catalog";

export const CATALOG_TEMPLATE_ID = "catalog-manager-v1";
export const MAX_VARIANTS_PER_PRODUCT = 2500;
const VERSION = 1 as const;
const uuid = z.string().uuid();
const iso = z.string().min(20).max(40);
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionId = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const title = z.string().trim().min(1).max(100);
const description = z.string().trim().max(800).default("");

export const catalogModeSchema = z.enum(["merch", "3d-print"]);
export const catalogProviderSchema = z.enum(["printify", "manual", "in-house"]);
export const productPresetSchema = z.enum(["team-jersey", "team-shirt", "team-hat", "drinkware", "3d-print", "blank"]);
export const productRegionSchema = z.enum(["front", "back", "left-sleeve", "right-sleeve", "collar", "wrap", "front-panel", "model"]);
export type CatalogMode = z.infer<typeof catalogModeSchema>;
export type CatalogProvider = z.infer<typeof catalogProviderSchema>;
export type ProductPresetId = z.infer<typeof productPresetSchema>;
export type ProductRegion = z.infer<typeof productRegionSchema>;

const lineBase = z.object({
  id: uuid.optional(), name: title, slug: z.union([slug, z.literal("")]).default(""), description,
  mode: catalogModeSchema, status: z.enum(["active", "archived"]).default("active"),
}).strict();
export const catalogLineInputSchema = lineBase;
export const catalogLineSchema = lineBase.extend({ id: uuid, slug, createdAt: iso, updatedAt: iso }).strict();
export type CatalogLineInput = z.infer<typeof catalogLineInputSchema>;
export type CatalogLine = z.infer<typeof catalogLineSchema>;

const collectionBase = z.object({
  id: uuid.optional(), lineId: uuid, name: title, slug: z.union([slug, z.literal("")]).default(""), description,
  status: z.enum(["active", "archived"]).default("active"),
}).strict();
export const catalogCollectionInputSchema = collectionBase;
export const catalogCollectionSchema = collectionBase.extend({ id: uuid, slug, createdAt: iso, updatedAt: iso }).strict();
export type CatalogCollectionInput = z.infer<typeof catalogCollectionInputSchema>;
export type CatalogCollection = z.infer<typeof catalogCollectionSchema>;

export const optionValueSchema = z.object({ id: optionId, label: z.string().trim().min(1).max(100) }).strict();
const optionAxisObject = z.object({ id: optionId, label: z.string().trim().min(1).max(60), values: z.array(optionValueSchema).min(1).max(100) }).strict();
export const optionAxisSchema = optionAxisObject.superRefine((axis, ctx) => {
  if (new Set(axis.values.map((value) => value.id)).size !== axis.values.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${axis.label} option.` });
});
export type OptionAxis = z.infer<typeof optionAxisSchema>;
export type OptionValue = z.infer<typeof optionValueSchema>;

export const priceAdjustmentSchema = z.object({ axisId: optionId, valueId: optionId, amountMinor: z.number().int().min(-100000).max(100000) }).strict();
const mapping = z.object({ productId: z.string().trim().min(1).max(200), variantId: z.string().trim().min(1).max(200) }).strict();
export const catalogVariantSchema = z.object({
  id: uuid, key: z.string().min(1).max(1200), options: z.record(z.string()), sku: z.string().trim().min(1).max(160),
  priceMinor: z.number().int().min(0).max(10000000), priceOverrideMinor: z.number().int().min(0).max(10000000).nullable().default(null),
  readiness: z.enum(["draft", "needs-review", "ready", "unavailable"]), provider: mapping.nullable().default(null),
  commerce: mapping.nullable().default(null), updatedAt: iso,
}).strict();
export type CatalogVariant = z.infer<typeof catalogVariantSchema>;

export const personalizationSchema = z.object({ playerName: z.boolean(), playerNumber: z.boolean(), customerUploads: z.boolean() }).strict();
export const productPricingSchema = z.object({
  currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/), basePriceMinor: z.number().int().min(0).max(10000000),
  adjustments: z.array(priceAdjustmentSchema).max(500),
}).strict();
export type ProductPricing = z.infer<typeof productPricingSchema>;
export type ProductPersonalization = z.infer<typeof personalizationSchema>;

const productBase = z.object({
  id: uuid.optional(), collectionId: uuid, name: title, slug: z.union([slug, z.literal("")]).default(""), description,
  preset: productPresetSchema, mode: catalogModeSchema, provider: catalogProviderSchema,
  providerBlueprintId: z.string().trim().max(200).default(""), providerPrintProviderId: z.string().trim().max(200).default(""),
  regions: z.array(productRegionSchema).max(12), personalization: personalizationSchema, axes: z.array(optionAxisSchema).max(12),
  providerProductAxes: z.array(optionId).max(12), pricing: productPricingSchema,
  status: z.enum(["draft", "ready", "archived"]).default("draft"),
}).strict();
type ProductShape = z.infer<typeof productBase>;
function validateProduct(product: ProductShape, ctx: z.RefinementCtx) {
  if (new Set(product.regions).size !== product.regions.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each print region can be selected once." });
  const axisIds = product.axes.map((axis) => axis.id), axisSet = new Set(axisIds);
  if (axisSet.size !== axisIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each option group must have a unique key." });
  if (new Set(product.providerProductAxes).size !== product.providerProductAxes.length || product.providerProductAxes.some((id) => !axisSet.has(id))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provider grouping must use available option groups." });
  const values = new Set(product.axes.flatMap((axis) => axis.values.map((value) => `${axis.id}:${value.id}`)));
  if (product.pricing.adjustments.some((item) => !values.has(`${item.axisId}:${item.valueId}`))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A price adjustment points to an unavailable option." });
}
export const catalogProductInputSchema = productBase.superRefine(validateProduct);
export const catalogProductSchema = productBase.extend({
  id: uuid, slug, variants: z.array(catalogVariantSchema).max(MAX_VARIANTS_PER_PRODUCT), createdAt: iso, updatedAt: iso,
}).strict().superRefine(validateProduct);
export type CatalogProductInput = z.infer<typeof catalogProductInputSchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

const stateObject = z.object({
  version: z.literal(VERSION), revision: z.number().int().min(0), lines: z.array(catalogLineSchema).max(100),
  collections: z.array(catalogCollectionSchema).max(500), products: z.array(catalogProductSchema).max(500), updatedAt: iso,
}).strict();
export const catalogStateSchema = stateObject.superRefine((state, ctx) => {
  const lines = new Set(state.lines.map((line) => line.id)), collections = new Set(state.collections.map((collection) => collection.id));
  if (lines.size !== state.lines.length || collections.size !== state.collections.length || new Set(state.products.map((product) => product.id)).size !== state.products.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog IDs must be unique." });
  if (state.collections.some((collection) => !lines.has(collection.lineId))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Every collection needs a product line." });
  if (state.products.some((product) => !collections.has(product.collectionId))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Every product needs a collection." });
});
export type CatalogState = z.infer<typeof catalogStateSchema>;

const revision = z.number().int().min(0);
export const catalogMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-line"), expectedRevision: revision, line: catalogLineInputSchema }).strict(),
  z.object({ action: z.literal("delete-line"), expectedRevision: revision, lineId: uuid }).strict(),
  z.object({ action: z.literal("save-collection"), expectedRevision: revision, collection: catalogCollectionInputSchema }).strict(),
  z.object({ action: z.literal("delete-collection"), expectedRevision: revision, collectionId: uuid }).strict(),
  z.object({ action: z.literal("save-product"), expectedRevision: revision, product: catalogProductInputSchema }).strict(),
  z.object({ action: z.literal("delete-product"), expectedRevision: revision, productId: uuid }).strict(),
  z.object({ action: z.literal("duplicate-product"), expectedRevision: revision, productId: uuid, collectionId: uuid.optional() }).strict(),
  z.object({ action: z.literal("save-variant"), expectedRevision: revision, productId: uuid, variantId: uuid, variant: z.object({
    sku: z.string().trim().min(1).max(160), priceOverrideMinor: z.number().int().min(0).max(10000000).nullable(),
    readiness: z.enum(["draft", "needs-review", "ready", "unavailable"]), provider: mapping.nullable(), commerce: mapping.nullable(),
  }).strict() }).strict(),
  z.object({ action: z.literal("restore-starter"), expectedRevision: revision }).strict(),
]);
export type CatalogMutation = z.infer<typeof catalogMutationSchema>;
export type TeamChoice = Pick<Team, "id" | "name">;

type Preset = { id: ProductPresetId; label: string; description: string; mode: CatalogMode; provider: CatalogProvider; regions: ProductRegion[]; personalization: ProductPersonalization };
export const PRODUCT_PRESETS: Preset[] = [
  { id: "team-jersey", label: "Team jersey", description: "Full-sublimation jersey with team, theme and size variants.", mode: "merch", provider: "printify", regions: ["front", "back", "left-sleeve", "right-sleeve", "collar"], personalization: { playerName: true, playerNumber: true, customerUploads: false } },
  { id: "team-shirt", label: "Shirt or hoodie", description: "Team apparel with front/back artwork and apparel sizes.", mode: "merch", provider: "printify", regions: ["front", "back"], personalization: { playerName: false, playerNumber: false, customerUploads: false } },
  { id: "team-hat", label: "Hat", description: "Team hat with a front decoration area.", mode: "merch", provider: "printify", regions: ["front-panel"], personalization: { playerName: false, playerNumber: false, customerUploads: false } },
  { id: "drinkware", label: "Drinkware", description: "Mug, tumbler or bottle with a wrap area.", mode: "merch", provider: "printify", regions: ["wrap"], personalization: { playerName: false, playerNumber: false, customerUploads: false } },
  { id: "3d-print", label: "3D-printed product", description: "Manual production item with material, color and size options.", mode: "3d-print", provider: "in-house", regions: ["model"], personalization: { playerName: true, playerNumber: true, customerUploads: false } },
  { id: "blank", label: "Blank product", description: "Start without suggested options or artwork areas.", mode: "merch", provider: "manual", regions: [], personalization: { playerName: false, playerNumber: false, customerUploads: false } },
];
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
export function slugify(value: string) { return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item"; }
export function uniqueSlug(value: string, used: Iterable<string>) { const taken = new Set(used), base = slugify(value); if (!taken.has(base)) return base; let n = 2; while (taken.has(`${base}-${n}`)) n += 1; return `${base}-${n}`; }
const values = (labels: string[]) => labels.map((label) => ({ id: slugify(label), label }));
export function presetAxes(preset: ProductPresetId, teams: TeamChoice[]): OptionAxis[] {
  const team = { id: "team", label: "Team", values: teams.map(({ id, name }) => ({ id, label: name })) };
  if (preset === "team-jersey") return [team, { id: "theme", label: "Theme", values: values(["Light", "Dark"]) }, { id: "size", label: "Size", values: values(SIZES) }];
  if (preset === "team-shirt") return [team, { id: "style", label: "Style", values: values(["Light", "Dark"]) }, { id: "size", label: "Size", values: values(SIZES) }];
  if (preset === "team-hat") return [team, { id: "fit", label: "Fit", values: values(["Adjustable"]) }];
  if (preset === "drinkware") return [team, { id: "capacity", label: "Capacity", values: values(["20 oz"]) }];
  if (preset === "3d-print") return [{ id: "material", label: "Material", values: values(["PLA", "PETG"]) }, { id: "color", label: "Color", values: values(["Team colors"]) }, { id: "size", label: "Size", values: values(["Standard"]) }];
  return [];
}
const grouping = (preset: ProductPresetId) => preset === "team-jersey" ? ["team", "theme"] : preset === "team-shirt" ? ["team", "style"] : preset === "team-hat" || preset === "drinkware" ? ["team"] : [];
export function presetProductInput(presetId: ProductPresetId, collectionId: string, teams: TeamChoice[]): CatalogProductInput {
  const preset = PRODUCT_PRESETS.find((item) => item.id === presetId) ?? PRODUCT_PRESETS[0], name = presetId === "team-jersey" ? "Brotherhood Jersey" : preset.label;
  return { collectionId, name, slug: slugify(name), description: preset.description, preset: preset.id, mode: preset.mode, provider: preset.provider, providerBlueprintId: "", providerPrintProviderId: "", regions: [...preset.regions], personalization: { ...preset.personalization }, axes: presetAxes(preset.id, teams), providerProductAxes: grouping(preset.id), pricing: { currency: "USD", basePriceMinor: preset.id === "team-jersey" ? 5500 : 0, adjustments: [] }, status: "draft" };
}

export function variantCount(axes: OptionAxis[]) { return axes.reduce((count, axis) => count * axis.values.length, 1); }
export function providerProductCount(axes: OptionAxis[], group: string[]) { const selected = new Set(group); return axes.filter((axis) => selected.has(axis.id)).reduce((count, axis) => count * axis.values.length, 1); }
export function variantsPerProviderProduct(axes: OptionAxis[], group: string[]) { return Math.max(1, Math.ceil(variantCount(axes) / providerProductCount(axes, group))); }
const combinations = (axes: OptionAxis[]) => axes.reduce<Record<string, string>[]>((rows, axis) => rows.flatMap((row) => axis.values.map((value) => ({ ...row, [axis.id]: value.id }))), [{}]);
const keyFor = (axes: OptionAxis[], options: Record<string, string>) => axes.map((axis) => `${axis.id}:${options[axis.id] ?? ""}`).join("|");
const adjustment = (pricing: ProductPricing, options: Record<string, string>) => pricing.adjustments.reduce((sum, item) => sum + (options[item.axisId] === item.valueId ? item.amountMinor : 0), 0);
const skuPart = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 14) || "VAR";
export function buildVariants(_productId: string, productSlug: string, axes: OptionAxis[], pricing: ProductPricing, existing: CatalogVariant[] = [], now = new Date().toISOString(), makeId: () => string = () => crypto.randomUUID()): CatalogVariant[] {
  const count = variantCount(axes); if (count > MAX_VARIANTS_PER_PRODUCT) throw new Error(`This product would create ${count} variants. The limit is ${MAX_VARIANTS_PER_PRODUCT}.`);
  const previous = new Map(existing.map((variant) => [variant.key, variant]));
  return combinations(axes).map((options) => { const key = keyFor(axes, options), saved = previous.get(key), calculated = Math.max(0, pricing.basePriceMinor + adjustment(pricing, options)), override = saved?.priceOverrideMinor ?? null; return { id: saved?.id ?? makeId(), key, options, sku: saved?.sku ?? ["FL", skuPart(productSlug), ...axes.map((axis) => skuPart(options[axis.id] ?? axis.id))].join("-").slice(0, 160), priceMinor: override ?? calculated, priceOverrideMinor: override, readiness: saved?.readiness ?? "needs-review", provider: saved?.provider ?? null, commerce: saved?.commerce ?? null, updatedAt: now }; });
}

export function productBlockers(product: Pick<CatalogProduct, "mode" | "provider" | "providerBlueprintId" | "providerPrintProviderId" | "regions" | "pricing" | "variants">) {
  const blockers: string[] = [], active = product.variants.filter((variant) => variant.readiness !== "unavailable");
  if (product.pricing.basePriceMinor <= 0) blockers.push("Set the base retail price.");
  if (product.mode === "merch" && !product.regions.length) blockers.push("Choose at least one decoration region.");
  if (product.provider === "printify" && !product.providerBlueprintId) blockers.push("Add the Printify blueprint ID.");
  if (product.provider === "printify" && !product.providerPrintProviderId) blockers.push("Add the Printify print-provider ID.");
  if (!product.variants.length) blockers.push("Add at least one sellable variant.");
  if (product.variants.length && !active.length) blockers.push("Keep at least one variant available for sale.");
  if (active.some((variant) => variant.priceMinor <= 0)) blockers.push("Every active variant needs a retail price.");
  if (active.some((variant) => variant.readiness !== "ready")) blockers.push("Review each active variant before publication.");
  if (product.provider !== "manual" && active.some((variant) => !variant.provider)) blockers.push("Map every active variant to its production provider.");
  if (active.some((variant) => !variant.commerce)) blockers.push("Map every active variant to Shopify before publication.");
  return [...new Set(blockers)];
}
export function catalogSummary(state: CatalogState) { return { lines: state.lines.length, collections: state.collections.length, products: state.products.length, variants: state.products.reduce((sum, product) => sum + product.variants.length, 0), readyProducts: state.products.filter((product) => product.status === "ready" && !productBlockers(product).length).length }; }

export function createStarterCatalog(now = new Date().toISOString(), makeId: () => string = () => crypto.randomUUID()): CatalogState {
  const lineId = "11111111-1111-4111-8111-111111111111", collectionId = "22222222-2222-4222-8222-222222222222", productId = "33333333-3333-4333-8333-333333333333";
  const input = presetProductInput("team-jersey", collectionId, builtInTeams.map(({ id, name }) => ({ id, name })));
  return catalogStateSchema.parse({ version: VERSION, revision: 0, lines: [{ id: lineId, name: "MLBL Team Wear", slug: "mlbl-team-wear", description: "League and team apparel produced through ForgeLinc.", mode: "merch", status: "active", createdAt: now, updatedAt: now }], collections: [{ id: collectionId, lineId, name: "Brotherhood Collection", slug: "brotherhood-collection", description: "Your team up front. The whole league behind you.", status: "active", createdAt: now, updatedAt: now }], products: [{ ...input, id: productId, slug: "brotherhood-jersey", variants: buildVariants(productId, "brotherhood-jersey", input.axes, input.pricing, [], now, makeId), createdAt: now, updatedAt: now }], updatedAt: now });
}
const next = (state: CatalogState, now: string): CatalogState => ({ ...state, revision: state.revision + 1, updatedAt: now });
const lineSlug = (state: CatalogState, input: CatalogLineInput) => uniqueSlug(input.slug || input.name, state.lines.filter((item) => item.id !== input.id).map((item) => item.slug));
const collectionSlug = (state: CatalogState, input: CatalogCollectionInput) => uniqueSlug(input.slug || input.name, state.collections.filter((item) => item.lineId === input.lineId && item.id !== input.id).map((item) => item.slug));
const productSlug = (state: CatalogState, input: CatalogProductInput) => uniqueSlug(input.slug || input.name, state.products.filter((item) => item.collectionId === input.collectionId && item.id !== input.id).map((item) => item.slug));

export function applyCatalogMutation(state: CatalogState, mutation: CatalogMutation, teamIds: Set<string>, now = new Date().toISOString(), makeId: () => string = () => crypto.randomUUID()): { state: CatalogState; selectedId?: string } {
  const current = catalogStateSchema.parse(state);
  if (mutation.action === "save-line") {
    const old = mutation.line.id ? current.lines.find((item) => item.id === mutation.line.id) : undefined;
    if (mutation.line.id && !old) throw new Error("That product line no longer exists.");
    if (old && old.mode !== mutation.line.mode) { const collections = new Set(current.collections.filter((item) => item.lineId === old.id).map((item) => item.id)); if (current.products.some((product) => collections.has(product.collectionId))) throw new Error("Move or delete this line's products before changing production mode."); }
    const line: CatalogLine = { ...mutation.line, id: old?.id ?? makeId(), slug: lineSlug(current, mutation.line), createdAt: old?.createdAt ?? now, updatedAt: now };
    return { state: catalogStateSchema.parse(next({ ...current, lines: old ? current.lines.map((item) => item.id === line.id ? line : item) : [...current.lines, line] }, now)), selectedId: line.id };
  }
  if (mutation.action === "delete-line") { if (current.collections.some((item) => item.lineId === mutation.lineId)) throw new Error("Move or delete this line's collections first."); return { state: catalogStateSchema.parse(next({ ...current, lines: current.lines.filter((item) => item.id !== mutation.lineId) }, now)) }; }
  if (mutation.action === "save-collection") {
    if (!current.lines.some((item) => item.id === mutation.collection.lineId)) throw new Error("Choose an existing product line.");
    const old = mutation.collection.id ? current.collections.find((item) => item.id === mutation.collection.id) : undefined;
    if (mutation.collection.id && !old) throw new Error("That collection no longer exists.");
    if (old && old.lineId !== mutation.collection.lineId) { const target = current.lines.find((item) => item.id === mutation.collection.lineId); if (current.products.filter((product) => product.collectionId === old.id).some((product) => product.mode !== target?.mode)) throw new Error("Move this collection only to a product line with the same production mode."); }
    const collection: CatalogCollection = { ...mutation.collection, id: old?.id ?? makeId(), slug: collectionSlug(current, mutation.collection), createdAt: old?.createdAt ?? now, updatedAt: now };
    return { state: catalogStateSchema.parse(next({ ...current, collections: old ? current.collections.map((item) => item.id === collection.id ? collection : item) : [...current.collections, collection] }, now)), selectedId: collection.id };
  }
  if (mutation.action === "delete-collection") { if (current.products.some((item) => item.collectionId === mutation.collectionId)) throw new Error("Move or delete this collection's products first."); return { state: catalogStateSchema.parse(next({ ...current, collections: current.collections.filter((item) => item.id !== mutation.collectionId) }, now)) }; }
  if (mutation.action === "save-product") {
    const collection = current.collections.find((item) => item.id === mutation.product.collectionId), line = current.lines.find((item) => item.id === collection?.lineId);
    if (!collection || !line) throw new Error("Choose an existing collection.");
    if (line.mode !== mutation.product.mode) throw new Error(`This collection belongs to a ${line.mode} line. Choose a matching product type.`);
    const teamAxis = mutation.product.axes.find((axis) => axis.id === "team"); if (teamAxis?.values.some((value) => !teamIds.has(value.id))) throw new Error("One or more selected teams are no longer available.");
    if (variantCount(mutation.product.axes) > MAX_VARIANTS_PER_PRODUCT) throw new Error(`Reduce the options below ${MAX_VARIANTS_PER_PRODUCT} variants.`);
    const old = mutation.product.id ? current.products.find((item) => item.id === mutation.product.id) : undefined;
    if (mutation.product.id && !old) throw new Error("That product no longer exists.");
    const id = old?.id ?? makeId(), productSlugValue = productSlug(current, mutation.product);
    const product: CatalogProduct = { ...mutation.product, id, slug: productSlugValue, variants: buildVariants(id, productSlugValue, mutation.product.axes, mutation.product.pricing, old?.variants ?? [], now, makeId), createdAt: old?.createdAt ?? now, updatedAt: now };
    if (product.status === "ready" && productBlockers(product).length) throw new Error("Finish the readiness checklist before marking this product ready.");
    return { state: catalogStateSchema.parse(next({ ...current, products: old ? current.products.map((item) => item.id === id ? product : item) : [...current.products, product] }, now)), selectedId: id };
  }
  if (mutation.action === "delete-product") return { state: catalogStateSchema.parse(next({ ...current, products: current.products.filter((item) => item.id !== mutation.productId) }, now)) };
  if (mutation.action === "duplicate-product") {
    const source = current.products.find((item) => item.id === mutation.productId); if (!source) throw new Error("That product no longer exists.");
    const collectionId = mutation.collectionId ?? source.collectionId, collection = current.collections.find((item) => item.id === collectionId), line = current.lines.find((item) => item.id === collection?.lineId);
    if (!collection || line?.mode !== source.mode) throw new Error("The destination collection must use the same production mode.");
    const id = makeId(), name = `Copy of ${source.name}`.slice(0, 100), productSlugValue = uniqueSlug(name, current.products.filter((item) => item.collectionId === collectionId).map((item) => item.slug));
    const copy: CatalogProduct = { ...source, id, collectionId, name, slug: productSlugValue, status: "draft", variants: buildVariants(id, productSlugValue, source.axes, source.pricing, [], now, makeId), createdAt: now, updatedAt: now };
    return { state: catalogStateSchema.parse(next({ ...current, products: [...current.products, copy] }, now)), selectedId: id };
  }
  if (mutation.action === "save-variant") {
    const product = current.products.find((item) => item.id === mutation.productId), old = product?.variants.find((item) => item.id === mutation.variantId); if (!product || !old) throw new Error("That variant no longer exists.");
    const calculated = Math.max(0, product.pricing.basePriceMinor + adjustment(product.pricing, old.options));
    const variant: CatalogVariant = { ...old, ...mutation.variant, priceMinor: mutation.variant.priceOverrideMinor ?? calculated, updatedAt: now };
    if (variant.readiness === "ready" && (variant.priceMinor <= 0 || (product.provider !== "manual" && !variant.provider) || !variant.commerce)) throw new Error("Ready variants need a price plus the required provider and Shopify mappings.");
    const updated = { ...product, variants: product.variants.map((item) => item.id === variant.id ? variant : item), updatedAt: now };
    return { state: catalogStateSchema.parse(next({ ...current, products: current.products.map((item) => item.id === updated.id ? updated : item) }, now)), selectedId: product.id };
  }
  if (current.lines.length || current.collections.length || current.products.length) throw new Error("Starter data can only be restored to an empty catalog.");
  const starter = createStarterCatalog(now, makeId); return { state: { ...starter, revision: current.revision + 1 }, selectedId: starter.products[0]?.id };
}
