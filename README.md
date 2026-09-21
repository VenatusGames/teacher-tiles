# WIG Tracker

WIGs runs at `/wigs/` and uses only the `wigstracker` Firebase project. It does not use the main Teacher Tiles project's authentication, database, storage, or billing. The web app identifiers in `lib/firebase-config.ts` are intentionally public. Never add service-account credentials.

Student profiles no longer collect email addresses or support separate Google student logins. Teachers use their own Google account and select a student for check-ins. On the first full class load, the app removes old email fields and matching login-directory entries for that class. Old directory access exists only for cleanup; it cannot grant class access or create new assignments.

A successful class load saves an AES-GCM encrypted snapshot in sessionStorage for five minutes. No plaintext class data or encryption keys are persisted. Reloads in the same tab during that window fetch only the shared key (one document read); student keys and history load when needed. First loads, expired caches, storage-disabled/oversized caches, and the Refresh from server button perform a full fetch. Sign-out clears the snapshot. Changes from another device appear after cache expiry on the next load or immediately with Refresh from server.

Deployment must publish firestore.rules before the new frontend; the old rules require student email hashes and will reject the updated profile writes. Cleanup happens as each teacher opens their class, not as a database-wide purge. Run pnpm test, pnpm build, and the local Firestore emulator suite before publishing.

