# Target architecture — proposed

## Ownership and modules

LincWerks owns identity, permissions, organizations and the shared catalog. ForgeLinc owns designs, templates, provider adapters and production jobs. GearLinc is the shopping experience. GameLinc and TournamentLinc display authorized portions of the shared catalog and route customers through the same product customization and checkout flow.

Use the main app's existing framework and service boundaries. These responsibilities do not require separate deployments or microservices. A module inside a monolith is acceptable. Reuse actual navigation and identity services after inspecting them.

## Terms

- **Production mode:** merch printing or 3D printing. Different technical workflows.
- **Product line:** an owner-created family such as MLBL Apparel, Team Drinkware, GreyLax Desk Gear or Money Cards. Has one production mode; a collection may span multiple lines.
- **Product type/blueprint:** provider-backed shirt, hat, mug, or an approved in-house 3D model/process. Defines supported options and print regions.
- **Design template:** reusable editable settings and assets. Versions are immutable once referenced by a purchased design. A template is compatible only with approved blueprint/region mappings.
- **Catalog product:** something customers can buy, using a product line, template revision and provider mapping. It contains variants rather than one listing per size.
- **Variant:** sellable combination of size, color, capacity, material or other supported options. Carries exact fulfillment and Shopify variant IDs after connection.
- **Collection:** a curated set of products, independent of product-line ownership. Example: a Bombers collection could include a shirt, cup, hat and printed desk accessory.
- **Channel:** a storefront context such as GearLinc, a GameLinc team page, or a TournamentLinc event page.
- **Placement:** an optional display slot in a channel: homepage group, team shop, VR shelf, rack or counter. Placement does not grant access by itself.
- **Purchased design:** immutable customer configuration plus approved template revision and generated production artifacts, linked to one order line.

## Collection publication

The admin chooses collections, ordering, banner/thumbnail and destinations. A collection can be published to all of GearLinc, selected GameLinc teams, selected TournamentLinc events, or any combination. Destinations default off. Allow draft, scheduled, published and withdrawn states; scheduling is optional after the first release.

One publication contains channel kind, destination ID, collection revision, visibility and optional dates. Resolve destination identity server-side; never trust the browser to declare which league/team/event it belongs to. Unpublishing removes discovery and blocks new checkout for that destination, while preserving previous orders.

Use a publication preview showing products, available variants, currency, imagery, customization permissions and missing connections. Missing price, artifact compatibility or mappings blocks publication for that product. Avoid listing a product that can be seen but cannot be ordered without clearly marking it preview-only.

## Catalog consistency

The normal and VR views use the same catalog query, eligibility rules, pricing and cart. Never copy products into scene files as an independent source of truth. Cache catalog responses by authorized channel and publication revision; invalidate on stock, price, listing or visibility changes. Checkout always revalidates server-side.

## Provider adapters

Printify handles provider-supported merch products. The current five-panel jersey renderer is one adapter, not a universal media renderer. Mugs need a wrap area; hats may need print or digitized embroidery assets; shirts vary by decoration method. Validate real provider capabilities before advertising a medium.

The 3D adapter covers model revision, printable geometry, dimensions, materials/colors, print settings, machine compatibility, quantity, estimated time/material and manual production status. Start with validated uploaded production files and manual job approval. A decorative GLB used for VR is not a printable model. Do not claim automated slicing, printer connectivity or machine dispatch until built and tested against the actual hardware.

## Product promotions

Billboard campaigns reference the same catalog product/collection IDs and channel eligibility as the shops. House campaigns cannot override paid sponsor slot reservations. Scene placement does not grant product access. See 08_BILLBOARD_PROMOTIONS.md for campaign selection and fallback rules.
