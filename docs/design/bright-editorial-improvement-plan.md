# Bright Editorial — Corrective Improvement Plan

The first implementation pass applied the redesign's *rules* (de-box, one accent, serif titles)
without preserving what the rules exist to produce: hierarchy, separation, and a focal moment
per screen. This plan fixes the execution while keeping the Bright Editorial direction, all
routes, data flows, and actions.

## Why the current result reads as flat and broken (audit synthesis)

1. **The surface system collapsed.** `AppCard`'s `surface`, `standard`, `compact`, `spotlight`,
   and `hero` variants all render as borderless `#FFFFFF` on the `#FAFAF8` canvas — a ~1.02:1
   contrast ratio. The hero blocks of Weight, Micronutrients, Food Diary, and Weekly Review are
   invisible white boxes. De-boxing leftovers made it worse: several controls kept a
   `borderColor` but set `borderWidth: 0` (FoodDiaryMoreSection tiles, AddFood back button), and
   the Weight snackbar renders **white text on a white surface** — unreadable.
2. **Hierarchy collapsed.** No screen has a large focal value anymore. Home's hero number is
   36px under a 20px screen title; the Food Diary's biggest type is 17px and its calorie total
   is a concatenated `bodySmall` string ("Energy - 1,850 / 2,000 kcal"); Weekly Review's
   headline is 16px while a *subordinate* insight card below it shows 36px. Every section title
   in the app is the same 20px Newsreader Bold. The old design at least had a large calorie
   ring as an anchor; the redesign removed it and replaced it with nothing.
3. **The single accent inflated into noise.** Persimmon appears on ~14 icon circles + every
   value on the More screen, on every vitamin's progress bar, as the Weight chart's entire data
   ink, twice per row in Add Food results, on every quick-add eyebrow, and on static weekday
   labels. When everything is persimmon, nothing is.
4. **Data colors are muddy or invisible.** `brand300 == brand400` (pale peach `#E9AA98`) is
   used as icon and data ink and looks disabled; the chart's goal band (`#F7E2DB` × 0.45) is
   a ghost; 4px macro rails in wheat/olive on an `#F1F1ED` track on `#FAFAF8` canvas are three
   near-identical light layers; vitamins/minerals share just two hues for ~20 nutrients.
5. **The migration is half-finished.** Nine food sub-screens still ship the legacy
   `sharedStyles` language — boxed white cards, pill chips, and **green and amber primary
   buttons** — and collide with the new idiom inside AddFoodScreen itself (legacy
   FoodLogContextBar pills above new divided rows). Weight has three different collapse
   affordances; there are two segmented-control shapes; eyebrow color and spinner tint differ
   by screen.
6. **Craft defects.** Literal `|` pipe glyphs as separators; off-grid paddings (9, 13, 14, 18);
   OptionCard rows that jump 12px sideways when selected and lose their divider; hanging
   dividers under the last row of every More section; duplicate result counts in Add Food;
   robotic template copy in coach notes and section subtitles.

## Corrective rules (system-level, applied everywhere)

- **No naked white on canvas.** A contained panel is either white **with a hairline
  `#E5E5DF` border**, or a soft `#F1F1ED` fill with no border. A true open section renders
  directly on the canvas with no box at all. Nothing in between.
- **One focal value per primary screen.** Every primary screen gets exactly one 40–56px
  tabular number (new `numberDisplay` role); everything else steps down from it.
- **Newsreader only at display sizes (≥ 22px) and in the coach voice.** Small groupings
  (settings sections, list headers) use the Plex uppercase eyebrow, not a 20px serif.
- **Persimmon = action + coaching only.** Interactive controls, the coach rule, selection
  states. Never data rails, static values, icon tiles, weekday labels, or per-row decoration.
- **Data ink:** calories = ink; macros = deepened food hues; micronutrient bars are colored by
  *status* (garden on-track / honey low / red over), not by section.
- **Rows:** divided lists use full-strength `#E5E5DF` hairlines, `·` (middle dot) separators,
  no rounded corners, no divider after the last row, 4px-grid padding only.

## Stage 1 — Repair the system (tokens + primitives)

Files: `theme/colors.ts`, `theme/typography.ts`, `theme/tokens.ts`, `ui/AppCard.tsx`,
`ui/AppButton.tsx`, `ui/AppChip.tsx`, `ui/AppInput.tsx`, `ui/AppStates.tsx`,
`ui/OptionCard.tsx`, `ui/ProgressRail.tsx`, plus the Weight snackbar bug.

- `AppCard`: `surface` = white + hairline border; `subtle` = soft fill; `spotlight` = white +
  hairline + 3px ink top rule (the editorial section opener — `appBorders.rule` finally earns
  its keep); map aliases `hero → spotlight`, `soft → subtle`, `standard/compact → surface`.
  Remove the disabled-border artifacts at call sites.
- Typography: add `numberDisplay` (52/56, −1.0 tracking, tabular); `screenTitle` stays 30
  serif; `sectionTitle` becomes 22 serif reserved for true section openers; small group labels
  use `eyebrow`. Retire serif below 22px.
- Colors: split `brand300`/`brand400` into distinct usable steps; deepen macro hues
  (protein `#A34E36`, carbs `#A87A2F`, fat `#66753F`); darken the rail track to `#EAEAE4`;
  add a status ramp for micronutrient bars.
