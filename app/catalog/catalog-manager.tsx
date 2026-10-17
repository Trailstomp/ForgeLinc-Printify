"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Layers3, Loader2, Package, Plus, Save, Trash2 } from "lucide-react";
import { apiFetch, readApiJson } from "@/lib/api-client";
import {
  MAX_VARIANTS_PER_PRODUCT,
  PRODUCT_PRESETS,
  catalogSummary,
  presetProductInput,
  productBlockers,
  providerProductCount,
  variantsPerProviderProduct,
  slugify,
  uniqueSlug,
  variantCount,
  type CatalogCollection,
  type CatalogCollectionInput,
  type CatalogLine,
  type CatalogLineInput,
  type CatalogProduct,
  type CatalogProductInput,
  type CatalogState,
  type CatalogVariant,
  type OptionAxis,
  type ProductPresetId,
  type ProductRegion,
  type TeamChoice,
} from "@/lib/catalog-manager";
import styles from "./catalog-manager.module.css";

type ApiBody = { error?: string; catalog?: CatalogState; selectedId?: string; teams?: TeamChoice[] };
type EditorKind = "line" | "collection" | "product" | null;
type VariantEdit = { productId: string; variant: CatalogVariant; price: string; pp: string; pv: string; sp: string; sv: string };
const REGIONS: { id: ProductRegion; label: string }[] = [
  { id: "front", label: "Front" }, { id: "back", label: "Back" }, { id: "left-sleeve", label: "Left sleeve" },
  { id: "right-sleeve", label: "Right sleeve" }, { id: "collar", label: "Collar" }, { id: "wrap", label: "Wrap" },
  { id: "front-panel", label: "Front panel" }, { id: "model", label: "3D model" },
];

