# Dribsnis Feature Audit

Date: 2026-04-24

Supersedes: 2026-04-23 audit

## Scope

This pass builds on the 2026-04-23 audit and re-checks the current
`dribsnis` codebase as of 2026-04-24. It focuses on:

- what changed since the previous audit,
- the current product shape across onboarding, food, home, weight, and settings,
- remaining UX and trust gaps,
- competitive positioning against current leading nutrition apps,
- the highest-value improvements to make next.

## Validation Snapshot

- Ran `cmd /c npx tsc --noEmit` on 2026-04-24.
- Result: passed.
- `package.json` still has no `lint`, `test`, or dedicated `typecheck` scripts.
- No `*.test*`, `*.spec*`, or `__tests__` files were found under `src`.
- This audit is code-informed, not device-runtime tested. I did not launch the
  app in an emulator or on a device during this pass.
- Competitive references were checked on 2026-04-24 against official product
  pages or official App Store listings.

## Executive Summary

- Dribsnis is in materially better shape than it was even one day ago. The
  app now has a real profile/account screen, a real weekly review surface, a
  fixed recipe save-and-log flow, duplicate-safe copy-yesterday behavior, a
  manual barcode fallback, and food-delete undo.
- The product now reads much more clearly as a focused nutrition tracker with
  three promising strengths:
  - MacroFactor-style adaptive calorie logic,
  - Cronometer-style micronutrient depth,
  - Lose It-style weekly calorie scheduling.
- The biggest gap is no longer "missing core screens." The biggest gap is
  product coherence versus best-in-class competitors:
  - logging is still a little fragmented,
  - weekly coaching is split across separate surfaces,
  - units and regional preferences are missing,
  - integrations and export are missing,
  - debug tooling still leaks into the main user experience.
- The right next move is not feature sprawl. It is tightening the core loop:
  log fast, review weekly, trust the data, and act on the recommendation.

## Since The 2026-04-23 Audit

### Clear improvements

- `src/screens/User_Settings/ProfileSettingsScreen.tsx` is now a real account
  and profile surface. The prior audit called this the biggest missing trust
  feature, and that gap is now meaningfully addressed.
- `src/screens/User_Settings/WeeklyReviewScreen.tsx` is now wired from
  `src/screens/User_Settings/MoreScreen.tsx` and gives the app a true weekly
  insight surface instead of only daily and settings views.
- `src/screens/Food/CreateRecipeScreen.tsx` now supports `Save & Add`, which
  resolves the old mismatch where recipe creation promised immediate logging but
  only saved the recipe.
- `src/screens/Food/FoodDiaryScreen.tsx` now uses duplicate-aware
  copy-yesterday preview and confirmation instead of blind copying.
- `src/screens/Food/FoodDiaryScreen.tsx` now gives food deletion an undo path,
  which makes diary editing feel much safer.
- `src/screens/Food/FoodBarcodeScannerShared.tsx` now includes a manual
  "Scan or enter barcode" fallback, which is a real usability improvement.
- The old "local account" user-facing copy appears to be gone. The migration to
  Google-backed account language is much cleaner than it was in the last pass.
- `src/screens/User_Settings/CalorieScheduleScreen.tsx` now navigates back only
  after a successful save instead of leaving the screen on failure.

### Still unresolved from the last audit

- `src/screens/Food/QuickAddFoodScreen.tsx` still keeps alcohol in state,
  editing, persistence, and calorie math, but the UI still exposes only protein,
  fat, and carbs.
- Fast logging in the diary is still partially fragmented:
  - `src/screens/Food/FoodDiaryScreen.tsx` still comments out
    `FoodDiaryQuickAdds`,
  - `src/screens/Food/FoodDiaryMoreSection.tsx` still receives
    `onQuickAddFood`,
  - that quick-add row still is not rendered in the actual section UI.
- `src/screens/User_Settings/MoreScreen.tsx` still exposes a visible
  `Debug Menu`.
- The app still has no units/preferences system, no activity UI, no health sync
  surface, and no export/import UX.
