# Dribsnis Improvement Plan

Date: 2026-07-02

Status: proposal only — no code changed by this document.

Relationship to prior docs:
- Supersedes the UX/product recommendations in `FEATURE_AUDIT.md` (dated
  2026-04-24), several of which are now stale — see "What changed since the last
  audit" below.
- Complements `ADAPTIVE_TDEE_V1_ANALYSIS.md`, which remains accurate on the
  adaptive engine's design.

---

## 1. What Dribsnis is today

Dribsnis is an Expo/React Native calorie and nutrition tracker with a genuine
point of view: it is an *adaptive* tracker, not just a food database browser.
The current build is meaningfully more coherent than the April audit describes.

**Navigation (5 tabs):** Home · Food · Shortcuts (center action) · Weight · More.

**Core capabilities that work today:**
- **Onboarding (11 steps):** Welcome → Goal → Login → Goal rate → Body data →
  Activity → Training → Protein focus → Fuel plan → Account → Success.
- **Food diary:** now organized into **Breakfast / Lunch / Dinner / Snacks**
  meal buckets (recently reworked away from the old hour-by-hour timeline), with
  per-meal totals, swipe-to-delete + undo, copy-last-day and repeat-meal,
  day-completion marking, and an adaptive-recommendation banner.
- **Food entry paths:** search (all foods / recipes / custom meals), barcode
  scan + manual barcode entry, quick add, custom food, custom meal, recipe
  builder, favorites/quick-picks.
- **Food data sources:** USDA FoodData Central, Open Food Facts, and a local
  library, with a caching layer (`cached_search_results`,
  `cached_barcode_lookups`, `cached_food_entries`, `cached_home_summaries`).
- **Home dashboard:** calorie rings, macro tiles with progress, micronutrient
  preview, weight reference.
- **Micronutrients:** a dedicated overview screen plus per-day totals — a real
  Cronometer-style depth advantage.
- **Weight:** entries with EMA-smoothed trend + chart, weight goal, same-day
  replacement, swipe delete + undo. Weight *sources* (`healthkit`,
  `health_connect`, `google_fit`, `smart_scale`, `csv`) are modeled in the
  schema but there is no import UI yet.
- **Adaptive calories (v1):** client-side, recommend-only. 28-day window over
  complete diary days + EMA weight trend → estimated TDEE (7700 kcal/kg
  heuristic) → strategy-based target with 50-kcal rounding, 150-kcal/cycle cap,
  confidence tiers, and a full proposed/applied/rejected/superseded lifecycle
  stored in Supabase.
- **Weekly review** surface, profile/account management, daily calorie schedule
  with weekly budget, public recipe/custom-meal visibility.

**Nutrition math (engine):**
- BMR via **Mifflin–St Jeor**, TDEE via activity factor (1.2–1.9).
- Goal offsets are **strategy-based** and — importantly — the *same* offsets are
  reused by both onboarding and the adaptive engine (via
  `getGoalCalorieOffset`), so the two are internally consistent. (The
  "-350/+250" figures in the older adaptive doc are simplified prose, not the
  actual code.)
- Protein = bodyweight × focus multiplier (1.3 / 1.6 / 2.0 / 2.6 g/kg), capped
  at `calories/4`; fat = 28% of calories (or what protein leaves); carbs = the
  remainder.

**Auth:** email + password via Supabase only — `LoginScreen` explicitly rejects
non-email providers (`assertEmailPasswordUser`), so OAuth/social sign-in is
deliberately disabled. A dev bypass allows a local-only account in Expo Go.
(Note: the April audit's "Google-backed" language is inaccurate for the current
build.)

**Persistence:** SQLite locally (~20 live tables incl. caches + migration
history), mirrored to Supabase (14 tables). Local-first: all writes go through a
`DB` facade → SQLite, then sync to Supabase (skipped in Expo Go dev). One shape
mismatch the sync layer bridges: SQLite stores custom meals as `food_items` rows
and recipes in `user_recipes`, while Supabase splits them into
`custom_recipes`/`custom_meals` (+ item tables).

---

## 2. What changed since the last audit (so we don't re-solve solved problems)

Several `FEATURE_AUDIT.md` (2026-04-24) items are **already resolved** and should
not be re-planned:

- ✅ **Quick-add rail is live** — `FoodDiaryQuickAdds` is rendered, not commented
  out.
- ✅ **Repeat-meal exists** — the diary now has per-meal "Repeat meal" plus
  copy-last-day, not just whole-day copy.
- ✅ **Quick Add alcohol mismatch appears gone** — no `alcohol` references remain
  in the Food quick-add screens.
- ✅ **Meal structure** — the diary is now Breakfast/Lunch/Dinner/Snacks.

Still open from that audit, and still worth doing: units/regional preferences,
export/import, health sync, debug-surface gating, weekly-review-as-action-loop,
and engineering guardrails (a first test harness now exists — `npm test` runs
typecheck + the food-log-copy tests).

---

## 3. New findings from this pass (current code)

