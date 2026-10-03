# MLBL locked character set — September 12, 2026

Twelve fixed characters: eleven team players plus Chandler. Only dayton-bombers, bulldawgs and queen-city have full sleeves and hockey-style helmets with full wire cages. All other characters, including Chandler, have sleeveless field uniforms. Eagles and Trash Pandas have white jerseys; no long sleeves. Team colors and exact supplied chest logo references were used for each generation. Sabers lettering was corrected from its mirrored reference.

Original generated full-body assets: public/assets/players/*-v1.png. Separate transparent cutouts: *-cutout-v1.png. Never regenerate a character merely to move it. The generator script uses these same assets for every composition and preserves all source artwork. It masks white backgrounds, including curated enclosed-background seed points, then feathers the lower portion of each player in the collage to avoid rectangular edges.

Composition source: lib/roster-layout.ts. Every layout contains each team once, with Chandler and the featured team at slots 6 and 7. Peripheral players rotate across staggered positions by team; a separate MLBL badge completes each design. Layout manifests are in public/assets/rosters/manifest.json. Final PNGs are 2400×2800 with alpha transparency. The panel renderer gives the original roster artwork 1.65 times the legacy width, retaining existing user position and scale adjustments. Custom uploaded backs remain user-controlled.

Generation used the built-in image tool, with existing dayton-bombers-back.png as a style reference and each supplied team crest as its logo reference. Prompt specification: one isolated full-body adult male lacrosse player, complete stick, natural bright face with one pair of eyes, exact chest crest, team colors, clear outline, pure white background, no surrounding shadow or scenery. Field players required both upper arms bare. Box players required sleeves to gloves. Each character received distinct face details. The three box helmets were corrected with a targeted edit requesting a classic hockey helmet with low rounded shell, no projecting visor, and separate silver full wire cage, preserving everything below the neck. The initial Eagles checkerboard-background generation was discarded; the white-background correction is the source used here. The league badge background was likewise corrected before compositing.

Approved kit specifications used:
- Eagles: white, navy/red trim, white/red field helmet.
- Bombers: black/red, full sleeves, black hockey helmet.
- Trash Pandas: white, pink/black trim, black/pink field helmet.
- OH10: white, red/black trim, white/red field helmet.
- BallHogs: white, light-blue/navy trim, white/blue field helmet.
- Bulldawgs: golden tan/black, full sleeves, black hockey helmet.
- American Dads: white, navy/red trim, white/red field helmet.
- Lacers: navy/gold, black/gold field helmet.
- Sabers: navy/gold, navy/gold field helmet.
- Black Snakes: black/lime, black/lime field helmet.
- Steamboats: white torso, blue/orange full sleeves, white hockey helmet.
- Chandler: black/red sleeveless MLBL jersey, black/red field helmet.

The illustration source resolution remains 1024×1536 per character. Larger composite and print panel files arrange/resample those pixels; they do not recover additional facial or logo detail. Generated characters are now fixed images, not a guarantee of pixel-identical original supplied logos.
