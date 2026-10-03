# 3D detail and administrator access

The shared 3D viewer now renders panel textures with a 2048px maximum edge, retaining original panel aspect ratios. Raster output respects display density up to 2x; anisotropic filtering is capped at 8x. Artwork uses physical height UVs, subtle folds, and torso aspect compensation to reduce stretched logos/faces. This remains an approximate garment preview, not a provider sewing-pattern model. Print exports and saved artwork are unchanged.

Merch Studio, Drafts, Connections, and Printify transfer actions are restricted on the server to the verified existing Site-scoped owner identity. Server rendering supplies only the admin boolean. Non-admin navigation excludes all admin panels and direct /send navigation returns to the shop. No client role field is trusted.

Signed-in players read reusable team designs and offered artwork through a separate shop endpoint. Private custom selections, store connection records, and unreferenced owner uploads are excluded. Players retain own uploads and the preview bag; admin-only save-to-Printify controls are hidden. Site sharing remains owner-private; Shopify checkout remains a separate unfinished integration.

Verified with TypeScript, explicit anonymous/player/forged-role/owner API checks against SQLite, reusable-template and artwork filtering, 2048px texture dimensions, finite geometry/UVs and attached sleeve boundaries, native front/side/back projection, and the spin interaction lifecycle. No browser UI QA was run.
