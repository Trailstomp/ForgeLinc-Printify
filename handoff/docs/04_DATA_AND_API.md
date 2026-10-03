# Proposed data and service contracts

This is a target design, not a description of endpoints already deployed. Adapt naming and persistence to the main application's conventions. `contracts/catalog-v1.ts` supplies portable domain interfaces, not runtime validation or a generated SDK.

## Entities and invariants

Every administrative record belongs to an organization. A product line has one production mode. A blueprint defines supported regions, options and processes. A template revision is immutable and compatible with a blueprint revision. A product references a template revision; its variants carry explicit provider mappings and prices. Collections curate product IDs; publications authorize those collections for a particular application and optional team/event context.

Use integer minor-unit amounts with explicit currency; never floats for money. Provider IDs are opaque strings in the shared domain even where an adapter needs numeric IDs. Unique mappings must include provider/store/product/variant and the local variant. A provider variant alone is not globally unique. Reject ambiguous mappings.

Separate internal records from public DTOs. Public responses contain eligible products, approved assets, allowed options and prices, not integration tokens, supplier costs, customer addresses or internal production files. Signed/private asset access must remain scoped and short-lived where required.

Purchased designs retain the resolved artwork, text, positions, colors, options, size, quantity, asset hashes, template revision, renderer version and print-file manifest. A template edit must never alter an already purchased design. Store production approval against the exact manifest hash; any change invalidates approval.

## Proposed endpoints

| Endpoint | Role and behavior |
| --- | --- |
| GET /commerce/catalog?channel=&context= | Resolve authorized published collections; server validates context membership, dates and eligibility |
| GET /commerce/products/:id | Same eligibility rules; expose usable variants and allowed personalization |
| POST /commerce/cart/items | Validate options, save a design revision and identify configuration separately from product ID |
| PATCH /commerce/cart/items/:lineId | Edit quantity/design by line ID with expected cart revision |
| DELETE /commerce/cart/items/:lineId | Remove exact configured line |
| POST /commerce/checkouts | Revalidate prices, eligibility and mappings; idempotency key plus cart revision prevents duplicate checkout creation |
| POST /forge/collection-jobs | Admin; plan sizes, prices and provider drafts; return job ID, not a long blocking request |
| GET /forge/jobs/:id | Authorized progress, per-product result and actionable failure |
| POST /forge/jobs/:id/retry | Retry failed/uncertain operations with reconciliation; never blindly recreate remote products |
| POST /forge/publications | Publisher role; explicit destination and reviewed product revisions |
| POST /forge/production-jobs/:id/approve | Production approver; exact revision, quote and manifest binding; adapter must support action |
| GET /commerce/placements?scene=&context= | Eligible store placements and billboard creatives with authorized product/collection destinations |
| POST /forge/campaigns | Publisher; create house promotion or sponsor campaign, then validate slot rules before activation |

Checkout/production are distinct state machines. A paid order is not approval to print an unreviewed file. Model holds, failures, cancellation and refunds explicitly. Use verified provider webhooks with deduplication and periodic reconciliation. Record an outbox entry transactionally with state changes so external calls survive worker restarts.

Mutations require server-side role checks, tenant scoping, input validation and CSRF/origin protection appropriate to host authentication. Client-provided team IDs, prices or production status are not authority. Cart writes use optimistic concurrency; rejected stale writes return current revision for user review.

For expensive rendering, use bounded durable workers and job leases. Persist checkpoint outputs, request hashes and external IDs. Treat timeout-after-create as uncertain, then inspect the remote result before retry. Application idempotency must work even when a provider has no native idempotency key.

Uploads need type/content checks, dimensions or geometry limits, quotas and private staging. Process untrusted image/model files in an isolated worker. Disabling customer uploads must be enforced by the API as well as hiding the button.
