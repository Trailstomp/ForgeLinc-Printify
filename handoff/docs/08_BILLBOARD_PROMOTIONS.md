# GearLinc products on sponsor billboards

Owner request: advertise GearLinc products and collections on the existing sponsor billboards as well as selling them in the normal app and walkable store. This is planned integration; the current sponsor/arena implementation was not provided or inspected.

## Admin workflow

Create a house promotion, choose an eligible product or collection, select approved creative, choose destination app/team/event/arena and billboard slots, set optional start/end dates, preview, then activate. A later catalog edit updates current product details; the creative remains versioned and reviewable.

Allow product hero, collection feature and event/team gear creatives. Store creative asset, aspect ratio/crop rules, short headline, call to action and accessible label. Prefer live price text sourced from the eligible catalog, or omit prices from baked images so they cannot silently become stale. Use the platform's server-resolved product/collection link; do not let arbitrary external URLs impersonate checkout.

## Placement rules

House promotions and paid sponsor campaigns are separate campaign types. Reuse existing sponsor inventory rules once inspected. A house promotion must not overwrite a reserved sponsor booking. Permit explicitly designated house-only slots and approved rotation of eligible unsold inventory. Define priority and rotation weight; reject conflicting exclusive reservations, and use deterministic selection for a time window so ads do not flicker every render frame.

Eligibility requires the campaign to be active and in date, the slot/context to match, and its product or collection to be published to that same audience. A direct billboard click must recheck eligibility. Withdrawn collections, unavailable products and empty collections use an approved neutral/house fallback or no promotion; they must never expose private catalog content. No draft design should appear in a public billboard.

A billboard selection opens the same GearLinc product/collection panel used by the normal shop and walkable store. Users can inspect, choose options and add to cart there. Preserve event/team context across the transition. Provide a normal clickable/text equivalent for keyboard and non-VR users. Clicking an ad never purchases or submits a production job.

## Optional analytics

Track aggregate eligible impressions and clicks only if the host's analytics/consent approach permits. Count an impression after meaningful visible dwell, with deduplication; do not emit one per animation frame. Product sales attribution may use a campaign reference carried through cart/order metadata, never a public customer identity. Analytics must not block shopping.

## Acceptance

Demonstrate a Bombers collection promotion on a chosen arena billboard leading to the correct collection; a direct product promotion opening the same configurator as the shop; an expired campaign falling back; a hidden collection staying hidden; and a paid reserved slot remaining unchanged when house promotions activate. Verify both normal browser and walkable/VR input paths.
