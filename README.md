# WIG Tracker

WIGs runs at `/wigs/` and uses only the `wigstracker` Firebase project. It does not use the main Teacher Tiles project's authentication, database, storage, or billing. The web app identifiers in `lib/firebase-config.ts` are intentionally public. Never add service-account credentials.

## Development and checks

- `pnpm install --frozen-lockfile`
- `pnpm dev`
- `pnpm build` — static website in `dist/`
- `pnpm test` — account routing and public-source checks
- `pnpm dlx firebase-tools emulators:exec --project demo-wigs-tests --only firestore "pnpm test:rules"` — isolated security-rule tests (Java required)

## Firebase console setup

In project **wigstracker**:

1. Authentication → Sign-in method → Google: enable it and choose the support email.
2. Authentication → Settings → Authorized domains: add `teachertiles.com`. Add `localhost` only for local development. Domains do not include `/wigs`.
3. Firestore Database: create a Standard database on Spark, choosing the desired region. Start in production mode, not test mode.
4. Publish `firestore.rules` and `firestore.indexes.json` with `pnpm dlx firebase-tools deploy --only firestore:rules,firestore:indexes --project wigstracker` after signing into the Firebase CLI. No Functions or Cloud Storage deployment is needed.

The project stays on Spark. Profile and answer pictures are re-encoded as small JPEGs (up to 24 KiB each) and stored in access-controlled Firestore documents, with picture fields excluded from indexes. Original photo metadata is discarded. Class data and photos never belong in Git.

## Accounts and permissions

Google sign-in is required. The Google pop-up opens from the Sign in button because browsers require a user gesture; dismissing it never grants access. Authentication lasts for the tab's browser session. WIGs uses a named Firebase app and memory-only Firestore caching.

Teachers see and manage only their own class. Add a student's Google email in the admin panel, or edit it later. A verified matching Google account opens that specific student automatically and cannot see the class roster, other students, or teacher controls. Unassigned accounts are teachers, as requested. A newly added/removed assignment changes the user's access on the next role snapshot. Each email can belong to only one student at a time; another teacher cannot overwrite that assignment.

Rules enforce access independently of the interface. Student records and matching email assignments are changed atomically. Students can create their own check-ins but cannot edit scores, questions, names, assignments, or existing responses. Teacher actions are scoped to the authenticated teacher's UID. The daily document ID prevents duplicate writes for the same date. Check-ins are self-reported; this is not an assessment or anti-cheating system.

## Publishing

The WIGs workflow builds this branch and copies **only `dist/`** to `/wigs/`, preserving the existing main and sandbox content. The corresponding combined workflows on `main` and `sandbox` must use this same WIGs build step before they deploy again, so they do not publish raw WIGs source or overwrite the built site. This task does not change those branches automatically.

Publish the Firestore rules before publishing the website. No Firebase configuration changes, database deployments, Git commits, or pushes are performed just by building locally.
