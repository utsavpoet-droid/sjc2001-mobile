# Mobile ↔ backend alignment

## What exists in this repo

- **`src/lib/api/`** — `bases`, `envelope`, `errors`, `client` (`requestV1Json` vs `requestContentJson`).
- **`src/features/auth/api/auth-api.ts`** — login (`identifier`), refresh/logout (`refreshToken`), `me` (Bearer **access**).
- **`src/features/push/api/push-api.ts`** — register/unregister with `expoPushToken` + Bearer.
- **`src/features/content/api.ts`** — stories, gallery, members, comments, reactions, upload (Bearer for authed routes).
- **`src/lib/api/wire-alignment.ts`** — pure mappers (stories, members, reactions, upload `proxyUrl || publicUrl`).
- **`shared/contracts/api-routes.ts`** — versionless paths only.
- **`shared/auth/mobile-contract.ts`** — auth types.

## Still missing (not in repo)

- **Secure token storage** (e.g. `expo-secure-store`) and **session hydration** wiring auth-api into UI.
- **Zustand/React Query** hooks for screens (tabs, directory, stories, gallery) — shell components exist without data layer.
- **Sign-in screen** wired to `postMobileLogin` (currently `sign-in.backup.tsx`).
- **E2E / integration tests** against a real server.

## Env

- `EXPO_PUBLIC_API_BASE_URL` — must end with `/api/v1`.
- `EXPO_PUBLIC_API_CONTENT_BASE_URL` — optional; if unset, derived by stripping `/v1` from the v1 base.