- Engineering hygiene is still thin: no test suite, no lint script, no
  typecheck script alias, and no automated quality gate.

## Current Product Snapshot

### Strong and user-meaningful right now

- Google-backed onboarding and login
- dashboard-style home tab with calories, macros, weight trend, goal progress,
  and micronutrient preview
- dedicated micronutrient overview screen
- food diary by date and hour
- food search with three meaningful modes in `src/screens/Food/AddFoodScreen.tsx`:
  - all foods,
  - recipes,
  - custom meals
- barcode flow with camera scan and manual barcode entry
- quick add
- custom meal creation and editing
- recipe creation and editing
- owned and public recipe/custom meal discovery
- dedicated "Your recipes" and "Your custom meals" library screens
- weight history, goal management, trend charting, undo delete, and same-day
  replacement
- adaptive calorie review flow
- weekly review surface
- profile/account management and sign out
- daily calorie schedule with weekly budget preview

### Present, but still rough or hidden

- diary-specific quick logging is split across:
  - the global shortcut sheet in `src/navigation/MainTabNavigator.tsx`,
  - the food search flow in `src/screens/Food/AddFoodScreen.tsx`,
  - the diary itself, where favorite quick-add UI is still commented out
- Quick Add has a hidden alcohol model that the user cannot see or edit
- public recipe/custom meal support exists, but discovery is still very plain:
  no save/bookmark layer, no social proof, no creator-centric browsing
- weekly review is strong as a report, but not yet strong as an action loop
- debug and destructive local tooling are still visible from the standard
  settings path

### Model and schema support exists, but product surfaces do not

- `activities` exists in SQLite and Supabase schema, but there is still no
  activity or exercise logging UI
- weight sources already include `smart_scale`, `healthkit`,
  `health_connect`, `google_fit`, and `csv`, but there is still no import or
  integration surface
- there is still no user-facing export/import or backup flow

## Product Positioning Now

Dribsnis is no longer just "another calorie app prototype." The clearest
positioning now is:

- more thoughtful than MyFitnessPal on adaptive calories,
- more focused than Cronometer on behavior and calorie guidance,
- less bloated than Lose It and MyFitnessPal,
- closer to a serious personal coaching tool than a mass-market calorie counter.

If the app stays disciplined, it can become a compact "adaptive nutrition
tracker" rather than a generic food logger.

The strongest product thesis in the current codebase is:

- precise enough for nutrition-focused users,
- light enough for daily use,
- opinionated enough to guide calories over time,
- personal enough to feel like a coaching tool instead of a database browser.

That is a credible niche. It is worth sharpening.

## Competitive References

The most useful current comparisons are these:

### MacroFactor

- Official page: <https://macrofactorapp.com/>
- Official feature page checked: <https://macrofactor.com/nutrition-coach-app/>
- Why it matters:
  - it leads with coached check-ins,
  - it makes energy expenditure adjustment feel like the product,
  - it turns review into action, not just reporting.
- What Dribsnis should borrow:
  - a single guided weekly check-in moment,
  - clearer "accept / postpone / keep current target" decisions,
  - stronger explanation of why the recommendation changed.

### Cronometer

- Official page: <https://cronometer.com/>
- Official feature page checked: <https://cronometer.com/features/index.html>
- Why it matters:
  - it is strong on nutrient depth,
  - it emphasizes integrations, charts, and long-term nutrition tracking,
  - it makes precision feel trustworthy.
- What Dribsnis should borrow:
  - better data trust surfaces,
  - export and integration support,
  - more confident micronutrient storytelling beyond the current overview.

### MyFitnessPal

- Official page: <https://www.myfitnesspal.com/>
- Official App Store listing checked:
  <https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718>
- Official premium feature page checked:
  <https://support.myfitnesspal.com/hc/en-us/articles/360032625951-What-are-the-features-of-MyFitnessPal-Premium>
- Why it matters:
  - it still sets expectations around logging speed,
  - it highlights barcode, meal scan, voice logging, and planner workflows,
  - it wins on breadth and convenience.
