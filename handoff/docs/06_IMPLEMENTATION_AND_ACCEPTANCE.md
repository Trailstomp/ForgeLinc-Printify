# Build sequence and acceptance

Ship reviewable milestones. The source snapshot remains the behavioral baseline; newly listed capabilities need implementation and verification.

1. **Host integration and clean base products.** Inspect LincWerks identity, routing, storage and jobs. Mount ForgeLinc under real admin roles. Add distinct actions for reusable base product vs personalized sample.
2. **Multi-size collection setup.** Discover provider-supported options, render validated panels per size, assign explicit prices, batch draft creation with resumable checkpoints and review. One compatible team/theme product contains its selected sizes.
3. **Publication and personalized commerce.** Map each real Shopify product/variant, expose only ready choices, maintain configuration-aware carts and immutable purchased artwork. Demonstrate manual production review before enabling public checkout.
4. **Other media and 3D printing.** Add blueprint/renderer/provider capabilities. Prove a cup wrap and a hat process independently; model 3D production jobs with validated model revisions and manual scheduling before machine automation.
5. **Selected collection distribution and promotions.** Publish to chosen GameLinc/TournamentLinc contexts and normal GearLinc shop. Implement house billboard campaigns with sponsor inventory protection.
6. **Walkable GearLinc.** Add fixtures, scene placement and product interactions over the shared catalog. Integrate arena billboards with the same product panels and accessible links.

## Required demonstrations

| Scenario | Pass condition |
| --- | --- |
| Base vs personal | Base draft has no player name/number; a personalized sample retains the requested fields |
| Multi-size | Every enabled size has correct provider variant, print region dimensions, price and Shopify mapping; unsupported sizes cannot be purchased |
| Batch retry | Simulate timeout after remote creation and worker restart; reconciliation yields one remote product, not duplicates |
| Existing remote edits | Remote artwork/pricing changes cause a conflict review rather than silent overwrite |
| Two configurations | Same jersey/size with different name or theme creates two distinct configured cart/order lines with correct print files |
| Quantity and edit | Edit/remove one exact line; returning to checkout does not append previous quantities |
| Historical design | Change template and logo after purchase; saved order artwork remains identical |
| Upload setting | Disabled uploads fail at server and UI, while approved alternate logos remain available |
| Access | Non-admin cannot read studio, credentials or production data; one organization cannot access another's records/assets |
| Visibility | A GameLinc-only collection is absent from unrelated events, direct product API requests and unauthorized billboard responses |
| Price/availability change | Checkout detects a changed price or unavailable size and requires review rather than silently substituting |
| Test order | Test payment/order stays blocked from real production |
| Fulfillment | Correct original Shopify/Printify order, configured files, quantity and destination reviewed; no second fulfillment order created |
| Mixed production | Merch and 3D lines become separate appropriate production jobs; shipping/status remain understandable per line |
| Billboards | Eligible house campaign opens correct product/collection; expired/withdrawn/ineligible target never exposes hidden products; reserved sponsor slot remains protected |
| VR fallback | Standard shop remains functional when WebGL is unavailable; scene/list share cart and configuration |

## Existing verification material

Review `source/scripts/verify-*.cjs`, especially preview-bag, shopify-checkout, shopify-orders, order-printify, fulfillment-review, printify-transfers, team-persistence, studio-access, shopper-settings, draft-archive, player-personalization and artwork-rendering. These are useful starting points, not evidence that new features already pass. Add meaningful tests for new mappings, concurrency and failure recovery.

Release gate: verify catalog/destination eligibility, real variant mappings and prices, reviewed print dimensions, correct name/number placement, signed webhooks, production holds and rollback. First real sample requires the owner's explicit choice of team, size, configuration and purchase approval; do not buy Eagles Large merely because it is the existing test mapping.
