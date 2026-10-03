# ForgeLinc production and GearLinc commerce — Groc handoff

Prepared September 26, 2026 for LincWerks. This package contains the existing ForgeLinc source plus an implementation specification. The new shared catalog, multi-size collection automation, other product media, 3D production workflow, cross-app distribution, walkable store, and billboard promotions are **planned, not implemented in this package**.

## Product direction approved by the owner

Make ForgeLinc the production module in LincWerks, with Merch Printing and 3D Printing workspaces. Support configurable product lines and new collections. Merch media includes shirts, hats, cups and future supported products. Offer selected collections in LincWerks/GearLinc, GameLinc and TournamentLinc. GearLinc should work as both a normal shop and a true walkable store with merchandise on racks, shelves, displays and counters—not just images on walls.

Also let the owner promote GearLinc products and collections on sponsor billboards, with house promotions separate from paid sponsor placements.

One catalog, collection publication rules, personalization record and cart should power all surfaces. Do not create independent catalogs for each app or put production controls in customer pages.

## What you received

- `source/`: tracked source and bundled assets of the current working ForgeLinc site, exported without Git history, build dependencies, credentials or live database contents.
- `SOURCE_MANIFEST.json`: exact baseline revision and package provenance.
- `docs/01_CURRENT_STATE.md`: verified implemented behavior, limitations and code entry points.
- `docs/02_PRODUCT_AND_ARCHITECTURE.md`: catalog, product lines, app channels and ownership boundaries.
- `docs/03_WORKFLOWS.md`: admin, shopper and fulfillment behavior.
- `docs/04_DATA_AND_API.md`: proposed data model, API semantics and security requirements.
- `docs/05_GEARLINC_STORE.md`: normal and walkable shop specification and performance limits.
- `docs/06_IMPLEMENTATION_AND_ACCEPTANCE.md`: build sequence, test scenarios and launch gates.
- `docs/07_MIGRATION_AND_OPERATIONS.md`: migration, secrets, rollback and operational handover.
- `docs/08_BILLBOARD_PROMOTIONS.md`: product/collection campaigns, sponsor slot rules and shop links.
- `contracts/catalog-v1.ts`: proposed typed interfaces; not installed in the current app.
- `examples/catalog-preview.json`: illustrative data with no real sellable provider or Shopify IDs.
- `GROC_START_PROMPT.txt`: paste-ready implementation assignment.

## First working milestone

Build **Merch Printing → Set up collection** around the existing jersey renderer:

1. Select saved team templates and themes.
2. Select the provider-supported sizes for that product.
3. Enter prices or an explicit base-price/surcharge rule.
4. Render and upload the correct panel set for each size.
5. Create one Printify base product per selected team/theme, containing its size variants.
6. Resume failed work without duplicate products; show individual job status and mockups.
7. Hold as drafts for review. Publication is a separate explicit action.

The next milestone publishes reviewed items and maps every Shopify variant to the correct team/theme/product/size. Then enable personalized checkout with validated fulfillment. New media, 3D manufacturing and VR build on that foundation.

## Important boundaries

This is a handoff, not a completed integration or launch approval. The main LincWerks, GameLinc and TournamentLinc repositories, auth model and current VR scene were not provided or inspected. Establish their real routes, contracts and module conventions before integrating. Do not overwrite another agent's lane or deploy an unrelated app.

No live Shopify/Printify products, orders, collection visibility or customer checkout settings were changed while preparing this package. Existing personalized samples remain separate from reusable base templates. Do not place or charge an order to test this handoff.
