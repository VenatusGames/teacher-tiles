# WIG Tracker

WIGs runs at `/wigs/` and uses only the `wigstracker` Firebase project. It does not use the main Teacher Tiles project's authentication, database, storage, or billing. The web app identifiers in `lib/firebase-config.ts` are intentionally public. Never add service-account credentials.

Student profiles no longer collect email addresses or support separate Google student logins. Teachers use their own Google account and select a student for check-ins. Conversion removes old email fields and matching login-directory entries. Old directory access exists only for cleanup; it cannot grant class access or create new assignments.

The authoritative class record packs settings, students, questions, answers, and a completion-date index together. Repeated pictures/text are deduplicated, gzip-compressed, and AES-GCM encrypted. History is packed separately by calendar month. New students do not need separate profile or key documents. No class data or encryption keys are persisted to browser storage, and there is no five-minute refetch cycle.

For records that fit in one part, the tested document-read costs are:

| Operation | Reads |
| --- | --- |
| Cold load, including a fresh browser session | 2: class + shared key |
| Menu visits and today's completion checks | 0 |
| Settings, student, question, or answer edit | 1 |
| Submit a check-in | 2: class + month |
| Open a history page within one month | 1; repeated pages in that month use memory |

Large photo collections split into up to four bounded parts; each extra part costs one extra read when that bundle is needed. Pages spanning months read only the required months. Packed-path rules authorize by UID with no dependent document reads. Transaction retries can increase counts during concurrent edits. Class and history writes are atomic; edits use the current server record rather than overwriting from a stale tab. Changes from another device appear on page reload or Refresh from server.

Existing classes require one conversion that reads their scattered profiles, keys, questions, answers, and check-ins. The source layout is frozen, monthly archives are written, and the packed class is published last. Cleanup removes old source documents only after that commit and resumes if interrupted. Later loads never rescan the old collections. Student deletion similarly resumes archive cleanup after an interrupted purge. Existing keys are retained and never regenerated for encrypted data.

Publish firestore.rules and firestore.indexes.json immediately before the new frontend. The previous rules cannot write packed records; older frontends cannot edit a converted class and must reload. Conversion changes the authoritative storage format, so rolling the frontend back to the old format is not supported. Local tests touch only synthetic emulator data.

Validation: pnpm test, pnpm build, and pnpm dlx firebase-tools emulators:exec --only firestore --project demo-wigs-tests "node tests/firestore-rules.mjs". The emulator suite exercises the actual storage code, encryption, conversion, and transactions under these rules.

## Student access

Teachers can create one reusable no-login student link from **Admin > Student Access**. The URL stays the same after it is generated; class changes are republished behind the existing token. Students select their own profile, complete the daily poll once, and can then view that profile's history. A completed profile shows a checkmark for the current day. The student route never renders teacher/admin controls.

The deployed URL uses the existing WIGs path, for example `https://teachertiles.com/wigs/?student=<token>`, so no additional DNS record or Namecheap change is required. Student access does require the matching Firestore rules and indexes in this repository to be deployed to the `wigstracker` Firebase project:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project wigstracker
```

Because student access intentionally has no login, possession of the shared class link is the access credential. Anyone with that link can choose any published student profile and view that profile's check-in history.

