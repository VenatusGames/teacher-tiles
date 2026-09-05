# Interactive Timers

- `index.js` connects the hourglass and candle to the existing shared timer controls and board state.
- `hourglass.js` renders the glass, walnut frame, sand texture, falling grains, and landing scatter on a canvas.
- `styles.css` sizes the hourglass within the resizable tile.
- Run `node tiles/interactive-timers/tests.cjs` to check sand conservation and draining/filling across the countdown.

The animation follows elapsed timer progress. Equal-area samples keep the combined sand amount consistent as the upper funnel drains and the lower mound grows. This is a visual simulation, not an individual-grain physics engine. Grain texture is cached; animation stops when paused, hidden, offscreen, in candle mode, or disposed. Reduced-motion preferences disable moving particles while preserving the sand levels and countdown.
