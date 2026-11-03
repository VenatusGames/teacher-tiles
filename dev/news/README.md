# News

| Folder | Purpose |
| --- | --- |
| **posts/** | Put exported `.ttn` news articles here |
| **banners/** | Put selectable news photos and gallery images here |
| runtime/ | Application code and article styles |
| generated/ | Build-generated article index; no manual edits |
| legacy/ | Original Markdown posts and old publishing tools, kept as backups |

You normally only need **posts/** and **banners/**. Create and edit articles through the dev portal.

## Publishing

Create and edit news in Community → News in the dev portal. Text sections, rich formatting and rotating photo galleries retain their order in the app and exported files.

## Move a post between branches

1. Save Post saves the portal copy and downloads a `.ttn` (TeacherTiles News) file. Use Download .ttn to download a previously saved post again.
2. Put that file inside `news/posts/` in the destination branch and commit it. Replace the existing file for an updated post; do not keep two files with the same post ID.
3. Deploy that branch normally. Its site build discovers `.ttn` files automatically, validates them, extracts their bundled images, and rebuilds `news/generated/posts.json`. No manual manifest edits or Firebase imports are required.

Both branches need the .ttn reader/build support, and the matching News functions update, installed once before transferring posts. This implementation is on dev only until promoted. Browser downloads cannot write directly into a Git checkout. For local previews, run `node scripts/build-news.cjs .` after adding or replacing a file.

The JSON-based, versioned file carries the post ID, date, publication/archive state, ordered modules, formatting, captions and original local image bytes. Local images (including GIF and SVG) travel with the file, without resizing or rasterizing. Existing externally hosted images retain their original URLs and still need that host. Font loading works the same as the original post. Each image can be up to 40 MB; a .ttn file can be up to 96 MB.

## Editing, archiving, and deleting folder posts

Folder posts also appear in the portal library. Saving, archiving, or deleting one creates a revision-checked override for that exact file version. The original .ttn is never overwritten by the browser. A replacement .ttn with new content becomes the new base version; matching cloud overrides win until then. Download again after archiving/unarchiving if transferring that state to another branch. To permanently remove a file post from the repository, remove its .ttn file as well.

Unpublished and archived posts do not appear in the in-app feed. Repository files are public static assets: never commit confidential drafts. Exported files contain no user IDs, backend credentials or developer audit data.

The two original Markdown posts remain preserved verbatim in `legacy/legacy-posts.json` and the original `legacy/1.md` / `legacy/2.md` files; the backend maintains its existing migrated versions. Markdown files, index.json and data.js are historical backups and are not read by the app or portal.

Deploy dev functions before the updated frontend to preserve file overrides and archive/delete behavior.

## Article display order

Drag article cards above/below one another in the portal library to save their in-app order automatically. Alt + Up/Down provides keyboard reordering. Search/filter reordering moves only visible cards; hidden cards keep their slots. Unlisted/new posts follow the saved order by newest publication date. Ordering is shared per backend/environment; it is not bundled into individual .ttn files.

## Photos and galleries

Place news images in `news/banners/`. The deployment build indexes this folder automatically. Choose **+ Photo** for a standalone image with an optional caption, or **+ Photo Gallery** for rotating images. Both are movable modules and retain their images in portable `.ttn` files. Existing image references continue working.

For compatibility, existing `.ttn` files placed directly in `news/` still load. Prefer `posts/` for new files; the build skips `runtime/`, `legacy/`, `generated/`, and `banners/` when discovering articles.
