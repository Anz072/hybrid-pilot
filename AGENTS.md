# AGENTS.md — hybrid-pilot

## Project context

This repository is the Nouri nutrition and weight-tracking mobile app, also
called Dribsnis in older documentation. The directory is `hybrid-pilot`.
It uses Expo SDK 54, React Native 0.81, React 19, strict TypeScript,
React Navigation, and Redux Toolkit. Check `package.json` for current versions.
The backend is the separate sibling repository [nouri-api](../nouri-api/AGENTS.md).

## Working agreements

- Inspect `git status --short` and the relevant diff before editing. Preserve
  existing staged, unstaged, and untracked work; never reset it to get a clean run.
- Follow existing code and tests. Older README and migration-report statements
  about SQLite, client-side adaptive analysis, and `.cjs` tests are superseded.
- Make routine implementation decisions and complete the requested work without
  repeated confirmation. Ask only when missing information materially blocks it.
- Keep changes focused. Update this file when commands or architecture change;
  put detailed explanations in `docs/` and link them here.
- Report what changed, what was checked, and any checks that could not run.
  Documentation-only edits need link and diff review, not application tests.

## Commands

Run these from this repository. Use npm and preserve `package-lock.json`;
`package.json` still advertises Yarn, but the checked-in lockfile and active
workflow use npm. Do not switch package managers as an incidental cleanup.

| Task | Command |
| --- | --- |
| Install from the lockfile | `npm ci` |
| Start Metro | `npm start` |
| Start Metro for a development build | `npm run start:dev-client` |
| Build/run Android | `npm run android` |
| Build/run iOS simulator | `npm run ios` |
| Typecheck | `npm run typecheck` |
| Normal verification after code changes | `npm test` |
| Run a focused test | `npx vitest run test/nutrition.test.ts` |
| Watch tests | `npm run test:watch` |

`npm test` runs typechecking followed by Vitest. `npm run lint` is an alias
for typechecking; it does not run ESLint. Native commands require the platform
toolchain. `prebuild:*:clean` regenerates native projects and can erase manual
native changes; use it only when regeneration is part of the task.

## Architecture and ownership

The normal data path is screens → `src/store/DB.ts` → feature stores →
`src/API/nouri/*Api.ts` → `src/API/nouri/client.ts` → `nouri-api`.
Supabase Auth is called directly through `src/API/supabase/`.

| Location | Responsibility |
| --- | --- |
| `src/screens/`, `src/navigation/` | Screens, navigation, route parameter types |
| `src/components/ui/`, `src/theme/` | Shared controls, typography, colors, spacing, motion |
| `src/store/DB.ts` | Screen-facing data facade and mutation notifications |
| `src/store/*Store.ts` | API-backed data access and adaptation to screen record shapes |
| `src/store/userSlice.ts`, `src/store/appStore.ts` | Redux session/bootstrap state |
| `src/domain/`, `src/engine/` | Domain vocabulary and pure calculations |
| `src/store/DB_TYPES.ts` | Compatibility record/input types and domain re-exports |
| `src/storage/`, `src/preferences/` | Device UI preferences and onboarding drafts |
| `test/` | Vitest logic, contract, lifecycle, and architecture checks |

- Supabase PostgreSQL through `nouri-api` is the only persistent application
  data store. Do not add SQLite, persistent food/diary/profile caches, offline
  mutation queues, local identities, or a development auth bypass.
- Device persistence is limited to UI preferences and pre-account onboarding
  drafts. Credentials belong in SecureStore. Process-lifetime render state and
  request coalescing are allowed; reset user-scoped state on sign-out/account change.
- Writes await the server and return its accepted values or throw. Emit data
  change notifications only after successful mutations. Preserve the `DB.ts`
  notification path so Home, Food Diary, and Weight refresh consistently.
- An API outage is an error/retry state. It must not sign out a valid Supabase
  session, mark hydration successful, or send an existing user to onboarding.
- Route backend requests through the shared client. Preserve one shared token
  refresh and one retry for `AUTH_TOKEN_EXPIRED`; do not retry arbitrary failed
  mutations or treat every 401 as an expired token.
