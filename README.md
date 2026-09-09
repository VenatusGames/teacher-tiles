# WIG Tracker

WIGs runs at `/wigs/` and uses only the `wigstracker` Firebase project. It does not use the main Teacher Tiles project's authentication, database, storage, or billing. The web app identifiers in `lib/firebase-config.ts` are intentionally public. Never add service-account credentials.

## Development and checks

- `pnpm install --frozen-lockfile`
- `pnpm dev`
- `pnpm build` — static website in `dist/`
- `pnpm test` — account routing, Web Crypto encryption, storage/migration behavior, and public-source checks
- `pnpm dlx firebase-tools emulators:exec --project demo-wigs-tests --only firestore "pnpm test:rules"` — isolated security-rule tests (Java required)

## Firebase console setup

In project **wigstracker**:

1. Authentication → Sign-in method → Google: enable it and choose the support email.
2. Authentication → Settings → Authorized domains: add `teachertiles.com`. Add `localhost` only for local development. Domains do not include `/wigs`.
3. Firestore Database: create a Standard database on Spark, choosing the desired region. Start in production mode, not test mode.
4. Publish `firestore.rules` and `firestore.indexes.json` with `pnpm dlx firebase-tools deploy --only firestore:rules,firestore:indexes --project wigstracker` after signing into the Firebase CLI. No Functions or Cloud Storage deployment is needed.

The project stays on Spark. Profile and answer pictures are re-encoded as small JPEGs (up to 24 KiB each), then encrypted inside access-controlled Firestore documents. Ciphertext and vault keys are excluded from indexes. Original photo metadata is discarded. Class data, photos, and generated keys never belong in Git.

## Encryption and migration

The browser uses AES-256-GCM with a fresh random 96-bit IV for every write. The Firebase project, schema version, and full document path are authenticated with each ciphertext, so moving a payload to another record fails decryption. Settings, question/answer content, student names, emails, images, scores, response timestamps, and response items are encrypted before writing. Full replacements remove old plaintext fields; plaintext writes are denied by the new rules.

A random shared class key protects settings/questions/answer choices. Every student has a separate random key for their profile and responses. These immutable keys live in `classes/{owner}/keys` and are fetched into browser memory after Google sign-in. Rules permit teachers to retrieve their own class keys and students to retrieve only the shared key and their own student key. There is no extra password, bundled key, Analytics, Cloud Storage, or external backend. Deleting a student retains the orphaned key to avoid losing a response that races with deletion; no removed student can fetch it through the app rules. Never manually delete a key for data you need to retain.

This matches the original Teacher Tiles trust model: database administrators who can read both ciphertext and key documents can decrypt the data. It is not end-to-end encryption against the Firebase project administrator. Firestore must retain opaque owner/student IDs, record paths (including check-in dates), and permission metadata. Student email lookup IDs use SHA-256 rather than readable addresses; these hashes are guessable from a known email and are not encryption. Firebase Authentication continues to manage Google account details separately, outside Firestore.

After publishing the new rules and app, each teacher must open their class once. The app converts existing accessible records, removes the legacy email assignment documents, and marks the class ready by encrypting its root last. Students wait for their teacher to finish this first migration. Interrupted migrations resume; missing keys or decryption failures stop loading rather than creating replacement data. Old open app versions can no longer write plaintext and must reload. Migration covers the active class records, not database backups/exports or unrelated manually created documents. Dormant teachers' records stay in the old format until their class is opened.

The local encryption tests use real Web Crypto and an in-memory Firestore adapter; they do not prove deployed rule enforcement. The separate emulator suite covers rule enforcement, student key isolation, plaintext rejection, assignment changes, and migration. Run that suite before production rollout. Verify the live rules and inspect the converted class after deployment; a local build does not encrypt existing server data.

## Firestore usage

Form edits remain local until Save/Add (or Enter submitting a form). Name blur, picture selection/removal, and schedule checkbox changes do not save automatically. Leaving an admin section discards its unsaved drafts. Deletes are explicit actions. Student answer selections stay in React memory; the app saves one encrypted response only after every active question has a valid answer. Incomplete surveys perform no submission reads or writes, and the daily transaction prevents duplicate completions. Initial class setup, encryption-key creation, and legacy migration remain necessary automatic writes.

Immutable encryption keys are reused in tab memory for the current account and role. Class sections and history reads are reused for up to 30 seconds, with simultaneous requests sharing the same pending read. Local writes invalidate only affected sections; changes from another device may take up to that cache window to appear on a subsequent load. Account/role changes and sign-out clear cached records and keys. Nothing is added to persistent browser storage.

The two assignment listeners remain active to enforce account routing and legacy migration. Their server-confirmed results are consumed directly, without duplicate transaction reads or reloading the class when the role is unchanged. Editing a student's profile no longer rewrites an unchanged email assignment. Opening history still reads the requested history on its first load; large histories and the initial encryption migration can generate substantial usage. Security-rule dependent reads also contribute to Firestore usage and are not included in the local request-count tests.

## Accounts and permissions

Google sign-in is required. The Google pop-up opens from the Sign in button because browsers require a user gesture; dismissing it never grants access. Authentication lasts for the tab's browser session. WIGs uses a named Firebase app and memory-only Firestore caching.

Teachers see and manage only their own class. Add a student's Google email in the admin panel, or edit it later. A verified matching Google account opens that specific student automatically and cannot see the class roster, other students, or teacher controls. Unassigned accounts are teachers, as requested. A newly added/removed assignment changes the user's access on the next role snapshot. Each email can belong to only one student at a time; another teacher cannot overwrite that assignment.

Rules enforce access independently of the interface. Student records and matching hashed email assignments are changed atomically. Students can create their own check-ins but cannot edit scores, questions, names, assignments, or existing responses. Teacher actions are scoped to the authenticated teacher's UID. The daily document ID prevents duplicate writes for the same date. Rules validate encryption envelopes and permissions; because content is encrypted, they cannot validate the survey answers inside them. Check-ins are self-reported; this is not an assessment or anti-cheating system.

## Publishing

The WIGs workflow builds this branch and copies **only `dist/`** to `/wigs/`, preserving the existing main and sandbox content. The corresponding combined workflows on `main` and `sandbox` must use this same WIGs build step before they deploy again, so they do not publish raw WIGs source or overwrite the built site. This task does not change those branches automatically.

Publish the Firestore rules before publishing the website. No Firebase configuration changes, database deployments, Git commits, or pushes are performed just by building locally.
