from pathlib import Path
import json
from datetime import datetime, timezone

folder = Path(__file__).resolve().parent
entries = []

for path in folder.glob("*.md"):
    stat = path.stat()
    entries.append({
        "file": path.name,
        "addedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        "text": path.read_text(encoding="utf-8")
    })

entries.sort(key=lambda x: x["addedAt"], reverse=True)

(folder / "index.json").write_text(
    json.dumps(
        {"files": [{"file": e["file"], "addedAt": e["addedAt"]} for e in entries]},
        indent=2
    ),
    encoding="utf-8"
)

(folder / "data.js").write_text(
    "window.TeacherTilesChangelogData = " +
    json.dumps(entries, ensure_ascii=False, indent=2) +
    ";\n",
    encoding="utf-8"
)

print(f"Updated changelog with {len(entries)} release note(s), newest first.")