const money = (minor: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
const dollars = (minor: number) => (minor / 100).toFixed(2);
const minor = (value: string) => Math.max(0, Math.round((Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0) * 100));
const lineInput = (): CatalogLineInput => ({ name: "", slug: "", description: "", mode: "merch", status: "active" });
const collectionInput = (lineId: string): CatalogCollectionInput => ({ lineId, name: "", slug: "", description: "", status: "active" });
const productInput = (p: CatalogProduct): CatalogProductInput => ({
  id: p.id, collectionId: p.collectionId, name: p.name, slug: p.slug, description: p.description, preset: p.preset,
  mode: p.mode, provider: p.provider, providerBlueprintId: p.providerBlueprintId, providerPrintProviderId: p.providerPrintProviderId,
  regions: p.regions, personalization: p.personalization, axes: p.axes, providerProductAxes: p.providerProductAxes,
  pricing: p.pricing, status: p.status,
});
const axisText = (axis: OptionAxis) => axis.values.map((v) => v.label).join(", ");
const variantLabel = (product: CatalogProduct, variant: CatalogVariant) => product.axes.map((axis) => axis.values.find((v) => v.id === variant.options[axis.id])?.label ?? variant.options[axis.id]).join(" · ");

export default function CatalogManager() {
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [teams, setTeams] = useState<TeamChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lineId, setLineId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [productId, setProductId] = useState("");
  const [editor, setEditor] = useState<EditorKind>(null);
  const [lineDraft, setLineDraft] = useState<CatalogLineInput>(lineInput());
  const [collectionDraft, setCollectionDraft] = useState<CatalogCollectionInput>(collectionInput(""));
  const [productDraft, setProductDraft] = useState<CatalogProductInput | null>(null);
  const [variantEdit, setVariantEdit] = useState<VariantEdit | null>(null);
  const [variantFilter, setVariantFilter] = useState("");
  const [variantPage, setVariantPage] = useState(0);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/api/catalog-manager");
      const body = await readApiJson<ApiBody>(response);
      if (!response.ok || !body.catalog) throw new Error(body.error || "Could not load the catalog.");
      setCatalog(body.catalog); setTeams(body.teams ?? []);
      setLineId((current) => body.catalog!.lines.some((x) => x.id === current) ? current : body.catalog!.lines[0]?.id ?? "");
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const lines = catalog?.lines ?? [];
  const collections = useMemo(() => catalog?.collections.filter((x) => x.lineId === lineId) ?? [], [catalog, lineId]);
  const products = useMemo(() => catalog?.products.filter((x) => x.collectionId === collectionId) ?? [], [catalog, collectionId]);
  const selectedLine = lines.find((x) => x.id === lineId);
  const selectedCollection = catalog?.collections.find((x) => x.id === collectionId);
  const selectedProduct = catalog?.products.find((x) => x.id === productId);
  useEffect(() => { if (!collections.some((x) => x.id === collectionId)) setCollectionId(collections[0]?.id ?? ""); }, [collections, collectionId]);
  useEffect(() => { if (!products.some((x) => x.id === productId)) setProductId(products[0]?.id ?? ""); }, [products, productId]);
  useEffect(() => { setVariantPage(0); setVariantFilter(""); }, [productId]);

  async function mutate(action: string, data: Record<string, unknown>) {
    if (!catalog) return null;
    setBusy(true);
    try {
      const response = await apiFetch("/api/catalog-manager", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expectedRevision: catalog.revision, ...data }) });
      const body = await readApiJson<ApiBody>(response);
      if (body.catalog) setCatalog(body.catalog);
      if (!response.ok) throw new Error(body.error || "Could not save that change.");
      return body;
    } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  }

  const closeEditor = () => { setEditor(null); setProductDraft(null); setVariantEdit(null); setError(""); };
  function newLine() { setLineDraft(lineInput()); setEditor("line"); }
  function editLine(line: CatalogLine) { setLineDraft({ id: line.id, name: line.name, slug: line.slug, description: line.description, mode: line.mode, status: line.status }); setEditor("line"); }
  function newCollection() { if (!lineId) return; setCollectionDraft(collectionInput(lineId)); setEditor("collection"); }
  function editCollection(c: CatalogCollection) { setCollectionDraft({ id: c.id, lineId: c.lineId, name: c.name, slug: c.slug, description: c.description, status: c.status }); setEditor("collection"); }
  function newProduct() {
    if (!collectionId || !catalog) return;
    const mode = lines.find((line) => line.id === selectedCollection?.lineId)?.mode ?? "merch";
    setProductDraft(presetProductInput(mode === "3d-print" ? "3d-print" : "team-jersey", collectionId, teams)); setEditor("product");
  }
  function editProduct(p: CatalogProduct) { setProductDraft(productInput(p)); setEditor("product"); }
  function applyPreset(id: ProductPresetId) {
    if (!productDraft) return;
    const next = presetProductInput(id, productDraft.collectionId, teams);
    setProductDraft({ ...next, ...(productDraft.id ? { id: productDraft.id } : {}), name: productDraft.id ? productDraft.name : next.name, slug: productDraft.id ? productDraft.slug : next.slug });
  }

  async function saveLine() {
    if (!lineDraft.name.trim()) return setError("Enter a product-line name.");
    const result = await mutate("save-line", { line: { ...lineDraft, slug: lineDraft.slug || slugify(lineDraft.name) } });
    if (result?.selectedId) { setLineId(result.selectedId); closeEditor(); }
  }
  async function saveCollection() {
    if (!collectionDraft.name.trim()) return setError("Enter a collection name.");
    const result = await mutate("save-collection", { collection: { ...collectionDraft, slug: collectionDraft.slug || slugify(collectionDraft.name) } });
    if (result?.selectedId) { setLineId(collectionDraft.lineId); setCollectionId(result.selectedId); closeEditor(); }
  }
  async function saveProduct() {
    if (!productDraft?.name.trim()) return setError("Enter a product name.");
    if (variantCount(productDraft.axes) > MAX_VARIANTS_PER_PRODUCT) return setError(`Reduce the variant matrix below ${MAX_VARIANTS_PER_PRODUCT}.`);
    const result = await mutate("save-product", { product: { ...productDraft, slug: productDraft.slug || slugify(productDraft.name) } });
    if (result?.selectedId) { setCollectionId(productDraft.collectionId); setProductId(result.selectedId); closeEditor(); }
  }
  async function remove(kind: "line" | "collection" | "product", id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? Parent records must be empty first. This never deletes remote Shopify or Printify products.`)) return;
    const result = await mutate(`delete-${kind}`, { [`${kind}Id`]: id });
    if (result) setError("");
  }
  async function duplicate(product: CatalogProduct) {
    const result = await mutate("duplicate-product", { productId: product.id });
    if (result?.selectedId) setProductId(result.selectedId);
  }

  function updateAxis(index: number, axis: OptionAxis) {
    if (!productDraft) return;
    const axes = productDraft.axes.map((x, i) => i === index ? axis : x);
    const valid = new Set(axes.flatMap((x) => x.values.map((v) => `${x.id}:${v.id}`)));
    setProductDraft({ ...productDraft, axes, providerProductAxes: productDraft.providerProductAxes.filter((id) => axes.some((x) => x.id === id)), pricing: { ...productDraft.pricing, adjustments: productDraft.pricing.adjustments.filter((x) => valid.has(`${x.axisId}:${x.valueId}`)) } });
  }
  function setAxisValues(index: number, text: string) {
    if (!productDraft) return;
    const axis = productDraft.axes[index];
    const labels = text.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 100);
    const used: string[] = [];
    const values = labels.map((label) => { const id = uniqueSlug(label, used); used.push(id); return { id, label }; });
    if (values.length) updateAxis(index, { ...axis, values });
  }
  function addAxis() {
    if (!productDraft) return;
    const id = uniqueSlug("option", productDraft.axes.map((x) => x.id));
    setProductDraft({ ...productDraft, axes: [...productDraft.axes, { id, label: "Option", values: [{ id: "default", label: "Default" }] }] });
  }
  function removeAxis(index: number) {
    if (!productDraft) return;
    const id = productDraft.axes[index].id;
    setProductDraft({ ...productDraft, axes: productDraft.axes.filter((_, i) => i !== index), providerProductAxes: productDraft.providerProductAxes.filter((x) => x !== id), pricing: { ...productDraft.pricing, adjustments: productDraft.pricing.adjustments.filter((x) => x.axisId !== id) } });
  }
  function setTeam(team: TeamChoice, checked: boolean) {
    if (!productDraft) return;
    const index = productDraft.axes.findIndex((x) => x.id === "team"); if (index < 0) return;
    const axis = productDraft.axes[index]; const exists = axis.values.some((x) => x.id === team.id);
    const values = checked && !exists ? [...axis.values, { id: team.id, label: team.name }] : !checked && axis.values.length > 1 ? axis.values.filter((x) => x.id !== team.id) : axis.values;
    updateAxis(index, { ...axis, values });
  }
  function setAdjustment(axisId: string, valueId: string, amountMinor: number) {
    if (!productDraft) return;
    const other = productDraft.pricing.adjustments.filter((x) => !(x.axisId === axisId && x.valueId === valueId));
    setProductDraft({ ...productDraft, pricing: { ...productDraft.pricing, adjustments: amountMinor ? [...other, { axisId, valueId, amountMinor }] : other } });
  }

  const filteredVariants = useMemo(() => {
    if (!selectedProduct) return [];
    const q = variantFilter.trim().toLowerCase();
    return q ? selectedProduct.variants.filter((v) => `${v.sku} ${variantLabel(selectedProduct, v)} ${v.readiness}`.toLowerCase().includes(q)) : selectedProduct.variants;
  }, [selectedProduct, variantFilter]);
  const pageSize = 40, pages = Math.max(1, Math.ceil(filteredVariants.length / pageSize));
  const visibleVariants = filteredVariants.slice(variantPage * pageSize, variantPage * pageSize + pageSize);
  function openVariant(v: CatalogVariant) {
    if (!selectedProduct) return;
    setVariantEdit({ productId: selectedProduct.id, variant: structuredClone(v), price: v.priceOverrideMinor === null ? "" : dollars(v.priceOverrideMinor), pp: v.provider?.productId ?? "", pv: v.provider?.variantId ?? "", sp: v.commerce?.productId ?? "", sv: v.commerce?.variantId ?? "" });
  }
  async function saveVariant() {
    if (!variantEdit) return;
    const result = await mutate("save-variant", { productId: variantEdit.productId, variantId: variantEdit.variant.id, variant: { sku: variantEdit.variant.sku, priceOverrideMinor: variantEdit.price.trim() ? minor(variantEdit.price) : null, readiness: variantEdit.variant.readiness, provider: variantEdit.pp.trim() && variantEdit.pv.trim() ? { productId: variantEdit.pp.trim(), variantId: variantEdit.pv.trim() } : null, commerce: variantEdit.sp.trim() && variantEdit.sv.trim() ? { productId: variantEdit.sp.trim(), variantId: variantEdit.sv.trim() } : null } });
    if (result) setVariantEdit(null);
  }
  function exportCatalog() {
    if (!catalog) return; const url = URL.createObjectURL(new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `forgelinc-catalog-r${catalog.revision}.json`; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <main className={styles.state}><Loader2 className={styles.spin} /><h1>Loading Catalog Builder…</h1></main>;
  if (!catalog) return <main className={styles.state}><AlertTriangle /><h1>Catalog unavailable</h1><p>{error}</p><button onClick={() => void load()}>Retry</button></main>;
  const summary = catalogSummary(catalog), blockers = selectedProduct ? productBlockers(selectedProduct) : [];

  return <main className={styles.page}>
    <header className={styles.header}><div><a href="/"><ArrowLeft size={16} /> Back to ForgeLinc</a><p>MERCH STUDIO / CATALOG BUILDER</p><h1>Add lines, collections and products</h1><span>Choose the teams, themes, sizes and prices once. ForgeLinc creates the variants for you.</span></div><div><button onClick={exportCatalog}><Download size={16} /> Export</button><button className={styles.primary} onClick={newLine}><Plus size={16} /> New line</button></div></header>
    {error && <div className={styles.error}><AlertTriangle size={16} />{error}<button onClick={() => setError("")}>×</button></div>}
    <section className={styles.stats}><article><b>{summary.lines}</b>Lines</article><article><b>{summary.collections}</b>Collections</article><article><b>{summary.products}</b>Products</article><article><b>{summary.variants}</b>Variants</article><article><b>{summary.readyProducts}</b>Ready</article></section>

    <section className={styles.builder}>
      <aside><div className={styles.title}><span><Layers3 /> Product lines</span><button onClick={newLine}><Plus /></button></div>{lines.map((line) => <button key={line.id} className={line.id === lineId ? styles.selected : ""} onClick={() => setLineId(line.id)}><b>{line.name}</b><small>{line.mode}</small></button>)}{selectedLine && <div className={styles.actions}><button onClick={() => editLine(selectedLine)}>Edit</button><button onClick={() => void remove("line", selectedLine.id, selectedLine.name)}>Delete</button></div>}</aside>
      <aside><div className={styles.title}><span>Collections</span><button disabled={!lineId} onClick={newCollection}><Plus /></button></div>{collections.map((c) => <button key={c.id} className={c.id === collectionId ? styles.selected : ""} onClick={() => setCollectionId(c.id)}><b>{c.name}</b><small>{catalog.products.filter((p) => p.collectionId === c.id).length} products</small></button>)}{selectedCollection && <div className={styles.actions}><button onClick={() => editCollection(selectedCollection)}>Edit</button><button onClick={() => void remove("collection", selectedCollection.id, selectedCollection.name)}>Delete</button></div>}</aside>
      <aside><div className={styles.title}><span>Products</span><button disabled={!collectionId} onClick={newProduct}><Plus /></button></div>{products.map((p) => <button key={p.id} className={p.id === productId ? styles.selected : ""} onClick={() => setProductId(p.id)}><b>{p.name}</b><small>{p.variants.length} variants · {p.status}</small></button>)}</aside>
    </section>

    {selectedProduct ? <section className={styles.detail}>
      <div className={styles.detailHead}><div><p>{selectedProduct.status.toUpperCase()}</p><h2>{selectedProduct.name}</h2><span>{selectedProduct.description}</span></div><div><button onClick={() => editProduct(selectedProduct)}>Edit</button><button onClick={() => void duplicate(selectedProduct)}><Copy size={15} /> Duplicate</button><button className={styles.danger} onClick={() => void remove("product", selectedProduct.id, selectedProduct.name)}><Trash2 size={15} /> Delete</button></div></div>
      <section className={styles.overview}><article><b>{providerProductCount(selectedProduct.axes, selectedProduct.providerProductAxes)}</b>Provider products<small>{variantsPerProviderProduct(selectedProduct.axes, selectedProduct.providerProductAxes)} variants each</small></article><article><b>{selectedProduct.variants.length}</b>Total variants<small>{selectedProduct.variants.filter((v) => v.readiness === "ready").length} ready</small></article><article><b>{money(Math.min(...selectedProduct.variants.map((v) => v.priceMinor)), selectedProduct.pricing.currency)}</b>Starting price</article></section>
      <section className={styles.readiness}><h3>Readiness</h3>{blockers.length ? blockers.map((b) => <p key={b}><AlertTriangle size={15} />{b}</p>) : <p className={styles.ok}><Check size={15} /> Ready for the future publish step.</p>}<small>This page never publishes or submits production by itself.</small></section>
      <div className={styles.variantTop}><h3>Variant matrix</h3><input placeholder="Search team, size or SKU" value={variantFilter} onChange={(e) => { setVariantFilter(e.target.value); setVariantPage(0); }} /></div>
      <div className={styles.table}><table><thead><tr><th>Variant</th><th>SKU</th><th>Price</th><th>Status</th><th>Printify</th><th>Shopify</th><th /></tr></thead><tbody>{visibleVariants.map((v) => <tr key={v.id}><td>{variantLabel(selectedProduct, v)}</td><td><code>{v.sku}</code></td><td>{money(v.priceMinor, selectedProduct.pricing.currency)}</td><td>{v.readiness}</td><td>{v.provider ? "Mapped" : "Missing"}</td><td>{v.commerce ? "Mapped" : "Missing"}</td><td><button onClick={() => openVariant(v)}>Edit</button></td></tr>)}</tbody></table></div>
      <footer className={styles.pager}><span>{filteredVariants.length} variants</span><div><button disabled={!variantPage} onClick={() => setVariantPage((p) => p - 1)}>Previous</button><span>{variantPage + 1} / {pages}</span><button disabled={variantPage + 1 >= pages} onClick={() => setVariantPage((p) => p + 1)}>Next</button></div></footer>
    </section> : <section className={styles.empty}><Package /><h2>{collectionId ? "Add a product" : "Choose a collection"}</h2>{collectionId && <button className={styles.primary} onClick={newProduct}><Plus size={16} /> Add product</button>}</section>}

    {editor === "line" && <div className={styles.modal}><form onSubmit={(e) => { e.preventDefault(); void saveLine(); }}><h2>{lineDraft.id ? "Edit" : "Add"} product line</h2><p>Examples: MLBL Team Wear, Desk Legends, ODI, MoneyCard.</p><label>Name<input autoFocus value={lineDraft.name} onChange={(e) => setLineDraft({ ...lineDraft, name: e.target.value })} /></label><label>Description<textarea value={lineDraft.description} onChange={(e) => setLineDraft({ ...lineDraft, description: e.target.value })} /></label><label>Production<select value={lineDraft.mode} onChange={(e) => setLineDraft({ ...lineDraft, mode: e.target.value as CatalogLineInput["mode"] })}><option value="merch">Merch printing</option><option value="3d-print">3D printing</option></select></label><div className={styles.modalActions}><button type="button" onClick={closeEditor}>Cancel</button><button className={styles.primary} disabled={busy}><Save size={15} /> Save</button></div></form></div>}

    {editor === "collection" && <div className={styles.modal}><form onSubmit={(e) => { e.preventDefault(); void saveCollection(); }}><h2>{collectionDraft.id ? "Edit" : "Add"} collection</h2><label>Product line<select value={collectionDraft.lineId} onChange={(e) => setCollectionDraft({ ...collectionDraft, lineId: e.target.value })}>{lines.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Name<input autoFocus value={collectionDraft.name} onChange={(e) => setCollectionDraft({ ...collectionDraft, name: e.target.value })} /></label><label>Description<textarea value={collectionDraft.description} onChange={(e) => setCollectionDraft({ ...collectionDraft, description: e.target.value })} /></label><div className={styles.modalActions}><button type="button" onClick={closeEditor}>Cancel</button><button className={styles.primary} disabled={busy}><Save size={15} /> Save</button></div></form></div>}

    {editor === "product" && productDraft && <div className={styles.modal}><form className={styles.productForm} onSubmit={(e) => { e.preventDefault(); void saveProduct(); }}><h2>{productDraft.id ? "Edit" : "Add"} product</h2><p>Start with a template, then choose the options customers can order.</p><div className={styles.presets}>{PRODUCT_PRESETS.filter((x) => x.mode === productDraft.mode).map((x) => <button type="button" key={x.id} className={x.id === productDraft.preset ? styles.selected : ""} onClick={() => applyPreset(x.id)}><b>{x.label}</b><small>{x.description}</small></button>)}</div>
      <div className={styles.formGrid}><label>Collection<select value={productDraft.collectionId} onChange={(e) => setProductDraft({ ...productDraft, collectionId: e.target.value })}>{catalog.collections.filter((c) => lines.find((l) => l.id === c.lineId)?.mode === productDraft.mode).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Name<input value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} /></label><label>Provider<select value={productDraft.provider} onChange={(e) => setProductDraft({ ...productDraft, provider: e.target.value as CatalogProductInput["provider"] })}><option value="printify">Printify</option><option value="in-house">In-house</option><option value="manual">Manual</option></select></label><label>Base retail price<input inputMode="decimal" value={dollars(productDraft.pricing.basePriceMinor)} onChange={(e) => setProductDraft({ ...productDraft, pricing: { ...productDraft.pricing, basePriceMinor: minor(e.target.value) } })} /></label><label className={styles.wide}>Description<textarea value={productDraft.description} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} /></label>{productDraft.provider === "printify" && <><label>Printify blueprint ID<input value={productDraft.providerBlueprintId} onChange={(e) => setProductDraft({ ...productDraft, providerBlueprintId: e.target.value })} /></label><label>Print provider ID<input value={productDraft.providerPrintProviderId} onChange={(e) => setProductDraft({ ...productDraft, providerPrintProviderId: e.target.value })} /></label></>}</div>
      <h3>Artwork areas</h3><div className={styles.checks}>{REGIONS.map((r) => <label key={r.id}><input type="checkbox" checked={productDraft.regions.includes(r.id)} onChange={(e) => setProductDraft({ ...productDraft, regions: e.target.checked ? [...productDraft.regions, r.id] : productDraft.regions.filter((x) => x !== r.id) })} />{r.label}</label>)}</div>
      <h3>Personalization</h3><div className={styles.checks}><label><input type="checkbox" checked={productDraft.personalization.playerName} onChange={(e) => setProductDraft({ ...productDraft, personalization: { ...productDraft.personalization, playerName: e.target.checked } })} />Name</label><label><input type="checkbox" checked={productDraft.personalization.playerNumber} onChange={(e) => setProductDraft({ ...productDraft, personalization: { ...productDraft.personalization, playerNumber: e.target.checked } })} />Number</label><label><input type="checkbox" checked={productDraft.personalization.customerUploads} onChange={(e) => setProductDraft({ ...productDraft, personalization: { ...productDraft.personalization, customerUploads: e.target.checked } })} />Image upload</label></div>
      <div className={styles.rowTitle}><h3>Options and variants</h3><button type="button" onClick={addAxis}><Plus size={14} /> Add option</button></div>{productDraft.axes.map((axis, index) => <section className={styles.axis} key={axis.id}><div><label>Option name<input value={axis.label} onChange={(e) => updateAxis(index, { ...axis, label: e.target.value })} /></label><button type="button" onClick={() => removeAxis(index)}><Trash2 size={14} /></button></div>{axis.id === "team" ? <div className={styles.teamGrid}>{teams.map((team) => <label key={team.id}><input type="checkbox" checked={axis.values.some((x) => x.id === team.id)} onChange={(e) => setTeam(team, e.target.checked)} />{team.name}</label>)}</div> : <label>Values, separated by commas<input defaultValue={axisText(axis)} onBlur={(e) => setAxisValues(index, e.target.value)} /></label>}<label className={styles.groupCheck}><input type="checkbox" checked={productDraft.providerProductAxes.includes(axis.id)} onChange={(e) => setProductDraft({ ...productDraft, providerProductAxes: e.target.checked ? [...productDraft.providerProductAxes, axis.id] : productDraft.providerProductAxes.filter((x) => x !== axis.id) })} />Create separate provider products by {axis.label}</label>{axis.id !== "team" && <div className={styles.surcharges}>{axis.values.map((v) => { const value = productDraft.pricing.adjustments.find((a) => a.axisId === axis.id && a.valueId === v.id)?.amountMinor ?? 0; return <label key={v.id}>{v.label} surcharge<input inputMode="decimal" defaultValue={dollars(value)} onBlur={(e) => setAdjustment(axis.id, v.id, minor(e.target.value))} /></label>; })}</div>}</section>)}
      <section className={styles.matrix}><b>{variantCount(productDraft.axes)} variants</b><span>{providerProductCount(productDraft.axes, productDraft.providerProductAxes)} provider product groups × {variantsPerProviderProduct(productDraft.axes, productDraft.providerProductAxes)} variants each</span>{variantCount(productDraft.axes) > MAX_VARIANTS_PER_PRODUCT && <em>Reduce below {MAX_VARIANTS_PER_PRODUCT}.</em>}</section>
      <label>Status<select value={productDraft.status} onChange={(e) => setProductDraft({ ...productDraft, status: e.target.value as CatalogProductInput["status"] })}><option value="draft">Draft</option><option value="ready">Ready</option><option value="archived">Archived</option></select></label><div className={styles.modalActions}><button type="button" onClick={closeEditor}>Cancel</button><button className={styles.primary} disabled={busy || variantCount(productDraft.axes) > MAX_VARIANTS_PER_PRODUCT}><Save size={15} /> Save product & variants</button></div></form></div>}

    {variantEdit && <div className={styles.modal}><form onSubmit={(e) => { e.preventDefault(); void saveVariant(); }}><h2>Edit variant</h2><p>{selectedProduct && variantLabel(selectedProduct, variantEdit.variant)}</p><label>SKU<input value={variantEdit.variant.sku} onChange={(e) => setVariantEdit({ ...variantEdit, variant: { ...variantEdit.variant, sku: e.target.value } })} /></label><label>Price override<input placeholder="Use pricing rule" value={variantEdit.price} onChange={(e) => setVariantEdit({ ...variantEdit, price: e.target.value })} /></label><label>Status<select value={variantEdit.variant.readiness} onChange={(e) => setVariantEdit({ ...variantEdit, variant: { ...variantEdit.variant, readiness: e.target.value as CatalogVariant["readiness"] } })}><option value="draft">Draft</option><option value="needs-review">Needs review</option><option value="ready">Ready</option><option value="unavailable">Unavailable</option></select></label><h3>Printify mapping</h3><div className={styles.formGrid}><label>Product ID<input value={variantEdit.pp} onChange={(e) => setVariantEdit({ ...variantEdit, pp: e.target.value })} /></label><label>Variant ID<input value={variantEdit.pv} onChange={(e) => setVariantEdit({ ...variantEdit, pv: e.target.value })} /></label></div><h3>Shopify mapping</h3><div className={styles.formGrid}><label>Product ID<input value={variantEdit.sp} onChange={(e) => setVariantEdit({ ...variantEdit, sp: e.target.value })} /></label><label>Variant ID<input value={variantEdit.sv} onChange={(e) => setVariantEdit({ ...variantEdit, sv: e.target.value })} /></label></div><div className={styles.modalActions}><button type="button" onClick={() => setVariantEdit(null)}>Cancel</button><button className={styles.primary} disabled={busy}><Save size={15} /> Save variant</button></div></form></div>}
  </main>;
}
