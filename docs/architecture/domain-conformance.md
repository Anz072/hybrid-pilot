# Domain Conformance

**Updated:** 2026-08-30
**Authoritative corpus:** `nouri-api/conformance/domain-conformance.json`
**Mirror:** `hybrid-pilot/conformance/domain-conformance.json` (byte-identical)

---

## The problem this solves

Nutrition, calorie-target and meal-slot logic is implemented **independently** in
both repositories. That is deliberate: the app computes optimistic previews
before the round trip, so a logged food shows its calories immediately rather
than after a server reply.

The duplication is the price of that. The **risk** is that both test suites stay
green while the two implementations drift apart — and the user sees one number
in the app and a different one after a refresh. Nothing detected that.

A single corpus of input/expected cases, executed by both repositories against
their own code, closes it. Neither side can change a rule without a test failing
in its own repo.

> **What the corpus is not.** Expected values encode the **current agreed
> contract**, not an independent proof of correctness. If both sides round the
> same way and that way is wrong, the corpus locks in the wrong answer. Its job
> is to stop the two diverging, and to make a deliberate change visible in
> review — changing behaviour means changing the fixture, in one commit, in
> both repos.

---

## What is covered, and why

### A · Intentionally duplicated deterministic domain logic — **conformance-tested**

Every one of these was compared function by function; all are semantically
identical today.

| Rule | Mobile | Backend |
| --- | --- | --- |
| `roundNutrient` | `engine/nutrition.ts` | `domain/nutrition.ts` |
| `FOOD_BASIS_DEFAULTS` / `getFoodResolvedServing` | ↑ | ↑ |
| `getQuantityScaleFactor` | ↑ | ↑ |
| `scaleFoodNutritionForQuantity` | ↑ | ↑ |
| `calculateLoggedNutrition` | ↑ | ↑ |
| `getLoggedCaloriesRaw` (unrounded, for aggregates) | ↑ | ↑ |
| `sumLoggedNutrition` (sum unrounded, round once) | ↑ | ↑ |
| `calculateQuickAddCaloriesFromMacros` (Atwater 4/4/9/7) | ↑ | ↑ |
| `clampCalorieTarget` (800–7000, rounded) | `engine/calorieTargets.ts` | `domain/calorieTargets.ts` |
| `getEffectiveCalorieTargetForDate` + daily overrides | ↑ | ↑ |
| `getMondayFirstDayIndex` | ↑ | `domain/timezone.ts` |
| `getMealSlotForHour` (11 / 16 / 21) | `screens/Food/foodUtils.ts` | `domain/mealSlots.ts` |
| `getMealSlotFromLabel` | ↑ | ↑ |
| `buildDuplicateKey` (copy-day dedupe) | `store/foodLogCopyUtils.ts` | `domain/duplicateKey.ts` |

### B · Presentation-only mobile logic — **not duplicated, not tested here**

`formatFoodHourLabel`, `clampFoodHour`, `MEAL_SLOT_DEFAULT_HOUR`,
`MEAL_SLOT_LABELS`, `CALORIE_SCHEDULE_DAY_LABELS` / `_NAMES`,
`getFoodDefaultLogAmount`, `assertValidFoodLogQuantity`.

These shape what a screen renders. They have no backend counterpart, so there is
nothing to conform to.

### C · Backend-authoritative — **duplicated for preview only**

`clampCalorieTarget` runs on both sides, but the **backend decides what is
stored**: `PATCH /v1/me` re-clamps and re-quantises regardless of what the client
sends. The mobile copy exists so the onboarding preview matches what will be
saved. It is conformance-tested precisely because a preview that disagrees with
the stored value is the bug this document exists to prevent.

The same holds for nutrition totals: the client previews, the server persists.

### D · Similar-looking, different semantics — **deliberately not merged**