- What Dribsnis should borrow:
  - faster repeat logging,
  - better shortcut discovery inside the diary itself,
  - eventually a multimodal logging layer, likely photo first.

### Lose It!

- Official page: <https://www.loseit.com/>
- Official App Store listing checked:
  <https://apps.apple.com/us/app/lose-it-calorie-counter/id297368629>
- Why it matters:
  - it keeps calorie budgeting and repeat logging very approachable,
  - it is good at making weekly flexibility feel simple,
  - it markets photo logging heavily.
- What Dribsnis should borrow:
  - better promotion of the weekly calorie schedule,
  - easier repeat-meal behavior from the diary,
  - a cleaner "weekend calories" story in onboarding and settings.

### Lifesum

- Official page: <https://lifesum.com/>
- Official feature page checked: <https://lifesum.com/features/>
- Why it matters:
  - it combines tracking with a more guided lifestyle layer,
  - it leans on meal plans, barcode, macro tracking, and weekly scoring,
  - it packages coaching in a friendly, low-friction way.
- What Dribsnis should borrow:
  - a friendlier weekly summary-to-action bridge,
  - more visible guidance for what to do next,
  - clearer day-level habit feedback.

## What Dribsnis Already Does Well Against Popular Apps

- The adaptive calorie engine remains one of the app's most believable and
  differentiating features. It feels more serious than generic calorie trackers.
- The new weekly review surface gives Dribsnis a real coaching direction.
- Micronutrient depth gives the app a precision story that mass-market calorie
  apps often underplay.
- The combination of:
  - daily calorie schedule,
  - adaptive calories,
  - weight trend,
  - recipes,
  - custom meals,
  - public library support
  is already richer than a typical first-version tracker.

## Highest-Value Improvements Next

### 1. Turn Weekly Review into the center of the coaching loop

Current state:

- `src/screens/User_Settings/WeeklyReviewScreen.tsx` is a good readout.
- `src/screens/User_Settings/AdaptiveCaloriesSettingsScreen.tsx` is where the
  actual recommendation workflow lives.
- The two surfaces are related, but they still feel separate.

Why it matters:

- MacroFactor's strongest product lesson is that the check-in is the product.
- Right now Dribsnis has the ingredients for that experience, but not the
  unified moment.

Recommendation:

- Make Weekly Review the place where users:
  - see calorie delta,
  - see weight trend,
  - see completion quality,
  - review the adaptive recommendation,
  - accept, postpone, or dismiss it.
- Add one clear "next action" at the top of the screen.

### 2. Make diary logging feel faster than it does today

Current state:

- The app has multiple fast-entry tools, but they are spread across surfaces.
- The global shortcut sheet in `src/navigation/MainTabNavigator.tsx` is good.
- `src/screens/Food/AddFoodScreen.tsx` is broad and capable.
- But inside the diary:
  - `FoodDiaryQuickAdds` is still commented out,
  - `onQuickAddFood` is passed but not shown in `FoodDiaryMoreSection`,
  - repeat logging still feels more hidden than it should.

Why it matters:

- MyFitnessPal, Lose It, and Lifesum all teach the same lesson:
  logging speed is still the retention engine.

Recommendation:

- Restore the diary quick-add rail or replace it with something even tighter.
- Add one-tap repeat meal actions by time slot.
- Add "repeat breakfast/lunch/dinner from yesterday" instead of only whole-day
  copy.
- Keep the global shortcuts, but do not rely on them as the primary fast path.

### 3. Add units and regional preferences

Current state:

- onboarding, profile, and weight flows are still metric-only
- body height is cm-only
- weight is kg-only
- food portions stay gram-centric

Why it matters:

- This is one of the biggest remaining "serious app" gaps.
- Every major competitor supports metric and imperial expectations.

Recommendation:

- Add:
  - weight: kg / lb
  - height: cm / ft+in
  - portion helper display: g / oz where relevant
  - date and 12h/24h display later if useful

### 4. Add trust features before novelty features

Current state:

- there is still no export/import flow
- there is still no health-sync or device-import surface
- there is still no clear sync-status explanation beyond account presence

