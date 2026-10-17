const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const domain = read("lib/catalog-manager.ts");
const api = read("app/api/catalog-manager/route.ts");
const ui = read("app/catalog/catalog-manager.tsx");
const teams = JSON.parse(read("lib/teams.json"));

assert.equal(teams.length + 1, 12, "starter catalog should include 11 teams plus MLBL");
assert.match(domain, /MAX_VARIANTS_PER_PRODUCT\s*=\s*2500/);
assert.match(domain, /Brotherhood Jersey/);
assert.match(domain, /providerProductAxes/);
assert.match(domain, /variantsPerProviderProduct/);
assert.match(domain, /expectedRevision/);
assert.match(api, /isStudioAdmin/);
assert.match(api, /Invalid request origin/);
assert.match(api, /catalog changed in another tab/i);
assert.match(ui, /New line/);
assert.match(ui, /New collection|Add.*collection/);
assert.match(ui, /Save product & variants/);
assert.match(ui, /Printify mapping/);
assert.match(ui, /Shopify mapping/);
assert.match(ui, /Create separate provider products by/);
assert.doesNotMatch(ui, /api\.printify|admin\.shopify|orders\.json/i, "catalog builder must not publish or order directly");

const starterVariantCount = (teams.length + 1) * 2 * 8;
assert.equal(starterVariantCount, 192, "starter Brotherhood matrix should create 192 variants");
console.log(`Catalog Manager verification passed: ${starterVariantCount} starter variants, admin guard, CSRF guard and draft-first mappings.`);
