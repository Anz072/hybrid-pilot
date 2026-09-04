# Remote-only data

**Date:** 2026-08-30 · **Applies to:** `hybrid-pilot` (React Native)
**Supersedes** the `expo-sqlite` row in
[2026-08-29-final-migration-matrix.md](../backend-migration/2026-08-29-final-migration-matrix.md) §5

---

## The rule

Supabase PostgreSQL, reached only through `nouri-api`, is the single persistent
store for application data. The device holds no copy of any of it.

Not "no stale copy", or "no copy that matters" — **none**. There is no local
database, no cache table, no mirror, no offline queue and no device-local user
record. Every read of a food, a diary entry, a weight, a recipe, a setting or a
recommendation is a request; every write either reaches Supabase or fails.

---

## What was removed

| | Lines |
| --- | --- |
| `src/store/cacheRepository.ts` — barcode hit/miss cache, home-summary cache, cache health | 1395 |
| `src/storage/sqlite.ts` — 19-table schema, versioned migrations, seed + reset | 1336 |
| `src/store/recipeRepository.ts` | 795 |
| `src/store/foodRepository.ts` | 680 |
| `src/store/foodLogRepository.ts` | 557 |
| `src/store/weightRepository.ts` | 431 |
| `src/store/userSettingsRepository.ts` | 209 |
| `src/store/userRepository.ts` | 193 |
| `src/dev/expoGoDevAuth.ts` — the Expo Go local-store bypass | 109 |

The four stores shrank alongside them, losing their cache-first branches:

| Store | Before | After |
| --- | --- | --- |
| `userStore.ts` | 712 | 403 |
| `diaryStore.ts` | 578 | 253 |
| `libraryStore.ts` | 571 | 306 |
| `foodSearchStore.ts` | 152 | 63 |

**Net across `src/`: 435 insertions, 7,514 deletions.**

`expo-sqlite` is gone from `package.json` and from the Expo plugin list. The
Android and iOS projects no longer link it.

---

## Why each removal, and what it was actually costing

### The cache layer was a second source of truth

The previous phase kept the cache deliberately, reasoning that a Node API in
front of Supabase made a local read *more* valuable, not less. That reasoning
holds for a read-only cache of immutable data. It does not hold here, because
the same tables were also written locally.

Two stores that both accept writes are two answers to the same question. The
app had no way to decide which was right, so it picked whichever it had — and
the one it had was usually the local one.

### A rejected write was reported as a success

`saveWeightEntry` wrote to SQLite first, POSTed second, and on rejection marked
the local row `sync_error` — then returned it to the caller as the saved entry.
The screen showed a weight the server had never accepted, with a "Saved locally"
badge that read as reassurance rather than as failure. On the next cold start
the row was still there, still in the trend, still feeding the adaptive
calculation.

`saveWeightEntry` now returns what the server returned, or throws.

The `syncStatus` / `syncError` fields are gone from `DBWeightEntry` with it,
along with the per-row "Synced / Saved locally / Needs review" column in the
weight history. Those three states described a sync engine. There is no sync
engine, and an entry that exists is one Supabase accepted.

### The barcode cache cached misses

`getCachedBarcodeLookup` stored both hits and misses on the device. A barcode
that returned nothing once stayed unknown on that phone — permanently, even
after another user added the product and the backend began answering.

The backend's `external_food_cache` already caches provider responses, shares
them across every user, and is invalidated in one place.

### The home summary survived restarts

`saveCachedHomeSummary` wrote the computed dashboard to disk. A cold start could
therefore paint yesterday's calorie total with nothing marking it stale.

The in-memory `summaryCache` remains: it lives for the lifetime of the process,
is dropped on sign-out, and exists so returning to Home paints immediately while
the real load runs. That is a render optimisation over data this process already
fetched, not a store.

### The development bypass exercised a path production never took

In Expo Go, `shouldUseExpoGoDevLocalStore()` signed the developer in as
`expo-go-dev-user` and served every store from SQLite. No Supabase, no API, no
network. The mode developers used all day was the one mode that never touched
the backend, which is precisely backwards: the bugs it could not surface were
the bugs only it could have surfaced.

