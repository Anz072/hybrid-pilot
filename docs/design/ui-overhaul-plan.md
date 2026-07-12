# Dribsnis UI Overhaul Migration Plan

This is the tracked migration plan for the full Dribsnis UI overhaul.

Source of truth for visual rules: [`.interface-design/system.md`](../../.interface-design/system.md). Do not duplicate or reinterpret the design system here.

Reference audit: [`docs/design/ui-craft-audit.md`](./ui-craft-audit.md).

## Direction

Approved direction: **Calm Ledger** as the core design language, with selected **Soft Coach** qualities only for onboarding, empty states, success states, and Weight.

The overhaul must preserve the cream, ink, and coral identity while prioritizing calm numerical clarity, fast food logging, consistent hierarchy, and a non-judgmental tone. Fresh Blocks is not the primary direction.

## Reference Implementation

**Add Food is the reference implementation.**

Use the approved Add Food implementation as the reference for:

- Search-first task hierarchy.
- Flat bordered surfaces.
- Food result row structure.
- Loading skeletons.
- Empty result actions.
- Search mode controls.
- Quick-log affordances.
- Scanner/search/manual logging relationship.

Current primary file: `src/screens/Food/AddFoodScreen.tsx`.

Add Food may still be refined as the Food family batch progresses, but other screens should migrate toward its approved interaction model rather than inventing new local patterns.

## Batch Status Values

Allowed status values:

- `pending`
- `in progress`
- `fixed`
- `deferred`
- `not applicable`

Checkbox convention:

- `[x]` means the issue is fixed in the current codebase.
- `[ ]` means the issue still needs validation, migration, or a deliberate defer decision.

## Migration Batches

1. Global correctness and foundations
2. Food family
3. Home and Weekly Review
4. Weight
5. Settings
6. Onboarding and Auth
7. Navigation and global cleanup
8. Final full-app audit

## Batch Notes

### 1. Global Correctness And Foundations

Status: foundation pass complete; screen-family migrations remain in their assigned batches.

Completed in this batch:

- Shared typography exposes the approved 400-600 scale and numeric roles.
- `NumericText` enforces tabular numerals even when callers pass local styles.
- Shared state opacity tokens are established at pressed `0.90` and disabled `0.56`.
- Shared UI seeds exist for `AppText`, `NumericText`, `AppButton`, `IconButton`, `AppCard`, `InteractiveCard`, `ListRow`, `Chip`, `SegmentedControl`, `AppInput`, `SearchInput`, `ScreenHeader`, `SkeletonLine`, `EmptyState`, `ErrorState`, `SuccessState`, and `LoadingState`.
- `AppCard` now includes the required `standard`, `compact`, `soft`, `interactive`, and `hero` variants.
- The unused no-op `appElevation.none` token was removed; elevation remains reserved for overlay UI.

Deferred to assigned screen-family batches:

- Migrating local 800/900 screen styles to shared typography.
- Replacing local screen card/button/chip/input recipes with shared primitives.
- Replacing legacy `brand800`, `slate*`, and shadow usage inside individual screen families unless already covered by a Batch 1 visible bug.
- Applying tabular numerals to every visible calorie, macro, weight, stepper, and chart value at call sites.

### 3. Home And Weekly Review

Status: fixed for assigned Home, Weekly Review, and Micros surfaces.

Completed in this batch:

- Home now uses shared `AppText`, `NumericText`, `AppCard`, `InteractiveCard`, `AppButton`, `LoadingState`, and `ErrorState` primitives for its dashboard story.
- Home routine shadows were removed from quick actions, the calorie ring, and macro tiles; all three now follow the flat-border depth language.
- Home calorie, macro, weight, trend, micronutrient, and goal-progress values now render through `NumericText` at call sites.
- Home macro accents now use the semantic `calories`, `protein`, `carbs`, and `fat` aliases.
- Micros Overview now uses shared cards, segmented control, icon button, loading/error states, and numeric text, with unused orb styles removed.
- Weekly Review now uses shared `ScreenHeader`, cards, buttons, state blocks, text, and numeric primitives while preserving the next-action -> hero -> insights story and existing adaptive-calorie actions.

Deferred/not applicable:

- No shared-component API changes were needed.
- Broader settings/navigation header consolidation remains in Batches 5 and 7.

### 4. Weight

Status: fixed for assigned Weight surfaces.

Completed in this batch:

