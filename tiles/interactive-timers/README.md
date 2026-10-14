# Interactive Timers

- `index.js` connects the hourglass and candle to the existing shared timer controls and board state.
- `hourglass.js` renders the glass, walnut frame, sand texture, falling grains, and landing scatter on a canvas.
- `garden-rocket.js` renders the rocket's burning fuse and launch, plus seed planting and staged sunflower growth. Both follow the shared timer, so pause, reset, switching modes, and restored boards preserve their progress.
- `styles.css` sizes the hourglass within the resizable tile.
- Run `node tiles/interactive-timers/tests.cjs` to check sand conservation, draining/filling, and ordered sunflower growth across different timer durations.

The animation follows elapsed timer progress. Equal-area samples keep the combined sand amount consistent as the upper funnel drains and the lower mound grows. This is a visual simulation, not an individual-grain physics engine. Grain texture is cached; animation stops when paused, hidden, offscreen, in candle mode, or disposed. Reduced-motion preferences disable moving particles while preserving the sand levels and countdown.