There is no bypass. Development signs in against the local Supabase stack like
everything else.

### `LocalAccount` was a second answer to "who is signed in"

A device-local identity record written alongside the Supabase session, and read
back by profile saves to fill in fields. The Supabase session is the answer.

---

## What the device still stores, and why each earns it

`src/storage/kv.ts` — a string key/value store over AsyncStorage. Not a
database: no schema, no migrations, no queries.

| Key | Why it cannot come from the server |
| --- | --- |
| `onboardingComplete` | Chooses the first screen, before a session or a network call exists. |
| `onboardingProfile` | The answers collected *before* an account exists. There is nowhere to send them until signup. |
| `foodSearchSectionState` | Which sections of the search screen are expanded, on this device. |
| `foodTrackingPreferences` | Fast-log toggle, on this device. |
| `adaptiveRecommendationSeen:<user>` | Whether this device has shown a given recommendation. No server column, and one would be wrong — it is per-install, not per-user. |
| `displayPreferences` | kg/lb, cm/ft, 12h/24h. Display units only; values are stored in kg, cm and ISO regardless. |

The Supabase session itself stays in `expo-secure-store`, which is the correct
place for a credential and is not application data.

### Memory-only

`shortcutRecents` and `foodRecentSearches` were persisted. They were the only
two lists whose contents outlived the process without the server ever knowing
they existed. They are hints about the current session — the server has no
column for them and does not need one — so they now live in module state and
are gone when the app is.

Adding a server table to preserve them was considered and rejected: they were
never a feature anyone asked for, and a `user_recent_searches` table would be a
new domain concept created to justify code that already existed.

### Legitimate in-memory state

Three things look like caches and are not:

* `summaryCache` (Home) — the last summary *this process* computed.
* `addFoodStaticListsCache` — favourites/recents for the add-food screen, plus
  in-flight de-duplication.
* `weekLoadInFlightRef` (Food diary) — joins a request already in flight rather
  than issuing a second identical one.

All three are process-lifetime, all three are dropped on sign-out, none survives
a restart, and none is ever the *only* copy of anything. Coalescing an in-flight
request is not caching a result.

---

## What this costs

Honestly: offline reads. There were none to lose in practice — every screen
already needed the API for something — but a phone in aeroplane mode now shows
an error state instead of yesterday's diary.

That is the intended trade. Showing yesterday's diary as though it were today's
is the failure mode this removes, and there is no offline mutation queue to
replace it with: a write that cannot reach the server does not happen.

If offline support is wanted later, it should be designed as one — with an
explicit staleness contract and conflict resolution — not recovered by leaving a
write-through cache in place and hoping.

---

## Two things only running the app could find

The static tests pass on a codebase that does not work. Both of the following
were found by building the app, installing it on the emulator and driving the
real screens against the local Supabase stack.

### An API outage rendered the welcome screen

Killing `nouri-api` and cold-starting the app showed **onboarding** — the same
screen a brand-new install shows — to a user holding a valid Supabase session.

The cause was one line in `userSlice`. `hydrateUserFromDb.rejected` set
`hydrated: true`, which was harmless when a local database could answer instead:
hydration had finished, it had simply found nothing locally. With the API as the
only source, that collapsed two different states into one —

| | |
| --- | --- |
| hydrate succeeded, found nobody | signed out; show the login screen |
| hydrate **failed** | we do not know; show an error |

— and the navigator's own `bootstrapError && !userHydrated` branch, written for
exactly this case, became unreachable. `rejected` now leaves `hydrated: false`,
and the same cold start shows **"Could not start the app — Could not reach the
server."** with a Try again button that recovers once the API is back.

This is a regression this change introduced, not a pre-existing one. Removing a
fallback makes the failure path load-bearing; it has to be looked at.
`scripts/session-hydration.test.cjs` holds all four states, and asserts the
navigator guard still matches the state the reducer produces — otherwise the
error screen is dead code again.

### A catalogue food could not be logged

Logging the one food in the local catalogue failed with `NOT_FOUND`. The alert
said "Please review the food and try again", and the `catch` discarded the
error, so the device left no trace of the cause.

`isSyntheticMealFoodId` tested magnitude without sign:

```ts
Number.isInteger(foodId) && Math.abs(foodId) >= SYNTHETIC_MEAL_FOOD_ID_OFFSET
```

Synthetic ids are negative — `-R` for a recipe, `-(1e9 + M)` for a meal — and
the sibling `isSyntheticRecipeFoodId` checks `foodId < 0`. The meal predicate did
not, so any real `food_items.id` at or above 1,000,000,000 decoded as a custom
meal, looked up a meal that did not exist, and 404ed. `food_items.id` is
`generated BY DEFAULT as identity`, so explicit ids in that range are not
hypothetical — the local database already held one.

Both repositories carried the same encoding and therefore the same defect, which
is why the conformance corpus could not catch it: the two agreed. Fixed:

* both predicates now require `foodId < 0`;
* the mobile copy moved out of `libraryStore.ts` into
  `src/domain/syntheticFoodIds.ts`, mirroring the backend module, so it is pure
  and testable;
* a `decodeFoodId` suite (10 cases) joined the shared corpus, including the
  boundary cases `+1000000000` and `+9000000006`;
* both conformance runners now **derive** their coverage assertion from the
  suites they request instead of a hand-written list. The backend's list had to
  be edited by hand to accept the new suite — a list whose job is to catch an
  unasserted suite should not itself need updating to allow one — and the mobile
  runner had no coverage assertion at all, so a corpus suite could have been
  asserted in one repository only.

Verified end to end afterwards: the food logs, `user_food_entries` gains a row
with `food_item_id = 9000000006`, and the diary redraws at 600 kcal.

### A note on the shared local database

The food logged during this run was one a security-test fixture had submitted.
`purgeUsers` in the backend fixtures deletes `food_items` by submitter, the FK
on `user_food_entries.food_item_id` is `ON DELETE SET NULL`, and the
`user_food_entries_target_matches_type` check then rejects the nulled row — so a
manual UI session left the backend suite failing until that one entry was
removed.

That is fixture fragility, not a production path: `food_items` grants no DELETE
and the app has no delete route for it, so only a superuser or a fixture can
reach it. Recorded here because the same shape — `SET NULL` into a column a
CHECK requires — would be a real problem if a delete path is ever added.

### Diagnostics

`quickLogFood` caught and discarded its error. `describeApiFailure` in the API
client now renders a failure as `CODE status=NNN requestId=…` — enough to find
the server-side log line, and nothing else. No message body, no field value, no
payload: a client log is not a place for a user's weight, diary or nutrition
data.

---

## How this is held

`scripts/remote-only-storage.test.cjs`, ten static-analysis tests over the
source. They need no simulator, no native modules and no running stack, so they
run in `npm test` on every change.

| # | Assertion |
| --- | --- |
| 1 | `expo-sqlite` is not a dependency, not a plugin, not imported |
| 2 | No local database or repository module exists — and no new one has appeared |
| 3 | The four stores import no local persistence |
| 4 | Every exported store function reaches the API |
| 5 | No store reports a success it did not get; no `sync_error` / queue / outbox state anywhere |
| 6 | No development mode runs against local storage |
| 7 | Device storage holds only the six allow-listed keys; no `LocalAccount` |
| 8 | `shortcutRecents` and `foodRecentSearches` never touch storage |
| 9 | Only `kv.ts`, `localStore.ts` and `displayPreferences.ts` reach device storage |
| 10 | Sign-out clears memory only; `DB` exposes no cache API |

Plus `scripts/session-hydration.test.cjs` (4 tests) for the failure-state
distinction above, and the `decodeFoodId` conformance suite in both repositories.

Test 4 replaced an earlier version whose parser skipped to the next `{` and so
attributed the *following* function's body to any concise arrow like
`async (...) => copyDay(to, from)`. It reported a false positive, which is how
the bug was found; it now walks the parameter list and handles both forms.

Six mutations were applied one at a time and each was caught by the intended
test: restoring the dependency (1), adding a store export that never calls the
API (4), reintroducing `syncStatus` (5), restoring the bypass file (6),
persisting `shortcutRecents` (8), and importing `storage/kv` from a screen (9).