- Weight now has one current-weight hero number, with trend and goal as supporting panels instead of a repeated "Current" stat.
- Weight headings now use the approved shared typography roles instead of competing local 28px section headings.
- Weight uses the shared Soft Coach-compatible primitives: `AppCard`, `InteractiveCard`, `AppButton`, `IconButton`, `AppInput`, `LoadingState`, `EmptyState`, `AppText`, `NumericText`, and `SegmentedControl`.
- Weight current values, deltas, history rows, modal inputs, log counts, and SVG chart labels now use numeric/tabular roles where the host primitive supports them.
- Weight no-op shadow declarations and proven-dead local style keys were removed from the migrated screen family.
- Weight entry modal now uses shared header, input, card, and button rules while preserving validation and discard confirmation behavior.
- Weight history rows now use `InteractiveCard` and the destructive swipe pattern from the Food family.

Deferred/not applicable:

- No shared-component API changes were needed.
- The chart drawing itself remains `react-native-svg`; SVG axis labels use the approved chart-axis typography constants because `AppText`/`NumericText` cannot render inside SVG text nodes.
- The custom swipe-delete action remains local because it is coupled to `react-native-gesture-handler` `Swipeable`.

### 5. Settings

Status: fixed for assigned Settings surfaces.

Completed in this batch:

- Activity, Goal Strategy, Training Types, and Protein Focus now use shared `OptionCard`, `AppCard`, `AppButton`, `AppText`, and `NumericText` primitives for their selectable setting rows and save actions.
- Profile now uses shared `AppInput`, `Chip`, `AppButton`, `AppCard`, and `AppText` primitives while preserving validation, unit display, save, and sign-out behavior.
- Preferences now uses the shared `SegmentedControl`; the primitive supports optional hints for unit examples.
- Data Export now uses shared cards, input, button, interactive rows, and text while preserving row-level busy indicators.
- Calorie Allowance and Calorie Schedule now use shared cards, icon buttons, buttons, and tabular numeric roles for calorie target values and steppers.
- Adaptive Calories, More, User-created Food Library, Calorie Budget Chart, and the developer Settings screen were tokenized to the approved flat-border, spacing, typography, and pressed-state rules without changing data flows.
- Settings scans no longer find local duplicated option-card recipes, routine 700/800/900 weights, old 20px screen gutters, stale `slate200` text/placeholder bugs, or routine shadows/elevation.
- Settings headers already delegate to shared `ScreenHeader` through `SettingsStackHeader` from Batch 7.

Deferred/not applicable:

- Adaptive Calories still keeps local action button wrappers because their busy/apply/reject logic is tightly coupled to that workflow; styles are token-backed and use approved typography/state tokens.
- User-created Food Library keeps its local table layout because it is a screen-specific dense data table, but rows, chips, typography, spacing, and pressed states are token-backed.
- The developer-only debug Settings screen keeps its existing debug action controls; styles were tokenized, but the destructive seed/reset tooling was not rebuilt as user-facing settings UI.
- No Settings files were deleted because no additional unused component files were proven unused.

### 6. Onboarding And Auth

Status: fixed for assigned Onboarding and Auth surfaces.

Completed in this batch:

- Onboarding now uses a shared step shell/top-bar pattern with consistent safe-area top inset, progress indicator, title/subtitle hierarchy, and optional footer CTA.
- Onboarding primary CTAs now wrap shared `AppButton`, preserving the existing call-site API while using the app pill shape, shared pressed state, and shared disabled opacity.
- Onboarding option selectors now use the shared `OptionCard` primitive; Goal, Goal Pace, Activity, Training, and Protein Focus no longer define local option-card recipes.
- Onboarding hero/title typography now uses approved shared roles instead of local 30/32/34/40px title sizes and routine 800/900 weights.
- Decorative orb/background style blocks were removed from the migrated onboarding screens.
- Activity Level no longer computes unused per-level accent/background fields.
- `OnboardingReviewCard` now uses `AppCard`, `AppText`, and `AppButton`.
- Fuel Plan and Success numeric targets now use `NumericText` where applicable and macro colors use semantic macro aliases.
- Login/Auth now uses shared card, text, input, segmented-control, and button primitives while preserving sign-in/register behavior.

Deferred/not applicable:

- No route, persistence, Supabase, local account, DB, or onboarding calculation behavior was intentionally changed.
- Broader settings-side `OptionCard` adoption was completed in Batch 5.

