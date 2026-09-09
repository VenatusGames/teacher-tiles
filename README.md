# WIG Tracker

Student check-ins, lead measures, and progress history. Intended path: `/wigs/`.

## Development

- `pnpm install --frozen-lockfile`
- `pnpm dev` — local development
- `pnpm build` — production build
- `pnpm typecheck` — TypeScript checks
- `pnpm test` — empty-database and production-access checks

The app uses React, Vite/vinext, Tailwind, and five shared UI components.
Local database and image storage currently use Cloudflare D1/R2 emulation. `db/runtime.ts` initializes the schema and generic question choices, with no student records. Keep these adapters until the Firebase replacement is connected.

## Sign-in and publishing

There is no login, password, or session system. Firebase/Google authentication is the next step. Local development opens the admin panel directly. Production API access is disabled until verified authentication and authorization are implemented; this is a temporary development restriction, not authentication.

This checkout tracks `origin/wigs`. Nothing is published by the development commands. The current GitHub Pages workflow cannot run the app's server routes. Finish the Firebase integration and deployment setup before pushing to publish; the main and sandbox workflows also need coordinated updates.

## Private files

Student databases, uploaded images, local settings, and generated builds are ignored by Git. Never commit student data or secrets. No remote database or storage account is connected by this source.
