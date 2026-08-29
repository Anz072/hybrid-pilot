# Final Supabase Migration Matrix

**Date:** 2026-08-29 · **Status:** data-access cutover complete
**Supersedes the open items in** [2026-08-27-current-state.md](2026-08-27-current-state.md)

---

## 1. Final client architecture

```
Supabase Auth          → RETAINED (direct)
Supabase Storage       → NOT USED (nothing to retain)
Supabase Realtime      → NOT USED (nothing to retain)
Supabase Data API      → NO direct application CRUD. Zero exceptions.
```

Verified by search across `src/`:

| Pattern | Before | After |
| --- | --- | --- |
| `.from(` | 71 | **0** |
| `.rpc(` | 0 | 0 |
| `functions.invoke(` | 0 | 0 |
| `.storage.` | 0 | 0 |
| `.channel(` / Realtime | 0 | 0 |
| Direct Supabase REST URLs | 0 | 0 |
| Generated DB clients | 0 | 0 |
| Supabase SDK calls remaining | — | **`auth.*` only** (7 call sites) |

Client-side external API secrets: **none**. `EXPO_PUBLIC_USDA_API_KEY` was
removed in the previous phase; only the Supabase URL, the publishable key (public
by design) and the API base URL remain.

---

## 2. Migration matrix — every original dependency

### 2.1 Tables

| Table | Original client access | Final destination | Endpoints |
| --- | --- | --- | --- |
| `profiles` | 2 direct calls | **Node API** | `GET/PATCH /v1/me` |
| `user_settings` | 3 | **Node API** | `PATCH /v1/me/settings` |
| `weight_goals` | 4 | **Node API** | `PUT/DELETE /v1/me/weight-goal` |
| `weight_entries` | 6 | **Node API** | `GET/POST/DELETE /v1/weights` |
| `adaptive_calorie_recommendations` | 5 | **Node API** | `/v1/adaptive/recommendations` |
| `user_food_entries` | 13 | **Node API** | `/v1/diary/*` |
| `user_diary_days` | 4 | **Node API** | `/v1/diary/:date/complete` |
| `user_food_favorites` | 4 | **Node API** | `/v1/library/favorites` |
| `custom_recipes` | 10 | **Node API** | `/v1/library/recipes` |
| `custom_recipe_ingredients` | 3 | **Node API** | folded into recipe endpoints |
| `custom_meals` | 7 | **Node API** | `/v1/library/meals` |
| `custom_meal_items` | 0 (unused) | **Retained, unused** | — |
| `food_items` | 10 | **Node API** | `/v1/foods*` |
| `activities` | 0 (unused) | **Retained, unused** | — |

`custom_meal_items` and `activities` have tables, indexes and RLS policies but
zero application usage. They are **not dropped** — out of scope, as instructed —
and are granted to the backend role so a future feature does not need a
privilege change.

### 2.2 RPCs

**There are none, and there never were.** The audit found zero `supabase.rpc(`
call sites. No classification is required.

Six *client-side multi-step sequences* did need transactional treatment. Per the
instruction not to move good transactional SQL into Node simply because Node
exists, each was evaluated on its merits:

| Sequence | Decision | Rationale |
| --- | --- | --- |
| Diary mutation cascade | **SQL, one statement** | Three correlated updates over one user's rows |
| Weight same-day supersede | **SQL, sequenced in one transaction** | Guards a partial unique index |
| Adaptive supersede + insert | **SQL, sequenced in one transaction** | Guards a partial unique index |
| Recipe create + ingredients | **SQL, one transaction** | Replaces a compensating delete |
| Recipe update + ingredient replace | **SQL, one transaction** | Could previously half-apply |
| Copy diary day | **Node + bulk SQL insert** | Dedupe is second-precision, timezone-aware business logic; the *write* is one statement |

> A note on technique: these were first written as single statements using
> data-modifying CTEs. That was wrong. PostgreSQL does not guarantee one CTE
> observes another's effects, so `supersede`-then-`INSERT` still raced the unique
> index. The integration tests caught it. They are now sequenced statements
> inside the request transaction — the transaction, not the statement, is the
> atomicity boundary.

### 2.3 Edge Functions

**None exist.** Nothing to evaluate. If one is added later it must justify its
existence against the Node API, which now covers every application concern.

### 2.4 Storage and Realtime

**Neither is used.** Zero `.storage.` and zero `.channel(` call sites, and the
database has no `storage` schema and no `supabase_realtime` publication (both
asserted by tests). Nothing was migrated "for purity" because there was nothing
to migrate. The revocation migration documents that if either is adopted, its
tables must be granted explicitly and excluded from the revocation.

### 2.5 SQL functions, triggers, views, constraints

All **retained in PostgreSQL**, unchanged:

| Object | Decision |
| --- | --- |
| `handle_new_user()` (SECURITY DEFINER, on `auth.users`) | **Retained.** Atomic with the auth insert — Node cannot match that. Sole creator of profile rows. |
| `set_updated_at()` + 9 triggers | **Retained.** Free, atomic, unbypassable. |
| `iso_text_date_prefix()` | **Retained.** Backs a generated column and a partial unique index. Cannot move. |
| `measured_day_local` generated column | **Retained.** |
| All CHECK / UNIQUE / partial-unique / FK constraints | **Retained.** |
| RLS policies (30) | **Retained and still enforced.** |

### 2.6 External integrations

| Integration | Before | After |
| --- | --- | --- |
| USDA FoodData Central | Direct from app, key in bundle | **Node API**, key server-side |
| Open Food Facts | Direct from app | **Node API** |

