# Food-Tracking Reliability Plan

Date: 2026-07-10. Status: complete (verified by typecheck + tests).

Findings source: full-repo audit of nutrition math, persistence, dates, and the in-progress
design overhaul (branch `feat/design-overhaul`, batches 1–7 done, batch 8 pending).

## Batch A — Nutrition correctness (single calculation path)

- [x] A1. `foodUtils.ts`: one authoritative serving-resolution + scaling path.
      `getFoodResolvedServing` must require `servingSizeValue > 0` (matching the repos);
      add `scaleNutritionForQuantity(food, quantity)` used by every preview; keep the
      canonical rounding policy (calories 0 dp, macros 1 dp, totals rounded once).
- [x] A2. `calculateQuickAddCaloriesFromMacros`: include alcohol at 7 kcal/g.
- [x] A3. `adaptiveCalories.ts`: day totals must use quantity-scaled calories
      (currently sums the per-serving base — corrupts TDEE estimates).
- [x] A4. Open Food Facts normalizer: for `nutrition_data_per = "serving"`, serving size
      must come from `serving_quantity` (grams per serving), not `product_quantity`
      (package size). Fall back to 1 "serving" when no gram weight exists.
- [x] A5. Replace the duplicated local scalers in `ScannedFoodLogScreen`,
      `FoodReadOnlyScreen`, `EditFoodEntryScreen` (micros factor), and
      `CreateRecipeScreen.calculateIngredientFactor` (its `factor = amount`
      fallback silently inflates recipes) with the shared helper.
- [x] A6. Local read path: resolve `servingSize` with the basis fallback when
      assembling `DBUserFoodLogEntry`, so stored-null serving sizes scale the same
      way in previews and totals.
- [x] A7. Validate `quantityG > 0` in the write paths (repo + store), not just the UI.

## Batch B — Persistence integrity (no silent loss, no ghosts, no dupes)

- [x] B1. Failed add: delete the optimistic `cached_food_entries` row (rollback)
      instead of marking it `error` forever. Phantom rows currently persist in the
      diary and are undeletable.
- [x] B2. Failed delete: roll back `deleted_at` on the cached row so local and server
      state don't diverge silently.
- [x] B3. Sweep stale optimistic rows (negative-id `pending` from a kill mid-write,
      legacy `error` rows) when replacing cache contents from the server.
- [x] B4. Synchronous re-entrancy guards (ref locks) on every save handler:
      ScannedFoodLog, QuickAdd, EditFoodEntry, CreateCustomFood, CreateRecipe,
      and the diary favorite "Log" chip (currently zero protection).
- [x] B5. EditFoodEntryScreen: catch + surface save/delete failures (currently silent).
- [x] B6. Delete + undo: sequence undo behind the in-flight delete so a failed delete
      cannot combine with undo to duplicate the entry.
- [x] B7. Repeat-meal: preserve seconds in copied `loggedAt` so its duplicate detection
      is idempotent (copy-day already is); keep `alcoholG` on quick-add undo/copy.
- [x] B8. `DB.ts`: update/delete notifications carry `{date, userExternalId}` like adds.

## Batch C — Dates

- [x] C1. Food Diary refreshes "today" on focus/app-state change; an app left open
      across midnight must not log new food onto yesterday's date.

## Batch D — Design-overhaul batch 8 (Food family cleanup only)

- [x] D1. Remove residual 800/900 font weights in Food family files (59 declarations).
- [x] D2. Fix the misnamed `slate300` style key in AddFoodScreen; verify remaining
      `brand800` usages are intentional ink surfaces.
- [x] D3. Remove proven-dead style keys (e.g. FoodEntryForm previewStrip/heroCard).

## Batch E — Tests + docs

- [x] E1. `npm test` runs all `scripts/*.test.cjs`.
- [x] E2. New deterministic tests: scaling/rounding/serving resolution, quick-add
      energy (incl. alcohol), adaptive day totals regression, OFF normalization,
      copied-timestamp dedup, date-key round-trips, meal-slot resolution,
      write-path quantity validation.
- [x] E3. Documentation: authoritative nutrition model, serving/unit behavior,
      entry data flow, persistence behavior + known limitations (no offline queue;
      local dev mode is reference-based while Supabase snapshots macros).

## Explicitly out of scope (documented limitations instead)

- Building an offline write queue / sync replay (a real feature, not a fix; the
  honest behavior is: fail visibly, roll back, never show unsaved data as saved).
- Re-architecting the local dev store to snapshot macros like Supabase.
- Removing `foodDiaryStartHour/EndHour` schema columns (dead but load-bearing in
  sync contracts; documented as legacy).
- Migrating the six deferred Food screens to shared primitives (visual-only).
