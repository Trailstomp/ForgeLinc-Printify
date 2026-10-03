# Light/dark jersey designs and front logo choices

- Existing team drafts remain the light template at `brotherhood-v1:{team}`. Dark designs have a separate `:dark` draft ID. Current artwork and colors are preserved. An unsaved dark design starts from the light artwork, with a dark body and pale base stripes, then becomes independent when saved. All colors and placement remain editable.
- Shared per-team logo libraries live in existing owner-scoped `templates` rows `team-logos:{team}`. Names, upload preference, and up to twelve alternate logos are validated; every referenced upload must belong to the authenticated owner. No public asset routes were added.
- Preview shopper choices modify a copy of the selected theme. Replacing the front image preserves its x/y/scale. Bag items retain a full cloned configuration and do not combine different themes/logos/placements.
- Saving a bag selection inserts a new `selection:{uuid}` draft, preserving the template and other selections. The Printify sender selects that exact owner/team-bound draft ID. Provider panels and transfer fingerprints use its frozen configuration; titles and exported ZIP names identify theme and logo. Quantity remains a preview-bag value; sending a draft does not order that quantity.
- Generate drafts saves both themes for each selected team, up to twenty-two templates. Saved templates update both draft and working state so later light edits cannot change a saved dark template.
- The downloadable Shopify starter now groups published products by `custom.team_name`, `custom.jersey_theme`, and `custom.front_logo`, then adds the mapped available size variant. It has not been deployed to Shopify by this update. Predefined choices need corresponding published Printify-linked products and metafields.
- Customer uploads in public Shopify checkout remain a separate integration task. Private ChatGPT-authenticated artwork storage must not be opened to anonymous shoppers, and a line-item logo property does not change a native Printify variant's print artwork. Public upload authorization, immutable order/design linkage, and review/hold fulfillment must be implemented and verified before enabling that path.

## Verification
- `verify-team-persistence.cjs`: 22 separate templates, library reload, alternate asset ownership, customized snapshot isolation, preserved placement, legacy behavior.
- `verify-printify-transfers.cjs`: exact personalized draft selection, owner/team mismatch rejection, five panels, idempotency, provider changes, uncertain create response recovery, no publish/order requests.
- `verify-theme-selector.cjs`: grouped team/theme/logo choices, real selected variant ID and metadata, locale path, sold-out blocking. This uses a DOM fixture and mocked cart response, not a live Shopify checkout.
- TypeScript check and managed production build.
