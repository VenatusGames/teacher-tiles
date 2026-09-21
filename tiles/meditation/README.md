# Meditation

Found under SEL. Start a timed breathing session, pause/resume it, or reset it.
The normal Customize and Settings buttons provide tile color, font, text color,
border, audio enable/volume, and timing controls.
The breathing-color button opens a four-color drawer: Lagoon, Ocean, Dusk, and
Sunrise. Its palette is saved independently for each tile/tab. The luminous orb
and ripples expand with inhalation and contract with exhalation, filling the
available space when the controls are hidden.

- Inhale and exhale: independently adjustable from 1–20 seconds.
- Session length: `minutes:seconds`, from 10 seconds to 60 minutes; default 3:00.
- Timing edits reset the session. Saved boards and tabs retain the settings and
  reopen at rest. Hiding the page, changing tabs, or closing the tile pauses audio.
- The supplied `soul_frequencies-ambient-meditation-music-498455.mp3` is copied to
  `assets/ambient-meditation.mp3`. Two audio players crossfade over 1.5 seconds at
  loop boundaries. The session also fades in and fades out as its timer ends.

Run `node scripts/tile-tabs-meditation.test.cjs` from the repository root to test
timing, audio lifecycle, tab persistence/Undo, drag merging, and resizing.
Run `node scripts/free-resize-meditation.test.cjs` to check independent dimensions,
skinny-shape limits, migration of previously scaled tiles, and palette persistence.
Set `PLAYWRIGHT_MODULE` to the installed Playwright module path if necessary.