- `ProgressRail`: default height 6, minimum 6 anywhere it renders data; darker track.
- `AppButton`: fix 13px off-grid padding; `secondary` = soft fill + ink label; `ghost` = text
  + pressed tint (no 5%-wash rectangle).
- `AppChip`: unselected = soft fill (visible on canvas); `SegmentedControl` active tab = ink
  label + 2px ink underline, inactive = muted (persimmon reserved for actions).
- `OptionCard`: equal padding in both states (no layout jump), divider persists when selected,
  radius only when the selected fill is on.
- `AppStates`: success block gets a real garden tint; state blocks get a hairline.
- **Bug fix:** Weight snackbar becomes an ink-filled toast with white text (currently
  white-on-white).

Exit: typecheck + tests green; every AppCard variant visually distinct; no borderless white
surface anywhere.

## Stage 2 — Rebuild the two daily heroes (Home, Food Diary)

- **Home:** 30px serif title; hero = `numberDisplay` consumed calories with "/ target kcal"
  and a 6px ink rail; "kcal left" appears once (remove the duplicate inside the coach
  sentence); rewrite `buildCoachMessage` so it never repeats the hero line; macro row values
  step up to 17px with 6px deepened-hue rails; pressable sections get pressed feedback and a
  chevron aligned to the section header, not buried mid-block.
- **Food Diary hero:** restore a real calorie figure (40px+) with target and remaining;
  "Energy - " debug string becomes label + aligned numbers; rename to "Calories"; expanded
  macros become MetricLines; visible disclosure affordance and pressed state.
- **Diary rows:** full-strength hairlines (remove the 0.55-opacity divider), `·` separators
  instead of `|`, meal titles 17px with right-aligned 16px tabular calories, day-status row
  visible in its default state, week-nav carets get 44px ghost-fill hit targets, all magic
  paddings (14/16/18) snapped to tokens, one selection idiom (drop the left accent bar).
- **More section tiles → divided `ListRow` list** (same idiom as the shortcuts sheet).
- **Quick adds:** one card width, `surface` treatment (white + hairline), eyebrow → muted
  metadata, one Log affordance per card.

Exit: both screens have exactly one focal number; no invisible surfaces; no pipes.

## Stage 3 — Add Food + finish the nine legacy sub-screens

- **AddFood:** result-row macro text → secondary ink (persimmon only on the Log button);
  back button gets a visible ghost-strong fill; amber notice → soft neutral panel with a small
  honey icon; remove the duplicated result count; un-bold the search input; give empty-state
  CTAs a real button treatment; humanize section subtitles.
- **Port all nine `sharedStyles` importers** (QuickAddFood, EditFoodEntry, FoodReadOnly,
  ScannedFoodLog, FoodEntryForm, FoodLogContextBar, CreateCustomFood, CreateFoodItem,
  CreateRecipe) to the repaired primitives. Green (`success500`) and amber (`warning600`)
  primary buttons become persimmon primary / soft secondary. One segmented-control shape
  app-wide. Then delete the dead recipes from `sharedStyles.ts`.

Exit: zero imports of legacy pill/card/button recipes; one design language across the whole
food flow.

## Stage 4 — Weight, Weekly Review, Micros, More, Onboarding

- **Weight:** one collapse idiom (header row + caret) for Goal/Insights/History; history =
  flat divided rows, not rounded compact cards; goal readout in ink; remove the 3px pale-peach
  smear lines; disclosure "Open/Hide" chips → plain caret affordance. **Chart:** trend line in
  ink, single persimmon current-point marker, visible goal treatment (dashed `#D8D8D0` line +
  honey-soft band at full opacity), remove the blurry halo, legend → inline text.
- **Weekly Review:** hero states the week's verdict as the screen's one big number
  (e.g. "−150 kcal / day" at `numberDisplay`); insight-card numbers step down; completion =
  garden, calories = ink everywhere (one color per meaning); CTA zone gets a `subtle` panel;
  weekday labels in ink; icons at full-strength hues; section gaps unified.
- **Micros:** hero de-boxed to an open section with one focal stat ("14 of 18 on track");
  nutrient bars colored by status ramp, not persimmon/green-by-section; row rhythm from
  aligned 14px labels + 13px tabular deltas.
- **More:** peach icon circles → plain ink icons; persimmon values → secondary ink
  ("Manage"/"Open" style affordances may keep accent); section titles → eyebrow; fix hanging
  last-row dividers; hero metrics equal-sized.
- **Onboarding:** footer bar matches canvas with a top hairline (no white-on-porcelain
  mismatch); review-card answers in primary ink; divider rhythm fixed; eyebrow color unified
  (secondary); FuelPlan cards → repaired `surface`/`subtle` treatments.

Exit: no screen with more than one accent job; consistent affordances; every "hero" visible.

## Stage 5 — Consistency and craft sweep

- App-wide greps and fixes: remaining `|` separators, off-grid paddings, dead styles,
  duplicate information, refresh-spinner tint (ink everywhere), radius drift (8 vs 10),
  robotic template copy.
- Final scans repeated from the original plan (hardcoded colors, shadows, passive chips,
  naked white surfaces — new check).
- `npm run typecheck` + `npm test` green; manual visual pass at 390×844 / 360×800.

## Test plan

Maintain the passing typecheck/test baseline after every stage. Acceptance per screen: one
focal value, every surface either open or visibly bounded, persimmon only on actions and
coaching, no legacy idiom visible from any adjacent screen.
