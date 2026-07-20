# Bright Editorial App Redesign

## Summary

Redesign the entire app as a bright, editorial nutrition tool while preserving all routes, calculations, data flows, and actions—including micronutrients, adaptive calories, weekly coaching, food logging, recipes, scanning, and weight tracking.

The new hierarchy will come from typography, spacing, alignment, and restrained color—not outlined cards, pills, badges, or decorative containers.

## Visual System

- Use a porcelain canvas (`#FAFAF8`), white elevated surfaces (`#FFFFFF`), soft fields (`#F1F1ED`), near-black text (`#171715`), and quiet gray dividers (`#E5E5DF`).
- Use one persimmon action accent (`#D6533C`) for primary actions and coaching highlights. Keep nutrient/status colors subdued and limited to progress visualization.
- Use Newsreader for screen titles and coaching statements; IBM Plex Sans for controls, body text, and tabular numeric data.
- Establish a 4px spacing grid, 16px screen gutters, 24–32px section spacing, 10–12px control radii, and no routine shadows.
- Replace enclosed card grids with open sections. Use hairline dividers only within dense lists; reserve filled panels for coaching, warnings, and selected controls.
- Keep chips only when they actively filter, select, or remove something. Convert passive badges, goal labels, dates, and statuses into ordinary inline text.
- Make “Daily Signal” the product signature: large aligned values, slim progress rails, concise context, and one plain-language coaching sentence.

## Component and Interface Changes

- Replace legacy color aliases and conflicting design documents with one semantic theme covering canvas, text hierarchy, controls, dividers, accent, nutrients, and statuses.
- Rework shared UI primitives:
  - `AppCard`: borderless `surface`, `subtle`, and `spotlight` variants; outlined usage becomes an explicit exception.
  - `ListRow`: transparent rows with optional internal dividers instead of boxed rows.
  - `SegmentedControl`: compact editorial tabs without an enclosing capsule.
  - `Chip`: restricted to genuine selection/filter interactions.
  - Add reusable `SectionHeader`, `MetricLine`, `ProgressRail`, and `CoachNote` patterns.
  - Preserve `NumericText` with tabular figures and consistent calorie, macro, micronutrient, and weight formatting.
- Simplify the bottom navigation while retaining Home, Food, central shortcuts, Weight, and More. Redesign the shortcuts sheet as a clean action list rather than a grid of outlined icon circles.
- Do not change navigation parameters, persistence schemas, repositories, nutrition engines, or external API contracts.

## Screen Migration

### 1. Foundation and navigation

- Replace the current Kitchen/Calm Ledger styling, update fonts and tokens, rebuild shared primitives, and remove obsolete theme aliases after all call sites migrate.
- Update headers, tab bar, modal sheets, buttons, inputs, loading states, and feedback states first.

### 2. Daily workflow

- Home: replace the double-ring/card grid with one calorie balance hero, an inline macro summary, micronutrient preview rows, and an actionable coaching note.
- Food Diary: lead with today’s balance; move date controls below it; present meals as open sections with divided rows and right-aligned calories.
- Add Food: keep search first, make scan a secondary icon action, use understated text tabs, and convert results into unboxed rows with one clear primary action.
- Preserve quick add, barcode scanning, recipes, custom foods, edit/delete, copy, undo, and all empty/error states.

### 3. Micronutrients and adaptive coaching

- Micronutrients: retain today/7-day views, personal targets, RDA/AI explanations, vitamin/mineral groups, values, and status copy; replace nested cards with aligned rows and slim progress rails.
- Adaptive coaching and Weekly Review: present the recommendation, evidence, and projected effect as one readable narrative followed by accept/decline controls. Keep every existing recommendation-setting and application action.
- Surface coaching on Home or Food Diary only when useful; avoid permanent “AI” badges or repeated adaptive labels.

### 4. Weight, settings, and onboarding

- Weight: one current-weight focal value, one trend chart, supporting metrics, and a divided history list.
- Settings and More: use grouped sections and row dividers; replace outlined option cards with rows, checkmarks, switches, or tabs appropriate to the interaction.
- Onboarding/Auth: use generous whitespace, one decision per screen, a thin progress indicator, filled fields, and a consistent footer CTA.
- Apply the same system to food creation, libraries, exports, scanners, forms, modals, and secondary settings so no legacy screen remains visually separate.

### 5. Cleanup and polish

- Remove dead styles, obsolete pill/card recipes, routine borders, duplicate primitives, unused theme values, and superseded redesign documentation.
- Add complete pressed, focused, disabled, loading, empty, error, success, over-target, and offline states.
- Keep motion under 250ms, animate only opacity/transform, and respect reduced-motion preferences.

## Test Plan

- Maintain the currently passing `npm run typecheck` and `npm test` baseline throughout every migration batch.
- Exercise all food logging, scanning, recipe, weight, settings, onboarding, micronutrient, weekly review, and adaptive-calorie workflows before and after redesign.
- Visually verify representative populated, empty, loading, error, disabled, and long-content states at 390×844 iOS and 360×800 Android sizes.
- Confirm 44×44 minimum touch targets, screen-reader labels, visible focus states, dynamic-number stability, and WCAG AA text contrast.
- Run final scans for unnecessary `borderWidth`, pill radii, passive chips/badges, hardcoded colors, routine shadows, non-tabular dynamic numbers, and local replacements for shared primitives.
- Acceptance criterion: each primary screen has one obvious focal task, passive information is not presented as a tag, routine content is not enclosed by default, and no existing capability or action is removed.

## Assumptions

- The initial release is light-only; full dark-mode infrastructure is out of scope.
- App icon, product name, backend behavior, nutrition formulas, and information architecture remain unchanged.
- Some layouts may reorder existing information for hierarchy, but no data, explanation, setting, or user action will be discarded.