### 7. Navigation And Global Cleanup

Status: fixed for assigned navigation/global cleanup pass; final full-app audit remains Batch 8.

Completed in this batch:

- `FoodScreenHeader` and `SettingsStackHeader` now delegate to shared `ScreenHeader`, preserving existing call-site props while removing local header/button/type recipes.
- `ScreenHeader` gained limited compatibility options for safe-top handling and back-icon replacement; existing callers keep the default behavior.
- The global shortcut sheet in `MainTabNavigator` now uses shared `AppText` and `IconButton`, tokenized spacing/borders/radii, a 44px close target, and semantic tab label behavior.
- Dead shortcut sheet style entries were removed after proving they were unused.
- Dead decorative orb style entries were removed from the remaining Food and Settings files after proving there were no `styles.orbTop`, `styles.orbBottom`, `styles.bgOrbTop`, or `styles.bgOrbBottom` references.
- App-wide scans found no remaining `#070707`, `rgba(7,7,7...)`, or raw caret color.
- Routine shadows/elevation remain confined to the scanner overlay exception and shared overlay token.

Deferred/not applicable:

- No additional UI files/components were deleted because no additional unused component files were proven by imports in this pass.
- `FoodDiaryMainStrip` still contains a computed hex-to-rgba helper; it is not a raw fixed palette color and remains part of the already-migrated Food family behavior.
- Larger Settings primitive migration remains Batch 5, and final duplicate-recipe/type-size hardening remains Batch 8.

## Global And Systemic Issues

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [ ] | `appTypography` and `sharedStyles` historically existed but were barely consumed, so screens became private forks of the system. | `src/theme/typography.ts`, `src/theme/sharedStyles.ts`, screen-local `StyleSheet.create` blocks | 1, then 2-7 | in progress |
| [ ] | No tabular figures were used across calorie, macro, weight, chart, and stepper values, causing numeric jitter. | `src/theme/typography.ts`, `src/components/ui/AppText.tsx`, all numeric screen text | 1, then 2-5 | in progress |
| [ ] | Typography system contradicted implementation: intended calm 400-600 scale vs widespread 700/800/900 local styles. | `src/theme/typography.ts`, `src/theme/sharedStyles.ts`, all migrated screens | 1, then 2-7 | in progress |
| [ ] | Screens used 21 font sizes while the official scale defined far fewer; 12px was common but not part of the old scale. | `src/theme/typography.ts`, screen-local styles | 1, then 2-7 | in progress |
| [x] | `sharedStyles.ts` itself encoded 800/900 weights, contradicting `typography.ts`. | `src/theme/sharedStyles.ts` | 1 | fixed |
| [ ] | Shared styles were imported by only a small subset of files, with Home, Weight, and Settings rebuilding surface/control recipes locally. | `src/theme/sharedStyles.ts`, `src/components/ui/*`, screen files | 2-7 | pending |
| [ ] | Card style drift: card recipe was redefined many times with inconsistent padding, border tokens, and margins. | `AppCard`, `sharedStyles.card`, screen card styles | 2-7 | pending |
| [ ] | Primary button drift: primary button recipe was redefined many times. | `AppButton`, onboarding buttons, screen button styles | 2, 5, 6 | pending |
| [ ] | Pressed opacity drift: pressed values ranged from `0.86` to `0.94`. | `appStates.pressedOpacity`, local `pressed` styles | 1, then 2-7 | in progress |
| [ ] | Disabled opacity drift: disabled values ranged across `0.5`, `0.58`, and `0.6`. | `appStates.disabledOpacity`, local disabled styles | 1, then 2-7 | in progress |
| [ ] | Screen gutter drift: screens used 14/16/18/20/22/24px instead of the approved 18px gutter. | `appSpacing.gutter`, screen containers | 2-7 | pending |
| [ ] | Option-card selector was duplicated across settings and onboarding with divergent selected states. | Future `OptionCard`, settings screens, onboarding screens | 5, 6 | pending |
| [ ] | Two depth languages competed: flat 1px borders vs shadows on cards, quick actions, day pills, ring, macro tiles, and tab bar. | `src/theme/tokens.ts`, screen-local shadows, `MainTabNavigator` | 1, then 2-7 | in progress |
| [ ] | Nested radii used 8-inside-8 without concentric reduction. | Cards, inputs, pills inside cards | 2-7 | pending |
| [ ] | `shadowOpacity: 0` no-op shadow declarations added noise. | `WeightScreen.tsx`, other screen styles | 4, 7 | in progress |
| [x] | Dead decorative orb styles were copied across many files and not rendered. | Onboarding, settings, Weight, Food styles | 7 | fixed |
| [ ] | Approximately 1,000 lines of dead design code increased migration risk. | `FoodDiaryDateStrip.tsx`, `FoodDiaryMoreSection`, `WeightScreen`, assorted copied styles | 2, 4, 7 | in progress |
| [ ] | Token names lied about values: `slate*` represented cream/sand/ink, causing border tokens to be used as text. | `src/theme/colors.ts`, legacy `slate*` aliases | 1, then 8 | in progress |
| [ ] | `brand800/900` resolved to ink, not coral, producing invisible labels when used as accent backgrounds and text. | `src/theme/colors.ts`, local styles | 1, then 8 | in progress |
| [x] | `brand500`, `danger600`, and calorie alias historically shared coral, making destructive and primary action color indistinct. | `src/theme/colors.ts` | 1 | fixed |
| [ ] | Macro aliases existed but were not used consistently by screens. | `appColors.protein`, `appColors.carbs`, `appColors.fat`, macro displays | 2-4 | pending |
| [x] | Raw color discipline was strong but not perfect: hardcoded tab black, one raw caret rgba, one off-palette scanner cream. | `MainTabNavigator.tsx`, scanner/input styles | 1, 2, 7 | fixed |

