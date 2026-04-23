# HybridPilot Feature Audit

Date: 2026-04-23

Supersedes: 2026-04-12 audit

## Scope

This audit re-checks the current `hybrid-pilot` codebase as of 2026-04-23. It focuses on:

- user-visible feature coverage,
- onboarding and account flow,
- food diary, search, recipe, and custom-meal workflows,
- weight tracking and adaptive calories,
- settings coherence,
- release-risk UX issues and odd flows,
- practical next-step product opportunities.

## Validation Snapshot

- Ran `cmd /c npx tsc --noEmit` on 2026-04-23.
- Result: passed.
- `package.json` still has no `lint`, `test`, or dedicated `typecheck` scripts.
- No `*.test*`, `*.spec*`, or `__tests__` files were found under `src`.
- This audit is code-informed, not device-runtime tested. I did not launch the app in an emulator/device during this pass.

## Executive Summary

- The app is in meaningfully better shape than the previous audit suggested. Home is now a real dashboard, Login is real, recipes and custom meals are real product slices, and adaptive calories has a strong v1 review flow.
- The strongest end-to-end loop is now: onboarding -> home/dashboard -> food diary -> weight trend -> settings/adaptive review.
- The main gaps are not missing foundations anymore. They are coherence issues: hidden features, stale copy, save-flow inconsistencies, debug surfaces exposed in production navigation, and a few places where the UI promises behavior the underlying flow does not deliver.
- The app feels close to a strong private beta, but it still needs one tightening pass before it feels truly polished and trustworthy.

## What Feels Strong Right Now

### 1. Onboarding and account creation

- The onboarding flow is substantial and useful: goal, goal rate, body data, activity, training, protein focus, fuel plan, and a Google-backed account creation step.
- The account step now clearly establishes that Google + Supabase is the supported account model.
- Finishing onboarding creates the user profile and seeds the initial weight entry, which makes the app feel immediately alive instead of empty.

### 2. Home is now a real tab

- `src/screens/Home/HomeScreen.tsx` is no longer a placeholder.
- It gives a solid daily summary: calorie gauge, macro progress, current weight, 7-day trend, goal progress, and micronutrient preview.
- `src/screens/Home/MicrosOverviewScreen.tsx` is a meaningful companion surface, not just a stub.

### 3. Food system breadth is impressive

- The app now supports:
  - local foods,
  - recent foods,
  - favorites,
  - USDA search,
  - Open Food Facts barcode lookup,
  - quick add,
  - reusable custom meals,
  - reusable recipes,
  - read-only food details,
  - recipe/custom-meal libraries with edit entry points.
- `src/screens/Food/AddFoodScreen.tsx` is one of the strongest screens in the app from a product capability standpoint.

### 4. Weight is still one of the best-polished slices

- `src/screens/Weight/WeightScreen.tsx` remains a strong product area.
- It supports:
  - trend charting,
  - goal setting,
  - history,
  - optimistic saves,
  - delete undo,
  - same-day replacement,
  - sanity checks on unusual/future entries,
  - adaptive-calorie refresh after saves.

### 5. Adaptive calories has real product value

- `src/engine/adaptiveCalories.ts` and `src/screens/User_Settings/AdaptiveCaloriesSettingsScreen.tsx` form a believable v1.
- The model is conservative in a good way:
  - it requires complete days,
  - it requires enough weigh-ins,
  - it explains why recommendations do or do not appear,
  - it requires explicit user review before apply.
- This is one of the app's most differentiating features.

## Current Feature Map

### Implemented and user-meaningful

- Google-backed onboarding and login
- home dashboard
- micronutrient overview
- food diary by day and hour
- add/search/log food
- barcode scanning via camera
- quick add logging
- custom meal creation and editing
- recipe creation and editing
- recipe/custom-meal libraries
- weight logging, history, and chart
- goal editing and calorie-plan adjustment
- daily calorie schedule
- protein focus and training profile settings
- adaptive calorie review flow

### Present but rough or inconsistent

- diary repeat/favorite shortcuts
- copy-yesterday behavior
- debug-facing food library
- diary timeline-hour editor
- save-flow consistency across settings screens
- empty-state and fallback messaging in several auth/settings surfaces

### Model/schema support exists but product surface does not

- `activities` table exists in schema/local storage, but there is no exercise/activity UI yet.
- weight source types include `smart_scale`, `healthkit`, `health_connect`, `google_fit`, and `csv`, but there is no import/integration surface yet.
- there is no export/import UX even though the app now stores meaningful user history worth exporting.

## Highest-Value Findings

### High

#### 1. Daily calorie schedule navigates away even when save fails

- In `src/screens/User_Settings/CalorieScheduleScreen.tsx`, `navigation.navigate("MoreMainScreen")` runs in `finally`, not only on success.
- That means the user is taken away from the screen even after a failed save attempt.
- Impact:
  - feels like the change probably saved,
  - makes recovery harder,
  - creates trust issues in settings.

