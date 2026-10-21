# Selectable banner images

Add PNG, JPG, WebP, GIF, SVG, or AVIF images to this folder (subfolders work too), then commit and deploy the site. They automatically appear in **Select Image** for shop banners, events, and polls. No Firebase Storage upload or functions deployment is needed to add images.

Existing built-in banners keep their original designs and files. This folder adds new image choices; it does not convert or replace built-in banners.

The site build regenerates `index.json`. For a local preview run `node scripts/build-banners.cjs .` from the repository root. Do not edit the index manually. Hidden files, symlinks, and folders beginning with `_` or `.` are excluded. Keep images at their current paths while they are selected by published events, polls, or shop banners.
