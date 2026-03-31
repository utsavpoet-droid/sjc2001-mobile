# TDD — API contract alignment (mobile)

**Repository:** `/Users/utsavsrivastava/sjc2001-mobile` (local path; remote URL is whatever you use for `sjc2001-mobile`).

This document describes **test-driven behavior** for aligning the app with the backend contract (dual bases: `/api/v1` for auth/push, `/api` for content). Implementation lives in feature modules when present; **pure wire helpers** live in `src/lib/api/wire-alignment.ts` with automated tests in `wire-alignment.test.ts`.

## Red → Green scope

| Area | Behavior to lock with tests |
|------|-----------------------------|
| Story author | Numeric `memberUserId` / `memberId` become strings; optional `avatarUrl`. |
| Reactions POST | `{ liked, count }` maps to `{ likedByMe, reactionCount }`; legacy keys still work. |
| Upload POST | `{ publicUrl }` or `{ url }` maps to `{ url }` for compose. |
| Member list/search | `name` → `display_name`; `photoUrl` or `photos[0].photoUrl` → `avatar_url`. |

## Integration tests (when HTTP layer exists)

- **Logout:** `POST` to v1 logout includes JSON `{ refreshToken }` from secure storage; `clearSession` calls logout before wiping storage.
- **Content client:** Comments, reactions, upload use **content** base (`/api/...`), not v1.
- **Stories list:** Response `{ stories, total }` is normalized (author ids, booleans, counts).

## How to run

```bash
npm run typecheck
npm test
```

Unit tests use **`ts-jest`** in **Node** (`jest.config.js`) so pure mappers run without the native runtime. **`jest-expo`** remains optional for component tests later.

`typecheck` is `"tsc --noEmit"` in `package.json`.

## Traceability

- Backend handoff: `docs/codex-backend-handoff-prompt.md` (prompt for backend audit).
- Contract routes: `shared/contracts/api-routes.ts` when that module exists in the branch.
