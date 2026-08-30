# Nouri Backend Migration — Compiled Report

**Period:** 27–30 August 2026
**Repos:** `hybrid-pilot` (React Native) · `nouri-api` (new backend)
**Commits:** 22 API · 11 mobile
**Status:** Code complete, locally exercised end to end. **Nothing is deployed.**

The React Native app no longer touches the Supabase Data API. All application
reads and writes go through a new Fastify service, and the database now refuses
direct client access outright.

Since the first edition of this report the whole stack has been stood up locally
— Supabase plus the API — and the migration exercised against it rather than
against mocks. **Twelve defects were found and fixed**, four of which would have
blocked or broken a production deployment. See
[§4 Defects](#4-defects-found-and-fixed) and the
[local E2E validation report](2026-08-29-local-e2e-validation.md).

---

## Scoreboard

| Metric | First edition (29 Aug) | Now (30 Aug) |
| --- | ---: | ---: |
| Backend tests passing | 231 | **358** |
| Mobile tests passing | 21 | **60** |
| API paths implemented | 26 | **26** |
| Direct Supabase CRUD calls left in the app | 0 | **0** |
| Defects found and fixed | — | **12** |
| Secrets shipped to the client | 0 | **0** (verified in the built bundle) |

Mobile migration diff: **46 files, +6,361 / −6,855**.

Locally verified end to end. No Supabase project is provisioned and the API is
not deployed — see [§5 What is not verified](#5-what-is-not-verified).

---

## 1. What was built

| # | Item | Status |
| --- | --- | --- |
| 1 | **Backend repository and migration tooling** — sibling repo `nouri-api`, Supabase CLI pinned as a devDependency, three ordered migrations, a deterministic schema fingerprint script, and a live-vs-migrations drift checker. | ✅ Done |
| 2 | **Service foundation** — Fastify 5 on Node 22, TypeScript strict. Health/readiness probes, `/v1` namespace, Zod-validated environment, standard error envelope, correlation IDs, graceful SIGTERM, OpenAPI generated from the route schemas. | ✅ Done |
| 3 | **Authentication** — Supabase JWTs verified server-side via JWKS or legacy HS256: signature, `exp`, `iss`, `aud`, UUID `sub`. Distinct `AUTH_TOKEN_EXPIRED` code so the client can refresh instead of signing out. Email-only provider restriction preserved. Caller identity comes exclusively from the verified token subject — no `user_id` in a body or query is ever trusted. | ✅ Done |
| 4 | **RLS-scoped database layer** — one abstraction, `withUserDb`: acquire a pooled connection, `BEGIN`, inject verified claims transaction-locally, `SET LOCAL ROLE`, run, commit or roll back, release. Connections that cannot end their transaction are destroyed rather than reused. | ✅ Done |
| 5 | **Calorie diary domain** — `GET /v1/diary/:date` returns meals, entries, per-meal totals, day totals and goals in one response, replacing a 7-to-40 request fan-out. Plus a range endpoint, create/edit/delete, day copy with duplicate detection, and completion toggling. | ✅ Done |
| 6 | **Food search and providers** — catalogue, own and public recipes/meals, and USDA queried concurrently behind one normalized shape. Barcode lookups fall through to Open Food Facts and are promoted into the catalogue. A failing upstream degrades the search instead of failing it. Since restructured so the upstream call runs outside the database transaction — see defect 12. | ✅ Done |
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

## 4. Defects found and fixed

Twelve. None were part of the brief; all were found by moving logic under test
and then running it against a real stack. Every fix carries a regression test,
and ✅ marks those whose test was **mutation-checked** — the bug reintroduced to
confirm the test actually fails, then reverted.

### Found during the migration itself

| Defect | Detail |
| --- | --- |
| **Non-atomic recipe edit** | Update → delete-all → re-insert as three un-transacted requests. A failure between the last two left a recipe with zero ingredients and stale macros. |
| **Lost-update race on settings** | Settings read, merged in JavaScript, written back whole. Two concurrent partial edits silently clobbered each other. Now a column-level upsert. |
| **Quick-add calories went stale on edit** | Editing macros did not re-derive calories unless energy was manually overridden. Caught by a test written to assert the opposite. |
| **Open Food Facts basis misread** | The adapter treated `"100g"` — the canonical basis marker — as a concrete serving size, reading `*_serving` nutrients such products do not publish. Macros came back null; scaling was unaffected, so it was invisible. |
| **Un-transacted diary cascade** | Three separate requests to un-complete the day, invalidate the adaptive timestamp and supersede the recommendation. A crash mid-way left a "complete" day containing an unaccounted entry. |
| **Serial N+1 on recents** | ~36 sequential requests inside a `for` loop. Now one query with a lateral join. |

### Found by running it locally, end to end

Four of these would have blocked or broken production. The recurring lesson: the
bare-PostgreSQL test harness connects as a **superuser**, so it structurally
could not detect three of them.

| # | Defect | Why it mattered |
| --- | --- | --- |
| 1 ✅ | **The migration could not apply as a non-superuser** | `ALTER ROLE … NOSUPERUSER` is rejected for any non-superuser, and Supabase runs migrations as `postgres`. **This was sitting at the front of the deploy path** and had never worked anywhere real. |
| 2 | `.env.example` named a role the schema rejects | Copying the example failed at boot. |
| 3 ✅ | **Client roles kept `EXECUTE` on every `public` function** | PostgreSQL grants EXECUTE to `PUBLIC` by default, which `REVOKE … FROM authenticated, anon` does not touch. Any future `SECURITY DEFINER` helper would have been RPC-callable by any signed-in user. **Revoking it also broke every weight write** — a generated column's function runs as the *writing* role — so one grant had to be given back explicitly. A blind hardening pass would have broken all weight logging. |
| 4 ✅ | The `external_food_cache` grant was inert | RLS enabled with no policy: reads returned nothing, writes raised. It only appeared to work because the cache queries the pool as the table owner. |
| 5 | The local stack signs **ES256**, not HS256 | My own assumption, written into `.env.local.example`. An HS256 secret cannot verify an ES256 signature. |
| 6 | `grant usage on schema auth` silently grants nothing | PostgreSQL warns and still returns a successful `GRANT` — **exit code 0**. Unfixable from a migration. No impact: RLS resolves through the table owner. |
| 7 | Stale mobile profile guard | Still signed users out with *"Finish onboarding first"* — the pre-migration model. |
| 8 ✅ | **Body validation ran before authentication** | An expired-token client with a malformed body got a 400, **never saw `AUTH_TOKEN_EXPIRED`, and so never refreshed** — failing forever while one refresh from working. Also made request schemas probeable without credentials. |
| 9 ✅ | **Only one user-created food could exist — globally, ever** | A placeholder `source_id` of `'new'` collided with a partial unique index. The second custom food *anywhere* failed with an opaque 500. Diagnosed from an identity sequence sitting at 3 with no row 3. |
| 10 ✅ | **Editing a private recipe silently published it** | `isPublic` defaulted to `true` on a schema shared by create and update, so a rename republished it. Found because a cross-user GET returned 200. |
| 11 ✅ | **Concurrent writes returned 500 and lost data** | Integrity held, but losers of the race got `INTERNAL_ERROR` — and the client deliberately does not retry ambiguous failures, so a weigh-in was simply gone. Fixed with an advisory lock; retrying alone was probabilistic and fixed only 2 of 6. |
| 12 ✅ | **Food search self-deadlocked the connection pool** | Each search held one pooled connection while asking the same pool for a second. At 25 concurrent: **88 of 200 requests returned 500**, p50 5017 ms. An outage, not a slowdown. |

### Three mistakes of my own, worth recording

**Data-modifying CTEs.** I first wrote supersede-then-insert as single statements
using CTEs. PostgreSQL does not guarantee one CTE observes another's effects, so
the insert still raced the unique index. Eight tests caught it.

**Vacuous security tests.** The test fixture re-granted privileges to
`authenticated` *after* running migrations — so every boundary test would have
passed while proving nothing. The fixture now mirrors production. This was the
most important catch of the whole migration.

**Orchestration in controllers.** During the E2E work I put a transaction-retry
wrapper and a search composition into route handlers, because each was the
smallest correct fix at the time. Both were tested. Both were wrong, and both
have since been moved into services — see §8.

---

## 5. What is not verified

The honest boundary. Much of what this section listed on 29 August has since
been verified against a real local stack; what remains is genuinely blocked.

| Area | Status | Evidence |
| --- | --- | --- |
| Backend logic | ✅ Verified | 358 tests against a database rebuilt from the committed migrations on every run |
| **Migrations against real Supabase** | ✅ Verified *locally* | Applied to the Supabase CLI stack — which is how defect 1 was found. Three identical builds; fingerprint deterministic |
| **JWT claim shape** | ✅ Verified | Real users signed in against local GoTrue, tokens decoded. The verifier needed no changes — see defect 5 |
| **Token refresh** | ✅ Verified | Against a genuinely expired token: one refresh, one retry, exactly one row written |
| **Security model** | ✅ Verified | 75 tests over the real Data API and SQL, plus 7/7 mutation-proven |
| **Concurrency** | ✅ Verified | 8 scenarios at 20–30 concurrent: zero 5xx, zero deadlocks, no connection leak |
| Container image | ✅ Verified | Built and run: probes respond, non-root, clean SIGTERM exit 0 |
| Mobile build | ✅ Verified | Typecheck, 60 tests, `expo export` for iOS **and** Android; the shipped Hermes bundle contains **zero** secrets |
| **Mobile runtime** | ❌ **Unverified** | **Nobody has run the app.** No screen has been opened against this stack — see below |
| SQLite cache behaviour | 🟡 Reviewed, not exercised | Read and traced; no cold load, warm hit or offline read observed at runtime |
| **Hosted Supabase** | ❌ Unverified | No project provisioned. Postgres major version, Supavisor pooling and the hosted JWT config are untested |
| **USDA-backed search** | ❌ Unverified | No API key configured. Degradation is graceful by design, but a real key — and therefore an end-to-end cache hit — is unexercised |
| **Cloud Run → Supabase latency** | ❌ Unverified | Probes written; both ends must exist first |

### The one blocker

The local end-to-end exercise met **eleven of twelve** stated criteria. The
exception: *"the actual React Native app works against it."* That step was
skipped by request, so everything beneath the UI is verified — API, database,
auth, refresh, isolation, concurrency — but the layer a user touches is not.

Recorded as `LOCAL_E2E_BLOCKED` rather than rounded up to ready. It is one
focused simulator session, not a body of engineering.

### Correction from earlier

I previously said the USDA key "shipped in every prior build" and needed urgent
rotation. Git history shows it **never entered version control** — re-verified
independently during the security pass — and no builds were distributed.
Rotating it is optional hygiene, not an incident.

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
| **Run the app against the local stack** | The `LOCAL_E2E_READY` verdict | The single remaining blocker. Everything it needs is running and green; the checklist is in the [E2E report §9](2026-08-29-local-e2e-validation.md). |
| **Provision a Supabase project** | Deployment | Then `supabase link` and `db push`. Three migrations, no repair step. Defect 1 means this has never been tried against a real project — it *should* now work, which is a prediction, not a measurement. |
| **Choose the region pair** | Deployment | Pick the Supabase region, then measure which Cloud Run region pairs fastest. All 17 regions probed; script and candidate table ready. A decision, not a discovery. |
| **Create the GitHub repo for `nouri-api`** | CI | No remote exists, so CI cannot run. |
| **Deploy and smoke-test** | — | Scripts deploy with `--no-traffic`, probe the tagged revision, then shift traffic. |
| **Add a USDA API key** | Food search | Without it, external search degrades gracefully to local results — correct, but the upstream path and its cache are unexercised. |
| **Measure cold starts, then decide on min-instances** | — | Currently 0, deliberately. Locally: container start → first 200 was 750 ms, of which Node boot was 66 ms. |
| **Port the adaptive engine** | Needs data | Still requires a dual-run diff against real diary history, which does not exist yet. |

**Done since the first edition:** client refresh on `AUTH_TOKEN_EXPIRED` (was
listed here; `autoRefreshToken` is now `true`, with single-flight refresh and
retry-exactly-once) and confirming the real JWT claim shape.

### From the structure review

A [structure review](../architecture/2026-08-30-structure-review.md) ranked
fourteen findings. Three are worth carrying here:

| Finding | Why it is on this list |
| --- | --- |
| **Domain logic is implemented twice** — nutrition, calorie targets and meal slots exist independently in both repos with nothing detecting drift | The only finding that can put a **wrong number in front of a user** with both test suites green. Fix is a shared conformance fixture, half a day. |
| **The mobile app has no domain layer** | Domain types live in `store/DB_TYPES.ts` (52 importers), producing 8 layer cycles. Mostly type-only, so the fix is to move the types and nothing else. |
| **Mobile tests are `.cjs` behind a transpile loader** | This is *why* store-layer integration testing was too expensive to attempt, and therefore why the runtime blocker above is still open. |

### Cheap now, expensive later

While there are no users, "never edit an applied migration" and
expand-then-contract do not bind. If you want the baseline's evolution artifacts
collapsed, or the two unused tables dropped, this is the least costly it will
ever be. Both were left alone because they were scoped out.

---

## 8. Structure work since the first edition

Three of six backend modules had no service layer and went routes → repository
directly. Nothing failed, which is why it went unnoticed — but domain rules had
drifted into HTTP handlers. The clearest case: the adaptive controller decided
that a status of `accepted` implies `respondedAt = now`, a rule reachable only
through a request with a live database behind it.

All six domains now have a service; no route imports its own repository. The
extracted rule became `deriveRecommendationPatch(input, now)` — pure,
clock-injectable, and covered by seven unit tests that could not previously have
been written.

`test/architecture.test.ts` enforces the layering by reading the source, and is
mutation-checked. The convention is documented in
`nouri-api/docs/architecture/module-layering.md`, with `health` and `foods`
recorded as **named** exceptions rather than silent ones.

---

## Appendix — repository figures

**nouri-api**
- 55 source files, 8,269 lines
- 12 test files, 4,057 lines — **358 tests**
- 3 migrations
- 4 architecture and database documents
- 22 commits

**hybrid-pilot**
- 46 files changed, **+6,361 / −6,855**
- 9 test files, 1,177 lines — **60 tests**
- 11 commits

### Related documents

| Document | What it covers |
| --- | --- |
| [`2026-08-27-current-state.md`](2026-08-27-current-state.md) | Original dependency investigation |
| [`2026-08-28-diary-and-foods-migration.md`](2026-08-28-diary-and-foods-migration.md) | Diary + foods phase |
| [`2026-08-29-final-migration-matrix.md`](2026-08-29-final-migration-matrix.md) | Full dependency matrix |
| [`2026-08-29-local-e2e-validation.md`](2026-08-29-local-e2e-validation.md) | **Local end-to-end validation** — all twelve defects in full, with symptom, root cause, fix and test |
| [`../architecture/2026-08-30-structure-review.md`](../architecture/2026-08-30-structure-review.md) | **Structure review** — fourteen ranked findings across both repos |
| `nouri-api/docs/architecture/auth-and-database-security.md` | Auth and security model |
| `nouri-api/docs/architecture/module-layering.md` | Backend layering convention, enforced by test |
| `nouri-api/docs/database/baseline-validation.md` | Schema and migration state, incl. §2a defects |
| `nouri-api/docs/deployment/cloud-run.md` | Deployment runbook |

*First compiled 29 August 2026; revised 30 August after the local end-to-end
exercise. All figures read from the repositories, not from memory.*