## Food Family

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Add Food should be the reference implementation for the overhaul. | `src/screens/Food/AddFoodScreen.tsx` | 2 | fixed |
| [x] | Add Food's core task is search/log fast, but search was visually too low and quiet in the audited version. | `AddFoodScreen.tsx`, `SearchInput`, `ScreenHeader` | 2 | fixed |
| [x] | Add Food mode switcher and scan button were visually stronger than the search task in the audited version. | `AddFoodScreen.tsx`, `SegmentedControl`, scanner action | 2 | fixed |
| [x] | Add Food result rows had three competing tap targets; row hierarchy now demotes secondary save/edit controls and makes quick log the clear primary action while preserving existing actions. | `AddFoodScreen.tsx`, future `FoodResultRow`, `IconButton`, `AppButton` | 2 | fixed |
| [x] | Add Food skeleton rows were a good pattern and should become shared loading primitives. | `AddFoodScreen.tsx`, `SkeletonLine`, `AppStates.tsx` | 1, 2 | fixed |
| [x] | Food Diary week navigation/date heading led the screen while today's totals appeared third. | `FoodDiaryScreen.tsx`, `FoodDiaryMainStrip.tsx`, `FoodDiaryHeroCard.tsx` | 2 | fixed |
| [x] | Food Diary empty day had no designed state, only four collapsed "Nothing logged yet" meal rows. | `FoodDiaryScreen.tsx`, meal section components, `EmptyState` | 2 | fixed |
| [x] | Food Diary day pills and meal cards carried shadows that out-elevated the hero totals card. | `FoodDiaryScreen.tsx`, `FoodDiaryMainStrip.tsx`, meal card styles | 2 | fixed |
| [x] | Food Diary calorie columns and row values need tabular numeric text and right alignment. | `FoodDiaryScreen.tsx`, meal rows, `NumericText` | 2 | fixed |
| [x] | `FoodDiaryDateStrip.tsx` was 318 lines and imported nowhere. | `src/screens/Food/FoodDiaryDateStrip.tsx` | 2 | fixed |
| [x] | `FoodDiaryMoreSection` contained around 100 orphaned style lines. | `src/screens/Food/FoodDiaryMoreSection.tsx` | 2 | fixed |
| [x] | Scanner had one off-palette cream/raw color issue. | `FoodBarcodeScannerShared.tsx`, `FoodBarcodeScannerModal.tsx` | 2 | fixed |
| [x] | Barcode scanner permission/loading/error states were good and should be preserved as reference state quality. | Scanner components | 2 | fixed |
| [x] | Swipe-to-delete with undo was good and should become the destructive row reference. | Food diary delete/undo row behavior | 2, 7 | fixed |
| [x] | Scanned food log save errors were swallowed by `try/finally` without `catch`. | `ScannedFoodLogScreen.tsx` | 1 | fixed |
| [x] | Food edit/log numeric steppers need tabular figures. | `FoodEntryForm.tsx`, `QuickAddFoodScreen.tsx`, `EditFoodEntryScreen.tsx`, `ScannedFoodLogScreen.tsx` | 2 | fixed |
| [ ] | Food family still contains local card/button/chip/input definitions that should migrate to shared primitives; large creation/library/read-only/scanner surfaces remain legacy and should be handled in a later focused cleanup. | `CreateRecipeScreen.tsx`, `CreateCustomFoodScreen.tsx`, `FoodReadOnlyScreen.tsx`, `FoodLibraryScreen.tsx`, `FoodBarcodeScannerShared.tsx`, `AdaptiveCaloriesBanner.tsx`, `src/components/ui/*` | 2, 7 | deferred |

