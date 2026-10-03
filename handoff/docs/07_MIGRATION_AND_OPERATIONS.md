# Migration and operations

## Source bootstrapping

The captured project uses Next/React through vinext, Cloudflare Workers, D1 and R2. Inspect `package.json` and lockfile: Node >=22.13.0, pnpm 11.19.0 are declared. Preserve the lockfile for baseline reproduction; do not silently upgrade the whole stack while integrating the module. Native canvas/SQLite dependencies used by some verification scripts may require a separate development test environment.

`pnpm install --frozen-lockfile` and `pnpm build` are baseline commands after configuring the appropriate development environment. Read source scripts before running them; this handoff did not rebuild or redeploy the unchanged site. The target app may use a different framework/runtime, so isolate domain/render/provider logic behind host adapters instead of copying an entire second app blindly.

`.openai/hosting.json` identifies the original Sites project and bindings. It is provenance, not authorization to deploy into that site. Replace deployment identity and use staging resources before any target deployment. Owner-specific Sites authentication must become host organization membership and roles. Never expose studio by merely removing its current access check.

## What is not in the archive

No Git history, dependency tree, live D1 records, R2 user uploads, Shopify/Printify secrets, private order export or production database dump is included. Bundled tracked artwork is included. `.env.example` contains an empty encryption-key placeholder only.

Inventory actual runtime templates, custom teams/themes, artwork alternatives and uploaded image objects before cutover. Export from authorized server-side tooling, retain ownership mappings and checksums, then migrate with explicit source-to-target IDs. Preserve order snapshots and archive markers. Do not assume bundled images include every saved user design.

Existing connections use encrypted credential storage. Securely provision new target secrets; do not put keys in prompts, package files, client code or logs. Migrating encrypted records requires the original key through an approved secret channel, or reconnecting each provider. Do not copy ciphertext and assume it decrypts under a new key.

Map owners to real host organizations deliberately. Validate every asset reference and variant mapping in staging. Record schema/version transformations and retain an encrypted backup outside the public app. Missing historical artwork must be flagged for manual review; never recreate a customer's paid design from today's template and call it the original.

## Cutover and recovery

1. Stage the shared catalog and read-only projections; reconcile counts and representative artwork.
2. Run provider integration checks in draft/test mode and keep production approval manual.
3. Migrate or deliberately expire preview carts; preserve paid design/order references.
4. Switch one selected collection/channel first, then verify availability, cart and order reconciliation.
5. Expand only after reviewed acceptance evidence. Keep old records and source revision available for rollback.

Rollback disables new publications/checkout and restores the previous application/catalog revision. It must not erase already placed orders or reverse production automatically. Reconcile external provider state before replaying any queued mutation.

Operational screens should expose failed jobs, uncertain creates, missing mappings, expired artwork links, webhook failures and order holds. Log correlation IDs and state transitions without secrets or customer artwork payloads. Have a manual retry/reconciliation action with audit history.

Provider documentation to verify during implementation: https://developers.printify.com/ ; https://shopify.dev/docs/api/admin-graphql ; https://shopify.dev/docs/api/storefront . Pin and test actual supported API versions/capabilities rather than assuming all media support the jersey flow.