#### 2. Food Diary promises recipe auto-logging, but recipe save does not log anything

- `src/screens/Food/FoodDiaryMoreSection.tsx` says: "Build a reusable recipe and log one serving into ..."
- `src/screens/Food/CreateRecipeScreen.tsx` saves or updates the recipe, then closes. It never creates a diary entry.
- The custom meal flow does log immediately (`src/screens/Food/CreateCustomFoodScreen.tsx`), which makes the recipe behavior feel even more inconsistent.
- Impact:
  - user expectation mismatch,
  - likely repeated confusion,
  - extra steps at exactly the point where the user expects speed.

### Medium

#### 3. Quick Add carries alcohol in state and persistence, but the UI never exposes it

- `src/screens/Food/QuickAddFoodScreen.tsx` still tracks `alcoholValue`, includes it in calorie math, loads it from existing entries, and saves it back.
- The actual form only renders Protein, Fat, and Carbs inputs.
- Impact:
  - existing alcohol values cannot be reviewed or edited,
  - users cannot intentionally create alcohol-inclusive quick adds,
  - hidden data model behavior is hard to trust.

#### 4. Food Diary quick-access features are half wired and partially hidden

- `FoodDiaryQuickAdds` exists but is commented out in `src/screens/Food/FoodDiaryScreen.tsx`.
- `FoodDiaryMoreSection` accepts `onQuickAddFood`, but there is no quick-add action row rendered in that component.
- Impact:
  - the diary feels less efficient than the codebase suggests it should be,
  - favorite repeat-entry behavior is effectively buried,
  - part of the intended "fast logging" story is missing.

#### 5. Copy-yesterday has no duplicate guard, merge strategy, or confirmation when the target day already has entries

- `src/screens/Food/FoodDiaryScreen.tsx` triggers copy directly.
- `src/store/supabaseFoodStore.ts` copies entries into the destination date with blind inserts.
- Impact:
  - easy accidental duplication,
  - hard-to-trace diary inflation,
  - especially risky for users who partially pre-logged the current day.

#### 6. Debug and destructive tools are exposed directly inside the main More flow

- `src/screens/User_Settings/MoreScreen.tsx` has a visible `Debug Menu`.
- From there, users can open:
  - `SettingsScreen`, which exposes `Seed Sample`, `Reset DB`, and destructive weight presets,
  - `FoodLibraryScreen`, which can delete food items and related data.
- Impact:
  - dangerous in any non-dev build,
  - undermines product polish,
  - makes the primary settings surface feel less trustworthy.

#### 7. Food delete flow is harsher than weight delete flow

- Weight delete supports undo in `src/screens/Weight/WeightScreen.tsx`.
- Food delete in `src/screens/Food/FoodDiaryScreen.tsx` is immediate after confirmation and has no undo.
- Impact:
  - inconsistency between major product areas,
  - harsher penalty in the diary where taps are more frequent.

#### 8. Several settings/auth strings still describe a "local account" world that the app has already moved past

- Examples:
  - `ActivityLevelSettingsScreen.tsx`
  - `CalorieAllowanceSettingsScreen.tsx`
  - `CalorieScheduleScreen.tsx`
  - `TrainingTypesSettingsScreen.tsx`
  - `ProteinFocusSettingsScreen.tsx`
  - `DiaryHoursDebugScreen.tsx`
- These screens still say things like "Load a local account first..."
- Current onboarding/account flow explicitly says Google/Supabase is the supported model.
- Impact:
  - stale copy,
  - product-story mismatch,
  - feels like unfinished migration.

#### 9. Weight sync/status copy is misleading

- `src/screens/Weight/WeightScreen.tsx` still renders `Offline | Local only`.
- Current weight data path goes through `supabaseUserStore`, with server-backed weight entries/goals and migration helpers.
- Impact:
  - wrong mental model,
  - makes the feature look less capable than it is,
  - may confuse debugging/support later.

### Low

#### 10. USDA search messaging can over-promise when the API key is missing

- `src/API/USDA/usdaEndpoints.ts` silently returns `[]` when `EXPO_PUBLIC_USDA_API_KEY` is missing.
- `src/screens/Food/AddFoodScreen.tsx` still uses search hint copy that implies USDA search is active.
- Impact:
  - subtle trust issue,
  - confusing for environments where remote search is not configured.

#### 11. No visible manual barcode entry fallback

- Barcode lookup depends on camera scanning UI.
- There is no clear manual UPC/EAN entry path in the food flows.
- Impact:
  - bad fallback for damaged packaging,
  - bad fallback for simulator/tablet/no-camera contexts,
  - slower recovery when scan framing fails.

#### 12. Logging and scanner code still contain release-noisy console output

