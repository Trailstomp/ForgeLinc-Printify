# LincForge Team Shop + Merch Studio

A private merchandise studio for the 11 supplied MLBL teams. Pick a team, explore its jersey, edit five print panels, save a template, create durable team drafts, and export panel PNGs in a ZIP.

## Current scope

- Original logos and corrected team back artwork are bundled locally. The browser prepares a transparent back-artwork layer using an edge-connected white-background mask. Narrow gaps in foreground outlines are closed before masking to protect white helmets and uniforms. The same cleaned layer feeds thumbnails, garment previews, draft reviews, and print exports; original source files remain unchanged.
- The lacrosse-stick and ball QR graphic sits on the right sleeve, opposite the “Proud member of…” MLBL badge on the left sleeve. The back carries the team group artwork without the QR. The QR toggle controls the sleeve artwork in previews and exports.
- The side and sleeve bands use three adjustable colors with narrow shirt-colored separators, following the sweeping lines of the approved sample. Older designs default to a white shirt and silver third stripe. The garment photograph is labeled as a style reference; print panels show the editable colors.
- Canvas exports use the supplied provider template dimensions; guides are excluded.
- Team templates are saved in D1 as individual team drafts under the signed-in visitor’s identity. Shirt background, three stripe colors, placement, and the sleeve QR option belong to that team’s artwork. Switching teams restores its design; new teams start in their own colors. Bulk generation submits a separate configuration per team. Store address settings are saved separately.
- Older per-team drafts remain available. The earlier shared template is retained through “Load previous shared template,” so the user can assign those settings to the correct team without guessing its identity.
- The storefront bag is a session-only demonstration. Prices, sizes, and garment mockups are illustrative. There is no live checkout, Shopify OAuth, or automatic Printify publishing/fulfillment.
- Inspect exports in the current provider editor and order a sample before production. Enlarging source images does not restore missing detail. QR scannability is not certified.

## Shopify integration

`shopify-extension/` contains a theme app extension starter that switches actual Shopify products and uses their real variant IDs for cart additions. Downloadable source is also available in the studio Connections tab. Scaffold and link the Shopify app first; follow that folder’s README to test and install the extension. The private studio URL is not a completed embedded Shopify app URL.

`lib/printify-adapter.ts` is an unused server-side API foundation, with no connected credentials or exposed endpoint. Do not place API tokens in client code. A future integration needs merchant authentication, durable product/variant mappings, retries, and fulfillment tests.

## Development

Node 22.13 or newer, pinned pnpm version, React, Vinext, and Cloudflare D1. `.openai/hosting.json` contains the registered Site ID and `DB` binding. Deploy through Sites; keep migrations in `drizzle/` and never manually replay deployed migrations.

- `node node_modules/typescript/bin/tsc --noEmit` — type checking.
- `node scripts/verify-core.cjs` — configuration checks and ZIP extraction fixture.
- `pnpm build` — Worker/static build. In the managed environment use the Sites build helper.

Hosted private access and identity come from Sites. API writes require authentication and same-origin requests; records are scoped to the authenticated owner. No credentials are stored here. Only the selected-team preference uses local storage.
