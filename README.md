# WIG Tracker

WIGs runs at `/wigs/` and uses only the `wigstracker` Firebase project. It does not use the main Teacher Tiles project's authentication, database, storage, or billing. The web app identifiers in `lib/firebase-config.ts` are intentionally public. Never add service-account credentials.

