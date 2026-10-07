# ForgeLinc Printify

Updated from the original private ForgeLinc Site on October 7, 2026. Source commit: `6d7b094738cc485c12b2ea96e8947dab47569436`.

Custom checkout freezes and uploads all five saved artwork panels before Shopify payment. Personalized checkout thumbnails now use separate immutable Shopify products and variants per verified Printify transfer; identical designs are reused. Existing carts and paid-order snapshots remain unchanged.

**One-time thumbnail setup:** grant the installed ForgeLinc app `read_publications` and `write_publications`, release the new app version, approve its scopes in Shopify, then refresh Connections. Until enabled, checkout continues with the original shared listing. Live thumbnails still need verification after granting those permissions. Type checking, the production build, and synthetic checkout/transfer tests passed; browser visual QA was unavailable.

Read [current implementation notes](handoff/CURRENT_AUTOMATIC_CHECKOUT.md). Original artwork, design history, the theme extension, and the [version 49 export documentation](handoff/README_EXPORT_2026-10-03.md) remain. Merge Emergent-specific changes separately; source synchronization does not migrate credentials, designs, or uploaded artwork.

The owner-private automation route must not be exposed publicly. Its `receipts` and single-order `shipping-diagnostic` actions cannot submit orders or charge production. The separate `retry-order` action can create and charge production for one explicitly authorized order. Provider validation errors now preserve their code and reason with delivery values and credentials redacted.

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

The original Site remains owner-private. Interactive endpoints preserve signed-in admin and same-origin checks. The dedicated service route `/api/automation/checkout` relies on the owner-private Sites access boundary and additionally requires runtime `FORGELINC_PRIVATE_AUTOMATION=enabled`. It separates read-only `status`, `inspect`, `receipts` and quote-only `shipping-diagnostic` from `setup`, `process` and the explicitly scoped `retry-order` production action, uses the fixed studio owner, and never accepts a caller-supplied identity or token. Disable this route and replace its authorization before changing the Site audience. Do not expose this private administrative implementation as a public customer API.

An unattended run obtains this Site's current service credential with Sites `get_site`, verifies the audience is still owner-private, and sends it only to the returned Site origin in `OAI-Sites-Authorization`. POST JSON `{"action":"process"}` to `/api/automation/checkout`, then POST `{"action":"status"}` and verify `lastRun.completedAt`. Process only the existing paid-order workflow; do not manufacture payments, retry an ambiguous provider write, change products, or change sharing. Source access and this runtime service authorization are separate. Keep credentials out of scheduled prompts and logs. The source helper can recover this revision from the registered Site repository for future maintenance.

## Development

Node 22.13 or newer, pinned pnpm version, React, Vinext, and Cloudflare D1. `.openai/hosting.json` contains the registered Site ID and `DB` binding. Deploy through Sites; keep migrations in `drizzle/` and never manually replay deployed migrations.

- `node node_modules/typescript/bin/tsc --noEmit` — type checking.
- `node scripts/verify-core.cjs` — configuration checks and ZIP extraction fixture.
- `node scripts/verify-prepared-checkout.cjs` — migrated in-memory database with synthetic Shopify/Printify integration: multiple teams, sizes, exact artwork, checkout, payment gates, production, concurrency and uncertain-response recovery.
- `node scripts/verify-printify-transfers.cjs` and `node scripts/verify-fulfillment-review.cjs` — existing transfer/review regression coverage.
- `pnpm build` — Worker/static build. In the managed environment use the Sites build helper.

Hosted private access and identity come from Sites. API writes require authentication and same-origin requests; records are scoped to the authenticated owner. No credentials are stored here. Only the selected-team preference uses local storage.

## Personalized checkout thumbnails

New checkouts can create a dedicated Shopify listing for each verified Printify transfer, using that transfer’s front mockup, selected size and selling price. Identical transfers reuse the same listing; distinct names/themes in the same size remain separate. Only the shared listing’s verified Headless/GameLinc Storefront channel (or the existing Online Store channel for tokenless checkout) is used. The shared size catalog is never edited, and completed checkout snapshots are immutable. Fulfillment checks each purchased product/variant against its saved mapping; legacy orders continue to use the shared product.

The installed ForgeLinc app needs `read_publications` and `write_publications` in addition to its existing product access. Connections shows the missing permission notice. Until granted, or when media cannot be verified, the existing checkout continues with the shared listing and a saved thumbnail notice. No image URL or product identifier supplied by a shopper can change fulfillment. Existing open checkouts are preserved; thumbnails apply to newly prepared checkouts.

For a rejected first paid order, `receipts` confirms the paid selections and fulfillment state. `shipping-diagnostic` takes one Shopify order ID and only requests a Printify shipping quote; it cannot create or submit an order. A separate `retry-order` action takes one order ID, revalidates payment/artwork/address and existing-order protections, and can create and charge production. Only invoke it with authorization for that specific order. Provider validation errors retain their code and reason with credentials and delivery values redacted.
