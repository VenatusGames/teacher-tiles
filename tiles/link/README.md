# Link

Tools tile that opens an HTTP(S) destination from an uploaded image or a text hyperlink. Uploads reuse fileToBoardImageData, preserve transparency, and are bounded to 760,000 characters for board storage. Accepted uploads are PNG, JPEG, WebP, or GIF under 10 MB; animated GIFs use the existing helper’s static conversion. Drag-and-drop uploads are supported. The board stores the image, URL, and label.

Credentials and executable/non-web URL schemes are rejected. Restored images accept only bounded raster data URLs; SVG is not accepted. External links use noopener and noreferrer. The image replaces the visible tile shell; the gear menu remains available on hover/focus. Removing an image keeps the destination and text label.

Run `node tiles/shared/classroom-tests.cjs` for shared regression checks.
