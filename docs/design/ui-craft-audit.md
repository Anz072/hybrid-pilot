Dribsnis UI Craft Audit
Verdict: the app has excellent color discipline sitting on top of a design system that exists but isn't actually used. Zero hardcoded hex colors across all screens is genuinely rare — but appTypography and sharedStyles are consumed by almost nobody, so every screen is a private fork of the system, and the forks have drifted into real visual bugs. The single biggest gap for a numbers-first app: tabular-nums appears zero times in the entire codebase, so every calorie, macro, and weight figure jitters as digits change.

What's genuinely good
Token discipline on color is near-perfect — everything routes through appColors; the only raw values in ~33k lines are the tab bar's #070707, one stray rgba(7,7,7,0.34) caret, and one off-palette cream in the scanner.
Radius vocabulary is tight (8 for cards, 999 for pills), pressed feedback exists almost everywhere, and swipe-to-delete with undo, the barcode scanner's permission/loading/error states, AddFood's skeleton rows, and DataExport's per-row busy states are all properly designed.
WeeklyReviewScreen is the one screen with a real focal story (accent-bordered "next action" card → hero → insights).
Ship-visible bugs (fix regardless of any redesign)
Invisible text — eyebrow label color equals its own background: ActivityLevelScreen.tsx:193 (brand800 on brand800) and SuccessScreen.tsx:167 (success700 on success700) — on the success screen it's the first word the user sees. The same broken style is copy-pasted (unused) into WeightScreen.tsx:1639 and WeightEntryModal.tsx:406.
Dark-on-dark selected option — the Activity list applies the selected card background but omits optionTitleSelected, so the chosen option's ink title sits on an ink card: ActivityLevelSettingsScreen.tsx:338.
Black hairline — borderWidth: 1 with no borderColor falls back to black in a cream UI: SuccessScreen.tsx:191.
Low-contrast body text — slate200 (the sand border token) used as text color and placeholders in ProfileSettingsScreen.tsx:514, ActivityLevel, and GoalStrategy settings.
Swallowed save errors — try/finally with no catch in ScannedFoodLogScreen.tsx:302: a failed food-log save fails silently.
Tab bar off-palette — MainTabNavigator.tsx:69 hardcodes #070707 instead of the app's ink #3D405B, and adds a drop shadow the rest of the app's flat-border language doesn't use.
The five systemic findings

1. No tabular figures, anywhere (highest impact, cheapest fix). Right-aligned calorie columns in diary rows, the hero ring value, weight deltas, the 7-day budget chart, +/- steppers — all use proportional figures and reflow as digits change. One fontVariant: ["tabular-nums"] in a shared numeric text style fixes the whole app.

2. The typography system is fiction. typography.ts describes a calm 400–600-weight scale; the screens use weights 700/800/900 317 times versus 38 uses of the official weights, across 21 distinct font sizes (the scale defines 9) — and the most common size in the app is 12px, which isn't on the scale at all. Worse, sharedStyles.ts itself is built on 800/900, so the two theme files contradict each other. This needs a decision, not a cleanup: either the app is a dense, heavy-type interface (then rewrite typography.ts to say so) or it's the calm one described (then the 800s have to go). Right now section titles, tile labels, and button text all shout at the same weight, which is why screens feel flat despite all the boldness.

3. The design system isn't consumed. sharedStyles is imported by only 8 files; HomeScreen and the entire Weight and Settings surfaces rebuild everything by hand. Measured drift: the card style is redefined 13 times (padding 12/14/16/18, border slate200 vs borderSoft), the primary button 9 times, pressed opacity exists as five values (0.86–0.94), disabled as three (0.5/0.58/0.6), and the screen gutter as six (14/16/18/20/22/24 — the official token is 18). The option-card selector is duplicated verbatim in 4 settings screens and again, differently, in 2 onboarding screens.

4. Two depth languages fight on the same screens. The app's baseline is flat 1px borders — but Home's quick actions, ring, and macro tiles float on shadows while the Weekly/Micros cards below them sit flat; the food diary's day pills and meal cards carry shadows that out-elevate the hero totals card; and the tab bar has its own shadow system. Nested radii are 8-inside-8 throughout (no concentric reduction), and Weight ships no-op shadowOpacity: 0 declarations.

5. Substantial dead design code. FoodDiaryDateStrip.tsx — all 318 lines — is imported nowhere. Decorative "orb" background styles are copy-pasted into ~17 files and rendered in none. ~100 orphaned style lines sit in FoodDiaryMoreSection, 25+ dead style keys in WeightScreen, and ActivityLevelScreen computes per-level accent colors that are never passed to the button. This is roughly a thousand lines of noise that makes every future style change riskier.

Hierarchy, screen by screen
Home — the calorie ring is the right focal point but it's bracketed by four near-identical 3-up grids at uniform weight and gap, so the eye ping-pongs instead of landing.
Food diary (the daily workhorse) — week-navigation chrome and a 22px date heading lead; today's totals, the reason to open the screen, sit third. An empty day has no designed state — just four collapsed "Nothing logged yet" rows.
Add Food — the core task is "search and log fast," but search is the fourth element down and visually the quietest; the mode switcher and scan button carry the strongest color, and each result row has three competing tap targets.
Weight — the "Current" number appears twice in the hero, and the page has four competing 28px headings, so nothing wins.
Onboarding — no shared step template: five different hero title sizes (30/32/34/40 vs the unused displayHero 44), two top-inset strategies, no progress indicator, and a primary CTA that's a rounded rect in an app where every other button is a pill. Login is the most token-correct screen and, ironically, the most visually foreign one.
Also worth knowing (token architecture)
In colors.ts: brand500, danger600, and the calories alias are all the same coral — destructive and primary share a color; brand800/900 resolve to ink, not coral, which is what produced the invisible-eyebrow bugs; and the macro aliases (protein/carbs/fat) are defined but never used by any screen. The slate\* naming also lies about its values (they're cream/sand, not slate), which is how a border token ended up as body text.

Recommended fix order
Bugs (the six above) — hours, no design decisions needed.
Tabular-nums + delete dead code (~1,000 lines incl. the dead file) — mechanical, high payoff.
Decide the type direction, rewrite typography.ts and sharedStyles.ts to agree, then migrate screens to consume them — this is the big one and where the app stops looking "generated."
One depth language (pick flat borders or shadows), one gutter, one pressed/disabled value.
Hierarchy passes on Home, Food diary, and Add Food (reorder so the task leads).
Want me to save this system snapshot (tokens, drift inventory, decided values) to .interface-design/system.md for future sessions, and/or start on wave 1–2 of the fixes?
