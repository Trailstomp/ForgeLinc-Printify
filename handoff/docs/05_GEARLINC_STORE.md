# GearLinc: normal shop and walkable store

Both surfaces consume the same eligible catalog, product details, configuration editor and cart. A player can enter from LincWerks, a GameLinc team, a TournamentLinc event or an arena promotion. The initiating channel/context is retained and checked server-side; entering VR must not reveal other collections.

## Walkable merchandising

| Fixture | Examples | Interaction |
| --- | --- | --- |
| Clothing rack/mannequin | Jerseys, shirts and approved apparel mockups | Select product, rotate detail preview, choose size/theme |
| Hat display | Printed or embroidered hats | Show available decoration method and allowed logo options |
| Shelf/counter | Cups and mugs | Inspect wrap preview and available capacity/color |
| Pedestal/display case | 3D printed collectibles, trophies and accessories | Rotate display model; select validated material/size options |
| Sponsor billboard | House product/collection promotions and sponsor creative | Open eligible GearLinc product or collection detail |

Place merchandise as objects in a navigable store, with recognizable aisles and reachable displays. Do not simulate the whole store as images hung on walls. Where a true product model is unavailable, use an honest simplified display proxy and open the real product preview on selection. The display GLB is not a printable manufacturing file.

Use keyboard/mouse/touch controls first. WebXR controller support is a later adapter to the same interactions. Provide a visible “Shop list” fallback, keyboard-accessible product navigation, product labels, reduced-motion support and a way to stop automatic rotation. Avoid forcing a headset or walk-through before purchasing.

Selection opens a normal accessible product panel over the scene. Configuration, basket edits and checkout use existing shared components and server contracts. Preserve cart state when switching views. A billboard click should not add to cart or initiate a purchase automatically.

## Performance acceptance

The user's low-power computer and integrated graphics make performance a launch requirement. Start with a conservative scene: lazy-load nearby fixtures, use instancing and level-of-detail models, cap pixel ratio, bound texture memory, and pause rendering when hidden. Avoid running a full jersey renderer for every rack item; load the high-detail configurator only for the selected product.

Set measured asset/download and frame-time budgets against an agreed real device before expanding the scene. Report device, browser, scene size, texture memory estimate and measured frame times. Do not promise a frame rate before profiling. Slow/unavailable 3D must fall back to the normal catalog without losing options or cart contents.

Scene definitions contain placement/product references and transforms, not duplicated prices or private credentials. Products withdrawn or unavailable disappear or use a neutral fixture placeholder. Existing paid orders remain accessible to their owners.