### 2.7 Client-side business rules

| Rule | Destination |
| --- | --- |
| Nutrition scaling / rounding | **Ported to backend**, still also used client-side for previews |
| Meal-slot grouping | **Backend** (timezone supplied by client) |
| Copy dedupe | **Backend** |
| Search ranking | **Backend** |
| Calorie clamp (800–7000, step 50) | **Backend, now enforced** — was unenforceable |
| Recipe per-serving nutrition | Client computes, backend stores |
| Adaptive TDEE engine (573 lines) | **Still client-side** — see §5 |

---

## 3. Security: the backend is now the data boundary

### 3.1 Restricted role

`nouri_app_backend` (migration `20260829090000`):

* `NOLOGIN` — reachable only via `SET ROLE` from the pooled connection
* `NOINHERIT` — holds exactly what is granted, nothing more
* `NOBYPASSRLS`, `NOSUPERUSER` — RLS still decides **rows**; the role only
  widens which **tables** are reachable
* `food_items` granted `SELECT, INSERT` only, matching the RLS model (no UPDATE
  or DELETE policy exists)

### 3.2 Client privilege revocation

The same migration revokes all table, sequence and function privileges in
`public` from `authenticated` and `anon`, and revokes default privileges so
future tables do not silently re-grant.

This is stated as one migration rather than a phased cutover because the app has
no users and no deployed client does direct CRUD — there is nothing to
transition. Once the app ships, a future privilege change *would* need phasing.

Explicitly unaffected: Supabase Auth (GoTrue owns `auth`), `handle_new_user()`
(SECURITY DEFINER, runs as owner), and `service_role` (break-glass, retained).

### 3.3 Proof

`test/security-boundary.test.ts` asserts all five required properties:

| # | Property | Evidence |
| --- | --- | --- |
| 1 | Valid API call succeeds | Alice reads her profile, writes a diary entry |
| 2 | Cross-user API call fails | Bob sees an empty diary, gets 404 deleting Alice's entry |
| 3 | Direct Data API access fails | 14 tables × SELECT and × write, as `authenticated`; plus `anon`; plus the server-only cache table — **all `permission denied`** |
| 4 | Auth still works | `auth.users` readable; signup trigger still creates profiles; valid token accepted, invalid rejected |
| 5 | Retained Storage/Realtime works | Asserted as *nothing retained*: no `storage` schema, no `supabase_realtime` publication |

Plus: the backend role is proven non-super, non-bypassrls, non-inherit, and
proven unable to read another user's rows despite holding table privileges.

> One finding worth recording: the test fixture originally re-granted privileges
> to `authenticated` **after** applying migrations, which would have made every
> boundary test pass vacuously. The fixture now mirrors production exactly.

---

## 4. Code removed

| File | Lines |
| --- | --- |
| `src/store/supabaseFoodStore.ts` | 2549 |
| `src/store/supabaseUserStore.ts` | 1702 |
| `src/API/supabase/supabaseProfiles.ts` | 296 |
| `src/API/USDA/usdaEndpoints.ts` | 345 |
| `src/API/OpenFoods/openFoodsEndpoints.ts` | 582 |
| **Total** | **5474** |

Legacy local→remote migration paths were **not** carried into the new stores.
They fired on every empty remote read and cost extra round trips permanently; a
one-shot server-side import is the right tool if that data still matters.

---

## 5. Deliberately not migrated

| Item | Why |
| --- | --- |
| **Supabase Auth** | Out of scope by design. Proxying it adds latency and breaks refresh. |
| **Adaptive TDEE engine** (573 lines) | Data access is migrated; the *analysis* is not. Porting it needs a dual-run diff against historical data before it can be trusted — moving it blind would silently change users' calorie targets. |
| **`expo-sqlite` cache layer** | Not a Supabase dependency. It is the app's offline and perceived-performance layer, and is more valuable now. |
| **Expo Go dev bypass** | Local-only development mode; never reaches the network. |
| **`activities`, `custom_meal_items`** | Unused, but dropping them is out of scope. |

---

## 6. Verification

| | |
| --- | --- |
| Backend tests | **231 passing** |
| Backend typecheck / lint / build | pass |
| Mobile typecheck | pass |
| Mobile unit tests | 21 passing |
| Mobile runtime | **NOT verified** — the API is not deployed and the Supabase project in `.env` still returns NXDOMAIN |

---

## 7. Remaining work

The app is pre-launch: no users, no provisioned Supabase project, no distributed
builds. Several items previously tracked as blockers assumed a production
database that does not exist, and are closed.

| # | Item | Status |
| --- | --- | --- |
| 1 | Provision a Supabase project and `db push` | ⬜ |
| 2 | Choose the Supabase region, then measure the Cloud Run pairing | ⬜ a decision, not a discovery |
| 3 | Deploy the API and run the latency probes | ⬜ |
| 4 | Confirm real JWT claim shape against a live token | ⬜ follows from (1) |
| 5 | Adaptive TDEE engine still client-side | 🟠 needs a dual-run diff before porting |
| 6 | Mobile refresh on `AUTH_TOKEN_EXPIRED` | ⬜ |

**Closed as moot:** verifying the baseline against production; capturing
production GRANTs; non-destructively adopting an existing database; auditing
`auth.users` for missing profiles.

**USDA key:** confirmed never committed to git history, and no builds were
distributed, so it was never exposed. Rotating it is optional hygiene rather
than an incident. It is no longer in the app either way.
