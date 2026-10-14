# Tile files

Keep files owned by an individual tile or app here:

- A tile with one standalone file uses `tiles/<tile-name>.js`, such as `lesson-planner.js`.
- A tile with multiple files gets its own directory, such as `image-search/index.js` and `image-search/styles.css`.
- Keep tile-specific tests and documentation beside that tile's files.

Shared board behavior stays in the main application files. Update the script and stylesheet references in `index.html` whenever moving a file.

Image Search uses the Wikimedia Commons API, without an API key. Search results and image source credits are saved with the board. Images remain remotely hosted and require a connection to load.