### 3.1 Orphaned code from the meal-bucket refactor (cleanup)
The move to meal buckets left the old hour-window machinery stranded:
- `foodDiaryStartHour` / `foodDiaryEndHour` in `DBUserSettings` are no longer
  read by the diary UI — only by the storage layer and the debug screen.
- `DiaryHoursDebugScreen.tsx` (412 lines) configures those now-unused hours.
- **`MoreNavigator` exposes this screen aliased as `PreferencesScreen`** — i.e.
  the only thing behind the "Preferences" entry is a diary-hours debug screen.
  There is **no real preferences/units screen**.

→ Opportunity: retire the diary-hours settings and replace the "Preferences"
slot with a genuine preferences screen (units, etc. — see §5.3).

### 3.2 Debug/destructive tooling — partially gated, still leaking
Gating is inconsistent:
- `SettingsScreen` (reset / sample-seed / destructive weight actions) and
  `FoodLibraryScreen` (destructive item deletion) **are** already
  developer-account gated via `MoreNavigator` (`isDeveloperAccountEmail`).
- But `MoreScreen` still shows a visible **"Debug Menu"** entry and invokes
  `seedDeveloperTestData` in the normal settings flow, **not** gated by `__DEV__`
  or the developer-account check.

→ The remaining work is closing the `MoreScreen` gap and standardizing on one
gating mechanism (dev flag + developer-account) for all debug surfaces.

### 3.3 Model exists, product surface doesn't
- `activities` table (SQLite + Supabase) but **no activity/exercise logging UI**.
- Weight import sources modeled but **no import/health-sync surface**.
- **No export/import/backup** anywhere despite meaningful history accumulating.

### 3.4 Onboarding length & auth placement
The flow is 11 steps with **two auth touchpoints** (Login early at step 3,
Account near the end at step 10). Worth validating this isn't creating drop-off
or duplicate-account confusion.

---

## 4. Competitive cross-reference

| App | Its core strength | What Dribsnis should borrow (or already beats) |
|---|---|---|
| **MacroFactor** | The weekly *check-in* is the product; expenditure adaptation feels first-class | Unify Weekly Review + Adaptive into one guided "check-in" moment with a single next-action. Dribsnis already has the engine — it lacks the moment. |
| **Cronometer** | Nutrient depth + trustworthy data + integrations/export | Dribsnis already rivals it on micronutrients; it's behind on export and data-source transparency. |
| **MyFitnessPal** | Logging speed & breadth (barcode, meal scan, recents) | Faster repeat logging, strong "recent/most-used" surfacing. Photo/meal-scan is a later bet. |
| **Lose It!** | Approachable calorie budgeting, weekly flexibility, photo logging | Promote the weekly calorie schedule more prominently; make "weekend calories" legible in onboarding + settings. |
| **Lifesum** | Friendly guidance, weekly scoring, low-friction coaching | A friendlier summary→action bridge and day-level habit feedback. |

**Positioning:** Dribsnis's credible niche is "the tight, calm, *adaptive*
tracker" — more thoughtful than MFP on adaptation, more focused than Cronometer
on behavior, less bloated than either. The plan below is sequenced to sharpen
that center rather than out-broaden the incumbents.

---

## 5. Proposed improvements (prioritized)

Priorities: **P0** = highest leverage / lowest regret, **P1** = strong, **P2** =
later/differentiation. Each item notes rough size (S/M/L) and why.

### P0 — Sharpen the core loop & remove polish-breakers

**5.1 Make the weekly check-in the product (M–L)**
Merge Weekly Review + Adaptive Calories into one guided flow: calorie delta →
weight trend → logging completeness → the recommendation → accept / postpone /
keep, with **one clear "next action" at the top**. This is the single biggest
differentiator lever and the pieces already exist; they're just split across two
screens.

**5.2 Close the debug-gating gap (S)**
`SettingsScreen` and `FoodLibraryScreen` are already developer-account gated;
finish the job by hiding the `MoreScreen` "Debug Menu" entry and
`seedDeveloperTestData` behind the same check (and/or `__DEV__`). While here,
delete the legacy/unused `API/supabase/endpoints.ts` path constants and the empty
"Add" placeholder screen's dead surface. Biggest trust-per-effort win in the app.

**5.3 Finish the meal-bucket refactor cleanup + real Preferences (S–M)**
- Retire `foodDiaryStartHour/EndHour` and `DiaryHoursDebugScreen`.
- Replace the "Preferences" nav entry (currently an alias to the debug screen)
  with a real Preferences screen — starting with units (§5.4).
