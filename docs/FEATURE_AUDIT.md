# HybridPilot Feature Audit

Date: 2026-04-07

## Scope

This audit covers the current Expo/React Native app in `hybrid-pilot`, with emphasis on user-facing workflows, persistence, validation, and feature gaps. It is based on source inspection plus the available automated check.

## Validation Run

- Ran `npx tsc --noEmit`.
- Result: failed because `src/API/supabase/endpoints.ts` references an implicit `any` parameter, an undefined `supabase`, and an undefined `setFoods`.
- No dedicated test scripts exist in `package.json`.
- No `*.test*`, `*.spec*`, or `__tests__` files were found under `src`.
- Native build was not run after the TypeScript failure; the first quality gate should be fixed before treating a native build as meaningful.

## Current Feature Map

### App Shell And Persistence

- Expo React Native app with local SQLite storage, Redux user state, Inter font loading, and an animated splash.
- Boot flow hydrates onboarding status and the first local user from SQLite.
- Navigation gates users through `Onboarding`, `Main`, or `Login`.
- Main tabs are `Home`, `Food`, center shortcut sheet, `Weight`, and `More`.
- Local SQLite migrations cover users, app key-value storage, food items/logs/favorites/custom meals, weight entries/goals, user settings, activities, and extended nutrient fields.

### Onboarding

- Flow: Welcome -> Goal -> Goal Rate -> Body Data -> Activity -> Training -> Fuel Plan -> Account -> Success.
- Goal options: lose fat, maintain, build muscle.
- Fat loss and muscle gain include pace selection.
- Body data captures age, height, weight, and sex.
- Activity captures baseline activity level.
- Training captures multiple training modes.
- Fuel plan estimates calories and macros from body data, activity, and goal pace.
- Account creation is local-only and writes the user, onboarding profile, onboarding-complete flag, and initial weight entry.

### Food Diary And Logging

- Food diary has a week/date strip, daily calorie ring indicators, macro target progress, hourly timeline, favorite quick adds, copy-yesterday, custom food creation, and configurable visible diary hours.
- Add Food supports local search, recent foods, favorites, save/unsave favorite, barcode scanning, and custom food creation.
- Custom food supports core macros plus many optional micronutrient and nutrient detail fields.
- Edit Food Entry supports quantity, time, label, nutrition preview, save, and delete.
- Scanned Food Log lets users review quantity, label, favorite status, and nutrition preview before logging.
- Food Library is a debug/local DB viewer with delete support.
- Barcode scanner validates EAN/UPC/GTIN-style codes, looks up local DB first, then Open Food Facts, and saves resolved products locally.

### Weight

- Weight diary supports manual add/edit/delete, notes, date/time, future timestamp confirmation, unusual weight confirmation, same-day entry replacement, optimistic updates, undo after delete, and local pending sync status.
- Weight chart supports ranges `1W`, `1M`, `3M`, `1Y`, and `ALL`, daily scale line, EMA-style trend line, and weight goal band.
- Goal workflow supports target weight, optional target date, pace helper, clear goal, and chart integration.
- Insights include trend, consistency, goal progress, and volatility with explanatory details.
- History is grouped by local date, supports pull-to-refresh, and has swipe-to-delete.
- Debug settings can seed weight histories for trend-down, trend-up, and maintain-ish scenarios.

### More, Settings, And Debug

- More screen is mostly a debug/settings shell.
- Settings screen exposes SQLite table counts, DB reset, sample seed data, and weight history presets.
- Food Library is reachable from More as a local DB debug tool.

## Workflow Issues And Improvement Plan

### P0: Build And Quality Gates

- `src/API/supabase/endpoints.ts` blocks strict TypeScript. Either remove the unused placeholder, implement a typed Supabase client, or isolate it behind a disabled stub that compiles.
- Add scripts: `typecheck`, `lint`, and `test` in `package.json`.
- Add at least repository/util tests around food logging, water tracking once added, weight goal math, barcode validation, and date/time helpers.
- Do not run release build validation until TypeScript is clean.