- Keep pure domain and engine code independent of React, navigation, storage,
  and API modules. Define vocabulary in `src/domain/types.ts`; keep existing
  `DB_TYPES.ts` re-exports compatible while callers still use them.
- Adaptive TDEE analysis and recommendation creation run on the backend at
  `POST /v1/adaptive/refresh`. The mobile app retains target application and
  presentation calculations; do not restore a second adaptive analysis engine.

## Changes spanning both repositories

- Read the sibling `AGENTS.md` before changing backend code. These are separate
  Git repositories with separate package managers and verification commands.
- Inspect backend route schemas and `../nouri-api/docs/api/openapi.json` before
  changing DTOs or request fields. Keep mobile adapters aligned with the API.
- `../nouri-api/conformance/domain-conformance.json` is authoritative; this
  repository's copy is a byte-identical mirror. For intentional shared-rule
  changes, edit the backend corpus, then run `pnpm conformance:sync` and
  `pnpm conformance` from `../nouri-api`. Review both copies and checksums.
- Verify affected behavior in both repositories. Preserve date-key/timezone,
  nutrition basis, aggregate rounding, and synthetic food-ID semantics. A
  matching checksum proves agreement, so use independently reasoned cases for
  correctness. Keep backend-only suite exclusions explicit in the mobile runner.

## UI conventions

- Reuse `src/components/ui/` and `src/theme/` tokens before adding local controls
  or literal colors, spacing, and font styles. Match neighboring screens.
- Current styling uses warm paper surfaces, ink text, a lingonberry accent,
  section rules and hairlines, and tabular dynamic numbers. Newsreader is used
  for editorial headings; IBM Plex Sans for body, controls, and numbers.
- Read `.interface-design/system.md` when present; its leading direction update
  supersedes its older body. This file is Git-ignored, so committed theme code
  and `docs/design/` must also be sufficient in a fresh checkout.
- Preserve accessible labels/roles, usable touch targets, safe areas, keyboard
  handling, and reduced-motion behavior. Include loading, empty, error, and
  disabled states when changing an interaction.
- For screen changes, exercise the affected flow on an available simulator or
  device. Node tests do not verify native rendering or interaction.

## Local environment and testing

- Use `.env.example` as the configuration reference. Keep secrets out of source
  and logs. `EXPO_PUBLIC_*` values ship in the app; USDA and privileged backend
  credentials stay on the server.
- Supabase Auth and the API must use the same environment. For the local stack,
  start Supabase and the API from `../nouri-api`; use `127.0.0.1` on iOS Simulator,
  `10.0.2.2` on Android Emulator, and the host's LAN address on a physical device.
  Do not hardcode a developer's LAN address into source.
- Tests live in `test/**/*.test.ts` and run in Node with explicit Vitest imports.
  Use `vi.mock` and reset modules where singleton state matters. Do not restore
  the removed `scripts/*.test.cjs` loader or hide checks with exclusion globs.
- Add focused regression coverage for changed domain, auth, or data behavior.
  Run `npm test` after code changes; distinguish failures already present in the
  working tree from regressions introduced by the task.
- The manual token-refresh check is opt-in:
  `RUN_MANUAL_E2E=1 npx vitest run test/manual/tokenRefreshE2E.test.ts`.
  Read that file's local-stack and short JWT-expiry setup first, and restore the
  prior configuration afterward. Its default skip is not an end-to-end pass.
- Log API error code, status, and request ID using existing helpers; do not log
  tokens, request bodies, diary contents, or other personal data.

## Reference map

- [Remote-only data](docs/architecture/remote-only-data.md)
- [Adaptive calories and backend ownership](docs/architecture/adaptive-calories.md)
- [Mobile testing](docs/architecture/mobile-testing.md)
- [Domain conformance](docs/architecture/domain-conformance.md) — its older
  client-only adaptive section is superseded by the adaptive document above.
- [Local architecture verification](docs/backend-migration/2026-08-30-final-local-architecture.md)

Treat historical test counts and deployment claims as dated evidence. Check
current code, configuration, and runtime state before relying on them.