## Home And Weekly Review

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Home calorie ring is the correct focal point but was bracketed by four near-identical 3-up grids, causing the eye to ping-pong. | `src/screens/Home/HomeScreen.tsx` | 3 | fixed |
| [x] | Home quick actions, ring, and macro tiles used shadows while Weekly/Micros cards sat flat. | `HomeScreen.tsx`, shared card primitives | 3 | fixed |
| [x] | Home calorie ring value needs tabular numeric text. | `HomeScreen.tsx`, `NumericText` | 3 | fixed |
| [x] | Home macro tiles need consistent macro aliases. | `HomeScreen.tsx`, `appColors.protein/carbs/fat` | 3 | fixed |
| [x] | Home locally rebuilds cards, grids, buttons, and numeric styles instead of consuming the shared system. | `HomeScreen.tsx`, `AppCard`, `AppButton`, `NumericText` | 3 | fixed |
| [x] | Weekly Review already had a strong focal story: accent-bordered next action card, hero, insights. Preserve this structure while aligning tokens. | `src/screens/User_Settings/WeeklyReviewScreen.tsx` | 3 | fixed |
| [x] | Micros/Weekly surfaces need the same flat-border and typography system as Home. | `MicrosOverviewScreen.tsx`, `WeeklyReviewScreen.tsx` | 3 | fixed |

## Weight

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Weight repeated the "Current" number in the hero. | `src/screens/Weight/WeightScreen.tsx` | 4 | fixed |
| [x] | Weight had four competing 28px headings, so nothing won. | `WeightScreen.tsx` | 4 | fixed |
| [x] | Weight should use Soft Coach qualities without becoming a separate design system. | `WeightScreen.tsx`, `WeightEntryModal.tsx`, shared primitives | 4 | fixed |
| [x] | Weight deltas, current weight, history values, and chart labels need tabular numeric text. | `WeightScreen.tsx`, `WeightTrendChart.tsx`, `WeightEntryModal.tsx`, `NumericText` | 4 | fixed |
| [x] | Weight contained no-op `shadowOpacity: 0` declarations. | `WeightScreen.tsx` | 4 | fixed |
| [x] | Weight contained 25+ dead style keys. | `WeightScreen.tsx` | 4 | fixed |
| [x] | Copied invisible success eyebrow style existed in unused Weight styles. | `WeightScreen.tsx`, `WeightEntryModal.tsx` | 1 | fixed |
| [x] | Weight entry modal should use shared modal/header/input/button rules. | `WeightEntryModal.tsx`, future modal/header primitives | 4 | fixed |
| [x] | Weight history rows should migrate to shared list row and destructive action patterns. | `WeightScreen.tsx`, `ListRow`, `IconButton` | 4 | fixed |

## Settings

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Activity settings selected option card could become dark-on-dark because selected card background applied without selected title style in one list. | `ActivityLevelSettingsScreen.tsx` | 1 | fixed |
| [x] | Low-contrast body text used `slate200`, a border token, in Profile settings. | `ProfileSettingsScreen.tsx` | 1 | fixed |
| [x] | Low-contrast body text used border tokens in Activity settings. | `ActivityLevelSettingsScreen.tsx` | 1 | fixed |
| [x] | Low-contrast body text used border tokens in Goal Strategy settings. | `GoalStrategySettingsScreen.tsx` | 1 | fixed |
| [x] | Profile placeholders used `slate200`, a border token. | `ProfileSettingsScreen.tsx` | 1 | fixed |
| [x] | Settings surfaces rebuild cards, inputs, buttons, chips, and selectors locally. | Settings screen files, `SettingsStackHeader.tsx`, shared primitives | 5 | fixed |
| [x] | Settings option-card selectors duplicate the same pattern across multiple screens. | `ActivityLevelSettingsScreen.tsx`, `TrainingTypesSettingsScreen.tsx`, `GoalStrategySettingsScreen.tsx`, other settings selectors | 5 | fixed |
| [x] | Settings screen gutters and spacing drift from the approved scale. | Settings screen containers | 5 | fixed |
| [x] | Settings heavy heading/label/button weights need migration to 400-600 hierarchy. | Settings screen styles | 5 | fixed |
| [x] | DataExport per-row busy states were good and should be preserved as reference busy-row quality. | `DataExportScreen.tsx` | 5 | fixed |
| [x] | Settings and More headers should merge toward shared `ScreenHeader`. | `SettingsStackHeader.tsx`, `MoreNavigator.tsx` screens | 5, 7 | fixed |

