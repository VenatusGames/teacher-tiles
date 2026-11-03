# News publishing

Create and edit news in the dev portal's Community → News tool. Posts use ordered text sections and photo galleries, with drafts, publication, and archiving managed there.

The two original posts are preserved verbatim in legacy-posts.json and the original 1.md / 2.md files. The functions repository includes the same immutable snapshot in functions/news-seed.json. The backend imports these only when upgrading the old schema, preserving any existing portal edits. The first authorized edit commits that upgrade atomically. A schema marker prevents archived/deleted posts from returning.

Markdown files, index.json, and data.js are historical backups, no longer read or merged by the app or portal. New files added here are not published.

Deploy dev functions before the updated frontend so the modular feed and editor API are available. No local migration command is needed.
