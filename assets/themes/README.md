# Material theme artwork

These local SVGs supply the Wood, Cardboard, Metal, Cosmos, and Corkboard packs.
They are static, deterministic artwork: switching themes never changes the pattern.

To adjust palettes, grain, stars, labels, or pins, edit
`scripts/generate-theme-artwork.cjs` and run:

```sh
node scripts/generate-theme-artwork.cjs
node scripts/generate-theme-previews.cjs
```

The preview generator requires `sharp` installed or available on `NODE_PATH`.
It rasterizes the artwork once into committed 1,200px-wide WebP images in
`previews/`. Ship that folder with the app; no image generation runs in the browser.
Regenerate previews whenever the SVG artwork changes. `previews/manifest.json`
records the source hashes and output sizes for checking stale assets.

The artwork generator also writes `palette.css`, which assigns full SVG artwork
to the workspace and separate WebP images to theme cards, pack icons, shop
previews, and saved-board thumbnails. This avoids repeatedly rendering complex
SVG filters in small previews, while preserving full-resolution board artwork.
Its URL variables are consumed by the root-level `styles-materials.css`; keep
their `assets/themes/` prefix so both root and subdirectory hosting work.

`styles-materials.css` controls texture scale, preview crops, and material UI
colors. Material textures repeat at a fixed size. Cosmos instead uses four
dedicated 12,000 × 8,000 compositions with irregularly scattered features,
varied rotations and sizes, and an independently scattered star field. Those
compositions never tile; their seeded placement stays stable when reopening a
board. Shelf and shop cards retain close-up artwork. Existing theme IDs, purchase requirements, and saved-data
formats are unchanged. No animation or external asset service is required.