## Onboarding And Auth

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Onboarding lacked a shared step template. | Onboarding screens, future onboarding step shell | 6 | fixed |
| [x] | Onboarding used five different hero title sizes: 30/32/34/40 vs unused 44 display hero. | Onboarding screen styles, `typography.ts` | 6 | fixed |
| [x] | Onboarding used two top-inset strategies. | Onboarding screens, `OnboardingTopBar.tsx`, future step shell | 6 | fixed |
| [x] | Onboarding had no progress indicator. | Onboarding screens, `OnboardingTopBar.tsx` | 6 | fixed |
| [x] | Onboarding primary CTA was a rounded rectangle while the rest of the app used pills. | `OnboardingPrimaryButton.tsx`, `onboardingButton.tsx`, `AppButton` | 6 | fixed |
| [x] | Login/Auth was the most token-correct screen but visually foreign to the rest of the app. | `AccountScreen.tsx`, auth/login components | 6 | fixed |
| [x] | Invisible ActivityLevel onboarding eyebrow used foreground equal to background. | `ActivityLevelScreen.tsx` | 1 | fixed |
| [x] | Invisible Success onboarding eyebrow used foreground equal to background. | `SuccessScreen.tsx` | 1 | fixed |
| [x] | Success highlight card used `borderWidth: 1` without `borderColor`, causing black fallback hairline. | `SuccessScreen.tsx` | 1 | fixed |
| [x] | ActivityLevel computed per-level accent colors that were never passed to the button. | `ActivityLevelScreen.tsx` | 6, 7 | fixed |
| [x] | Decorative orb styles were copied across onboarding screens but not rendered. | Onboarding screen style blocks | 6, 7 | fixed |
| [x] | Onboarding review card is a useful pattern but needs token/type migration. | `OnboardingReviewCard.tsx` | 6 | fixed |
| [x] | Onboarding option-card selectors duplicate settings patterns and should use the same shared `OptionCard`. | Onboarding option screens, future `OptionCard` | 6 | fixed |

## Navigation And Global Cleanup

| Done | Finding | Likely file/component | Batch | Status |
| --- | --- | --- | --- | --- |
| [x] | Tab bar hardcoded `#070707` instead of app ink. | `src/navigation/MainTabNavigator.tsx` | 1 | fixed |
| [x] | Tab bar added a drop shadow that conflicted with the flat-border language. | `MainTabNavigator.tsx` | 1 | fixed |
| [x] | One raw caret color `rgba(7,7,7,0.34)` remained outside tokens; Batch 7 scan confirms no remaining match. | Text input/focus styles, likely scanner/input related | 7 | fixed |
| [x] | Navigation/global headers should use shared header/icon-button rules. | `MainTabNavigator.tsx`, `FoodScreenHeader.tsx`, `SettingsStackHeader.tsx`, `ScreenHeader` | 7 | fixed |
| [x] | Dead decorative orb/background styles across approximately 17 files should be removed after each family migration. | Onboarding, Settings, Weight, Food screens | 7 | fixed |
| [x] | Dead or unused files/components should be removed only when imports prove they are unused; `FoodDiaryDateStrip.tsx` was proven unused and removed in Batch 2, and Batch 7 removed additional proven-unused style blocks without deleting imported components. | deleted/orphaned sections, screen style blocks | 7 | fixed |
| [ ] | Final app-wide scan should reject new hardcoded hex values, arbitrary type sizes, shadow drift, and duplicate component recipes. | Entire app | 8 | pending |

## Batch Validation Requirements

### 1. Global Correctness And Foundations

