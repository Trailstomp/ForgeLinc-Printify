# ForgeLinc Printify

ForgeLinc's MLBL team shop and merchandise studio, including the jersey designer,
3D previews, Shopify theme extension, Printify draft transfers, and order/artwork
review. This repository contains the complete saved application source and bundled
artwork, plus the GearLinc commerce handoff and future implementation plans.

The application files and `package.json` are at the repository root so a builder
can import the project directly. Dependencies and versions are preserved from the
existing application.

## Source baseline

- ForgeLinc Site version: **49**
- Original source commit: `3a7f2a57925e8f09d9e5bc28dda7525ab6ed581f`
- Original handoff prepared: **September 26, 2026**
- Repository preparation: **October 3, 2026**
- Provenance: [`handoff/SOURCE_MANIFEST.json`](handoff/SOURCE_MANIFEST.json)

This is a source export, without the original Git history. The original source
README is retained in [`handoff/ORIGINAL_SOURCE_README.md`](handoff/ORIGINAL_SOURCE_README.md);
its integration-status statements predate the current source. The current scope
below and [`handoff/docs/01_CURRENT_STATE.md`](handoff/docs/01_CURRENT_STATE.md)
describe the exported baseline.

## Included functionality

- Team management, saved templates, Light/Dark and custom themes, artwork choices,
  placement controls, and customer-upload settings.
- Five jersey print panels: front, back, both sleeves, and collar; name/number
  personalization, panel exports, and matching 3D previews.
- A preview bag with editable configured items, quantities, and removal.
- Server-side Shopify and Printify connections with encrypted credential storage.
- Printify transfer snapshots, upload checkpoints, and draft product creation for
  **one selected provider variant per transfer**.
- Shopify checkout previews, saved design references, imported order matching,
  and fulfillment/artwork review.
- A Shopify theme app extension in [`shopify-extension/`](shopify-extension/README.md).
- Database schema/migrations, existing verification scripts, bundled team artwork,
  and the original artwork/design archives.

The shared catalog, multi-size collection automation, additional merchandise
media, 3D manufacturing workflow, cross-app catalog distribution, walkable GearLinc
store, and billboard promotions are **planned work**, documented in `handoff/`.
Automated production fulfillment is not complete; final production approval
remains manual in Printify. Existing Shopify mappings are limited to the configured
product/team and are not a general mapping for every team, theme, and size.

## Development

The project declares **Node.js >=22.13.0** and **pnpm 11.19.0**. It uses React,
Next.js APIs through Vinext/Vite, Cloudflare Workers, D1, and R2. Preserve
`pnpm-lock.yaml` when reproducing this baseline.

With the declared Node and pnpm versions installed:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The portable development command uses port 5173. A build uses:

```sh
pnpm build
```

Authentication and storage need appropriate host configuration before the entire
workflow can run. `app/chatgpt-auth.ts` consumes Sites-authenticated user headers;
`lib/studio-access.ts` contains the original owner-only studio restriction. The
portable local sign-in identity does not automatically become that administrator.
When moving to another host, implement verified host authentication and role checks.

`.openai/hosting.json` preserves the original Site identifier and the `DB` (D1)
and `ARTWORK` (R2) bindings. Configure separate development or staging resources
before deploying elsewhere. No deployment or database migration is performed by
this repository export.

`.env.example` provides an empty `CONNECTION_ENCRYPTION_KEY` placeholder. Configure
a server-only key consisting of 32 random bytes encoded as 64 hexadecimal
characters through the target host's environment/secret mechanism. Configure
Shopify and Printify credentials through the authenticated connection workflow.
Real environment files and credentials must remain untracked.

## Verification

Existing checks include:

```sh
pnpm exec tsc --noEmit
node scripts/verify-core.cjs
pnpm lint
```

Additional `scripts/verify-*.cjs` files cover rendering, saved designs, connections,
checkout, order review, and transfers. Some need native canvas/SQLite support in
the development environment.

For this repository preparation, the original archive's per-file checksums and
source inventory were verified and files were checked for embedded credentials.
The application build and integration checks were not rerun. No live provider
products, orders, checkout settings, or production data were changed.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Shop/studio pages, UI components, and server routes |
| `lib/` | Rendering, catalogs, persistence, provider connections, checkout and fulfillment logic |
| `components/`, `hooks/` | Shared UI and hooks |
| `public/`, `design-notes/` | Bundled artwork, original assets, and design history |
| `db/`, `drizzle/` | Database schema and migrations |
| `shopify-extension/` | Shopify Team Shop theme extension |
| `scripts/`, `build/` | Development/build helpers and existing checks |
| `handoff/` | Product plans, architecture, proposed contracts, examples, and provenance |

Start future integration work with
[`handoff/START_HERE.md`](handoff/START_HERE.md) and
[`handoff/docs/06_IMPLEMENTATION_AND_ACCEPTANCE.md`](handoff/docs/06_IMPLEMENTATION_AND_ACCEPTANCE.md).
References to `source/` in the original handoff mean this repository's root.
The proposed contracts/examples in `handoff/` are not installed application features.

Live D1 records, uploaded R2 artwork, provider credentials, dependencies, generated
build output, and original Git history were excluded from the original source
handoff and are not included here.
