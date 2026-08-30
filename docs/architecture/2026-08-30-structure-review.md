# Project Structure Review

**Date:** 30 August 2026 · **Scope:** `nouri-api` + `hybrid-pilot` · **Read-only**
**Context:** pre-launch, single developer, one client, no users.

Every finding below cites a file, a line count, or a dependency edge. Nothing
here is asserted without evidence.

---

## Summary

**The backend is in good shape.** One real cross-module edge, low coupling, a
layering convention that is now enforced. Its problems are small and local.

**The mobile app is where the structural debt is**, and it predates this
migration. The headline: **there is no domain layer**, so domain types live in
`store/DB_TYPES.ts` (610 lines, 55 exports, imported by **52 files**) and domain
enums live in `navigation/onboardingTypes.ts` (imported by 25). Every lower
layer reaches *up* into them, producing **8 layer cycles**.

**The most expensive single finding spans both repos**: nutrition, calorie
targets and meal-slot logic are independently implemented in each, with nothing
keeping them in sync.

### The number that matters

Measured, not estimated — files touched by one domain (`adaptive` as the proxy):

| Repo | Files |
| --- | ---: |
| `nouri-api` | **21** (3 are the module; 7 tests, 2 migrations, 9 bleed) |
| `hybrid-pilot` | **25** (10 of them screens; no module boundary at all) |

---

## Backend

### B1 · Synthetic id encoding is stated twice, once as a raw SQL literal — **coupling**

`domain/syntheticFoodIds.ts` defines `SYNTHETIC_MEAL_FOOD_ID_OFFSET = 1_000_000_000`.
`library/repository.ts:120` hardcodes the same rule in SQL:

```sql
SELECT -(1000000000 + m.id) AS food_id, ...
```

The encoding has 5 consumers (`library/repository`, `foods/dto`, `foods/service`,
`foods/providers/catalogue`, `diary/service`) and `library/repository.ts:463`
re-exports the helpers, adding a second import path for the same functions.

This is genuine coupling: recipes and meals are addressed by *integer range*, so
the ranges are load-bearing across three modules and one SQL string. Changing
the scheme means finding every site, including one a grep for the function name
would miss.

**Recommendation: fix now, narrowly.** Replace the SQL literal with a reference
to the constant (or a SQL function), and drop the re-export so there is one
import path. Do **not** redesign the id scheme — it works, the client depends on
it, and the migration cost is real. Effort: under an hour. Blast radius: one
query, one export line.

### B2 · `src/domain/` is mostly "things diary needs" — **inconsistency**

| Module | Lines | Consumers |
| --- | ---: | --- |
| `syntheticFoodIds` | 46 | **5** — genuinely cross-cutting |
| `timezone` | 187 | 2 (both diary) |
| `calorieTargets` | 34 | 2 (diary, me) |
| `mealSlots` | 46 | 2 (both diary) |
| `nutrition` | 183 | **1** (diary) |
| `duplicateKey` | 102 | **1** (diary) |

`diary/service.ts` consumes 5 of the 6. Two modules (285 lines) have exactly one
consumer and are diary-private in everything but location.

The boundary is historical, not principled: these were extracted from the mobile
app during the migration and landed in a shared folder because that is where
ported code went.

**Recommendation: accept and document.** Moving `nutrition` and `duplicateKey`
into `modules/diary/` would be more honest, but `src/domain/` also serves as
"logic ported from the client, kept pure and separately tested" — a real
category worth keeping visible while the adaptive engine port is still pending.
Say so in `module-layering.md` rather than shuffling files. Effort: one paragraph.

### B3 · `retryOnConflict.ts` lives in `src/db/` — **inconsistency**