Validation:

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Scan for `#070707`, `rgba(7,7,7`, `placeholderTextColor={appColors.slate200}`, `color: appColors.slate200`, and routine `fontWeight: "800"|"900"` in theme/shared primitives.
- Verify `danger*` no longer maps to coral.
- Verify `NumericText` or approved numeric roles include `fontVariant: ["tabular-nums"]`.
- Verify no global foundation change redesigns unrelated screens.

### 2. Food Family

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Manually verify Add Food search, scan, mode switching, quick log, favorite/save, recent searches, empty states, loading states, and remote-search-failure notice.
- Verify Food Diary shows today's totals before secondary date/week chrome.
- Verify Food Diary empty meals have designed actions.
- Verify all visible Food family numeric values use tabular numeric styles.
- Verify Food family surfaces use flat borders, not routine shadows.
- Scan Food files for duplicate button/card/chip/input definitions that should be shared primitives.

### 3. Home And Weekly Review

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Manually verify Home has one focal calorie story.
- Verify Home macro colors use semantic macro aliases.
- Verify Home numeric values do not jitter when values change.
- Verify Home and Weekly Review use one flat-border depth language.
- Verify Weekly Review preserves its next-action -> hero -> insights story while aligning tokens.

### 4. Weight

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Manually verify Weight has one current-weight focal number and one trend story.
- Verify Weight uses Soft Coach only through approved shared tokens/components.
- Verify Weight entry create/edit/delete/undo flows still work.
- Verify all weight values, deltas, and chart labels use tabular numeric styles.
- Scan for no-op shadows and dead style keys in Weight files.

### 5. Settings

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Manually verify profile, activity, goal strategy, training, preferences, and data export flows.
- Verify option-card selected states are readable in every settings selector.
- Verify settings inputs use visible labels and semantic placeholder colors.
- Verify settings buttons/cards/chips/selectors use shared primitives or token-backed variants.
- Verify DataExport busy-row states remain clear.

### 6. Onboarding And Auth

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Manually complete onboarding end to end.
- Verify every onboarding step uses the shared step template.
- Verify consistent top inset, progress indicator, title scale, and CTA shape.
- Verify Auth/Login feels consistent with Calm Ledger while retaining its token correctness.
- Verify onboarding success, empty, and supportive states use the Soft Coach layer without introducing a second system.

### 7. Navigation And Global Cleanup

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Scan for unused UI files and remove only when imports prove they are unused.
- Scan for raw colors outside approved token files.
- Scan for routine shadows/elevation outside modals, sheets, popovers, overlays, and scanner overlays.
- Scan for decorative orb/background styles.
- Verify bottom tabs, stack headers, modal headers, and icon buttons align with shared navigation rules.

### 8. Final Full-App Audit

Validation:

- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Run final code scans for hardcoded hex, deprecated `slate*` text usage, arbitrary type sizes, routine 800/900 weights, duplicate card/button/chip/input recipes, routine shadows, no-op shadows, and non-tabular numeric text.
- Perform a visual pass of Home, Food Diary, Add Food, Weight, Onboarding, Settings, More, scanner, modals, empty states, loading states, error states, success states, and disabled states.
- Squint-test each primary screen for one focal point.
- Verify every unresolved item in this plan is marked `fixed`, `deferred`, or `not applicable` with a reason.

## Legacy Patterns Not Allowed In New Code

Do not introduce:

- New hardcoded hex or raw rgba colors outside approved token files.
- `danger`/destructive/error UI using coral.
- Sand/border tokens as body text, helper text, or placeholder text.
- `brand800`/`brand900` as coral action/accent tokens.
- Routine 800/900 text weights.
- Font sizes outside the approved typography scale.
- Numeric calorie, macro, weight, trend, chart, or stepper text without tabular figures.
- Local primary button, card, chip, input, icon-button, segmented-control, or option-card recipes when a shared primitive exists.
- Pressed opacity values other than the approved token.
- Disabled opacity values other than the approved token.
- Screen gutters outside the approved 18px standard unless a full-bleed component explicitly requires it.
- Routine shadows/elevation on standard cards, tabs, day pills, meal rows, macro tiles, or quick actions.
- No-op shadows such as `shadowOpacity: 0`.
- 8px nested inside 8px radius without concentric adjustment.
- Decorative orb/blob/background styles.
- Placeholder-only input labels.
- Selected card states that invert the background without selected-safe child text colors.
- New duplicated option-card selectors in settings or onboarding.