### P0: Placeholder Or Incomplete UI

- `HomeScreen` still says "This is the Home Screen"; replace it with a real dashboard for calories, water, weight trend, and today's quick actions.
- `WelcomeScreen` has an "I already have an account" button without a handler; either wire it to login/restore or remove it until real auth exists.
- `LoginScreen` is a visual placeholder and does not sign in.
- `MoreScreen` exposes debug tools as the main settings experience; split developer debug tools from user settings before release.
- `USDA` endpoint uses a placeholder base URL; either implement USDA search/import or remove the visible integration.

### P1: Food Logging UX

- Add quantity adjustment before immediate local search/favorite add, not only after scanned food.
- Add undo/snackbar for food log deletion and copy-yesterday.
- Add duplicate protection or a confirmation when copying yesterday into a day that already has entries.
- Add loading/error states around local search, Open Food Facts lookup, and DB operations.
- Add manual barcode entry fallback for scanner/camera failures.
- Replace noisy scanner/API logging of raw barcode and raw food response with dev-only guarded logs.
- Clarify custom food nutrition basis and units. Today custom foods are grams-only and lack brand/barcode/image fields.
- Promote Food Library from debug viewer into a safer user food manager, or keep it behind a dev gate.

### P1: Weight UX

- Same-day replacement is useful, but it should be explicit in the UI because users may expect multiple weigh-ins per day.
- Insights and history are hidden by default; consider showing compact summaries by default and letting users collapse them.
- Sync status is local-only. Either label it clearly as "local pending" or implement real sync.
- Add body composition fields later: body fat percentage, waist, resting heart rate, photos, or smart scale imports.
- Add unit support beyond kg before wider release if targeting US users.

### P1: Onboarding And Profile

- Add a profile/settings editor for calorie target, macros, body data, activity, training, and diary hours after onboarding.
- Make email optional if the account is truly local-only, or explain why it is required.
- Add clearer privacy copy around local-only storage.
- Add validation for birthdate age consistency against body-data age.
- Save onboarding selections as editable structured profile data, not only static initial targets.

### P2: Navigation And Architecture

- Food screens are registered in both root stack and food stack. That enables global shortcuts, but it increases close/pop complexity. Keep only the root modal path for global modals or wrap close behavior in a shared helper.
- Add a proper production/dev mode split for debug screens.
- Add typed route helpers for food logging context to avoid passing the same `date`, `loggedAt`, `mealType`, and `contextLabel` shape through many screens.

## Water Tracking Recommendation

Water tracking should be added as a first-class diary feature, not as a food item. The app already has `waterG` as a nutrient field on foods, but that is different from a user's deliberate drinking-water log.

### Phase 1: Data Model

- Add `water_logs` table:
  - `id`, `user_external_id`, `date`, `logged_at`, `amount_ml`, `source`, `created_at`, `updated_at`, `deleted_at`.
- Add user settings:
  - `daily_water_goal_ml`, `default_water_amount_ml`, `water_unit`, `show_water_widget`.
- Add `waterRepository.ts` with:
  - `addWaterLog`, `listWaterLogsByDate`, `updateWaterLog`, `deleteWaterLog`, `sumWaterByDate`, `copyWaterFromDate`.
- Add DB types and expose repository methods through `DB`.
- Keep drinking water separate from food `waterG` at first; later add an optional "total hydration" view that includes water from foods.

### Phase 2: UI

- Add a water widget to `FoodDiaryScreen`, near macro progress:
  - progress toward goal,
  - quick buttons like `250 ml`, `500 ml`, `750 ml`,
  - custom amount,
  - undo for last add,
  - date-aware totals.
- Add a `Water` shortcut to the center shortcut sheet.
- Add water settings under a real user settings screen:
  - daily goal,
  - default container,
  - unit: mL, cups, fl oz,
  - widget visibility.
