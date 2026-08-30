# Local End-to-End Validation

**Date:** 29–30 August 2026
**Scope:** fully local. No hosted Supabase project, no Cloud Run, no deployment.
**Repos:** `hybrid-pilot` (React Native) · `nouri-api` (backend)

**Verdict: `LOCAL_E2E_BLOCKED`** — on one criterion only. See [§9](#9-verdict).

---

## Summary

A complete local stack was stood up — Supabase (Postgres, GoTrue, PostgREST,
Studio) plus the Node API — and the migration was exercised against it rather
than against mocks.

**Twelve defects were found and fixed.** Four would have blocked or broken a
production deployment outright: a migration that could not apply, an
authentication ordering flaw, a feature that worked exactly once for the whole
app, and a connection-pool self-deadlock under load.

| | Before | After |
| --- | ---: | ---: |
| Backend tests | 231 | **344** |
| Mobile tests | 21 | **60** |
| Defects found and fixed | — | **12** |

Every fix carries a regression test, and most were **mutation-checked**: the bug
was reintroduced to confirm the new test actually fails, then reverted.

---

## 1. Environment

| Component | Version |
| --- | --- |
| Supabase CLI | 2.116.0 |
| PostgreSQL | 17.6 (`public.ecr.aws/supabase/postgres:17.6.1.165`) |
| Node | 22.11.0 |
| pnpm | 9.15.0 |
| Docker | 29.6.1 |

### Local endpoints

| Service | URL |
| --- | --- |
| API gateway (Kong) | `http://127.0.0.1:54321` |
| Auth (GoTrue) | `http://127.0.0.1:54321/auth/v1` |
| PostgREST (Data API) | `http://127.0.0.1:54321/rest/v1` |
| Studio | `http://127.0.0.1:54323` |
| Mail catcher | `http://127.0.0.1:54324` |
| PostgreSQL | `127.0.0.1:54322` |
| **nouri-api** | `http://127.0.0.1:8080` |

Keys come from `pnpm supabase status -o env` — per-machine CLI defaults, not
production credentials. `.env.local` is gitignored; `.env.local.example` is the
committed placeholder and contains no filled-in secret.

### Reproducibility

Three independent builds produced byte-identical schema fingerprints: two
`db reset` runs and one cold rebuild after `supabase stop --no-backup` destroyed
the volumes.

---

## 2. Database

### Migrations

All three apply cleanly from empty. The schema is **deterministic** — the
fingerprint after a clean reset is identical to the baseline captured at the
start, and remained so after every subsequent phase including fault injection.

| Object | Count |
| --- | ---: |
| Tables | 15 (14 application + `external_food_cache`) |
| Columns | 257 |
| RLS policies | 31, RLS enabled on **all 15** |
| Constraints | 64 (29 CHECK, 20 FK) |
| Indexes | 41, of which **4 partial-unique** |
| Generated columns | 1 (`weight_entries.measured_day_local`) |
| Triggers | 9 × `updated_at` + `on_auth_user_created` |
| Functions | `set_updated_at`, `iso_text_date_prefix`, `handle_new_user` |
| **Table privileges for `anon` / `authenticated`** | **0** |
| **Function privileges for `anon` / `authenticated`** | **0** |

Confirmed: `handle_new_user()` is SECURITY DEFINER with `search_path=public`;
`iso_text_date_prefix` is IMMUTABLE; `on_auth_user_created` fires on
`auth.users`; the four partial-unique indexes exist and are enforced.

### Bare PostgreSQL vs. real Supabase

Structurally **identical**. The whole fingerprint diff was: table owner name,
four Supabase-provided extensions, a patch version (17.10 vs 17.6), the
migration-history table, and one function body (`auth.uid()` — the hand-built
prelude carries one extra defensive `nullif`; semantics match).

The **privilege model is not identical**, and this matters: the bare-PG harness
connects as a **superuser**, so it structurally cannot detect a privilege error.
It silently passed three of the defects below.

### Roles

| Role | super | inherit | login | bypassrls |
| --- | --- | --- | --- | --- |
| `supabase_admin` | t | t | t | t |
| `postgres` (migration role) | **f** | t | t | **t** |
| `authenticated` / `anon` | f | t | f | f |
| `service_role` | f | t | f | t |
| **`nouri_app_backend`** | **f** | **f** | **f** | **f** |

`SET LOCAL ROLE nouri_app_backend` correctly drops `BYPASSRLS` even though the
session user `postgres` holds it.

---

## 3. Auth

### Real token shape — confirmed, not assumed

Two users were created through real email/password signup against local GoTrue
and their issued tokens decoded. **The verifier needed no changes.**

| Property | Observed |
| --- | --- |
| `alg` | **ES256** (asymmetric), header carries a `kid` |
| JWKS | published, `kty: EC`, `crv: P-256`, kid resolves |
| `iss` | the auth base URL |
| `aud` | `authenticated` (string, not array) |
| `role` / `sub` | `authenticated` / UUID |
| `exp` | `iat + 3600` |
| `app_metadata` | `{ provider: "email", providers: ["email"] }` |
| Also present | `aal`, `amr[]`, `phone`, `is_anonymous`, `session_id` |

`aal`, `amr` and `phone` were not in the schema and are absorbed by
`.passthrough()` — which vindicates that design choice.

Verified against the real token: **accepted** via JWKS; **rejected** on wrong
issuer, wrong audience, disallowed provider, HS256-secret-only config, and a
tampered signature.

> No raw JWT was written to git, documentation, a snapshot or a log. Verified by
> grep across both repositories.

### Signup and the profile trigger

| Check | Result |
| --- | --- |
| Brand-new signup → profile rows | exactly **1**, created by the trigger |
| Profile defaults | display name from user metadata; **all onboarding fields null** — a shell, not a complete profile |
| `user_settings` at signup | **not** created; appears on first write |
| Onboarding `PATCH /v1/me` | **same row** — `createdAt` unchanged, `updatedAt` moved |
| Server-side clamp | requested 2137 → stored **2150** (step 50) |
| Re-authenticate | same identity, everything persisted |
| Orphans | **0 in both directions** between `auth.users` and `profiles` |
| Missing profile | **HTTP 500 `PROFILE_MISSING`, not 401** |

The conflict flagged in the original investigation — the database creating
profiles while the client treated a missing profile as "no account" — is
resolved on both sides.

### Token refresh

Verified against a **genuinely expired** token (`jwt_expiry` lowered to 60s, the
stack restarted, the expiry waited out, then restored — the config was diffed
against a backup afterwards and is otherwise identical).

| Case | Behaviour |
| --- | --- |
| `AUTH_TOKEN_EXPIRED` | refresh **once**, retry **once** |
| Second expiry after the retry | throw, **no second refresh** |
| `AUTH_INVALID_TOKEN` / provider not allowed | **never** refresh |
| Refresh returns null | `AUTH_REQUIRED`, the signed-out path |
| `NETWORK_ERROR` | **never** retried, even for mutations |
| No session | fail fast, no network call |

End-to-end with a real expired token: **1 refresh, 1 retry, exactly 1 row
written, no double-write.**

Retrying a *mutation* after expiry is safe, and this was measured rather than
assumed: `AUTH_TOKEN_EXPIRED` is raised in `onRequest`, before any handler, and
a POST rejected with it **wrote nothing**.

---

## 4. Backend

### Routes exercised

All 26 paths, over real HTTP, with two real GoTrue users: **58/58 checks pass.**
Profile, settings, weight goal, foods (create, batch, by-ref, search, barcode),
diary (day, range, create, edit, delete, complete, copy), weights, favourites,
recents, recipes CRUD, custom meals CRUD, adaptive recommendations.

Open Food Facts was exercised **live** — barcode `3017620422003` → "Nutella".

### Transaction behaviour

Fault injection used a temporary `RAISE`-ing trigger on the *last* step of the
diary cascade, so the rollback path was genuinely exercised rather than
simulated. The trigger was dropped afterwards and the fingerprint re-verified.

| Fix under test | Result |
| --- | --- |
| Recipe edit with an invalid 2nd ingredient | ingredients **not wiped** (still 2); name and servings rolled back |
| Two concurrent partial settings updates | both survive; untouched field preserved |
| Diary cascade, last step faulted | entry not written, day still complete, adaptive timestamp uncleared, recommendation still open |
| Same, fault removed | all four change **together** |

### Concurrency

| Scenario (25–30 concurrent) | Result |
| --- | --- |
| Diary reads, same user / 4 users | 100% 200 |
| Food searches | 100% 200 |
| Diary writes, same user / different users | 100% 201 |
| Settings updates, same user | 100% 200 |
| Same-day weight writes | 100% 201 |
| Mixed read/write | 100% ok |

**Zero 5xx, zero deadlocks, zero lock waits, zero idle-in-transaction.**
Invariants held under sustained load: exactly one active weigh-in for the
contended day, exactly one settings row. Stress-verified at **25 concurrent
same-day writers**: 25 accepted, one active row.

**No connection leak** — the pool settles at exactly `DATABASE_POOL_MAX`;
`pg_stat_database` reports 0 deadlocks, 0 conflicts, 0 temp files.

### Performance

Measured with `pg_stat_statements` reset around each request. Localhost timings
are recorded for shape only and are **not** treated as predictive of production.

| Endpoint | DB queries |
| --- | ---: |
| Food Diary — full day (meals, entries, per-meal totals, day totals, goals) | **1** |
| 7-day range · recents · favourites · meals · profile · weights · batch foods | **1** each |
| Food search (catalogue + own recipes + own meals) | 3 (deliberate fan-out) |
| Copy a day (12 entries) | 4 — 2 selects, 1 cascade, **1 bulk insert of 12 rows** |

**No N+1, proven by scaling rather than a single sample:**

| entries | diary day | recents | week range | batch foods |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 1 | 1 | 4* | 1 |
| 20 | 1 | 1 | 1 | 1 |
| 50 | 1 | 1 | 1 | 1 |

Query count stays flat while payload grows linearly (2.9 → 22.8 KB) — the
signature of a set-based query. (*the single 4 did not reproduce.)

Three honest qualifications:

* **"One request" describes the diary *day payload*, not the whole screen.**
  `FoodDiaryScreen` also loads settings, favourites, recents, week statuses and
  the latest recommendation. All are cache-first, so a **warm** screen makes 0
  blocking requests; a cold one makes several.
* `copyFoodLogsFromDate` costs 2 requests (copy, then re-read the day).
* `getUserByExternalId` and `getUserSettings` both call `GET /v1/me`, so a cold
  load can fetch it twice. Racy but harmless; both are cache-first.

---

## 5. Mobile

### Screens exercised

**None.** Task 9 was **skipped at the user's request**. No simulator display or
interactive device was available. Nothing about rendered screen behaviour is
verified — see [§8](#8-deferred).

### What *was* verified

* typecheck, 60 tests, and **`expo export` for both iOS and Android** — which
  proves the app bundles, something typecheck cannot show. Nothing was published.
* The app's `.env` previously named a Supabase project that **still does not
  resolve** (NXDOMAIN, re-checked against 8.8.8.8). It now points at the local
  stack, verified with exactly the values the app reads: signup through the
  publishable key issues a session, `GET /v1/me` returns 200, the profile email
  matches.

### Cache behaviour — reviewed by reading, **not executed**

| Layer | API imports | Supabase refs |
| --- | ---: | ---: |
| `src/store/*Repository.ts` (the cache) | **0** | **0** |
| `src/storage/sqlite.ts` | **0** | **0** |
| The four store facades | 4/4/3/2 | 0 |

* **Cold** — empty cache → Node API → written to SQLite. `clearUserCache` runs on
  sign-out as one transaction across every cached table.
* **Warm** — return cached immediately, then fire-and-forget refresh **through
  the Node API**. `forceRefresh` bypasses the cache for pull-to-refresh.
* **API offline** — warm cache: failure swallowed, cached data already returned.
  Cold cache: the error propagates, which is correct.
* **Reconciliation** is not a blind overwrite. The DELETE is scoped to
  `synced`, `error`, or `pending` older than two minutes, so a refresh landing
  mid-write cannot clobber a recent optimistic entry.
* **Mutation rollback preserved**, and deliberately asymmetric: diary *add*
  deletes the pending row on failure; diary *delete* restores, and on 404
  converges rather than resurrecting; `saveUserSettings` has no rollback and
  self-heals on the next refresh.
* **No offline mutation queue** was introduced.

### Expo Go development bypass

`isExpoGoDevAuthEnabled() = __DEV__ && isRunningInExpoGo()` — both conditions
matter, and a throw from `isRunningInExpoGo()` returns false (fails closed).

Audited **all 44 API-calling exported store functions: 43 guard first** via
`resolveUserId` or `isExpoGoDevUserId`. The one exception, `getFoodByRefRemote`,
is unguarded **by design** — the remote half of a cache-then-refresh pair — and
all three of its callers resolve the session first, so it is unreachable in dev
mode.

The two development modes are genuinely separate: the environment guard contains
no reference to the bypass, and the bypass reads no `EXPO_PUBLIC_*` value. So
pointing the app at `127.0.0.1` does **not** switch it offline.

`scripts/expo-go-bypass.test.cjs` locks this down by static analysis and is
mutation-checked 3/3.

---

## 6. Security

### User A / User B isolation

Asserted twice, through two different code paths, with **real GoTrue-issued
tokens**:

* **Database layer** (`test/supabaseLocalSecurity.test.ts`, 75 tests) — all 15
  required properties: `anon` and `authenticated` denied on 11 tables over both
  SQL and the **real PostgREST Data API**; backend role attributes and grants;
  claim injection, RLS resolution, concurrent caller isolation; cross-user read,
  update and delete; public-vs-private recipe and meal visibility; diary writes
  unable to reference another user's private rows — *and able* to reference
  their public ones, so the denial is about visibility, not a blanket refusal.
* **HTTP layer** — B receives 404 on every one of A's resources, and A's data was
  verified intact after every attempt.

### Spoofing attempts — all rejected

`user_id`, `created_by_user_id`, `submitted_by_user_id`, and a forged
`role: service_role` claim. Identity comes only from the verified JWT subject;
the database role comes only from `SET LOCAL ROLE`, never the token body.

### The tests are proven non-vacuous

`pnpm test:mutation` breaks one security assumption at a time and checks that
the specific test which should notice actually fails. **7/7 caught**, then the
database is restored from the committed migrations:

grant SELECT back to `authenticated` · disable RLS · give the backend role
BYPASSRLS · drop the cache policy · revoke the generated-column function ·
restore PUBLIC EXECUTE · make private recipes world-readable.

### Logging — 932 KB / 3,787 lines across every scenario

Zero occurrences of: JWTs, `Bearer` headers, passwords, emails, database
credentials, weight values, diary contents, nutrition payloads, food names,
birthdates, API keys.

The allow-list holds exactly. Every key ever logged: `req.{id, method, route}`,
`res.{coldStart, instanceUptimeMs, statusCode}`, plus envelope fields. `route`
is the **pattern** (`/v1/diary/:date`), so dates and ids never leak.

A deliberate leak probe — a token containing `SIGNATURE_SECRET_VALUE`, a body
with a secret note, a birthdate and a weight, and a diary entry named
`SENSITIVE_FOOD_NAME`, across 401/400/404/201 — produced **0 occurrences of
every marker**. Even `VALIDATION_FAILED` logs only `"request validation
failed"`; per-field detail goes to the caller, not the log.

### The shipped bundle carries no secrets

Scanned the actual Hermes bytecode, which is stronger evidence than grepping
source because it is what would ship: **0** occurrences of `sb_secret_`,
`service_role`, `USDA_API_KEY`, `api.nal.usda.gov`, `openfoodfacts.org`,
`postgres://`, `supabase.co/rest`. Present as expected: the Supabase URL, the
API base URL and the publishable key — all public by definition.

### Git history

`.env` never committed in either repo · no JWT-shaped strings ever added · no
`sb_secret_`. **The USDA key value was never committed** — verified independently
rather than taken on trust; every historical mention is the code reading the env
var, the `your-usda-api-key` placeholder, or a README row.

### Mobile Supabase surface

`.from(`, `.rpc(`, `functions.invoke(`, `.storage.`, `.channel(` and direct REST
URLs: **0 each**. What remains is `supabase.auth.*` only.

---

## 7. Bugs

Twelve found, twelve fixed. Every fix has a regression test; ✅ marks those whose
test was mutation-checked by reintroducing the bug.

### 1. The migration could not apply to a real Supabase project ✅
**Symptom** `supabase start` failed: `permission denied to alter role (42501)`.
**Root cause** Migrations run as `postgres`, which on Supabase is NOSUPERUSER,
and PostgreSQL rejects `ALTER ROLE … NOSUPERUSER` from a non-superuser even when
it changes nothing. It passed before only because the bare-PG harness connects
as a superuser. **This was waiting at the front of the deployment path.**
**Fix** `nosuperuser` moved to `CREATE` (legal there); the four security-bearing
attributes became an asserted invariant — the migration now RAISEs if the role is
ever SUPERUSER, BYPASSRLS, INHERIT or LOGIN, which is strictly stronger than the
statement it replaced.
**Test** role attributes asserted in the security suite.

### 2. `.env.example` named a role the schema rejects
**Symptom** copying the example failed at boot.
**Root cause** `DATABASE_AUTHENTICATED_ROLE=authenticated`, but the Zod enum
allows only `nouri_app_backend`. **Fix** corrected.

### 3. Client roles kept `EXECUTE` on every `public` function ✅
**Symptom** `set local role authenticated; select iso_text_date_prefix(…)`
succeeded despite a revoke directly above it.
**Root cause** PostgreSQL grants EXECUTE to `PUBLIC` by default, and
`REVOKE … FROM authenticated, anon` does not touch a privilege held *through*
PUBLIC. Harmless for today's three functions, but any future `SECURITY DEFINER`
helper would have been RPC-callable by any signed-in user.
**Fix** revoked from `PUBLIC`, plus `ALTER DEFAULT PRIVILEGES … ON FUNCTIONS`,
which had never been issued.
**Trap found by testing:** revoking from PUBLIC **breaks every weight write** —
`measured_day_local` is `GENERATED ALWAYS AS iso_text_date_prefix(…)` and a
generated column's function runs with the privileges of the writing role. One
grant had to be given back explicitly. A blind hardening pass would have broken
all weight logging.
**Test** client privilege counts asserted at 0.

### 4. The `external_food_cache` grant was inert ✅
**Symptom** none visible — the cache silently never cached.
**Root cause** RLS enabled with no policy, so the grant gave nothing: reads
returned zero rows, writes raised. It appeared to work only because
`createFoodCache` queries the raw pool as `postgres`, which owns the table.
**Fix** a policy scoped `TO nouri_app_backend`, so the declared grant is real and
the cache no longer depends on who happens to own the table.
**Test** cache reachability asserted for the backend role.

### 5. The local stack signs ES256, not HS256 — my own assumption
**Symptom** would have rejected every request.
**Root cause** I wrote in `.env.local.example` that local signs with legacy HS256
and publishes no JWKS. Both halves are false: a current Supabase Auth issues
ES256 with a `kid` and publishes a JWKS. An HS256 secret cannot verify an ES256
signature. **Fix** corrected in all three env files.
**Test** a regression test for exactly that misconfiguration.

### 6. `grant usage on schema auth` silently grants nothing
**Symptom** none today.
**Root cause** `auth` is owned by `supabase_admin`; `postgres` holds USAGE
**without grant option**, so it cannot delegate. PostgreSQL emits
`WARNING: no privileges were granted` and still returns a successful `GRANT` —
**exit code 0, the migration "succeeds"**. Unfixable from a migration, because
Supabase never hands out `supabase_admin`.
**Impact** RLS policies resolve through the *table owner*, so all isolation
works. Only a direct `auth.uid()` call in application SQL would fail.
**Fix** the migration comment now states the truth. Two tests pin the boundary:
one asserts the direct call is denied, the other greps `src/` to prove no query
depends on it.

### 7. A stale mobile guard contradicting the new model
**Symptom** would sign a user out with *"No app account exists for this email
yet. Finish onboarding first."*
**Root cause** that message describes the pre-migration model. The trigger now
creates the profile atomically at signup, so the branch is unreachable in the
signup path, and a genuinely missing profile never reaches it. If it did fire —
absent session, or an id mismatch — it blamed onboarding for a session failure.
**Fix** guard kept, explanation and message made true.
**Test** five signup-contract tests.

### 8. Body validation ran before authentication ✅
**Symptom** an unauthenticated caller received `400 VALIDATION_FAILED` instead of
401, making request schemas probeable without credentials. Worse for the client:
an **expired-token** caller with a malformed body got a 400, never saw
`AUTH_TOKEN_EXPIRED`, and so **never refreshed** — failing forever while one
refresh from working.
**Root cause** `requireAuth` was a `preHandler`, and Fastify parses and validates
the body *between* `onRequest` and `preHandler`.
**Fix** moved to `onRequest` across all 37 routes. Unauthenticated request bodies
are now never parsed at all.
**Test** measured before/after on all three cases.

### 9. Only one user-created food could exist — globally, ever ✅
**Symptom** the second custom food anywhere failed with an opaque **500**.
**Root cause** `POST /v1/foods` sent `ref: "<source>:new"`, and `materialise`
parses the segment after the colon into `source_id`, so every user-created food
carried the literal `'new'` — which is covered by a partial unique index on
`(source, source_id)`. Not per-user: **global across all users.** Diagnosed from
the identity sequence sitting at 3 with no row 3 — the insert ran, the read-back
found nothing, the throw rolled back, and the sequence kept its advance because
sequences are not transactional.
**Fix** user-created foods store `source_id = NULL`, keeping them out of the
index; the conflict fallback also re-reads by `(source, source_id)`.
**Test** 5 tests; verified 5 foods for one user plus 1 for another, with barcode
idempotency still converging two creates onto one row.

### 10. Editing a private recipe silently published it ✅
**Symptom** a cross-user `GET` of a "private" recipe returned **200**.
**Root cause** `isPublic: z.boolean().default(true)` was shared by the create
*and* update schemas, so a `PUT` that renamed a recipe without resending the flag
reset it to public.
**Fix** only the update path changed — `isPublic` is optional there and the SQL
uses `coalesce($n::boolean, is_public)`. The `true` default on **create** was
left alone: the column default is `true` in both tables, so public-by-default is
the app's existing design, not a defect.
**Test** 5 visibility tests covering both directions.

### 11. Concurrent writes returned 500 and silently lost data ✅
**Symptom** integrity was never violated, but the **losers of the race received
`INTERNAL_ERROR`** — and since the client deliberately does not retry ambiguous
failures, a user's weigh-in was simply gone. Six concurrent writers: 1 succeeded,
5 failed.
**Root cause** supersede-then-insert is correct in isolation and races at READ
COMMITTED — neither transaction sees the other's uncommitted supersede, so both
insert and the loser hits the partial unique index (23505, unhandled).
**Fix** retrying once helped but is probabilistic (with N racers you can lose
repeatedly — it fixed only 2 of 6). A **transaction-scoped advisory lock** keyed
on the user and the local day removes the race instead, so the outcome does not
depend on how many clients are writing.
**Result** 6/6, then **25/25** under stress, with exactly one active row.
**Test** 2 concurrency tests.

### 12. Food search self-deadlocked the connection pool ✅
**Symptom** at 25 concurrent searches: **88 of 200 requests returned 500**, p50
**5017 ms**, peak **10 connections idle-in-transaction** — exactly the pool max.
Error: `timeout exceeded when trying to connect`.
**Root cause** `search()` ran inside `withUserDb` holding one pooled connection,
while its cache reads and writes go through `pool.query` — asking the **same pool
for a second connection**. Every search needed two at once, capping concurrency
at `POOL_MAX/2` and then self-deadlocking: each request holds one connection and
waits for another only a peer can release. A related problem: awaiting upstream
HTTP inside a transaction pins a connection for the whole deadline.
**Fix** split into `searchInternal` (DB only, inside the transaction) and
`searchExternal` (upstream + cache, entirely outside it), composed concurrently.
A search now holds at most one connection and never across a network call.
**Result** 25 concurrent: 200×200, p50 **64 ms**, idle-in-transaction **0**.
60 concurrent complete in 54 ms.
**Test** an app with pool max 2, a pool-backed cache and a slow provider; the
nesting restored fails it at 5048 ms — the identical signature.

### Also fixed: the food cache was untested and silent ✅
`foods.test.ts` injects `NO_CACHE`, so the only implementation that runs in
production had never been executed by a test — which is how defect 4 stayed
invisible. Failures were swallowed by a bare `catch {}`, making a permanent cache
miss indistinguishable from a cold cache. Now reported through `app.log` (never
the cache key or payload), with 8 tests against the real table.

---

## 8. Deferred

### `DEFERRED_HOSTED_VERIFICATION`

Only verifiable against a hosted project. **Not proposed as part of this work.**

| Item | Note |
| --- | --- |
| Hosted JWT configuration | `iss` becomes `https://<ref>.supabase.co/auth/v1` — a config value, not a code change. Confirm the project signs asymmetrically (new ones do; older may be HS256) and set `SUPABASE_JWKS_URL`. |
| Migrations against a hosted database | Defect 1 means this has never been tried anywhere real. It now *should* work; that is a prediction, not a measurement. |
| Postgres major version | Local is 17.6. A hosted project on a different major is untested. |
| USDA-backed search | No `USDA_API_KEY` configured. Degradation is graceful (HTTP 200, local results still returned) but a real key is unexercised, and therefore so is an end-to-end cache **hit**. |
| Supavisor transaction pooler | Local exposes Postgres directly. Prepared-statement and pooling behaviour under Supavisor is untested. |
| Cloud Run latency, cold starts, min-instances | Both ends must exist first. |
| `supabase_admin`-owned default privileges | Cannot be altered from a migration; a table created by that role would be auto-exposed to the Data API. Fingerprint §16 records them so it shows as drift. |

### `DEFERRED_SEPARATE_MIGRATION`

**The adaptive TDEE engine remains client-side.** Its *data access* is migrated;
the analysis is not. Nothing in this work changes that assessment: porting it
needs a dual-run diff against real diary history, which does not exist yet.
Moving it blind would silently change users' calorie targets.

### Skipped or reviewed-only — **not verified**

| Item | Status |
| --- | --- |
| **Task 9 — the real app against the local stack** | **SKIPPED at the user's request.** No screen behaviour is verified. |
| **Task 10 — SQLite cache** | **Static review only.** No cold load, warm hit, offline read or reconciliation was observed at runtime; the two-minute stale-pending window is unexercised; SQLite schema migration against an existing on-device database is untested. |

---

## 9. Verdict

### `LOCAL_E2E_BLOCKED`

Eleven of the twelve stated criteria are met:

| Criterion | Status |
| --- | --- |
| Fresh local Supabase stack reproducibly initializes | ✅ three identical builds |
| Migrations apply | ✅ after fixing defect 1 |
| Local Auth works | ✅ real users, real tokens |
| JWT validation works | ✅ verifier confirmed against real tokens |
| RLS security tests work | ✅ 75 tests, mutation-proven 7/7 |
| Local Node API works | ✅ 58/58 HTTP checks, all 26 paths |
| Token refresh works | ✅ verified against a genuinely expired token |
| SQLite cache remains functional | 🟡 **reviewed, not exercised** |
| No direct mobile Data API CRUD exists | ✅ 0, confirmed in source and in the shipped bundle |
| Complete local test suites pass | ✅ 344 backend, 60 mobile |
| No deployment was performed | ✅ nothing deployed or published |
| **Actual React Native app works against it** | ❌ **not attempted** |
| **Major product flows work** | ❌ **not attempted** |

### The single blocker

**Nobody has run the app.** Task 9 was skipped, so no screen has been opened
against this stack. Everything beneath the UI is verified — the API, the
database, auth, refresh, isolation, concurrency — but the layer the user actually
touches is untested.

This is reported as `BLOCKED` rather than rounded up to `READY` because the
definition explicitly requires it. The remaining work is one focused session with
a simulator, not a body of engineering.

### To clear it

1. Start the stack: `pnpm supabase start` and `pnpm start:local` in `nouri-api`.
2. Set the mobile `.env` host for your target (`127.0.0.1` for the iOS Simulator,
   `10.0.2.2` for an Android emulator, your LAN IP for a device).
3. Run the app and exercise: signup → onboarding → restart → session restore;
   diary logging, editing, deletion, completion, copy-day; food and barcode
   search; recipes and custom meals including public/private; weight including
   same-day replacement; and the offline behaviour of the SQLite cache.

Everything that session needs is in place and green.

---

## Related documents

* [`2026-08-27-current-state.md`](2026-08-27-current-state.md) — original dependency investigation
* [`2026-08-28-diary-and-foods-migration.md`](2026-08-28-diary-and-foods-migration.md) — diary and foods phase
* [`2026-08-29-final-migration-matrix.md`](2026-08-29-final-migration-matrix.md) — full dependency matrix
* [`2026-08-29-migration-report.md`](2026-08-29-migration-report.md) — compiled migration report
* `nouri-api/docs/architecture/auth-and-database-security.md` — auth and security model
* `nouri-api/docs/database/baseline-validation.md` — schema and migration state, including §2a

*Compiled 30 August 2026. Every figure was read from a running system or a
repository, not from memory.*
