# LincForge Team Shop + Merch Studio

A private merchandise studio for the 11 supplied MLBL teams. Pick a team, explore its jersey, edit five print panels, save a template, create durable team drafts, and export panel PNGs in a ZIP.

## Current scope

- Original logos and corrected team back artwork are bundled locally. The browser prepares a transparent back-artwork layer using an edge-connected white-background mask. Narrow gaps in foreground outlines are closed before masking to protect white helmets and uniforms. The same cleaned layer feeds thumbnails, garment previews, draft reviews, and print exports; original source files remain unchanged.
- The lacrosse-stick and ball QR graphic sits on the right sleeve, opposite the “Proud member of…” MLBL badge on the left sleeve. The back carries the team group artwork without the QR. The QR toggle controls the sleeve artwork in previews and exports.
- The side and sleeve bands use three adjustable colors with narrow shirt-colored separators, following the sweeping lines of the approved sample. Older designs default to a white shirt and silver third stripe. The garment photograph is labeled as a style reference; print panels show the editable colors.
- Canvas exports use the supplied provider template dimensions; guides are excluded.
- Team templates are saved in D1 as individual team drafts under the signed-in visitor’s identity. Shirt background, three stripe colors, placement, and the sleeve QR option belong to that team’s artwork. Switching teams restores its design; new teams start in their own colors. Bulk generation submits a separate configuration per team. Store address settings are saved separately.
- Older per-team drafts remain available. The earlier shared template is retained through “Load previous shared template,” so the user can assign those settings to the correct team without guessing its identity.
- The bag is held in the current browser tab. For the studio owner, **Prepare my jerseys & checkout** freezes every selected design, renders and uploads all five panels, creates the selected-size Printify products, verifies their image mappings, then opens Shopify payment. Provider sizes are read live; XXL and 2XL use the same exact variant mapping. Every built-in or saved custom team uses this flow.
- Inspect exports in the current provider editor and order a sample before production. Enlarging source images does not restore missing detail. QR scannability is not certified.

## Shopify integration

`shopify-extension/` contains a theme app extension starter that switches actual Shopify products and uses their real variant IDs for cart additions. Downloadable source is also available in the studio Connections tab. Scaffold and link the Shopify app first; follow that folder’s README to test and install the extension. The private studio URL is not a completed embedded Shopify app URL.

The active server connectors are `lib/printify-transfers.ts`, `lib/checkout-catalog.ts`, `lib/prepared-checkout.ts`, and `lib/automatic-fulfillment.ts`. Credentials remain encrypted in D1 and never enter browser code. `lib/printify-adapter.ts` is an older, unused foundation.

## Custom checkout and production

1. In Connections, set up **All-team custom checkout** once. The app creates a dedicated Shopify product with the provider's size options and separate ForgeLinc SKUs. It does not change the older Eagles listing or publish every artwork variation. The shared product must be available to the saved Storefront token's channel and have shipping rates in Shopify.
2. Customize a team jersey and add it to the bag. Choose **Prepare my jerseys & checkout**, keep the tab open for panel uploads, then continue to Shopify. Missing artwork, missing sizes, altered provider images, and blocked order-data access prevent checkout. The rendered files come from the frozen bag configuration, including custom themes, stripes, logos and personalization.
3. The private paid-order processor checks fresh Shopify payment, items, quantities and delivery details. Only completed `automated-v2` snapshots qualify. It creates an order using those exact unpublished Printify product/variant IDs, then requests production. This charges the merchant's configured Printify payment method only after a real paid Shopify order is verified. Tests, refunds, cancellations, changed data and suspected duplicates are held.
4. Orders shows progress and **Check paid orders now**. A linked background schedule calls the same processor while the app is closed. Ambiguous writes are reconciled against the original order; they are never blindly replayed. Printify tracking is available from Orders; Shopify shipment/tracking synchronization is not implemented yet.

Prerequisites: Shopify product access, `read_orders` and access to the required protected delivery/contact fields; `read_publications`/`write_publications` for automatic one-time channel publication (or publish that shared product manually); a working Storefront token; Printify catalog/product/upload access plus `orders.read` and `orders.write`, and a working Printify payment method. Provider order-write and charging cannot be verified by a read-only preflight. No real payment or production order is placed by the test suite.

The original Site remains owner-private. Interactive endpoints preserve signed-in admin and same-origin checks. The dedicated service route `/api/automation/checkout` relies on the owner-private Sites access boundary and additionally requires runtime `FORGELINC_PRIVATE_AUTOMATION=enabled`. It accepts only `status`, `setup`, and `process`, uses the fixed studio owner, and never accepts a caller-supplied identity or token. Disable this route and replace its authorization before changing the Site audience. Do not expose this private administrative implementation as a public customer API.

An unattended run obtains this Site's current service credential with Sites `get_site`, verifies the audience is still owner-private, and sends it only to the returned Site origin in `OAI-Sites-Authorization`. POST JSON `{"action":"process"}` to `/api/automation/checkout`, then POST `{"action":"status"}` and verify `lastRun.completedAt`. Process only the existing paid-order workflow; do not manufacture payments, retry an ambiguous provider write, change products, or change sharing. Source access and this runtime service authorization are separate. Keep credentials out of scheduled prompts and logs. The source helper can recover this revision from the registered Site repository for future maintenance.

## Development

Node 22.13 or newer, pinned pnpm version, React, Vinext, and Cloudflare D1. `.openai/hosting.json` contains the registered Site ID and `DB` binding. Deploy through Sites; keep migrations in `drizzle/` and never manually replay deployed migrations.

- `node node_modules/typescript/bin/tsc --noEmit` — type checking.
- `node scripts/verify-core.cjs` — configuration checks and ZIP extraction fixture.
- `node scripts/verify-prepared-checkout.cjs` — migrated in-memory database with synthetic Shopify/Printify integration: multiple teams, sizes, exact artwork, checkout, payment gates, production, concurrency and uncertain-response recovery.
- `node scripts/verify-printify-transfers.cjs` and `node scripts/verify-fulfillment-review.cjs` — existing transfer/review regression coverage.
- `pnpm build` — Worker/static build. In the managed environment use the Sites build helper.

Hosted private access and identity come from Sites. API writes require authentication and same-origin requests; records are scoped to the authenticated owner. No credentials are stored here. Only the selected-team preference uses local storage.
