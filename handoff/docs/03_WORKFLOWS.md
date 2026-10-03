# Workflows — proposed except where noted

## Admin: merchandise collection

Product lines → create/edit line → select merch blueprint/provider → select compatible saved team/template revisions → choose supported variants → choose pricing → generate drafts → review actual provider mockups and print regions → publish selected products → verify Shopify variant mappings → assign collections to app destinations.

Keep the familiar jersey editing workflow, original/alternate artwork, unlimited named themes and owner controls. A new product template exposes named regions from its blueprint. Never stretch the jersey's five regions onto a mug or hat.

The base-template path clears customer name and number without changing the personal sample's saved selection. Label the actions distinctly: "Save team template", "Save personalized sample", "Create collection drafts", "Publish reviewed products" and "Prepare order artwork".

## Multi-size preparation

Fetch current provider catalog and availability. Select only valid variant IDs. Retain each variant's region dimensions and decoration method. Render at the required dimensions; reuse uploads only when content and region geometry are identical. Inspect seam/bleed/safe-area placement; do not assume identical image pixels mean identical physical placement on different sizes.

For multiple variants, group Printify print areas only where the geometry/artwork mapping is compatible. Otherwise send the correct placeholder list for each variant. Record content hashes and provider image IDs per variant/region. Persist a job manifest before external calls. Each design becomes one multi-size base product where supported.

For adding sizes to an existing product: show a diff; retain product ID and existing variants, provider identifiers and prices; add only requested valid sizes. Fetch and compare current remote state before applying. Never silently replace a manually edited design. Provider mismatch or conflict becomes a review task.

A price rule must show final per-variant amounts and currency before committing. Support per-size overrides. Do not pick a profit margin, retail price or large-size surcharge for the owner. Provider cost, shipping, taxes and retail price are distinct.

## Customer

Open normal GearLinc shop, GameLinc team collection, TournamentLinc event collection, or a VR display → product detail → choose available variant/theme → choose permitted artwork/name/number → preview → add to shared cart → edit/remove/change quantity → Shopify checkout.

Each cart line carries a configuration fingerprint; the same product with different names, numbers, logos or styles remains separate. Identical configurations may merge quantity. Return from checkout must preserve cart state and avoid adding the same lines twice. Customers never receive admin functions, secrets or unrestricted asset access.

## Purchased order and production

Verify Shopify webhook signature and deduplicate event IDs. Reconcile delayed/out-of-order events against Shopify. Bind the paid order line to the saved design and actual purchased variant. Do not trust line-item text alone to regenerate artwork. Snapshot template/assets, personalization, region mapping, renderer version, variant, quantity and checksums.

Generate exact order artifacts → validate required regions/files → show admin review → create or attach fulfillment preparation as supported by the provider → explicitly approve production → track status and shipment. Keep an audit trail throughout.

The current app uses a manual Printify fulfillment-review flow. The proposed collection automation must NOT silently change that into automatic production. Never cancel/recreate an imported Shopify order just to replace its design unless that behavior has been explicitly designed and approved. Preserve delivery/tracking relationships and distinguish Printify product drafts from production orders.

## Admin: 3D product line

Create 3D product line → select approved model revision → define allowed personalization and physical variants → attach print-ready files and machine/material profile → enter price/capacity → review proof/sample → publish → receive order → generate/validate personalized model where supported → queue manual production → print → inspect → pack → fulfill.

Unimplemented capabilities such as model generation, slicer execution, printer telemetry and automated dispatch must be visibly marked unavailable. Start with a reliable file/job queue that records who approved each production file.

## Failure recovery

Jobs expose queued, running, waiting-for-review, succeeded, retryable-failure and uncertain-external-result states. Use bounded retries/backoff for safe calls. If a product creation times out, search by its deterministic transfer marker before retrying; an uncertain write must not create a duplicate product or charge. Persist checkpoints so closing the browser does not lose progress. API rate limits require a real server job runner/queue in the target environment, not browser setTimeout loops.