Why it matters:

- Cronometer and MyFitnessPal feel durable partly because users trust that their
  data is portable and connected.
- Dribsnis is now storing enough meaningful history that ownership matters.

Recommendation:

- Start with:
  - CSV export for weights and food logs
  - JSON export for profile/settings/history backup
  - clear sync/account status copy in profile
- Then add:
  - Apple Health / Health Connect weight import
  - eventual activity sync after that

### 5. Decide what Quick Add is supposed to be

Current state:

- `src/screens/Food/QuickAddFoodScreen.tsx` still models alcohol and uses it in
  calorie math and save/edit flows.
- The UI does not expose alcohol as an input.

Why it matters:

- Hidden nutrition model behavior is hard to trust.

Recommendation:

- Pick one:
  - expose alcohol clearly,
  - or remove alcohol from the quick-add model until the UI supports it.

### 6. Remove debug surfaces from the normal More flow

Current state:

- `src/screens/User_Settings/MoreScreen.tsx` still shows `Debug Menu`.
- `src/screens/Settings/SettingsScreen.tsx` still exposes reset, sample seeding,
  and destructive weight debug actions.
- `src/screens/Food/FoodLibraryScreen.tsx` still exposes destructive item
  deletion from a debug viewer.

Why it matters:

- This is still one of the clearest polish breakers in the app.
- It also makes the product look less trustworthy than it actually is.

Recommendation:

- Gate these screens by environment or dev flag.
- Remove them entirely from production navigation.

### 7. Keep building on the recipe and custom-meal library strength

Current state:

- `src/screens/Food/AddFoodScreen.tsx` now supports distinct recipe and custom
  meal search modes.
- `src/screens/User_Settings/UserCreatedFoodLibraryScreen.tsx` gives users a
  dedicated place to manage what they created.
- Public recipes and public custom meals are already part of the product model.

Why it matters:

- This is stronger than the previous audit gave credit for.
- It could become a real differentiator if discovery improves.

Recommendation:

- Add:
  - bookmark/save for public recipes and meals,
  - "created by you" and "public" chips everywhere,
  - last-used or most-used sorting,
  - clearer ownership and editability messaging.

### 8. Add baseline product-quality guardrails

Current state:

- no test suite
- no lint script
- no `typecheck` script alias

Why it matters:

- The app is now too featureful to rely only on manual checking.

Recommendation:

- Add scripts:
  - `typecheck`
  - `lint`
  - `test`
- Add a small first test suite around:
  - adaptive recommendation rules,
  - copy-yesterday duplicate protection,
  - quick-add calorie math,
  - recipe save-and-add behavior,
  - same-day weight replacement

## Recommended Roadmap

### Pass 1: sharpen the core loop

1. Merge Weekly Review and Adaptive Calories into one guided review flow.
2. Restore or redesign diary-native fast logging and repeat meal actions.
3. Hide debug and destructive tooling in non-dev builds.
4. Resolve the Quick Add alcohol mismatch.

### Pass 2: remove trust and usability friction

1. Add units and regional preferences.
2. Add export/import.
3. Improve sync/account status communication.
4. Add first health integration for weight import.

### Pass 3: deepen differentiation

1. Expand micronutrient coaching beyond overview and totals.
2. Improve recipe/custom-meal library discovery and bookmarking.
3. Add activity logging as Adaptive v2 groundwork.

### Pass 4: only then consider broader market features

1. Photo logging
2. Recipe import from URL
3. Meal-plan or habit-score overlays

The key is sequence. Dribsnis should not try to out-broaden MyFitnessPal.
It should become the tighter, calmer, more adaptive product.

## Bottom Line

Dribsnis has crossed an important line: it now looks like a product with a
real point of view.

The app no longer needs a long list of disconnected features. It needs a strong
center:

- logging should feel faster,
- weekly review should feel more actionable,
- user data should feel safer and more portable,
- the app should speak clearly in the user's units and preferences.

If the next pass focuses on that, Dribsnis can become more compelling than a
generic calorie tracker very quickly.
