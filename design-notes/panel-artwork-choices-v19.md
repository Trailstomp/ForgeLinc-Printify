# Panel artwork choices — v19

The studio now offers an explicit original-artwork card, restoration of the saved template default, and up to 12 alternate images for each of the five panels. Adding an alternate does not apply it. Use on this template edits the working design; Save team template persists that default. Save artwork choices independently persists the team library shared by every theme for that team.

The private shopping preview offers each panel’s template default, optional original artwork, saved alternates, and optional uploads. Choices compose independently and are captured in the existing immutable bag/design snapshot for Printify drafts. Restoring original artwork preserves the panel placement and does not touch other panels. Restoring the saved template default restores that panel’s saved placement and image, including custom uploads.

Legacy front-logo records retain their existing top-level shape. Optional per-position policies extend the same owner-scoped record; no database migration or destructive asset operation is needed. All library asset references are ownership-checked. Ownership lookups batch at 90 IDs for D1 bind limits. No anonymous upload or public checkout capability is added.

Custom collar artwork now renders through the shared preview/export renderer. Its original remains stripes only. Existing team colors, light/dark defaults, approved roster artwork, sleeve emblem and background layering remain intact.

Validation: TypeScript, team persistence/ownership and independent panel choices, artwork rendering including collar restoration, and Printify snapshot/transfer regression checks. Production build and private deployment use the existing project and audience.

## Named custom themes

Teams can create named themes without a fixed theme-count cap. Each theme has a stable custom UUID independent of its name. Light and Dark keep their existing draft IDs; legacy configs gain an empty themeName default. Custom themes are normal independently saved team templates, created one at a time, and can copy current edits, another theme, or a fresh base with artwork hidden.

Rename saves to the same identity. Remove deletes only the owner/team/custom-template row, leaving assets, saved shopper selections and transfer snapshots intact. Light/Dark removal is rejected. Theme labels carry through shop choices, draft reviews, export filenames and Printify titles. Bulk collection generation still prepares the 22 standard Light/Dark designs; custom themes are already saved on creation and can be sent individually.

Additional validation: 30 independently saved custom themes for one team; rename identity, rejected invalid theme/name, owner-isolated deletion, Light/Dark protection, immutable selection after theme removal, and custom-theme Printify snapshot/title.
