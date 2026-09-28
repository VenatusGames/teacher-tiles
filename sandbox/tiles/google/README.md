# Google

Tools tile that accepts a Google search query on the board and opens results in a new browser tab with SafeSearch requested. The last results link remains available if a popup is blocked. This does not embed the Google results page inside the board. Query text and the editable title persist with the board.

Embedded results require a configured Google Programmable Search engine: https://developers.google.com/custom-search/docs/element . No third-party engine ID, API key, proxy, or unsupported iframe bypass is shipped.

Run `node tiles/shared/classroom-tests.cjs` for shared regression checks.
