TeacherTiles changelog folder

Add one Markdown file per version, for example:
  v1.2.md
  v1.3.md

After adding or editing a changelog, run:
  python update_changelog.py

Windows:
  Double-click update_changelog.bat

The generator rebuilds:
  index.json  - manifest for hosted/localhost use
  data.js     - embedded copy so the changelog also works when index.html is opened directly

Markdown files are sorted by modification time, newest first.
