# Restore the original angled head

User requested the original diagonal QR lacrosse head on September 12, 2026.
`scripts/build-angled-membership.cjs` uses the original transparent `qr.png`
without rotating or regenerating it. Its perspective, ball texture and original
working QR are retained. Imagegen created a separate matching chrome membership
wordmark; its outer white background is masked before composition above the head.

The original is placed at x=0, y=200 in a 1254×1454 transparent canvas. The
membership wording remains “Proud member of the MLBL.” The final asset is
`public/assets/membership-head-angled-v2.png`. This replaces the upright default
graphic through the shared panel renderer while retaining existing layer settings.