- Examples:
  - `src/API/OpenFoods/openFoodsEndpoints.ts`
  - `src/API/supabase/googleAuth.ts`
  - `src/screens/Food/FoodBarcodeScannerShared.tsx`
  - `src/screens/Food/FoodBarcodeScannerModal.tsx`
  - `src/API/USDA/usdaEndpoints.ts`
- Impact:
  - noisy debug output,
  - harder production troubleshooting,
  - avoidable polish issue.

## Weird Flows Worth Fixing Soon

### 1. Settings save behavior is inconsistent

- Some settings screens stay in place after save.
- Some navigate back.
- `CalorieScheduleScreen` navigates away even on failure.
- This should be normalized:
  - either save-and-stay with a clear confirmation,
  - or save-and-close only on success.

### 2. Custom meal and recipe flows behave differently after save

- Custom meal creation saves and logs immediately.
- Recipe creation saves only.
- The UI language currently treats them too similarly in some entry points.

### 3. Diary completion is meaningful, but the app does not coach the user enough

- Marking a day complete materially affects adaptive calories.
- The concept is good.
- The surrounding UX still feels slightly hidden and "advanced," especially for newer users.

### 4. The product language has not fully caught up with the architecture migration

- The app is no longer conceptually "local-first with optional auth" in the visible experience.
- It now behaves more like "Google-backed personal tracker with local persistence."
- Some copy still speaks from the old model.

## Product Improvements That Would Add Real Value

### 1. Add a real profile/account screen

- Edit display name
- Edit birthdate
- Edit sex
- Edit height
- View/change connected account email
- Sign out
- Explain sync/account status clearly

This is the biggest missing "basic trust" feature in the app right now.

### 2. Add units and regional preferences

- weight: kg/lb
- body height: cm / ft+in
- food: g / oz where relevant
- maybe date/time display preferences later

This would noticeably improve accessibility and broaden usability.

### 3. Add a save-choice finish for recipes

- `Save recipe`
- `Save and log 1 serving`

This would remove one of the biggest current flow mismatches.

### 4. Add manual barcode entry

- barcode keyboard field alongside camera scan
- reuse the same validation logic already present in barcode utilities

### 5. Add repeat-meal helpers instead of raw copy-yesterday only

- preview entries before copy
- skip duplicates
- merge into empty slots only
- favorite full meal blocks, not only single foods

### 6. Add a weekly review surface

- average calories vs target
- completed diary days
- weight trend change
- adaptive recommendation status
- "most repeated foods"

The app already has most of the underlying data for this.

### 7. Add activity logging as Adaptive v2 groundwork

- the schema already has `activities`
- adaptive calories explicitly ignores exercise in v1
- a simple activity layer would unlock a clear roadmap story

### 8. Add export/import

- CSV export for weights and food logs
- JSON backup/export for the full profile

This would materially improve user trust and data ownership.

## Engineering Improvements With Good ROI

### 1. Add baseline quality scripts

- add `typecheck`
- add `lint`
- add `test`

The codebase now deserves first-class quality gates.

### 2. Add a small test suite around fragile product logic

- adaptive calorie window rules
- copy-yesterday behavior
- recipe/custom meal log behavior
- calorie schedule save behavior
- quick add calorie math
- same-day weight replacement

### 3. Extract shared food search logic

- `AddFoodScreen` and `CreateRecipeScreen` duplicate a lot of search normalization, ranking, dedupe, and remote/local blending logic.
- A shared hook or utility would reduce future drift.

### 4. Gate or strip debug-only screens by environment

- Debug Menu
- Reset DB
- sample seeding
- destructive food-library delete tools

### 5. Clean up product copy after the Supabase migration

- replace "local account" wording
- unify save-success patterns
- align recipe/custom meal action text with actual behavior

## Recommended Roadmap

### Pass 1: coherence and trust

1. Fix `CalorieScheduleScreen` so it only exits on successful save.
2. Fix the recipe logging promise mismatch.
3. Restore or intentionally remove the hidden diary quick-add/favorites path.
4. Add delete undo for food diary entries.
5. Replace stale "local account" copy with current Google-account language.
6. Hide Debug Menu and Food Library from standard user navigation in non-dev builds.

### Pass 2: friction removal

1. Add manual barcode entry.
2. Add duplicate protection/preview to copy-yesterday.
3. Expose alcohol in Quick Add if it remains part of the data model.
4. Add profile/account management and sign-out.
5. Add units/preferences.

### Pass 3: differentiation

1. Weekly review/report screen.
2. Activity logging.
3. Export/import.
4. Adaptive calories v2 inputs and notifications.

## Bottom Line

HybridPilot is no longer a collection of promising screens. It now has a believable core product.

What holds it back is not the absence of major features. It is the last 15 percent:

- aligning copy with behavior,
- removing dev-only surfaces from the main experience,
- making fast logging genuinely fast,
- and tightening the "save, trust, continue" feeling across settings and diary flows.

If the next pass focuses on coherence instead of feature sprawl, the app should feel much more mature very quickly.
