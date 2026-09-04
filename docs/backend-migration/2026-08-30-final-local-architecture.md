# Final local architecture

**Date:** 2026-08-30 · **Scope:** `hybrid-pilot` + `nouri-api`, entirely local
**Closes** the six-task programme that began after
[the final migration matrix](2026-08-29-final-migration-matrix.md)

---

## 1. Where things run

```
┌─────────────────────────────────────────────────────────────────────────┐
│  React Native app                                                       │
│                                                                         │
│  Supabase Auth ─────────────────────────────► GoTrue (direct)           │
│    session in expo-secure-store                                         │
│                                                                         │
│  Everything else ───────────────────────────► nouri-api                 │
│    foods · diary · weights · library · settings · adaptive              │
│                                                                         │
│  On the device:  six preference keys in AsyncStorage. No domain data.   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  nouri-api (Fastify)                                                    │
│    verifies the Supabase JWT · SET ROLE nouri_app_backend               │
│    domain rules · adaptive engine · USDA + Open Food Facts              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL — the single source of truth. RLS on every table.  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The four properties, and how each is held

### The app cannot reach the database directly

| | |
| --- | --- |
| `.from(` / `.rpc(` / `functions.invoke(` / `.storage.` / `.channel(` | **0** |
| Supabase SDK calls outside `auth.*` | **0** |
| Client-side third-party API keys | **none** |

Not only absent but unreachable: `authenticated` and `anon` hold no privileges
on any `public` table, and default privileges are revoked so a future table
cannot silently re-grant them. 44 boundary tests assert 14 tables × read × write
are denied through the Data API, and `pnpm test:mutation` breaks one security
assumption at a time to prove those tests can fail — 7 of 7 caught.

### The device stores no domain data

`expo-sqlite` is gone: not the dependency, not the plugin, not the native
library in the built APK. With it went 19 tables, six repositories, the barcode
hit/miss cache, the home-summary cache, and the Expo Go development mode that
ran the whole app against local SQLite.

What remains on the device is six preference keys in AsyncStorage — whether
onboarding finished, the profile draft collected before an account exists, and
display units — plus the Supabase session in SecureStore. Ten static tests hold
that line, each mutation-checked.

### Domain rules cannot drift between the two repositories

One corpus, **26 suites / 204 cases**, byte-identical in both repositories and
checksummed. Both test suites run it against their own implementation.

An audit for this review found four functions implemented in both repositories
but pinned by no suite — `getEntryScaleFactor`, `getDailyCalorieOverrideForDate`,
`formatGoalStrategyMeta` and the *encode* half of the synthetic food ids. Each
was reachable from something already covered, so none was unprotected; but
"covered through a caller" is not the same as covered, and the callers' cases
were not chosen to exercise them. All four now have suites. The audit is
reproducible and finds nothing today.

### Calculations that get stored are the server's

Recipe per-serving nutrition and the adaptive calorie recommendation are both
derived server-side and written in the same transaction that reads their inputs.
The client still computes both — for a live preview while editing a recipe, and
for the apply step after a recommendation is accepted — but no longer sends
either, and the routes no longer accept them.

---

## 3. What the six tasks changed

| | |
| --- | --- |
| Mobile source | **1,009 insertions, 8,519 deletions** across 45 files |
| Files deleted | 14 |
| Mobile tests | 21 → **122** (+ 1 skipped by design) |
| Backend tests | 231 → **580** |
| Conformance corpus | 105 → **204 cases**, 14 → **26 suites** |

The deletions are the headline. Almost every one is a second implementation of
something the server already did: a local database mirroring Supabase, a client
engine mirroring the backend's, a cache mirroring `external_food_cache`.

---

## 4. Fourteen defects, and what found each

Grouped by what caught them, because that is the part worth keeping.

### Only running the real app could find these (9)

| | |
| --- | --- |
| A recipe logged at **0 kcal** — the API accepted `caloriesPerServing` from the body; the client never sent it | UI |
| Opening a recipe to edit it **emptied** its prepared weight, times, link, description and visibility — snake_case payload behind `z.record(z.unknown())`, read as camelCase through `as unknown as` | UI |
| **None of your own recipes were "Yours"** — ownership parsed from a `rawPayload` the mapper always nulls, while the API had been sending `isOwn` all along | UI |
| "Edit this recipe" requested **recipe 0** — a recipe's `ref` has no colon, so `sourceId` was null and `Number(null)` is 0 | UI + the new diagnostic |
| A 450 kcal meal logged as **45,000** — the editor passed its default serving *in grams* as the quantity for a one-serving food | UI |
| An API outage rendered the **welcome screen** — `hydrate rejected` set `hydrated: true`, collapsing "unreachable" into "signed out" | UI |
| A catalogue food with id ≥ 1e9 was **unloggable** — the synthetic-meal predicate tested magnitude without sign | UI |
| `loadAdaptiveInputs` ran three queries on one pooled connection with `Promise.all` | real app; the backend suite passed either way |
| Clearing per-day calorie overrides returned **500** — `JSON.stringify(null)` is a JSON null, not SQL NULL, and the column's array check rejects it | UI |

Every one lived in the gap between two components that were individually
correct. No test suite could have caught them, because each component's tests
were right about that component.

### Found by writing tests that could fail (5)

Mutation testing, throughout. Beyond the security suite's 7/7, this programme
mutation-checked the remote-only storage rules (6/6), the coalescer (3/3 plus
one that revealed redundant state, which was deleted rather than defended), the
API failure reporting (3/3), the architecture rules (3/3), and the adaptive
dual-run (8/8 — two of which escaped first and exposed real gaps in the
scenarios, see §5).

Three cases where a mutation *escaped* were the most useful:

* A conformance mutation changing calorie rounding from 0 to 1 decimal place was
  not caught, because every existing case happened to divide evenly. Two cases
  were added.
* Removing the coalescer's generation counter was not caught, because `clear()`
  already did the work. The counter was **deleted** — dead state that cannot
  fail is not defended by adding an assertion about it.
* Two adaptive mutations escaped because the scenarios could not distinguish
  them: a 100 kcal floor is indistinguishable from any threshold in (50, 100]
  when every value is a multiple of 50, and a tie-break's `>=` is
  indistinguishable from `>` unless the tie is total. Both scenario sets were
  widened.

---

## 5. How the adaptive engine was moved

The migration matrix flagged this as the one item needing a dual-run diff before
it could be trusted, because porting it blind would silently change users'
calorie targets.

That is what was done. Both implementations ran side by side over generated
scenarios sitting on every threshold the engine has, and every field of every
output was compared. **Zero differences.** The diff was then mutation-checked
eight ways, and the two that escaped were fixed in the scenarios, not waved
through.

The mobile engine is now deleted. Its answers are not: 15 whole-outcome cases,
recorded from it at the moment the diff showed the two agreed, are in the corpus
and asserted against the backend on every run.

Detail in [adaptive-calories.md](../architecture/adaptive-calories.md).

---

## 6. What is deliberately not done

| | |
| --- | --- |
| **Offline reads** | Gone, and not replaced. Showing yesterday's diary as though it were today's is the failure this removes. If offline support is wanted, it should be designed — with a staleness contract and conflict resolution — not recovered by leaving a write-through cache in place. |
| **Offline writes** | There is no mutation queue. A write that cannot reach the server does not happen. |
| **Supabase Auth** | Stays direct. Proxying it adds latency and breaks refresh. |
| **`activities`, `custom_meal_items`** | Tables, indexes and RLS exist; no application uses them. Dropping them is out of scope. |
| **The `DB_TYPES` name** | A misnomer — those are API response shapes now. Load-bearing across ~45 files; renaming is churn without a payoff. The file says so at the top. |

---

## 7. What remains before shipping

Everything here ran locally, and that is the boundary of what this programme
could establish. These are unstarted, not unfinished:

| # | | |
| --- | --- | --- |
| 1 | Provision a hosted Supabase project and `db push` | ⬜ |
| 2 | Choose the region, then measure the Cloud Run pairing | ⬜ a decision, not a discovery |
| 3 | Deploy the API and run the latency probes | ⬜ |
| 4 | Confirm the JWT claim shape against a hosted token | ⬜ follows from (1) |
| 5 | **iOS has never been run** | ⬜ every UI verification here was Android |

On (4): the local stack signs **ES256 with JWKS**, which contradicted what three
of this repository's own env files claimed. That was corrected and a regression
test added — but a hosted project should still be checked rather than assumed.

---

## 8. Verification, reproducible

```
# backend  — typecheck, lint, 580 tests
cd nouri-api && pnpm verify

# backend  — proves the security tests can fail (7 assumptions, one at a time)
cd nouri-api && pnpm test:mutation

# mobile   — typecheck, 122 tests
cd hybrid-pilot && npm test

# both     — the corpus mirrors are byte-identical
cd nouri-api && ./scripts/sync-conformance.sh verify
```

| | |
| --- | --- |
| Backend | 580 tests, 14 files |
| Mobile | 122 tests, 15 files (+1 skipped: needs a running stack and a real token expiry) |
| Security | 150 of those: 75 Supabase-local, 44 boundary, 31 RLS |
| Conformance | 204 cases across 26 suites, run by both repositories |
| Corpus checksum | `b4bf6331…` — verified identical in both |

**LOCAL_ARCHITECTURE_COMPLETE**
