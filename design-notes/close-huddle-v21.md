# Close huddle correction — v21

The spread-out v3 layout is replaced by a close shoulder-to-shoulder huddle. Supporting players are larger and overlap neighboring shoulders, arms and shorts instead of occupying isolated diagonal slots. Uneven head heights soften the row structure. The fixed featured pair remains central and largest; chest logos remain visible. The metallic league badge stays above the players.

All eleven compositions reuse the same approved player and buddy-pair source assets without redrawing faces, uniforms, helmets or crests. Outputs use v4 filenames and the v4 manifest; earlier v3 composites are retained outside public assets in the source archive. Custom uploaded back artwork is unaffected.

The storefront description now reads: Your team beside MLBL Chandler.

Validation: TypeScript and native production garment rendering for Eagles and Lacers, visual composition inspection, complete team membership in all eleven manifests, and production build.

## Studio 3D viewer
- Enlarged the five top panel thumbnails from 48px to 96px. Removed the duplicate right-hand flat panel grid.
- The right-hand Live samples rail now shows a lazy-loaded Three.js garment with curved front/back, open sleeves, shoulders and collar. All five textures use the shared print-panel renderer without guides, including current themes, placements, colors and uploaded artwork.
- Drag, keyboard rotation, front/back/side shortcuts, zoom buttons and responsive camera framing. Render on change rather than a continuous animation loop; dispose geometry, textures, listeners and WebGL on unmount. Flat front/back fallback when WebGL or artwork fails.
- This is a generic placement model, not a provider-specific sewing or fit simulation.
- Verification: TypeScript and native CPU textured mesh projections; finite vertices/UVs, valid indexed topology and all five material mappings (13,280 triangles). No browser/WebGL interaction QA was performed.