- Add a compact Home dashboard tile after `HomeScreen` is upgraded.

### Phase 3: Insights

- Add streaks: days meeting hydration goal.
- Add gentle reminders configurable by time window.
- Add trend summaries: 7-day average, today vs average, and hydration consistency.
- Later correlate water with weight trend, training days, or high-sodium days.

### Phase 4: Testing

- Repository tests for add/update/delete/sum/copy by date.
- Utility tests for unit conversion and date key handling.
- Screen-level manual test checklist:
  - add water today,
  - add water to a past date,
  - custom amount,
  - delete/undo,
  - change goal/unit,
  - copy yesterday,
  - no-user state,
  - app restart persistence.

## Additional Popular Functionality To Consider

These are high-value additions based on current common capabilities in nutrition apps:

- Photo/AI meal scan and voice logging. MyFitnessPal now lists meal scan and voice logging as premium features, so this is becoming table-stakes for lower-friction logging.
- Intermittent fasting tracker. MyFitnessPal tracks fasting periods directly alongside meals, water, and exercise; Cronometer also exposes fasting dashboard visibility.
- Recipes, meals, and meal planning. Add reusable recipes, combined meals, scheduled meal templates, and grocery planning later.
- Wearable and health-platform sync. Cronometer highlights device/app sync and biometrics; this app already models sync status but does not sync yet.
- Micronutrient dashboard. The data model already stores many micronutrients, so a Cronometer-style "nutrients to improve" view is a natural differentiator.
- Streaks and reminders. Use lightweight habit loops for logging food, water, and weight.
- Data export. Useful for trust, coaching, and debugging.
- Barcode correction and contribution workflow. Allow users to correct a mismatched barcode locally.
- Restaurant/common-food remote search. Today remote lookup is mostly barcode-only.
- Body composition and measurements. Add waist, body fat, progress photos, and smart scale source metadata.
- Per-day and per-meal targets. Support different calorie/macro goals by weekday and meal timing.

## Suggested Roadmap

1. Fix TypeScript and debug placeholders.
2. Build real Home and user Settings shells.
3. Add water tracking as a small vertical slice: data, diary widget, shortcut, settings, tests.
4. Harden food logging UX: quantity-before-add, undo, duplicate copy guard, scanner fallback, dev-only logs.
5. Add test coverage and CI-like scripts.
6. Add profile target editing and proper auth/restore decisions.
7. Add advanced features: recipes/meals, fasting, micronutrient insights, health sync, AI/photo/voice logging.

## External Reference Notes

- MyFitnessPal App Store listing currently emphasizes water tracking, AI food tracking, workouts, dashboards, recipes, meal planning, device integrations, barcode scan, meal scan, voice logging, custom goals, and fasting: https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718
- MyFitnessPal Premium feature list includes goals by day, macro/calorie goals by meal, food timestamps, recipe discovery, meal scan, barcode scanner, intermittent fasting, multi-day logging, and voice logging: https://support.myfitnesspal.com/hc/en-us/articles/360032625951-What-are-the-features-of-MyFitnessPal-Premium
- MyFitnessPal Meal Scan FAQ describes camera/photo meal recognition and logging flow: https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ
- Cronometer positions itself around macros-to-micros nutrition, verified food data, weight goals, device sync, biometrics, barcode scanning, and detailed dashboards: https://cronometer.com/index.html
- Cronometer settings include a configurable water widget, diary visibility, water units, daily drinking-water goal, default container size, fasting visibility, sleep, streaks, highlighted nutrients, and nutrient balances: https://support.cronometer.com/hc/en-us/articles/360060181932-Display-Settings
- YAZIO has a diary water tracker that can be enabled under profile/settings: https://help.yazio.com/hc/en-us/articles/360000671858-Why-is-my-Water-Tracker-gone
