# ForgeLinc stadium visual direction

Adapted from the user's supplied earlier LincForge jersey concept, retaining the current ForgeLinc name and approved jersey artwork.

- Midnight navy surfaces, orange calls to action, cool blue borders, pale metallic-style display headline.
- Main shop composition: live front/back jerseys on a stadium background; team, theme, and customization controls alongside; the team's logos and current panel previews below.
- Shared visual tokens, controls, cards, dialogs, connection pages, and draft views follow the same palette. Print canvases preserve their real colors and the editor uses a light neutral work surface for accurate placement.
- Mobile stacks the hero, keeps the team/theme controls available, wraps team logos, and places team settings before the canvas. Keyboard outlines and forced-color headline fallback are included.
- The change is presentation only: existing team/theme state, ownership rules, saved artwork, uploads, and Printify draft handoff remain intact.

## Background asset
`public/assets/forgelinc-stadium.png` — generated once for this redesign, 1672 × 941. Empty sports stadium, outer floodlights, blue haze, wet turf; no text, logos, people, or jersey imagery. The real configurable jerseys are rendered separately above it.

## Checks
TypeScript, production build, image inspection, and source review of responsive layouts, control bindings, and contrast. No browser QA was requested or run.
