# Consumer UI refinement — local implementation

Implemented from an Android emulator walkthrough and the 44-screen audit, using `ui-ux-pro-max` and `frontend-design`. The priority is **remove → simplify → reuse → add**, retaining the existing Bright Editorial porcelain/persimmon direction and all existing routes and save outcomes.

## Shared foundation

- Ordinary forms use an inline back/title header. Remove category eyebrows and explanatory subtitles that repeat the current task.
- Use transparent `AppCard` plain variants for structural groups. Dividers, spacing and type do the grouping; a surface should have a reason.
- `Disclosure` keeps optional micronutrients, notes, preparation and onboarding review available without making them the default screen.
- `AppSheet` provides one safe-area-aware, scrollable meal menu with close/back behavior and reduced-motion support. The Add sheet exposes all seven shortcuts.
- Single choices use radio semantics; multiple choices use checkboxes; persistent on/off settings use switches. Main controls have at least 48 dp targets, even when their visual treatment is quiet.
- Food form footers participate in keyboard layout rather than overlaying scroll content. Safe-area padding belongs outside the scroller. Android uses keyboard height adjustment; iOS retains padding behavior.
- Large text wraps or stacks values and actions. Body content honors system scaling; fixed bottom-tab labels cap at 1.3 so navigation remains usable at 200% body text.

## Screen composition

- Diary: compact date strip and calorie/macro summary, meals before quick picks, small completion control, conditional counts, intact repeat/copy and direct logging.
- Home and reviews: remove generic intros, zero-filled nutrient previews, duplicate adaptive calls to action and repeated numeric explanations. Weekly comparisons retain a coverage qualifier. Adaptive changes still require explicit Apply.
- Weight: one latest value and selected-period change; no empty goal/pace panels. History uses consistent precision and the user's clock preference. Optional notes stay collapsed. Dismissing an unchanged draft is silent; editing notes alone preserves the stored weight precision.
- Settings: grouped destination rows replace the dashboard. Choices show their selected state once. Calorie schedule is seven compact rows; identical budget charts and inactive reset actions are hidden.
- Search and libraries: name, calories/serving and relevant state replace table headers, counts, provider badges and status prose. Edit, favorite, quantity review and quick logging remain available.
- Creation and food review: essential fields come first; units are quiet suffixes; nutrition is summarized once. Optional information is disclosed. Save-only, save-and-add, edit and delete behavior remain distinct. Ingredient details use one nutrition view rather than repeating library and recipe values.
- Onboarding: current question or fields precede expandable previous answers. Plain language and familiar choices replace explanatory paragraphs. The initial plan shows calories and macros once, without the duplicate donut.

## Behavioral fixes and API dependency

`libraryFoodIdentity` resolves synthetic recipe/custom-meal IDs before legacy metadata fallbacks. Recipe editors receive the underlying recipe ID; custom-meal editors retain the synthetic food ID expected by the existing store contract.

The sibling API now returns optional `isPublic` and `description` metadata for custom catalogue items. The mobile adapter uses it to retain private/public state and notes when editing. Apply these local backend changes with the app; no auth, RLS or migration changes were made for this work.

Backup export creates an actual CSV/JSON file for native sharing. Import uses a document picker, size/version/weight validation and an explicit preview before the existing weights-only restore. Full-history food exports use inclusive 400-day windows with bounded concurrency and fail rather than sharing partial results.

Native dependencies added: Expo DocumentPicker, FileSystem and Sharing. The date/time picker theme is configured in `app.json`. Rebuild a development client after pulling these local changes into another checkout; Metro reload alone cannot install native modules.

## Verification recorded for this implementation

- Android API 36, Pixel_10 AVD, local development client built and installed with Expo. Actual rendered screens and interaction were inspected; this was not a source-only redesign.
- Main navigation, diary/review/copy/repeat, weight/settings, search/library/edit/create, scanner permission/camera/manual, native time picker, export share and import preview were exercised.
- Welcome through account form was exercised in a separate Expo Go session without submitting an account.
- Compact width (~375 dp), 200% text, reduced motion and software keyboards were checked. Stacked values, wrapped chart legend and keyboard-safe footers were verified after corrections.
- `npm test`: TypeScript and 136 tests passed; the opt-in manual token-refresh test remains skipped. New tests cover synthetic library identity, backup validation/range boundaries, and weight precision in kg/lb.
- API `pnpm verify`: typecheck, lint, 253 pure tests and 273 database tests passed. Database tests used a separate disposable PostgreSQL container, not the running app database. `pnpm build` and `pnpm openapi` passed.
- No iOS/tablet/physical-device pass, optical barcode decode, account submission or restore commit is claimed. Native sharing was canceled at the chooser; import was canceled after preview. No data was sent to an external recipient.

The companion local `nouri-ui-implementation` folder contains the per-screen implementation map, original/updated screenshots and a standalone gallery. The original audit remains in `nouri-ui-audit`. All work remains local and uncommitted; no remote push or deployment was performed. Unrelated in-progress changes in both repositories were preserved.