| Pair | Why they are not the same thing |
| --- | --- |
| `getMondayFirstDayIndex` | Mobile takes a `Date` and reads `getDay()` in the device zone; the backend takes a `YYYY-MM-DD` key and parses it as UTC. Same answer for the same calendar date, different inputs and different failure modes. The corpus tests the **calendar-date → index** mapping and the mobile adapter builds its `Date` at **local noon**, so no DST edge can shift it. |
| Time-of-day in `buildDuplicateKey` | Mobile reads the device clock; the backend takes an explicit `tz` supplied by the client. Equivalent **given the same zone**, which is the contract. Corpus cases are fixed to UTC and the mobile test sets `TZ=UTC` before loading modules, because the mobile helper has no timezone parameter to pass. |
| `quantity` vs `quantityG` | The same field under two names. The fixture uses one neutral name and each side maps it; the rule is shared, the row shape is not. |
| Fuel-plan builders (`buildAutomaticFuelPlanForUser`, `buildMacroTargetsForCalories`, `scaleMacroTargetsToCalories`, `getWeeklyCalorieBudget`) | **Mobile only.** The backend has no counterpart — its `calorieTargets.ts` is 34 lines. Nothing to conform to, so nothing is asserted. |

### Explicitly excluded

**The adaptive TDEE engine.** It runs only on the device; its data access is
migrated but the analysis is not. There is no second implementation, so there is
nothing to conform to. It is out of scope here **and** out of scope for porting —
that needs a dual-run diff against real diary history, which does not exist yet.

**Gram/kilogram conversion.** There is none in the duplicated logic. Weights are
stored in kilograms with the original value and unit kept alongside; no shared
rule converts between them, so there is no case to write.

---

## Fixture format

Domain data only. No framework types, no HTTP, no database.

```json
{
  "version": 1,
  "suites": {
    "clampCalorieTarget": [
      { "name": "below the floor clamps up", "input": { "value": 799 }, "expected": 800 }
    ]
  }
}
```

Every case is `{ name, input, expected }`. `name` appears in the failure
message, so make it a sentence describing the rule rather than a label.

**105 cases across 14 suites**, covering normal values, boundaries, zero where
allowed, decimals, rounding halves in both directions, very small and very large
quantities, clamp boundaries, per-100g vs per-serving vs custom serving scaling,
macros that produce fractional calories, meal-slot thresholds, and null/optional
inputs.

## Adding a case

1. Edit **`nouri-api/conformance/domain-conformance.json`** — the authoritative copy.
2. `./scripts/sync-conformance.sh sync` — writes the mirror and both checksums.
3. Run both suites. If one side fails, that is the finding; see below.
4. Commit the fixture, both checksums and any fix **together**.

## Syncing and verifying

```bash
# in nouri-api
pnpm conformance          # verify: checksums match, and mirrors match if present
pnpm conformance:sync     # copy authoritative -> mirror, rewrite both checksums
```

Three independent guards:

| Guard | Catches |
| --- | --- |
| Each repo asserts its own copy against its own committed `CHECKSUM` | Editing a corpus in one repo without syncing — fails in **that** repo |
| The backend suite compares its hash to the mobile mirror when the sibling is checked out | The two repos holding different corpora |
| `sync-conformance.sh verify` | The same, from the command line or CI |

Verified by simulation: editing the mirror alone fails the mobile checksum test
**and** `verify`, which prints both hashes and the remedy.

There is no shared package, no registry and no third repository. The cost of
that is one command after a deliberate change; the benefit is that neither repo
depends on the other to build or test.

---

## Current state

**The two implementations agree on all 105 cases.** No divergence had to be
resolved — the corpus locks in agreement that already existed rather than
papering over a difference.

### Drift is provably detected

Nine mutations, each reverted afterwards, every one caught by the suite in the
repository that was mutated:

| Mutation | Side | Result |
| --- | --- | --- |
| `Math.round` → `Math.floor` in `roundNutrient` | mobile | ✅ 3 suites |
| Fat coefficient 9 → 8 | mobile | ✅ |
| Calorie floor 800 → 900 | mobile | ✅ |
| Meal-slot threshold 11 → 12 | mobile | ✅ |
| `Math.round` → `Math.floor` in `roundNutrient` | backend | ✅ 10 cases |
| Carb coefficient 4 → 5 | backend | ✅ 3 cases |
| Calorie ceiling 7000 → 6000 | backend | ✅ 3 cases |
| Meal-slot threshold 21 → 22 | backend | ✅ 1 case |
| Duplicate-key separator `\|` → `~` | backend | ✅ 6 cases |

## If the two sides disagree

Do not pick one. For each difference:

1. Record what mobile does today, and what the backend does today.
2. Decide which is the existing **product contract** — usually the side the user
   has been seeing, not the tidier code.
3. Fix the other side, and note the decision in this file.
4. Only change agreed behaviour when an implementation is clearly defective, and
   say so explicitly in the commit.
