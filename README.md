# TeacherTiles

A browser-based modular classroom workspace. Right-click the board to add tools, drag and resize them freely, snap modules together, customize their appearance, and drag modules to the trash to remove them.

## Homepage and Board Routing

Keep `home-site/` and `scripts/build-site.cjs` in main, sandbox, and dev when copying builds between branches. `index.html` is the current board source in all three branches. `home-site/index.html` is the homepage template, with URLs relative to the published site root; the demo and its assets stay inside `home-site/`.

GitHub Pages runs the shared site builder on a temporary deployment copy:

- **main:** the homepage becomes `/index.html`; the current board becomes `/board.html`.
- **sandbox / dev:** the existing protected portal becomes that branch's index; its protected board remains `board.html`. The homepage is carried with the source for future promotion to main.

The branch name determines routing. Copying a `sandbox/` source folder into main does not turn the public homepage into the developer portal, and root publishing excludes the separately deployed `sandbox/`, `dev/`, and `wigs/` folders. A missing homepage fails the main build instead of publishing the board at `/`.
