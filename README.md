# TeacherTiles

A browser-based modular classroom workspace. Right-click the board to add tools, drag and resize them freely, snap modules together, customize their appearance, and drag modules to the trash to remove them.

Current modules include Sticky Note, Visual Timer, Interactive Timers, Clock, Noise Detector, Collections, Stoplight, Image, Text Bubble, and To-Do.

Custom Flashcards lets teachers create multiple reusable card sets, switch between them, and mix text with uploaded images. Lunch Count categories can also use a teacher-uploaded image instead of the preset lunch icons.

## Run locally

Open `index.html` directly for most features. Microphone access for the Noise Detector requires localhost or HTTPS. From this folder, you can run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Image module

Create an Image module from the right-click menu and drag an image into it, or drag an image file directly onto the workspace to create an Image module automatically.

- YouTube module: paste a YouTube link and load an embedded player.
- Image modules always preserve the full image aspect ratio.
- Expanded font choices across customizable text modules.


## YouTube and custom font
YouTube embeds must be tested through localhost or HTTPS; opening index.html directly with file:// can trigger YouTube error 153 because the player receives no valid HTTP referrer.

The Phantom Guardians font option is wired to `assets/PhantomGuardiansCoolGamingBold-q2Rlx.otf`. Place your licensed copy of that font file in the assets folder when deploying.


## Boom Box soundscapes


## Boom Box player styles
Boom Box defaults to a minimal Apple Music-inspired player. Use the appearance button inside the module to switch between Apple Music, classic iPod, and spinning Vinyl views. The selected soundscape and playback state continue across appearance changes.

## Module categories
The right-click Add Module menu defaults to ALL and can be filtered with TEXT, MEDIA, and TOOLS tabs.


## Changelog

TeacherTiles now includes a Markdown-powered changelog.

Release-note files live in `changelog/`. Add one `.md` file per release, then run:

```bash
python changelog/update_changelog.py
```

On Windows you can also double-click `changelog/update_changelog.bat`.

This rebuilds `changelog/index.json`, which is what the website uses to discover entries. Files are sorted by their modification/addition time so the newest release appears first.

## Writing Lines font

The Writing Lines typing mode uses the supplied `PrintBold-J5o.ttf` font from `assets/PrintBold-J5o.ttf`.
Place your copy of `PrintBold-J5o.ttf` in the `assets` folder to enable that font.
The app falls back to a handwriting-style system font if the asset is not present.
