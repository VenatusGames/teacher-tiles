# Daily learning and embedded Google setup

The original offline collections contained 20 quotes and 80 words (40 per collection). The word fallback now contains 80 uncommon words. Those fallback banks still repeat; online refresh requires the backend below to be deployed.

Deploy the `dailyLearning` Firebase function in project `teachertiles-6739b` with the normal release process. It reads the current Wiktionary Word of the Day and a ZenQuotes batch. It keeps up to 365 words and 365 quote records in the private `dailyLearning/current` Firestore document, avoids quote duplicates against that cache, and refreshes at most once per UTC day after a successful refresh. A transaction lease limits retries. The browser caches content locally and retries unavailable feeds hourly while mounted. No API key is needed. Existing Firestore rules deny direct client access to this cache.

Wiktionary text is attributed under CC BY-SA; ZenQuotes links provide the required free-tier credit. Upstream content is filtered for basic unsuitable terms and quotes are selected for learning and encouragement. This is not human editorial review; upstream availability and content remain external dependencies.

Set `engineId` in `tiles/google/config.js` to the site's Google Programmable Search engine ID (`cx`). The isolated `search.html` frame renders Google's supported Search Element with SafeSearch active. Results appear inside each tile; destination websites open separately because arbitrary websites may prohibit embedding. An unconfigured engine shows a connection message and does not open a Google results tab.

Checks: `node tiles/shared/classroom-tests.cjs` and `node tiles/shared/live-content-tests.cjs`.