It encodes two domain rules ("one active weigh-in per local day", "one open
recommendation") as exported constants naming specific indexes, but sits in the
database layer. Only two modules import it.

**Recommendation: accept.** It is genuinely about database mechanics (`23505`,
transaction boundaries); the index names are parameters, not policy. Moving it
would trade one arbitrary location for another.

### B4 · `diary/service.ts` at 654 lines — **not a finding**

Checked for cohesion rather than counted. It has four clearly marked sections
(DTOs, row→domain, read, write) and 8 exported functions covering one domain:
day assembly, range, create ×2, update, delete, copy, complete. The DTO assembly
is inherently rich because `GET /v1/diary/:date` returns meals, entries,
per-meal totals, day totals and goals in one response — which is the point of
the endpoint.

It is also the only module with `schemas.ts` (128 lines, 77 Zod references vs 12
inline in its routes), which is proportionate: it has the most complex request
shapes.

**Recommendation: reject the split.** Size here reflects the domain, not
disorder. Revisit only if a second consumer of `buildDayDto` appears.

### B5 · `library` holds two entities — **not a finding**

Recipes and meals have near-duplicate CRUD (5 route blocks vs 4). But both are
"the user's food library", both surface as `FoodDto` with synthetic ids, and both
share the visibility rule fixed during the E2E work. Splitting them would
duplicate that rule across two modules.

**Recommendation: reject.** Two entities, one bounded context. The duplication is
honest — the shapes differ enough (ingredients vs per-serving macros) that a
shared abstraction would be worse.

### B6 · `foods` has no repository — **not a finding**

Data access lives in `providers/catalogue.ts` beside the external providers.
Documented as deliberate and enforced as a named exception in
`test/architecture.test.ts`.

Verified as correct: the catalogue is one source among three in a search
fan-out, not the module's private table. Placing it beside USDA and Open Food
Facts makes the symmetry visible. A `repository.ts` would imply a primacy it
does not have.

**Recommendation: accept as-is.** Already documented.

### B7 · What the recent layering work got wrong

Two things, both mine, both now corrected but worth recording:

* `weight` and `adaptive` routes were wrapped in `retryOnUniqueViolation`,
  putting transaction-concurrency in a controller.
* `foods/routes.ts` composed the two halves of a search, so the rule "the
  upstream call must stay outside the transaction" — learned from a pool
  deadlock — lived in an HTTP handler.

Each was the smallest correct fix at the time and each was tested. That is
exactly how layering decays: never in one deliberate step. The fitness test now
catches the shape of both.

---

## Mobile

### M1 · There is no domain layer, and it causes every cycle — **coupling, highest severity**

There is no `src/domain/` or `src/types/`. Domain types live in two places that
are not domain layers:

| Location | Size | Imported by |
| --- | ---: | ---: |
| `store/DB_TYPES.ts` | 610 lines, 55 exports | **52 files** |
| `navigation/onboardingTypes.ts` | 99 lines | **25 files** |

So `engine/nutrition.ts` imports `DBFoodItem` from `store/`,
`storage/localStore.ts` imports `GoalStrategy` from `navigation/`, and
`API/nouri/foodsApi.ts` imports `DBFoodItem` from `store/`. Lower layers depend
upward on higher ones.

**Eight layer cycles** result:

| Cycle | Edges | Nature |
| --- | --- | --- |
| `navigation ↔ screens` | 54 / 52 | normal for React Navigation |
| `screens ↔ engine` | 37 / 2 | `engine/calorieTargets` imports `screens/Onboarding/initialCalculations`; `engine/adaptiveCalories` imports `screens/Weight/weightUtils` — **runtime, real logic in screens** |
| `API ↔ store` | 6 / 17 | mostly type-only, but `API/supabase/auth.ts` and `API/Local/LocalEndpoint.ts` import `DB` at runtime |
| `engine ↔ store` | 3 / 5 | type-only |
| `navigation ↔ store` | 4 / 2 | |
| `dev ↔ store` | 2 / 4 | |
| `navigation ↔ storage` | 2 / 1 | type-only |
| `screens ↔ API` | 5 / 2 | `API/supabase/auth.ts` imports two screen cache-clearers — **runtime** |

Most edges are type-only, which softens the runtime risk considerably. But three
are real: sign-out reaches into screen caches, and `engine/` — the pure
calculation layer — imports from `screens/`.

**Recommendation: fix before launch, in one narrow move.** Create `src/domain/`
and move *only the types*: `DB_TYPES.ts` and `onboardingTypes.ts`. That is a
mechanical import rewrite across 52 and 25 files, no logic change, and it
collapses five of the eight cycles at a stroke. Leave the three runtime cycles
alone for now and record them.

Do **not** attempt a full layer reorganisation. Effort: half a day, mostly
mechanical. Blast radius: wide but shallow — imports only, and the typechecker
proves completeness.

### M2 · `src/store/` holds four unrelated responsibilities — **inconsistency, high nuisance**

18 files, 7,393 lines:

| Responsibility | Files | Lines |
| --- | ---: | ---: |
| SQLite cache (`*Repository.ts`) | 6 | 4,260 |
| API-backed stores (`*Store.ts`) | 4 | 1,994 |
| Domain types (`DB_TYPES.ts`) | 1 | 610 |
| Facade (`DB.ts`) | 1 | 262 |
| Redux (`appStore`, `userSlice`, `hooks`) | 3 | 85 |
| Utilities | 3 | 182 |

"Store" means three different things in one directory: a Redux store, a
persistence repository, and an API-backed data source.

**Recommendation: fix before launch, but only after M1.** Once `DB_TYPES` moves
to `domain/`, the remaining split is `cache/` vs `data/` vs the three Redux
files. It is a rename, and the typechecker verifies it. Do it in a separate
commit from M1 so each is reviewable. Effort: 2 hours.

### M3 · `DB.ts` re-exports 106 names; 30 screens call 50 of them — **coupling**

262 lines whose entire job is to re-export. Screens import one symbol and reach
anything.

This earned its place during the migration — it is precisely why swapping
Supabase for the API required no screen changes, a genuine and significant win.
But it now hides every seam: a screen calling `DB.getUserFoodLogEntriesByDate`
cannot tell whether that hits SQLite, the network, or both, and nothing
constrains which screens use what.

**Recommendation: accept and document.** With one client and one developer, the
facade's cost is discoverability, and its benefit — a single swap point — has
already been collected once and may be collected again when the adaptive engine
moves server-side. Revisit if a second client appears. Document *why* it exists,
because it currently reads as an accident rather than the deliberate seam it is.

### M4 · Cache-then-refresh repeated at 16 sites across 4 stores — **inconsistency**

The shape is identical everywhere: read cache → if non-empty, return it and fire
a background refresh → else await the network.

**Recommendation: accept for now.** The repetition is load-bearing in one
respect: each site differs in *what* it caches and how it maps the response, and
the E2E review found the pattern correctly applied at every site including the
error paths. A generic `cacheThenRefresh` helper would need a mapper, a key, a
cache reader and a cache writer per call — four parameters to remove nine lines.
Revisit if a fifth store appears, or if a bug is found at one site and not
another. Effort to change: 3 hours. Value today: low.

### M5 · `cacheRepository.ts` at 1,395 lines and `sqlite.ts` at 1,336 with 21 tables — **inconsistency**

Assessed against how the app reads, per the brief. `sqlite.ts` is schema plus
migrations for 21 tables — inherently linear and rarely edited. `cacheRepository`
is a flat function list.

**Recommendation: accept.** Neither is hard to navigate; both are append-mostly.
Splitting them would create import churn for no behavioural or comprehension
gain. Revisit `cacheRepository` only if it starts holding logic rather than SQL.

### M6 · Mobile tests are `.cjs` behind a TS transpile loader — **constraint worth removing**

9 files, 1,177 lines, run by `node --test` with `scripts/register-ts.cjs`
compiling TS on require. It works — 60 tests, including the static-analysis
suites added recently.

The cost is real but bounded: no ESM, no TS in test files, and the harness
substitutions written during the token-lifecycle work had to patch
`Module._load` by hand. That is why exercising the store layer against a live
stack was expensive enough to be declined.

**Recommendation: fix before launch.** Adopting Vitest — already a backend
dependency, already understood — would remove the loader, allow TS tests, and
make store-layer integration testing tractable. That directly unblocks the
`LOCAL_E2E_BLOCKED` verdict's hardest remaining item. Effort: half a day.
Blast radius: test files only.

---

## Cross-cutting

### X1 · Domain logic is independently implemented in both repos — **coupling, highest severity**

| Logic | Mobile | Backend |
| --- | --- | --- |
| Nutrition scaling / rounding | `engine/nutrition.ts` — 213 lines | `domain/nutrition.ts` — 183 lines |
| Calorie targets | `engine/calorieTargets.ts` — 224 | `domain/calorieTargets.ts` — 34 |
| Meal slots | `store/foodLogCopyUtils.ts` — 155 | `domain/mealSlots.ts` — 46 |
| Synthetic ids | inside `store/DB_TYPES.ts` — 610 | `domain/syntheticFoodIds.ts` — 46 |

These are ports, not coincidences — the doc comments match nearly word for word
("*Model: a food stores macros for exactly `servingSizeValue` units of its…*"),
and both encode the same Atwater factors including alcohol at 7 kcal/g.

**Nothing keeps them in sync.** Each repo tests its own copy. A change to
rounding on one side and not the other produces totals that disagree between the
optimistic UI and the server — exactly the class of bug that is hardest to
notice, because the server is right and the screen is subtly wrong.

This is deliberate in origin: the client computes previews before the round trip.
The duplication is the price of optimistic UI. But the *risk* is unmanaged.

**Recommendation: fix before launch — the cheapest version.** Do not extract a
shared package; that is a build-system problem this project does not need. Add a
**conformance test**: a committed fixture file of inputs and expected outputs,
checked into both repos and asserted by both suites. Drift then fails a test
instead of surfacing as a wrong number on a screen. Effort: half a day. This is
the highest value-per-hour item in this review.

### X2 · Where a new feature goes — **the honest answer**

Measured against `adaptive`: **21 backend files, 25 mobile files.**

Backend's 21 breaks down defensibly — 3 module files, 7 tests, 2 migrations, and
9 files that legitimately reference adaptive state (the diary cascade
invalidates it, settings holds its timestamp, weight triggers it). The module
boundary is real.

Mobile's 25 has **no module boundary at all**. A domain spreads across `engine/`,
`storage/`, `store/` (5 files), `API/`, `navigation/` and **10 screen files**. A
developer adding a hydration tracker would touch: `DB_TYPES`, a new
`*Repository`, a new `*Store`, `sqlite.ts` (table + migration), `DB.ts`, a new
`*Api.ts`, plus screens and navigation. Nothing tells them that list — they would
have to derive it by imitating an existing domain.

**Recommendation:** M1 and M2 improve this. A full feature-folder reorganisation
would improve it more and is **not** worth it at this size — reject.

---

## Ranked findings

| # | Finding | Severity | Effort | Blast radius | Recommendation |
| --- | --- | --- | --- | --- | --- |
| **X1** | Domain logic duplicated across repos, nothing detects drift | **High** | 0.5d | Both suites | **Fix before launch** — conformance fixture |
| **M1** | No domain layer; 52 files import types from `store/`, 8 cycles | **High** | 0.5d | Wide, shallow | **Fix before launch** — move types only |
| **M6** | Mobile tests are `.cjs` behind a transpile loader | Medium | 0.5d | Tests only | **Fix before launch** — adopt Vitest |
| **M2** | `store/` holds four responsibilities | Medium | 2h | Imports | **Fix before launch**, after M1 |
| **B1** | Synthetic id encoding duplicated, once as a SQL literal | Medium | <1h | 2 files | **Fix now** |
| **M3** | `DB.ts` re-exports 106 names, hides every seam | Medium | — | — | **Accept and document** |
| **M4** | Cache-then-refresh repeated 16× | Low | 3h | 4 files | **Accept** — revisit at a 5th store |
| **B2** | `src/domain/` is mostly diary-private | Low | 1 para | — | **Accept and document** |
| **B3** | `retryOnConflict` in the db layer | Low | — | — | **Accept** |
| **M5** | Two 1,300-line files | Low | — | — | **Accept** |
| **B4** | `diary/service.ts` at 654 lines | — | — | — | **Reject the split** — cohesive |
| **B5** | `library` holds two entities | — | — | — | **Reject the split** |
| **B6** | `foods` has no repository | — | — | — | **Accept** — already documented |
| **X2** | Mobile feature-folder reorganisation | — | Days | Everything | **Reject** — wrong size of project |

### If only one thing gets done

**X1.** Every other finding costs a developer some navigation time. X1 is the
only one that can put a wrong number in front of a user, silently, with both
test suites green.

---

*Compiled 30 August 2026. Figures read from the repositories, not from memory.*
