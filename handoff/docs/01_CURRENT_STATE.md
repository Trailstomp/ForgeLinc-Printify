# Existing ForgeLinc baseline

These findings describe the inspected source revision in SOURCE_MANIFEST.json. Existing verification scripts were inventoried, not rerun for this documentation-only handoff. Runtime data and the other LincWerks applications were not inspected.

| Area | Existing behavior | Integration gap |
| --- | --- | --- |
| Studio | Team creation, reusable team templates, Light/Dark and custom themes, panel artwork alternatives and placement, customer-upload setting | Replace owner-specific Sites access with host organization roles |
| Jersey rendering | Front, back, two sleeves and collar, name/number personalization, matching 3D preview | Fixed jersey assumptions; other media need their own regions and render adapters |
| Preview bag | Configuration-aware items, review/edit, quantity and removal | Shared persisted cross-app cart and general product catalog |
| Printify transfers | Saved selection snapshot, upload checkpoints and product creation | One selected provider variant per transfer; multi-size collection setup is not implemented |
| Shopify checkout | Admin preview, saved design references and order matching | One configured product/team connection; generalized team/theme/size mappings and public checkout still needed |
| Order review | Paid/test status, matching saved checkout artwork, fulfillment review | Final production approval remains manual in Printify; no general production dispatcher |
| Draft archive | Archive metadata preserves saved history | Collection lifecycle and deletion retention rules |
| Live sample layout | Current source uses normal scrolling flow | Verify layout after integration into the host shell |
| Cross-app/VR/ads | No implementation verified | Shared catalog, channel publication, walkable shop and billboard campaigns are new work |

## Code entry points

- `app/team-shop.tsx`, `app/artwork-editor.tsx`, `app/team-manager.tsx`: studio and shop UI.
- `lib/catalog.ts`, `lib/teams.json`, `lib/shop-catalog.ts`: current catalogs and public template projection.
- `lib/panel-renderer.ts`, `lib/jersey-renderer.ts`, `lib/player-personalization.ts`, `lib/jersey-model.ts`, `app/jersey-3d.tsx`: artwork and preview.
- `lib/printify-transfers.ts`, `lib/printify-transfer-types.ts`, `app/api/printify/drafts/route.ts`: actual transfer workflow. `lib/printify-adapter.ts` is a legacy foundation, not the active transfer implementation.
- `lib/shopify-checkout.ts`, `lib/preview-bag.ts`, `app/api/shopify-checkout/route.ts`: checkout snapshot and line configuration.
- `lib/shopify-orders.ts`, `lib/fulfillment-review.ts`, `app/api/fulfillment/route.ts`: reconciliation and review.
- `lib/studio-access.ts`: Sites identity with a specific owner restriction. Do not carry that user restriction into a multi-tenant host.
- `lib/storage.ts`, `lib/artwork-storage.ts`, `drizzle/`: Cloudflare D1 and R2 persistence.

## Constraints that matter

The transfer snapshot contains one variant and its print-area dimensions. Product creation currently emits one selected variant. A personalized selection includes its name and number in the rendered files: this is why the sample bearing Hopkins/35 was not a clean reusable base product. Base-product creation must explicitly start from the team template and clear customer fields.

The Shopify connection is a single configured product/team, with Eagles-specific restrictions. It is not a universal product mapping. Do not solve this by sending all teams through the Eagles variant. The existing checkout design reference links each order line to a saved design; retain that concept and strengthen it into an immutable, versioned snapshot.

Fulfillment review checks an imported order and prepared artwork. It does not replace Printify order lines or submit them for production. Test orders are held for artwork review. Do not describe automated fulfillment as complete.

Public catalog projection strips private details from reusable templates. Preserve that separation. Production credentials are encrypted server-side. Actual database records, uploaded R2 artwork and secrets are not part of this source export.