- Optional: let users **rename/reorder meal buckets** or add a 5th ("Pre/Post
  workout") since the app has a training profile.

**5.4 Units & regional preferences (M)**
Metric-only is the clearest "not a serious app yet" gap. Add weight kg/lb,
height cm/ft-in, portion g/oz display, and 12h/24h. Store one preference object;
convert at the display edge.

### P1 — Trust, portability, and logging speed

**5.5 Export / import / backup (M)**
CSV for weights + food logs, JSON for profile/settings/history. Cheapest way to
earn Cronometer-grade "my data is safe" trust; history is now large enough to
matter.

**5.6 Data-source & sync transparency (S–M)**
Show which source a food came from (USDA / OFF / custom / recipe) consistently,
plus a clear account/sync-status line in Profile. Reinforces the precision story.

**5.7 Faster repeat logging (S–M)**
Now that meals are buckets: add "recent foods" and "most-used" surfacing per
meal, and a one-tap "log same as yesterday's <meal>." Keep the global shortcut
sheet but don't rely on it as the primary fast path.

**5.8 Recipe / custom-meal library discovery (M)**
Bookmark/save for public recipes & meals, "created by you" vs "public" chips
everywhere, last-used / most-used sorting, clearer ownership + editability. This
is an underrated latent strength.

### P2 — Differentiation & broader market

**5.9 Health integration for weight import first (L)** — Apple Health / Health
Connect weight import (sources already modeled), before any activity sync.

**5.10 Activity logging (L)** — a real surface for the existing `activities`
table; groundwork for adaptive v2 (activity-aware corrections).

**5.11 Micronutrient coaching (M)** — move beyond totals to "you're
consistently low on X" storytelling; leans on existing depth.

**5.12 Later bets** — photo/meal-scan logging, recipe import from URL, habit/score
overlays, optional adaptive auto-apply mode, incomplete-day reminder nudges
(notification lifecycle).

---

## 6. Nutrition-science refinements (optional, engine-level)

The engine is sound; these are refinements, not fixes:
- **Protein basis:** protein scales with *current* bodyweight, which overshoots
  for higher-body-fat users. Consider goal weight or an estimated lean-mass
  basis (offer as an advanced option to avoid confusing casual users).
- **Fat floor:** fat is a flat 28% of calories. Consider a minimum g/kg floor so
  very high-protein or low-calorie plans don't push fat too low.
- **Adaptive `7700 kcal/kg`** is a fine v1 heuristic; a v2 could adopt a dynamic
  expenditure model (NIDDK-style) once activity data exists.
- **Fiber/sugar targets:** tracked but not surfaced as goals — cheap add given
  the data is already there.

---

## 7. Engineering guardrails

- Extend the test suite (a harness now exists) to cover the highest-risk pure
  logic: adaptive recommendation rules, quick-add calorie math, schedule
  override shifting, same-day weight replacement, meal-bucket grouping /
  legacy-entry fallback.
- Add a `lint` script (currently `lint` aliases typecheck).
- Consider a lightweight CI gate (typecheck + test) before release builds.

---

## 8. Suggested sequencing

1. **Pass 1 (polish + core loop):** 5.2 debug gating → 5.3 refactor cleanup →
   5.1 unified check-in.
2. **Pass 2 (trust + units):** 5.4 units → 5.5 export → 5.6 sync transparency.
3. **Pass 3 (logging + library):** 5.7 fast logging → 5.8 library discovery.
4. **Pass 4 (differentiation):** 5.9 health import → 5.10 activity → 5.11 micro
   coaching → 5.12 later bets.

---

## 9. Open questions for you

Answers here will sharpen scope and reordering:

1. **Audience & platform:** Is this primarily your personal app, or aimed at
   public release? (Changes how much the trust/units/export work matters vs.
   pure feature depth.)
2. **iOS, Android, or both** as the priority target? (Drives whether Apple
   Health or Health Connect comes first.)
3. **Weekly check-in:** Do you want to go the MacroFactor route and make a single
   guided weekly check-in the centerpiece (5.1)? Or keep review and adaptive
   settings separate?
4. **Meal buckets:** Are the fixed four (Breakfast/Lunch/Dinner/Snacks) enough,
   or do you want user-customizable/renamable meals (e.g. a workout meal)?
5. **Units:** Which do *you* use day-to-day? Should imperial be a full option or
   just a display toggle? Any locale/region priorities?
6. **Adaptive aggressiveness:** Keep it recommend-only, or add an opt-in
   auto-apply mode? Are the current guardrails (150 kcal/cycle, 14-day minimum)
   the feel you want?
7. **Social/public features:** Is public recipe/meal sharing a real product
   direction to invest in (discovery, bookmarking), or just a nice-to-have to
   leave minimal?
8. **Activity tracking:** Do you want to log workouts in-app, or rely on adaptive
   TDEE to absorb activity implicitly (the current approach)?
9. **Protein target:** Are you happy with bodyweight-based protein, or interested
   in a goal-weight / lean-mass basis for leaner targets at higher body fat?
10. **Debug tooling:** Confirm the seed/reset/debug screens are dev-only and safe
    to hide from production navigation.

---

## 10. Bottom line

The app has crossed from "prototype with gaps" into "product with a thesis." The
highest-leverage next moves are not new features — they are: gate the debug
surfaces, finish the meal-bucket cleanup with a real Preferences screen, and turn
the already-built adaptive engine + weekly review into one guided check-in
moment. Units, export, and faster repeat-logging follow. Everything else is
differentiation that should come only after that center is tight.
</content>
