# Nouri — raised cards and clear daily progress

This direction supersedes the visual rules in the older Kitchen Ledger and
Bright Editorial documents. Their behavior, data, accessibility, keyboard, and
diary interaction requirements still apply.

## Reference and intent

The user selected Walk15's layout and card depth while retaining Nouri's orange
identity. The supplied Home image informs the calorie ring, three macro cards,
and summary-card footers. The Profile and Settings images inform the compact
account card and grouped destination rows. The Wallet image informs rounded
category controls and section spacing; it does not introduce marketplace content.

Walk15 was inspected read-only. Its settings card uses radius 12, padding 16,
and a shadow with opacity .08, radius 8, and offset [0, 2]. Its compact metrics
use radius 8 and a lighter .06 shadow. Nouri implements those principles using
its own components, graphics, content, and existing native dependencies.

Nouri serves people checking daily intake, logging meals, reviewing weight, and
adjusting nutrition targets. The visual hierarchy keeps those tasks immediate:
calories lead Home, meals lead Diary, the current value and chart lead Weight.

## Tokens and component contracts

| Role | Value |
| --- | --- |
| Canvas / card / inset | `#F7F7F5` / `#FFFFFF` / `#F1F1ED` |
| Primary / secondary / muted text | `#171715` / `#55534C` / `#706E67` |
| Accent / filled actions and navigation / pressed | `#D6533C` / `#B8402C` / `#963523` |
| Macro colors | Existing protein, carbs, fat, and water tokens |
| Font | IBM Plex Sans, bundled 400 / 500 / 600 / 700 |
| Screen / section / body / secondary / hero | 28/34 · 20/26 · 16/24 · 14/20 · 44/48 |
| Spacing | 4-point grid; gutter 16; card padding 16; compact padding 12 |
| Card / section gap | 16 / 24 |
| Compact / card / hero and sheet / button radius | 8 / 12 / 16 / 20 |
| Metric / card / hero shadow | 0/1 blur 6 at .06 · 0/2 blur 8 at .08 · 0/4 blur 16 at .08 |

`appElevation`, `appCardSurface`, and `appMetricSurface` own native depth.
React Native box shadows are used on iOS and Android 28+, with elevation on
older Android. Card roots must not clip their shadows; round inner content
separately when clipping is required.

`AppCard` and `InteractiveCard` retain their variant API. Surface/standard cards
are raised; compact cards use lighter elevation; hero/spotlight cards use the
larger radius and shadow. Plain stays transparent, soft/subtle stays inset, and
outlined stays a flat bordered choice. Do not put a shadow on each food row or
on an inner chart. Repeated form groups use the shared surface rather than
screen-local literals.

`CalorieRing` uses a presentation-only normalization helper and the existing SVG
library. It displays consumed calories, target context, and remaining/over text.
The arc stops at one revolution, retaining the actual over-target value. Missing
or invalid targets never imply completion. At large font scales, values move
below the ring so they remain readable without being shrunk to fit its center.

`CardFooter` is the visual action band inside a parent `InteractiveCard`; the
parent owns the single accessible tap target. Rounded segmented controls expose
selection. Option cards retain radio/checkbox semantics and explicit indicators.

## Screen composition

- **Home:** title/date, calorie ring, three macro cards, weekly check-in card,
  micronutrients card. Macro cards stack above a 1.3 font scale; below 360 points, their icons sit
  above the labels to keep all three values aligned.
- **Diary:** compact date control, raised expandable calorie summary, one card
  per meal with divided entries, followed by quick picks and copy/repeat groups.
  Keep independent disclosures, empty-header Add, saved-entry reveal, collapse
  anchoring, search-session stability, and delete/undo behavior.
- **Weight:** latest value and chart share the leading card; goal, insights, and
  history are grouped below. Keep precise stored values and native chart sizing.
- **Settings:** compact account card, then Review, Targets, Preferences, Data,
  and Food Library. Developer visibility rules and account actions stay intact.
- **Logging and libraries:** rounded search categories, raised result groups and
  form sections, compact rows, existing quantity and save controls. Camera
  overlays retain their functional scanning region.
- **Reviews, account, and onboarding:** shared headers, typography, raised form
  sections and choices, optional disclosures, and keyboard-safe actions.
- **Bottom navigation:** Home, Food, Add, Weight, More on a deep-orange bar;
  white icons and labels, filled active icons and an underline. Add opens the
  existing sheet. Existing destination and back behavior stay unchanged.

## Accessibility and compatibility

- Minimum interactive targets remain 48 points. Normal text meets 4.5:1 contrast;
  the deeper orange provides 5.51:1 against white.
- Body text scales normally; fixed tab labels retain the existing 1.3 cap.
  Long content wraps or stacks, and supported tablet content is limited to 720
  points including gutters. The app remains light and portrait-oriented.
- Keep safe-area space outside keyboard-aware scrollers, and preserve reduced
  motion, accessible labels, selected/expanded states, loading, empty, retry,
  disabled, and pending-save states.
- No backend contract, authentication bypass, data migration, persistence,
  calculation, or route-parameter change belongs to this redesign.

## Verification

Run `npm test`, including the presentation edge cases in
`test/progressRingModel.test.ts`. Native verification must cover real screens,
card clipping, fonts, large text, keyboards, safe areas, and the diary/weight
interaction flows. Recorded implementation evidence accompanies the task;
historical screenshots are reference material, not proof of the current build.

### Implementation checks — September 8, 2026

- `npm test`: typecheck and 175 tests pass; the opt-in token-refresh test stays
  skipped. The new ring model has 12 edge-case checks.
- Android debug and iOS simulator builds succeeded. iOS welcome and onboarding
  confirmed bundled fonts, raised controls, and card shadows.
- Android authenticated local checks covered Home, Diary, Settings, Weight,
  Quick Add, independent nutrition/meal disclosures, the Add sheet, weight
  save and unsaved changes, and food deletion followed by Undo. The server
  confirmed five diary entries and 1,690 kcal after the undo operation.
- Android layouts were inspected at normal text and 200% text, with animations
  disabled, on a 320-point compact viewport and a tablet-sized viewport.
- Populated flow checks used a disposable local Supabase account and, after a
  `/v1/library/recents` HTTP 500 from the active backend, an isolated copy of
  backend commit `a011bea`. The active backend's uncommitted work was preserved.
  This does not verify that backend work or authenticated iOS flows.
- No production records, repository environment files, or Walk15 files were
  changed. Native review screenshots are stored alongside the mobile repository
  in `../nouri-walk15-redesign/` (not bundled with the app).

The disposable account and its cascading data were removed after verification.
Temporary test services were stopped, and the original Android font, motion,
keyboard, display, and bundler settings were restored.
