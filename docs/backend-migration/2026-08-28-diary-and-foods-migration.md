# Migration: calorie diary + food search → Node API

**Date:** 2026-08-28 · **Status:** implemented, **not runtime-verified** (see §6)
**Follows:** [2026-08-27-current-state.md](2026-08-27-current-state.md)

---

## 1. What moved

| Surface | Before | After |
| --- | --- | --- |
| Diary day (meals, entries, totals, goals) | 7–40 Supabase requests | `GET /v1/diary/:date` — **1** |
| Diary week/range | 2 requests × N screens | `GET /v1/diary?start&end` — **1** |
| Log a food / quick add | 2–6 requests, no transaction | `POST /v1/diary/:date/entries` — **1** |
| Edit entry | 4–7 | `PATCH /v1/diary/entries/:id` — **1** |
| Delete entry | 3–6 | `DELETE /v1/diary/entries/:id` — **1** |
| Copy / repeat a day | 4–7 | `POST /v1/diary/:date/copy-from` — **1** |
| Day complete toggle | 1 + cascade | `PUT /v1/diary/:date/complete` |
| Food search | 5 Supabase + 1 USDA (key in bundle) | `GET /v1/foods/search` — **1** |
| Barcode lookup | 2 Supabase + 1 OFF + save | `GET /v1/foods/barcode/:code` — **1** |
| Food by id | 1–3 | `GET /v1/foods/:ref` — **1** |

## 2. Old code removed, not left in parallel

`src/store/supabaseFoodStore.ts`: **3741 → 2549 lines**.

Deleted: 14 exported functions (all diary reads/writes, day status, copy, food
search, barcode) plus 18 now-dead private helpers and the
`user_diary_days` / `user_settings` / `adaptive_calorie_recommendations` table
constants. That file no longer touches the diary at all.

Also deleted:
* `src/API/USDA/usdaEndpoints.ts`
* `src/API/OpenFoods/openFoodsEndpoints.ts`
* `scripts/open-foods.test.cjs`
* the direct USDA call in `foodSearch.ts` and the direct OFF fallback in
  `FoodBarcodeScannerShared.tsx`

`EXPO_PUBLIC_USDA_API_KEY` is gone from `.env`, `.env.example` and the README.
**The key must still be rotated** — old builds contain it.

New: `src/API/nouri/{client,diaryApi,foodsApi}.ts`, `src/store/diaryStore.ts`,
`src/store/foodSearchStore.ts`.

## 3. Behaviour deliberately preserved

* **Nutrition maths** — engine ported verbatim; per-entry rounding, sum-then-round,
  quick-adds never scaled, basis fallbacks. Regression-tested.
* **Timezone** — meal-slot fallback and copy-dedupe time keys used the *device*
  clock. The client now sends its IANA zone (`?tz=`) and the server evaluates
  them in it. Same rows, same grouping. DST-tested.
* **Copy dedupe** — consuming, second-precision, full quick-add nutrition shape.
* **Search semantics** — ranking/dedupe heuristics ported; token-AND matching kept
  (the old PostgREST `.or()` chain ANDed across tokens); short queries still skip
  external providers.
* **Local-first reads** — SQLite cache answers first, background refresh, block
  only on a cold cache.
* **Optimistic writes** — pending row from the cached food, rolled back on failure.
  No silent fallback to Supabase: a failed write fails visibly.

## 4. Behaviour deliberately changed

| Change | Why |
| --- | --- |
| Food-entry nutrition derived server-side | Client-sent calories/macros are ignored. Previously the client computed and stored them. |
| Quick-add `systemCalculatedCalories` derived server-side | Atwater is derivable; only the user's manual override is trusted. |
| Editing quick-add macros re-derives calories unless manually overridden | Old code left calories stale. **Bug fixed.** |
| Mutation cascade is one atomic statement | Was three un-transacted requests; a crash mid-way left a "complete" day with an unaccounted entry (§5.8). |
| OFF `nutrition_data_per: "100g"` no longer treated as a serving | The old regex matched it, flipping the basis and reading `*_serving` nutriments that such products do not publish. **Bug fixed.** |
| Barcode hits promoted server-side | Same demand-driven promotion, now atomic and idempotent under the partial unique indexes. |

## 5. Caching — investigated, no Redis

* **Barcode**: not separately cached. Hits are materialised into `food_items`,
  which is both cache and loggable record — the pre-existing behaviour.
* **USDA search**: small Postgres table (`external_food_cache`), 1 h TTL, only to
  protect a rate-limited key. Best-effort; a cache failure never fails a search.
* **Rejected**: importing USDA/OFF datasets. OFF alone is ~3M products; nothing
  needs offline coverage of never-searched foods and it would not fit the free
  tier. Rationale recorded in the migration file itself.
* **Rate limiting**: in-memory token bucket per user. Per-instance, which with
  `max-instances=4` is a *tighter* bound than a shared counter.

## 6. Verification status

**Backend — verified.** 137 tests: diary integration, cross-user authorisation,
totals/calculation regressions, timezone + DST, provider normalisation, degraded
upstreams, N+1 absence. Typecheck, lint and build pass.

**Mobile — typecheck + unit tests only (21 pass).** The app cannot be run
end-to-end here: the API is not deployed and the Supabase project referenced by
`.env` still returns NXDOMAIN. Screen-level behaviour is unverified.

## 7. Not migrated (still direct Supabase)

Out of scope for this task; `supabaseFoodStore.ts` / `supabaseUserStore.ts` still
own them:

* recents list (`getRecentSupabaseItems`) — still the N+1 described in §7.1
* favourites, recipes & custom meals CRUD, food catalogue writes
* weight, profile, settings, adaptive recommendations

## 8. Follow-ups

1. **Rotate the USDA key** — shipped in every prior build.
2. Point `EXPO_PUBLIC_API_BASE_URL` at a deployed API and run the app.
3. Migrate the recents list — the last big N+1.
4. Adopt `DB.getDiaryDay` in `FoodDiaryScreen` to use the server's meals/totals
   directly instead of the flattened compatibility shape.
5. Client refresh on `AUTH_TOKEN_EXPIRED`.
