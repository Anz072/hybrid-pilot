# Nouri Backend Migration — Compiled Report

**Period:** 27–29 August 2026
**Repos:** `hybrid-pilot` (React Native) · `nouri-api` (new backend)
**Commits:** 9 API · 4 mobile
**Status:** Code complete and locally verified. **Nothing is deployed.**

The React Native app no longer touches the Supabase Data API. All application
reads and writes go through a new Fastify service, and the database now refuses
direct client access outright.

---

## Scoreboard

| Metric | Value |
| --- | --- |
| Backend tests passing | **231** |
| API paths implemented | **26** |
| Direct Supabase CRUD calls left in the app | **0** |
| Mobile lines deleted | **6,782** |
| Mobile lines added | **2,823** |
| Secrets shipped to the client | **0** |

All verified locally. No Supabase project is provisioned and the API is not
deployed — see [§5 What is not verified](#5-what-is-not-verified).

---

## 1. What was built

| # | Item | Status |
| --- | --- | --- |
| 1 | **Backend repository and migration tooling** — sibling repo `nouri-api`, Supabase CLI pinned as a devDependency, three ordered migrations, a deterministic schema fingerprint script, and a live-vs-migrations drift checker. | ✅ Done |
| 2 | **Service foundation** — Fastify 5 on Node 22, TypeScript strict. Health/readiness probes, `/v1` namespace, Zod-validated environment, standard error envelope, correlation IDs, graceful SIGTERM, OpenAPI generated from the route schemas. | ✅ Done |
| 3 | **Authentication** — Supabase JWTs verified server-side via JWKS or legacy HS256: signature, `exp`, `iss`, `aud`, UUID `sub`. Distinct `AUTH_TOKEN_EXPIRED` code so the client can refresh instead of signing out. Email-only provider restriction preserved. Caller identity comes exclusively from the verified token subject — no `user_id` in a body or query is ever trusted. | ✅ Done |
| 4 | **RLS-scoped database layer** — one abstraction, `withUserDb`: acquire a pooled connection, `BEGIN`, inject verified claims transaction-locally, `SET LOCAL ROLE`, run, commit or roll back, release. Connections that cannot end their transaction are destroyed rather than reused. | ✅ Done |
| 5 | **Calorie diary domain** — `GET /v1/diary/:date` returns meals, entries, per-meal totals, day totals and goals in one response, replacing a 7-to-40 request fan-out. Plus a range endpoint, create/edit/delete, day copy with duplicate detection, and completion toggling. | ✅ Done |
| 6 | **Food search and providers** — catalogue, own and public recipes/meals, and USDA queried concurrently behind one normalized shape. Barcode lookups fall through to Open Food Facts and are promoted into the catalogue. A failing upstream degrades the search instead of failing it. | ✅ Done |
| 7 | **Remaining domains** — profile, settings, weight history, adaptive recommendation storage, favourites, recents, recipes and custom meals. Only domains that actually exist in the repo. | ✅ Done |
| 8 | **Database security boundary** — a restricted `nouri_app_backend` role (NOLOGIN, NOINHERIT, NOBYPASSRLS, NOSUPERUSER) that the API assumes per transaction, plus revocation of all table privileges from `authenticated` and `anon`. RLS remains enabled beneath as defence in depth. | ✅ Done |
| 9 | **Deployment scaffolding** — multi-stage non-root Dockerfile (79 MiB, built and run-verified), parameterised setup/deploy/rollback scripts, GitHub Actions CI, and a manual-only deploy workflow using Workload Identity Federation. | ✅ Done |

---

## 2. The API as it stands

```
GET               /healthz
GET               /readyz

GET               /v1/me
PATCH             /v1/me
PATCH             /v1/me/settings
PUT · DELETE      /v1/me/weight-goal

GET               /v1/diary                        (date range)
GET               /v1/diary/:date                  (complete day)
POST              /v1/diary/:date/entries
PATCH · DELETE    /v1/diary/entries/:id
POST              /v1/diary/:date/copy-from
PUT               /v1/diary/:date/complete

GET · POST        /v1/foods                        (batch by id · create)
GET               /v1/foods/search
GET               /v1/foods/:ref
GET               /v1/foods/barcode/:code

GET · POST · DEL  /v1/weights
DELETE            /v1/weights/:id

GET · POST        /v1/adaptive/recommendations
PATCH             /v1/adaptive/recommendations/:id

GET               /v1/library/favorites
PUT               /v1/library/favorites/:foodId
GET               /v1/library/recents
GET · POST        /v1/library/recipes
GET · PUT · DEL   /v1/library/recipes/:id
GET · POST        /v1/library/meals
PUT · DELETE      /v1/library/meals/:id
```

26 paths total.

---

## 3. Every Supabase dependency, and where it went

| Surface | Before | After | Destination |
| --- | ---: | ---: | --- |
| Table access `.from(` | 71 | **0** | Node API |
| RPCs `.rpc(` | 0 | 0 | *None existed* |
| Edge Functions | 0 | 0 | *None existed* |
| Storage | 0 | 0 | *Not used* |
| Realtime / channels | 0 | 0 | *Not used* |
| Supabase Auth | 11 | 11 | **Retained, direct** |
| USDA FoodData Central | 1 | **0** | Node API, key server-side |
| Open Food Facts | 1 | **0** | Node API |
| Client-side API secrets | 1 | **0** | Google Secret Manager |

### On the special-handling questions

The audit answered three of them immediately: there are **no RPCs, no Edge
Functions, and no Storage or Realtime usage anywhere in the repo**. Nothing was
migrated for architectural purity, because there was nothing to migrate.

Six client-side multi-step sequences did need transactional treatment. **Five
stayed in SQL.** Only the diary day-copy moved to Node, because its duplicate
detection is second-precision, timezone-aware business logic — and even there the
write itself is a single bulk statement.

### Files removed rather than left running in parallel

| File | Lines | Reason |
| --- | ---: | --- |
| `store/supabaseFoodStore.ts` | 2,549 | Replaced by `diaryStore` + `libraryStore` |
| `store/supabaseUserStore.ts` | 1,702 | Replaced by `userStore` |
| `API/OpenFoods/openFoodsEndpoints.ts` | 582 | Provider moved server-side |
| `API/USDA/usdaEndpoints.ts` | 345 | Provider moved server-side, key removed |
| `API/supabase/supabaseProfiles.ts` | 296 | Replaced by `/v1/me` |

---

## 4. Defects surfaced along the way

These were not part of the brief. They were found because moving logic
server-side forced it under test.

| Defect | Detail | Status |
| --- | --- | --- |
| **Non-atomic recipe edit** | The client updated a recipe, deleted all its ingredients, then re-inserted them — three un-transacted requests. A failure between the last two left a recipe with zero ingredients and stale per-serving macros. | ✅ Fixed |
| **Lost-update race on settings** | Settings were read, merged in JavaScript, and written back whole. Two concurrent partial edits silently clobbered each other. Now a column-level upsert. | ✅ Fixed |
| **Quick-add calories went stale on edit** | Editing a quick-add's macros did not re-derive its calories unless the energy had been manually overridden. Caught by a test written to assert the opposite. | ✅ Fixed |
| **Open Food Facts basis misread** | The adapter treated `"100g"` — the canonical basis marker — as a concrete serving size, flipping the basis and reading `*_serving` nutrients that such products do not publish. Macros came back null. Scaling was unaffected, so it was invisible. | ✅ Fixed |
| **Un-transacted diary cascade** | Writing an entry triggered three separate requests to un-complete the day, invalidate the adaptive timestamp and supersede the open recommendation. A crash mid-way left a "complete" day containing an unaccounted entry. | ✅ Fixed |
| **Serial N+1 on recents** | Up to ~36 sequential requests — one per food, three per recipe — inside a `for` loop. Now a single query with a lateral join. | ✅ Fixed |

### Two mistakes of my own, worth recording

**Data-modifying CTEs.** I first wrote supersede-then-insert as single statements
using CTEs. PostgreSQL does not guarantee one CTE observes another's effects, so
the insert still raced the unique index. Eight tests caught it. Now sequenced
inside the request transaction.

**Vacuous security tests.** The test fixture re-granted privileges to
`authenticated` *after* running migrations — so every boundary test would have
passed while proving nothing. The fixture now mirrors production exactly. This
was the most important catch in the whole migration.

---

## 5. What is not verified

This is the honest boundary of the work. Everything above was validated locally;
none of it has met a real Supabase project or a deployed service.

| Area | Status | Why |
| --- | --- | --- |
| Backend logic | ✅ Verified | 231 tests against a database rebuilt from the committed migrations on every run |
| Container image | ✅ Verified | Built and run: probes respond, non-root, clean SIGTERM, no token leakage in logs |
| Mobile compile | ✅ Verified | Typecheck and 21 unit tests pass |
| **Mobile runtime** | ❌ Unverified | No API deployed to point the app at; screen behaviour never exercised |
| **Migrations against real Supabase** | ❌ Unverified | `supabase link` has never been run; no project exists |
| **JWT claim shape** | ❌ Unverified | Derived from documentation, not from decoding a real token |
| **Cloud Run → Supabase latency** | ❌ Unverified | Probes are written; both ends need to exist first |

### Correction from earlier

I previously said the USDA key "shipped in every prior build" and needed urgent
rotation. Checking git history shows it **never entered version control**, and no
builds were distributed. Rotating it is optional hygiene, not an incident. It is
out of the app either way.

---

## 6. Deliberately not done

| Item | Rationale | Status |
| --- | --- | --- |
| **Supabase Auth was not proxied** | Out of scope by design. Routing sign-in through the API adds latency, complicates refresh, and buys nothing. The API verifies the token instead. | Retained |
| **The adaptive TDEE engine stayed on the device** | 573 lines of float maths with cascading thresholds. Its *data access* moved; the analysis did not. Porting it blind would silently change users' calorie targets — it needs a dual-run diff against real diary history first, and there is no history yet. | ⏸ Deferred |
| **The SQLite cache layer was kept** | It is not a Supabase dependency — it is the app's offline and perceived-performance layer, and it is more valuable now, not less. | Retained |
| **Good transactional SQL was left in SQL** | Triggers, generated columns, CHECK and partial-unique constraints, and the `SECURITY DEFINER` signup trigger all stayed in PostgreSQL. Node existing is not a reason to move them. | Retained |
| **Unused tables were not dropped** | `activities` and `custom_meal_items` have schemas and RLS policies but zero usage. Their cleanup was scoped out, so they remain — granted to the backend role so a future feature needs no privilege change. | Out of scope |
| **Redis was not introduced** | USDA search results get a small Postgres cache with a 1-hour TTL. Barcode hits are promoted into `food_items`, which is both cache and loggable record. Bulk-importing public food datasets was rejected: Open Food Facts alone is ~3M products, and nothing needs coverage of never-searched foods. | Rejected |
| **Speculative domains were not invented** | The brief listed subscriptions, entitlements and statistics as likely domains. None exist in this repository — the only "subscription" matches were auth and AppState listeners. | N/A |

---

## 7. What is left to do

| Task | Blocks | Detail |
| --- | --- | --- |
| **Provision a Supabase project** | Everything | Then `supabase link` and `db push`. Three migrations, no repair step needed. |
| **Choose the region pair** | Deployment | Pick the Supabase region first, then measure which Cloud Run region pairs fastest. All 17 Supabase regions probed; script and candidate table are ready. This is a decision, not a discovery. |
| **Create the GitHub repo for `nouri-api`** | CI | No remote exists yet, so CI cannot run. |
| **Deploy and smoke-test** | Mobile | Scripts deploy with `--no-traffic`, probe the tagged revision, then shift traffic. |
| **Point the app at the API and run it** | — | Set `EXPO_PUBLIC_API_BASE_URL`. First real exercise of every screen. |
| **Confirm real JWT claims** | — | Decode a live token; confirm `iss`, `aud`, `alg`, provider. The schema tolerates unknown claims, so this is confirmation, not a rewrite. |
| **Measure cold starts, then decide on min-instances** | — | Currently 0, deliberately. Locally: container start → first 200 was 750 ms, of which Node boot was 66 ms. Measure on Cloud Run before paying for an always-on instance. |
| **Client refresh on `AUTH_TOKEN_EXPIRED`** | — | Server contract is in place; the mobile side is not implemented. `autoRefreshToken` is still `false`. |
| **Port the adaptive engine** | Needs data | Requires a dual-run diff against real diary history, which does not exist yet. |

### Cheap now, expensive later

While there are no users, "never edit an applied migration" and
expand-then-contract do not bind. If you want the baseline's evolution artifacts
collapsed, or the two unused tables dropped, this is the least costly it will
ever be. Both were left alone because they were scoped out.

---

## Appendix — repository figures

**nouri-api**
- 51 source files, 7,556 lines
- 13 test files, 2,740 lines
- 3 migrations
- 3 architecture documents, 1,030 lines

**hybrid-pilot**
- 27 files changed, +2,823 / −6,782

### Related documents

- [`2026-08-27-current-state.md`](2026-08-27-current-state.md) — original dependency investigation
- [`2026-08-28-diary-and-foods-migration.md`](2026-08-28-diary-and-foods-migration.md) — diary + foods phase
- [`2026-08-29-final-migration-matrix.md`](2026-08-29-final-migration-matrix.md) — full dependency matrix
- `nouri-api/docs/architecture/auth-and-database-security.md` — auth and security model
- `nouri-api/docs/database/baseline-validation.md` — schema and migration state
- `nouri-api/docs/deployment/cloud-run.md` — deployment runbook

*Compiled 29 August 2026. All figures read from the repositories, not from memory.*
