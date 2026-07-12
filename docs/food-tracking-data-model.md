# Food Tracking Data Model

This document describes the authoritative food-log behavior as of July 2026.

## Nutrition and serving model

`src/engine/nutrition.ts` is the single calculation path for food previews,
diary rows, totals, and adaptive-calorie inputs.

A food's calorie and macro values describe exactly one resolved serving. The
resolved serving is:

1. `servingSizeValue` and `servingSizeUnit` when the value is finite and greater
   than zero.
2. Otherwise the nutrition-basis default: 100 g for `100g`, 100 ml for `100ml`,
   or 1 serving for `serving`.

A normal log stores a quantity in the same unit as the resolved serving. Its
nutrition is `food value * quantity / resolved serving size`. Quick-add rows
already contain absolute entry totals and are never quantity-scaled.

Calories are displayed at zero decimal places and macro grams at one decimal
place. Collections sum unrounded entry values and round once at the end. The
adaptive-calorie engine also consumes unrounded, quantity-scaled calories.
Quick-add calculated energy uses 4 kcal/g protein, 4 kcal/g carbohydrate,
9 kcal/g fat, and 7 kcal/g alcohol.

Open Food Facts products whose declared basis is `serving` use
`serving_quantity` (or a parsed gram/ml amount from `serving_size`) as the
serving size. `product_quantity` is package size and is not a serving fallback.
When serving weight is unknown, the app stores 1 `serving` and does not silently
reuse unscaled per-100g nutrients.

## Entry flow

The logging screens validate positive quantities and call the `DB` facade.
Normal food writes contain the user, food id, diary date, timestamp, quantity,
and meal. Quick adds contain their absolute calories/macros and optional alcohol.
The facade emits a `food_log` change event only after a successful write; add,
update, delete, and copy notifications include the affected user and date when
known.

Supabase entries snapshot serving and nutrient values when they are created.
That prevents later food edits from rewriting historical remote diary totals.
The Expo Go local-development store is still reference-based: it joins the
current food row when reading a log, so editing a food can change historical
local-development totals. Aligning that development-only schema with Supabase
requires a migration and remains deliberately out of scope.

## Persistence and failure behavior

Production reads are local-first through SQLite cache with Supabase as the
authoritative store. Adds are shown optimistically while the network write is in
flight. A failed add removes its optimistic cache row. A failed delete restores
the cached row. Successful server refreshes sweep legacy `error` rows and stale
negative-id `pending` rows left by an interrupted write.

There is currently no offline mutation queue or replay worker. A write that
cannot reach Supabase fails visibly and is rolled back; the UI must never claim
that an unsaved mutation succeeded. Adding durable offline writes is a separate
feature because it needs ordering, conflict, identity, retry, and migration
rules.

Save handlers use synchronous re-entry locks in addition to disabled UI state so
rapid taps cannot submit duplicate requests. Diary delete/undo waits for the
delete to settle before restoring. Copy and repeat duplicate detection includes
the full time of day through seconds and the complete quick-add nutrition shape.

## Dates and meal slots

Diary date keys are local-calendar `YYYY-MM-DD` values. Date-key parsing uses
local noon to avoid UTC boundary drift. Logged timestamps are ISO instants built
from the selected local date and time. Meal grouping prefers a recognized meal
label, then falls back to the logged local hour for legacy entries.

When the focused diary was tracking the previous value of “today,” foregrounding
or refocusing after midnight advances it to the new local day. A deliberately
selected historical or future date is preserved.

The `foodDiaryStartHour` and `foodDiaryEndHour` settings columns are legacy sync
contract fields. They are not the authoritative date-boundary model and remain
in the schema for compatibility.
