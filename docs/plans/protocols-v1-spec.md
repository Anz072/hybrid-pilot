# Nouri Protocols — V1 Product & Engineering Specification

## 1. Product goal

**Nouri Protocols** is an optional compound-tracking module inside Nouri.

It should let a user:

1. define the compounds they are taking,
2. define exactly when and how they intend to take them,
3. log what they actually took,
4. see upcoming and historical administrations,
5. visualize approximate pharmacokinetic levels,
6. compare hypothetical schedules without changing their real schedule,
7. record bloodwork,
8. view bloodwork, weight and nutrition alongside protocol changes.

The feature is a **tracker**, not a regimen builder.

Nouri must not:

- recommend compounds,
- recommend doses,
- generate cycles or stacks,
- tell users what they should take,
- optimize regimens,
- infer medical causation from tracked data.

The central product idea is:

```text
PLAN
  ↓
SCHEDULE
  ↓
LOG REALITY
  ↓
ESTIMATE LEVELS
  ↓
VIEW HEALTH + NUTRITION CONTEXT
```

---

# 2. V1 scope

## Included

### Compound tracking

V1 catalog:

- testosterone esters,
- popular injectable AAS,
- injectable GLP-1/incretin compounds.

Important:

- ester variants are independent compounds,
- use active-compound names rather than brands,
- no oral AAS in V1,
- no broader research-peptide catalog in V1,
- no custom compounds in V1.

Examples of the required modeling principle:

```text
Testosterone Enanthate
Testosterone Cypionate
Testosterone Propionate
Testosterone Undecanoate
```

These must not become one generic `Testosterone`.

### Scheduling

Support:

- daily,
- every N days,
- every N hours,
- specific weekdays,
- multiple administrations per day,
- different doses at different times,
- one-time administration,
- as-needed/manual administration,
- indefinite courses,
- scheduled future changes,
- course history.

### Logging

Support:

- scheduled time,
- actual time,
- planned dose,
- actual dose,
- administration route,
- optional injection site,
- editing old logs,
- deleting old logs.

### Estimated Levels

Support:

- modeled levels from logged administrations,
- future projections from planned administrations,
- Relative %,
- Estimated amount remaining,
- 1W / 1M / 3M / All ranges,
- compound toggles,
- multi-compound overlay,
- dose markers,
- phase-change annotations,
- graph scrubbing,
- hypothetical comparison mode,
- 95% clearance estimate.

### Bloodwork

Support:

- manual bloodwork entry,
- curated biomarker catalog,
- multiple supported units,
- automatic compatible-unit conversion,
- selectable chart unit,
- per-result reference ranges,
- optional laboratory/provider name,
- bloodwork reminders.

### Trends

Support:

- bodyweight,
- calories,
- protein,
- bloodwork,
- course start/end annotations,
- phase-change annotations.

Calories and protein should default to a **7-day rolling average**.

---

# 3. Explicit non-goals

Do not add these during V1 unless this specification is deliberately revised:

- cycle recommendations,
- stack recommendations,
- dose recommendations,
- custom compounds,
- oral AAS,
- general research peptide catalog,
- inventory,
- vial inventory,
- supply tracking,
- vial expiration,
- reconstitution,
- reconstitution calculators,
- dosage calculators,
- syringe/needle tracking,
- dose photos,
- injection notes,
- body-map visualization,
- protocol sharing,
- protocol marketplace,
- CSV export,
- PDF reports,
- HealthKit/Health Connect integration,
- training overlays,
- web UI,
- widgets,
- AI correlation/causation analysis,
- streaks,
- adherence scores,
- premium gating.

Everything in Protocols V1 is free.

---

# 4. Terminology and domain model

Use these concepts consistently.

```text
Protocols
    │
    ├── Compound Course
    │       │
    │       ├── Phase
    │       │      │
    │       │      └── Scheduled Occurrences
    │       │
    │       └── Dose Logs
    │
    ├── Bloodwork
    └── Bloodwork Reminders
```

## Protocols

The name of the overall Nouri feature.

There is **not** one giant user `protocol` object containing all compounds.

## Compound Definition

Nouri's curated knowledge about a compound.

Example:

```text
Testosterone Enanthate
```

Contains metadata, supported routes and PK model information.

## Compound Course

One continuous tracked run of one compound.

Example:

```text
Testosterone Enanthate
Aug 11 → ongoing
```

Ending and later restarting the same compound creates a **new course**.

Two simultaneous courses of the same compound are allowed.

## Phase

A point from which the configuration of a course changes.

Example:

```text
Course: Testosterone Enanthate

Phase 1
Aug 11
100 mg every 3 days

Phase 2
Sep 9
110 mg every 2 days

Phase 3
Oct 1
100 mg every 3 days
```

Phases preserve historical truth.

Editing a schedule must never silently rewrite historical configuration.

## Occurrence

One planned administration.

Example:

```text
scheduled_at:
2026-09-09T20:00
```

## Dose Log

What actually happened.

Example:

```text
scheduled_at: 20:00
actual_at:    21:14

planned:
110 mg

actual:
105 mg
```

Planned and actual information must remain separate.

---

# 5. Course states

Internally use:

```text
DRAFT
ACTIVE
ENDED
```

Display state can additionally be derived.

For example:

```text
DRAFT
→ Planned

ACTIVE + starts in future
→ Scheduled

ACTIVE + currently running
→ Active

ENDED
→ History
```

A draft:

- can be edited,
- can preview schedule,
- can use Estimated Levels,
- can use Compare,
- produces no notifications,
- produces no real scheduled occurrences,
- cannot have normal scheduled-dose logging.

Starting the draft activates it.

---

# 6. Main application integration

Protocol tracking is opt-in.

Add:

```text
Settings
  Tracking
    Protocol tracking
```

When first enabled, show one simple introduction screen.

```text
Track your protocol

Schedule compounds, log actual doses,
track injection sites, visualize estimated
levels, and view changes alongside your
health data.

Nouri tracks the protocol you enter.
It does not recommend compounds or dosing.

[ Add first compound ]

Not now
```

Do not build a multi-step onboarding carousel.

Users who never enable Protocols should see **no Protocol-specific Home UI**.

---

# 7. Home integration

The Protocol card sits:

> **immediately below the primary calorie section**

Do not place it above the calorie experience.

## Default card

```text
PROTOCOL                                    >

 M     T     W     T     F     S     S
 7     8    [9]   10    11    12    13
 •          •••         •

Next dose in 5h 42m

○ Testosterone Enanthate
  110 mg · IM · 20:00                  [ Log ]

○ HCG
  250 IU · SubQ · 20:00                [ Log ]

✓ Semaglutide
  1 mg · Taken 08:14
```

### Week strip

The seven-day strip is the primary Home calendar visualization.

Do not put a month calendar on Home.

Dots indicate dates containing scheduled occurrences.

Tapping a date changes **only the Protocol card**.

It must not change the food diary's selected date or global Home state.

### Selected past date

Show:

```text
Tuesday, Sep 8

✓ Testosterone Enanthate
  110 mg · Taken 20:14

○ Semaglutide
  Unlogged
```

### Selected future date

Show scheduled occurrences without logging actions that imply they can be completed in advance.

### Density

Use adaptive density:

```text
1 item     → spacious layout
2–3 items → compact rows
4+ items  → first 3 + "View all"
```

### Completed items

Completed items remain visible on the current day with a checkmark.

### Card navigation

Tapping:

- `PROTOCOL` header → Protocols / Today,
- a compound → that compound course,
- `Log` → logging sheet,
- a date → that date inside Home card.

### Home exclusions

Do not display:

- PK sparkline,
- bloodwork reminders,
- bloodwork values,
- trends,
- injection history.

Home should remain calm.

---

# 8. Protocols navigation

Use four primary sections:

```text
[ Today ] [ Levels ] [ Trends ] [ Compounds ]
```

Do not create separate top-level tabs for:

- injections,
- calendar,
- bloodwork,
- labs,
- history,
- settings,
- peptides,
- steroids.

These belong inside the four core areas.

Provide a global `+` action.

```text
Add

Compound
Bloodwork
Bloodwork reminder
```

Subjective check-ins can join this menu in a later release without changing the architecture.

---

# 9. Today screen

Today is the operational view.

```text
Wednesday, September 9

‹   Sep 7 – Sep 13   ›             [ calendar ]

 M    T    W    T    F    S    S
 7    8   [9]  10   11   12   13
 •        ••         •

Next dose in 6h 24m

EVENING

○ Testosterone Enanthate
  110 mg · IM
  20:00

  [ Log dose ]

○ HCG
  250 IU · SubQ
  20:00

COMPLETED

✓ Semaglutide
  1 mg · SubQ
  Taken 08:14
```

The month-calendar button opens the full calendar.

---

# 10. Previous unlogged administrations

Do not mix an indefinite backlog into today's schedule.

If yesterday has unlogged occurrences, show:

```text
NEEDS ATTENTION

1 unlogged dose from yesterday        >
```

Only yesterday receives this Today-screen callout.

Anything older remains visible through:

- calendar navigation,
- course history.

Historical unlogged occurrences retain the status:

```text
Unlogged
```

Do not call them `Missed`.

Do not invent adherence states.

---

# 11. Overdue behavior

During the scheduled calendar day:

```text
Testosterone Enanthate
110 mg

Overdue · 2h 14m
```

At the next day boundary it becomes historical:

```text
Unlogged
```

There is no recurring overdue push notification.

---

# 12. Full calendar

Accessible from Today.

Month calendar should communicate scheduled activity without becoming visually noisy.

Recommended states:

```text
• scheduled
✓ completed day
mixed indicator if day contains both
```

Exact visual language should use the existing Nouri design system.

Tapping a date opens that date's Today view.

Do not create a separate standalone Calendar tab.

---

# 13. Logging interaction

Tapping `Log dose` opens a bottom sheet.

```text
Log dose

Testosterone Enanthate

Dose
[ 110 ] mg

Scheduled
20:00

Taken
[ Now · 19:52 ]

Route
[ IM ]

Injection site
[ Left delt                     > ]

Last used
Right delt · Sep 7

                          [ Confirm ]
```

The user must explicitly confirm.

A push notification must never mark a dose as taken directly.

## Editable fields

Allow:

- actual dose,
- actual time,
- route,
- injection site.

## Required fields

Required:

- actual amount,
- actual time,
- route.

Injection site is optional.

## Historical logging

A user can open yesterday or another past date and log the occurrence.

Example:

```text
Scheduled
Sep 8 · 20:00

Taken
Sep 8 · 22:17
```

This is explicitly supported.

## Editing

Existing logs can be edited.

No audit history is required.

## Deleting

Existing logs can be deleted.

Deleting a scheduled occurrence's log returns that occurrence to:

```text
Unlogged
```

The planned occurrence itself remains.

---

# 14. Injection-site picker

Do not build a body visualization in V1.

Use a polished grouped list.

```text
Injection site

RECENT

Right delt                      Sep 7
Left delt                       Sep 5

IM

Left delt
Right delt
Left ventroglute
Right ventroglute
Left quad
Right quad

SUBQ

Left abdomen
Right abdomen
...
```

The exact site catalog should be curated separately.

Nouri should show **previously used sites**, not recommend where the user should inject next.

Remember the previous route and site when opening the next logging sheet.

These are defaults only and remain editable.

---

# 15. Add Compound flow

## Step 1 — Compound

```text
Add compound

Search
┌───────────────────────────────┐
│ testosterone en...            │
└───────────────────────────────┘

TESTOSTERONE

Testosterone Enanthate
Testosterone Cypionate
Testosterone Propionate
Testosterone Undecanoate

OTHER INJECTABLE AAS
...

GLP-1 / INCRETIN
...
```

Do not show brand names.

## Step 2 — Configuration

```text
Testosterone Enanthate

Route
[ IM ]

Schedule
[ Every 2 days                    > ]

Starts
[ Sep 9 ]

Ends

● No end date
○ On date

Notifications
[ On ]

                         Continue
```

## Step 3 — Schedule preview

```text
Your schedule

Sep 9      20:00      110 mg
Sep 11     20:00      110 mg
Sep 13     20:00      110 mg
Sep 15     20:00      110 mg

[ Preview estimated levels ]

[ Save as draft ]    [ Start tracking ]
```

The preview is required.

Users should be able to identify schedule mistakes before activation.

---

# 16. Schedule types

Model schedule behavior explicitly.

Recommended typed representation:

```ts
type ScheduleConfig =
  | DailySchedule
  | EveryNDaysSchedule
  | EveryNHoursSchedule
  | WeekdaySchedule
  | OneTimeSchedule
  | AsNeededSchedule;
```

## Daily

```ts
{
  kind: "daily",
  doses: [
    {
      time: "08:00",
      amount: 2,
      unit: "mg"
    },
    {
      time: "20:00",
      amount: 4,
      unit: "mg"
    }
  ]
}
```

## Every N days

```ts
{
  kind: "every_n_days",
  intervalDays: 2,
  anchorDate: "2026-09-09",
  doses: [
    {
      time: "20:00",
      amount: 110,
      unit: "mg"
    }
  ]
}
```

## Every N hours

```ts
{
  kind: "every_n_hours",
  intervalHours: 12,
  anchorAt: "2026-09-09T08:00:00",
  amount: 2,
  unit: "mg"
}
```

## Specific weekdays

Allow different times and amounts per weekday if necessary.

Conceptually:

```ts
{
  kind: "specific_weekdays",
  days: [
    {
      weekday: 1,
      doses: [...]
    },
    {
      weekday: 3,
      doses: [...]
    },
    {
      weekday: 5,
      doses: [...]
    }
  ]
}
```

## One time

```ts
{
  kind: "one_time",
  at: "...",
  amount: 1,
  unit: "mg"
}
```

## As needed

Produces no scheduled occurrence.

Store a default amount/unit that can prefill manual logging.

---

# 17. Morning / evening UX

The UI may provide:

```text
Morning
Evening
Specific time
```

These are only shortcuts.

Resolve them to explicit clock times.

Suggested defaults:

```text
Morning → 08:00
Evening → 20:00
```

Let the user edit the actual time.

Never store an ambiguous value like:

```text
time = "morning"
```

---

# 18. Time zones

V1 does not require travel-specific UX.

Still store an IANA timezone on each phase, for example:

```text
Europe/Vilnius
```

Wall-clock schedules such as daily or weekdays are interpreted using that phase timezone.

Do not attempt automatic schedule re-anchoring when a device changes timezone in V1.

Designing the database correctly now avoids making travel support impossible later.

---

# 19. Critical schedule invariant

Actual administrations must **never automatically move future scheduled administrations**.

Example:

```text
Planned

Monday     20:00
Wednesday  20:00
Friday     20:00
```

The Monday administration happens Tuesday at 09:10.

Store:

```text
scheduled_at = Monday 20:00
actual_at    = Tuesday 09:10
```

Wednesday remains:

```text
Wednesday 20:00
```

If the user intends to change the schedule, they must explicitly edit the course.

---

# 20. Schedule anchoring

`Every N days` is anchored to the planned schedule.

It is **not** anchored to:

> last actual administration time.

This is a hard domain rule.

---

# 21. Phase editing

Editing an active course creates a new phase.

```text
Change Testosterone Enanthate

Dose
110 mg → 100 mg

Schedule
Every 2 days

Effective

● Today
○ Choose date

                         [ Save change ]
```

For V1, phase changes may become effective:

- today,
- in the future.

Do not retroactively rewrite historical phases.

Historical log errors can be corrected by editing logs.

---

# 22. Future phases

Future planned phases are supported.

Example:

```text
Current

110 mg every 2 days
until Sep 30

Upcoming

100 mg every 3 days
from Oct 1
```

Future phases immediately affect:

- future calendar,
- schedule preview,
- Estimated Levels projection.

---

# 23. Editing around existing future phases

If a future phase already exists and the user creates another change:

```text
A future change is already scheduled for Oct 1.

Your new settings will apply until then.

● Keep future change
○ Replace future changes
```

Default:

```text
Keep future change
```

Nouri must never silently erase an existing future plan.

### Keep

Insert the new phase and preserve later phases.

### Replace

Delete phases after the new phase's effective time and regenerate future occurrences.

The user must explicitly choose this.

---

# 24. Course ending

A course can have no end date.

Ending a course should support:

```text
End today
Pick end date
```

Ending:

- preserves historical phases,
- preserves historical occurrences,
- preserves dose logs,
- removes scheduled occurrences after the end,
- stops notifications.

Restarting later creates a new course.

---

# 25. Course deletion

Deletion is allowed.

Show an explicit destructive warning:

```text
Delete Testosterone Enanthate course?

This will permanently delete:

• the course
• its phases
• scheduled occurrences
• logged doses
• injection-site history associated with those doses

Bloodwork, nutrition and body measurements
will not be deleted.

[ Cancel ]

[ Delete course ]
```

Deletion must cascade transactionally.

---

# 26. Compounds screen

Suggested structure:

```text
Compounds                                  [+]

ACTIVE

Testosterone Enanthate
110 mg · Every 2 days
Started Aug 11
Next · Today 20:00                         >

Semaglutide
1 mg · Every Monday
Started Aug 17
Next · Sep 14                              >

PLANNED

Testosterone Cypionate
Draft                                      >

HISTORY

Testosterone Enanthate
Apr 4 – Jul 18                             >
```

---

# 27. Course detail screen

An active course should expose:

```text
Testosterone Enanthate

110 mg
Every 2 days

Next
Today · 20:00

Notifications                     On

CURRENT SCHEDULE

110 mg every 2 days
IM
Sep 9 →

UPCOMING CHANGES

100 mg every 3 days
Oct 1 →

RECENT DOSES
...

[ Edit schedule ]
```

Secondary actions:

```text
Compound info
End course
Delete course
```

An ended course may offer:

```text
Start new course
```

This preselects the compound definition only.

Do **not** automatically duplicate the previous schedule.

---

# 28. Notifications

V1 notifications are intentionally simple.

## Dose notification

Exactly one notification per scheduled occurrence.

Example:

```text
Nouri

Testosterone Enanthate · 110 mg
Scheduled for 20:00

[ Log ]
```

`Log` deep-links to the confirmation sheet.

It does not mark the administration completed.

## Rules

- notifications are configurable per compound course,
- two compounds at 20:00 create two notifications,
- no early reminder,
- no second reminder,
- no overdue reminder,
- no notification for draft courses,
- no notification for as-needed courses,
- logged occurrences should not receive a later notification,
- changed/deleted occurrences should not receive obsolete notifications.

## Bloodwork reminders

Bloodwork reminders use one notification at the user-selected time.

They appear inside Protocols Today/calendar but **not the Home Protocol card**.

---

# 29. Occurrence materialization

Persist scheduled occurrences instead of deriving every future event exclusively in the client.

This gives stable identities for:

- logging,
- notification delivery,
- overdue state,
- historical unlogged state,
- phase changes.

Recommended rolling future horizon:

> **120 days**

On activation:

1. create occurrences from the course start through the future horizon,
2. create historical occurrences if the user selected a past start date,
3. do not assume historical occurrences were taken.

A recurring backend job extends the horizon.

If a phase changes, regenerate only affected future, unlogged occurrences.

Never rewrite historical logged occurrence snapshots.

---

# 30. Past-start edge case

A user may create:

```text
Course started Aug 11
```

while beginning Nouri tracking on Sep 9.

Generate the historical planned occurrences.

Do **not** fabricate dose logs for them.

Estimated Levels should explain:

```text
This estimate uses your logged past doses.

Some earlier scheduled doses are unlogged, so
the current estimate may be incomplete.
```

The user can backfill historical administrations manually.

Do not silently assume every planned historical administration happened.

---

# 31. Occurrence state

Do not persist unnecessary user-facing status enums where the state can be derived.

Conceptually:

```text
if dose log exists
    → Logged

else if occurrence date == today && scheduled_at < now
    → Overdue

else if occurrence date < today
    → Unlogged

else
    → Scheduled
```

Avoid `Missed`.

---

# 32. Estimated Levels UX

Main screen:

```text
Estimated Levels

● Testosterone Enanthate
○ Semaglutide

Estimated level
72%

        ╭──╮            ╭──╮
     ╭──╯  ╰──╮      ╭──╯  ╰┈┈┈┈┈
─────╯        ╰──────╯
    ▲       ▲       ▲
   dose    dose    future

━━━━ logged
┈┈┈┈ planned

[ 1W ] [ 1M ] [ 3M ] [ All ]

[ Relative % ▼ ]
```

Default range:

```text
1M
```

---

# 33. Past vs future PK

Historical model:

> use actual logged administrations.

Future model:

> start from modeled state produced by actual logs and add future scheduled administrations.

Therefore:

- a late logged dose alters the curve,
- an edited actual amount alters the curve,
- an unlogged historical occurrence contributes nothing,
- a deleted dose log contributes nothing,
- scheduled future doses are projections.

Use:

```text
solid → historical/logged model
dotted → future projection
```

---

# 34. PK model architecture

PK calculations must be data-driven.

Do not write compound-specific formulas throughout the app.

Each model version should define:

```text
compound
route
model_type
parameters
sources
explanation
version
updated_at
```

V1 should support at least:

```text
FIRST_ORDER_ABSORPTION_ELIMINATION
ELIMINATION_ONLY
```

A common simple first-order absorption + elimination model uses a Bateman-type function. In a one-compartment model, an administered dose is absorbed with a rate constant `ka` and eliminated with a rate constant `ke`; `ke` can be obtained from the elimination half-life. Published PK literature also supports deriving the relationship between `tmax`, `ka` and `ke`.

For linear PK, repeated-dose exposure can be modeled by superimposing the contributions from individual doses. This assumption must be documented as part of Nouri's model rather than implied to be universally true for every drug.

Conceptually:

```text
total modeled level at t
=
dose 1 contribution
+ dose 2 contribution
+ dose 3 contribution
+ ...
```

Do not claim this is a measured serum concentration.

---

# 35. PK fallback behavior

Preferred model:

```text
absorption + elimination
```

If only elimination information is sufficiently available:

```text
elimination-only approximation
```

If data are limited, a rough model is still preferable to disabling the graph, but the limitation must be disclosed inside Compound Info.

Do not show noisy permanent warning badges throughout the UI.

---

# 36. Compound PK information

Example:

```text
Testosterone Enanthate

ESTIMATED LEVEL MODEL

Nouri uses an approximate pharmacokinetic model.

MODEL

First-order absorption + elimination

PARAMETERS

Elimination half-life
...

Time to peak
...

Bioavailability
...

HOW IT WORKS

Each administration contributes independently
to the estimated level over time. Logged doses
are used for historical estimates and future
scheduled doses are used for projections.

LIMITATIONS

Available data and individual pharmacokinetics
vary. Estimated Levels are a modeled
visualization and are not measured blood levels.

SOURCES

Source ...
Source ...
```

Regulatory information also belongs here.

Do not clutter the primary Levels graph with regulatory labels.

---

# 37. PK source policy

Do not source model constants from:

- bodybuilding forums,
- Reddit,
- random blogs,
- SteroidPlotter values copied without original evidence,
- competitor applications.

Source preference:

1. official regulatory/product pharmacology documents,
2. peer-reviewed human PK studies,
3. peer-reviewed clinical reviews,
4. weaker evidence only when stronger data do not exist.

Every compound model should retain its original source references.

---

# 38. Model versioning

Store a model version.

Example:

```text
testosterone-enanthate-im-v1
```

The Levels API should return the model version used.

V1 may use the latest published Nouri model when recalculating old timelines.

Full historical PK-model reproducibility is not required yet.

---

# 39. Relative %

For a single course:

```text
100%
```

means:

> the highest modeled level produced by the current modeled schedule.

Do not normalize based merely on the current graph zoom window, otherwise zooming would change the meaning of 100%.

Recommended normalization:

### Finite course

Calculate the maximum from course start through post-course modeled clearance.

### Indefinite course

Simulate until modeled steady-state behavior is reached and use its modeled peak.

---

# 40. Multi-compound graph

Users can toggle compounds:

```text
● Test E
● Nandrolone
○ Semaglutide
```

When more than one compound is visible, force:

```text
Relative %
```

Do not overlay absolute milligram scales between unrelated drugs.

Never produce:

```text
TOTAL DRUG LEVEL
```

or add different compounds together as one biological value.

---

# 41. Estimated amount remaining

Single-compound view can switch between:

```text
Relative %
Estimated amount remaining
```

The information screen must explain assumptions behind this number.

It remains a **modeled dose-equivalent estimate**, not a measured plasma concentration.

---

# 42. Graph markers

Show dose markers.

Historical marker:

```text
▲ 110 mg
```

Future marker:

```text
△ 110 mg
```

Do not label every marker until the user taps/scrubs.

---

# 43. Phase annotations

Show restrained vertical annotations for:

- course start,
- phase change,
- course end.

Example:

```text
        Dose changed
             │
             ▼
─────────────┼──────────────────
```

Do not annotate every configuration property.

---

# 44. Scrubbing

The user may drag/scrub the chart.

Show:

```text
Sep 16 · 14:00

Estimated level
74%

Estimated amount
...
```

Plus nearby relevant dose/phase events if useful.

Avoid giant tooltips.

---

# 45. 95% clearance

Expose:

```text
Estimated 95% clearance
```

For an ended course, base this on the final logged administration.

For an active finite course, base it on the final scheduled administration.

For an indefinite course expose:

```text
If dosing stopped now
Estimated 95% clearance
...
```

Calculate the point at which the same modeled curve falls below the defined 5% threshold after the final included administration.

The exact definition belongs in Compound Info.

---

# 46. Compare mode

Compare mode is temporary.

Example:

```text
CURRENT

110 mg every 2 days

COMPARE

165 mg every 3 days
```

Graph:

```text
Current    ━━━━━━━━━
Compare    ┈┈┈┈┈┈┈┈┈
```

Allow simultaneous modification of:

- amount,
- schedule type,
- interval,
- administration time.

Comparison:

- is not persisted,
- creates no notifications,
- creates no occurrences,
- changes no actual course data.

Closing Compare discards it.

Do not add saved scenarios in V1.

---

# 47. Trends

Trends displays one primary metric at a time.

Examples:

```text
Body weight
Calories
Protein
```

Do not put three independent y-axes onto one graph.

## Nutrition

Calories and protein should default to:

```text
7-day rolling average
```

This reduces meaningless day-to-day noise.

Use the existing Nouri nutrition data.

Do not duplicate nutrition storage inside Protocols.

## Bodyweight

Use the existing Nouri bodyweight source.

Protocols consumes these measurements; it does not create a second weight-tracking system.

---

# 48. Trend annotations

Overlay:

- compound course start,
- compound course end,
- phase changes.

Do not overlay every administration.

If multiple compounds create too much annotation noise, allow the user to filter which compound event markers are displayed.

---

# 49. Bloodwork information architecture

Inside Trends:

```text
[ Metrics ] [ Bloodwork ]
```

Do not add Bloodwork as a fifth root Protocols tab.

Example:

```text
Bloodwork

Sep 8, 2026
12 markers                              >

Jun 6, 2026
9 markers                               >

                                      [+]
```

---

# 50. Bloodwork entry

Use a curated marker catalog.

Example:

```text
Add bloodwork

Date
Sep 8, 2026

Lab
[ Optional ]

Search marker

test...

Testosterone, total
Testosterone, free
...
```

Marker result:

```text
Total Testosterone

Value
[ 18.4 ]

Unit
[ nmol/L ]

Reference range
[ 8.6 ] – [ 29.0 ]
```

Reference ranges are optional.

---

# 51. Biomarker unit model

Keep:

```text
raw_value
raw_unit
```

plus normalized values.

Conceptually:

```text
raw:
18.4 nmol/L

canonical:
18.4 nmol/L
```

or:

```text
raw:
530 ng/dL

canonical:
18.39 nmol/L
```

The raw value must never be destroyed.

---

# 52. Display-unit conversion

The user can choose compatible chart units.

Example:

```text
Total Testosterone

Display as

● nmol/L
○ ng/dL
```

The entire graph updates.

Reference ranges should be converted for display too.

Persist preferred display unit per biomarker so it syncs between devices.

---

# 53. Biomarker conversion data

Conversion logic belongs to the biomarker definition.

Example conceptual structure:

```text
Biomarker
  Total Testosterone

Canonical unit
  nmol/L

Supported units
  nmol/L
  ng/dL

Conversions
  ...
```

Do not create one global assumption that all laboratory unit conversions are simple mass conversions.

Some conversions are biomarker-specific.

---

# 54. Bloodwork reference ranges

Reference range belongs to the **individual result**, not the biomarker definition.

Correct:

```text
Result A
Lab A
Reference 8.6–29.0

Result B
Lab B
Reference 9.2–31.8
```

Incorrect:

```text
Total Testosterone always has one Nouri range
```

Nouri should not invent universal reference ranges.

---

# 55. Bloodwork chart

One biomarker at a time.

```text
Total Testosterone                   [ nmol/L ▼ ]

30 ┤
25 ┤                 ●
20 ┤          ●
15 ┤
10 ┤  ●
   └───────────────────────────────

       │              │
    Course start   Dose changed
```

Show course/phase annotations but not every administration.

---

# 56. Bloodwork reminders

One-time reminder in V1.

Fields:

```text
Date
Time
Title
```

Default title:

```text
Bloodwork
```

User chooses when.

Nouri must not recommend a testing interval.

The reminder appears:

- Protocol Today,
- Protocol calendar.

It does not appear on the Home Protocol card.

---

# 57. Suggested Supabase data model

Supabase/Postgres is the authoritative storage layer.

The exact names can be adapted to existing repository naming conventions.

## `compound_definitions`

```text
id
slug
name
category
default_unit
supported_routes
regulatory_metadata
is_active
created_at
updated_at
```

Curated system data, not user-owned.

---

## `compound_pk_models`

```text
id
compound_definition_id
route
version
model_type
parameters_json
explanation
limitations
published_at
created_at
```

---

## `compound_pk_sources`

```text
id
pk_model_id
title
citation
url
source_type
```

---

## `protocol_courses`

```text
id
user_id
compound_definition_id
status
notifications_enabled
started_at
ended_at
created_at
updated_at
```

---

## `protocol_course_phases`

Store only the phase starting point rather than redundant overlapping ranges.

```text
id
course_id
effective_from
timezone
route
schedule_config_json
created_at
updated_at
```

The effective end of a phase is:

> the next phase's `effective_from`, or the course end.

This makes overlapping phases difficult to create by accident.

---

## `protocol_occurrences`

```text
id
course_id
phase_id
slot_key

scheduled_at

planned_amount
planned_unit
planned_route

created_at
```

Create a uniqueness constraint based on the deterministic occurrence identity.

---

## `protocol_dose_logs`

```text
id
user_id
course_id
phase_id
occurrence_id nullable

actual_at
actual_amount
actual_unit
actual_route

injection_site_code nullable

created_at
updated_at
```

`occurrence_id` is null for manual/as-needed logs.

Enforce at most one active log per scheduled occurrence.

---

## `biomarker_definitions`

```text
id
slug
name
category
canonical_unit
supported_units_json
conversion_config_json
created_at
updated_at
```

---

## `bloodwork_panels`

```text
id
user_id
collected_at
lab_name nullable
created_at
updated_at
```

---

## `bloodwork_results`

```text
id
panel_id
biomarker_definition_id

raw_value
raw_unit

canonical_value
canonical_unit

reference_low_raw nullable
reference_high_raw nullable
reference_unit nullable

created_at
updated_at
```

---

## `user_biomarker_preferences`

```text
user_id
biomarker_definition_id
preferred_display_unit
```

---

## `protocol_reminders`

V1 reminder type:

```text
BLOODWORK
```

Fields:

```text
id
user_id
type
title
scheduled_at
notification_sent_at
created_at
updated_at
```

---

# 58. Database rules

All user-owned tables require RLS.

Users may access only rows belonging to their authenticated user ID.

The API must obtain user identity from authentication, never trust a supplied `user_id`.

Add appropriate indexes around:

```text
protocol_courses(user_id, status)

protocol_course_phases(course_id, effective_from)

protocol_occurrences(course_id, scheduled_at)

protocol_occurrences(scheduled_at)

protocol_dose_logs(course_id, actual_at)

bloodwork_panels(user_id, collected_at)

bloodwork_results(panel_id)
```

Course deletion must cascade through:

```text
phases
occurrences
dose logs
```

Bloodwork must remain independent.

---

# 59. Backend ownership

Recommended boundary:

```text
React Native
    ↓
nouri-api
    ↓
Supabase/Postgres
```

Supabase remains the source of truth.

`nouri-api` owns:

- course mutation rules,
- phase creation,
- recurrence compilation,
- occurrence generation,
- logging validation,
- PK calculation,
- unit conversion,
- bloodwork mutation,
- notification scheduling/dispatch integration.

The mobile app owns:

- presentation,
- temporary form state,
- temporary Compare state,
- graph interaction state.

Do not create a local Protocol database.

Do not persist user protocol truth locally.

Normal ephemeral query caching is fine.

---

# 60. API surface

Exact names should follow existing `nouri-api` conventions, but the capabilities should roughly map to:

```text
GET    /v1/protocols/home
GET    /v1/protocols/day
GET    /v1/protocols/calendar

GET    /v1/protocols/compounds
GET    /v1/protocols/compounds/:id

GET    /v1/protocols/courses
POST   /v1/protocols/courses
GET    /v1/protocols/courses/:id
PATCH  /v1/protocols/courses/:id
DELETE /v1/protocols/courses/:id

POST   /v1/protocols/courses/:id/phases
POST   /v1/protocols/courses/:id/end
POST   /v1/protocols/courses/:id/start

POST   /v1/protocols/occurrences/:id/log

PATCH  /v1/protocols/logs/:id
DELETE /v1/protocols/logs/:id
POST   /v1/protocols/courses/:id/log

GET    /v1/protocols/levels
POST   /v1/protocols/levels/compare

GET    /v1/protocols/trends

GET    /v1/biomarkers

GET    /v1/bloodwork
POST   /v1/bloodwork
GET    /v1/bloodwork/:id
PATCH  /v1/bloodwork/:id
DELETE /v1/bloodwork/:id

GET    /v1/protocol-reminders
POST   /v1/protocol-reminders
DELETE /v1/protocol-reminders/:id
```

Do not mechanically add an endpoint if existing architecture can express the operation more cleanly.

The domain behavior in this specification matters more than exact REST naming.

---

# 61. Phase-change transaction

Creating a phase must be atomic.

Conceptually:

```text
BEGIN

validate course ownership

validate effective date

inspect future phases

insert new phase

if replace_future_changes:
    delete superseded future phases

delete affected future unlogged occurrences

regenerate occurrences using new phase timeline

COMMIT
```

A partial schedule change must never leave future occurrences inconsistent with phases.

---

# 62. Occurrence generation worker

Maintain a rolling future horizon.

Suggested behavior:

```text
once daily

for every active finite/indefinite course:

ensure occurrences exist through
today + 120 days
```

The operation must be idempotent.

A unique deterministic occurrence key prevents duplicates.

---

# 63. Notification worker

Use the project's existing push infrastructure where possible.

Conceptually:

```text
find due occurrences

for each:

if already logged:
    skip

if course notifications disabled:
    skip

if occurrence no longer valid:
    skip

if notification already dispatched:
    skip

dispatch notification

record dispatch idempotently
```

The job must tolerate retries without duplicate push notifications.

Notification payload should carry an opaque occurrence ID for deep linking.

Do not put bloodwork values or other unnecessary health information into notification metadata.

---

# 64. Home performance

Protocol loading must never block the primary calorie experience.

The Home Protocol query should return enough information for:

- seven-day indicators,
- selected day's rows,
- next upcoming administration.

Do not fetch each compound independently.

Avoid N+1 API/database queries.

If Protocols fails to load, the rest of Home remains fully usable.

---

# 65. PK calculation location

Calculate canonical PK series in the backend.

Benefits:

- Android and iOS produce identical results,
- future web can reuse the same engine,
- compound model updates are centralized,
- calculations remain testable independently of chart rendering.

The mobile app should receive chart-ready points plus useful metadata.

Example:

```json
{
  "modelVersion": "...",
  "metric": "relative",
  "series": [...],
  "doseMarkers": [...],
  "phaseMarkers": [...],
  "currentValue": 72,
  "clearance": {...}
}
```

Do not send thousands of unnecessarily dense points.

Use adaptive sampling suitable for the selected range.

---

# 66. Compare implementation

Compare does not require database persistence.

Mobile sends the hypothetical configuration to:

```text
POST /levels/compare
```

alongside the relevant course.

Backend validates it using the same schedule compiler and PK engine.

Response contains a temporary comparison series.

Nothing is saved.

---

# 67. Chart implementation

Reuse Nouri's existing chart stack.

Do not add a second charting dependency solely for Protocols unless the current solution genuinely cannot satisfy:

- multiple series,
- solid/dashed lines,
- markers,
- interactive scrubbing.

Avoid expensive chart remounting during simple compound toggles.

---

# 68. Sensitive-data handling

Protocol and bloodwork data are sensitive health information.

Do not put actual values into:

- analytics event names,
- generic application logs,
- breadcrumbs,
- crash metadata,
- notification analytics unnecessarily.

Good telemetry:

```text
protocol_course_created
protocol_dose_logged
protocol_phase_changed
pk_graph_opened
```

Bad telemetry:

```text
protocol_test_e_500mg_logged
estradiol_74_logged
```

Server error logs should use opaque record IDs rather than health values whenever possible.

---

# 69. User deletion

Protocol tracking data must be separately deletable.

Settings may expose:

```text
Protocol tracking

Disable Protocols
Delete all Protocol data
```

Disabling the feature does not automatically delete history.

Deleting Protocol data requires an explicit destructive confirmation.

Deletion should cover:

- compound courses,
- phases,
- occurrences,
- dose logs,
- protocol reminders,
- Protocol-specific preferences.

Bloodwork deletion behavior should be stated explicitly in the confirmation because bloodwork is part of Protocols V1.

Do not delete ordinary Nouri nutrition or bodyweight data.

---

# 70. Error handling

Keep error handling proportional.

For failed saves:

```text
Couldn't save dose.
Try again.
```

Retain the sheet and entered values.

Do not silently discard forms.

For failed PK calculation:

```text
Estimated Levels aren't available right now.
```

The rest of Protocols remains usable.

Protocol calculations must not become a dependency for basic logging.

---

# 71. Empty states

## No active courses

```text
No active compounds

Add a compound to start tracking its
schedule and estimated levels.

[ Add compound ]
```

## No doses today

```text
Nothing scheduled today
```

Do not make this a celebratory adherence state.

## No bloodwork

```text
No bloodwork added yet

[ Add bloodwork ]
```

## No PK model

If a compound has absolutely no usable model:

```text
Estimated Levels aren't available for
this compound yet.
```

This should be rare because rough models are acceptable where transparent assumptions are available.

---

# 72. Visual design principles

Protocols should feel like Nouri, not a separate bodybuilding application.

Prefer:

- whitespace,
- strong typography,
- short labels,
- progressive disclosure,
- bottom sheets,
- compact chips,
- one major action per surface,
- clean charts.

Avoid:

- giant dashboards,
- dense biomedical labels,
- dozens of badges,
- large warning banners,
- tables on mobile,
- dashboards full of “stats” merely because data exists,
- bodybuilding-themed visual design,
- needles/syringes as decorative imagery.

The interface should work equally naturally for:

```text
TRT
GLP-1 treatment
injectable AAS tracking
```

---

# 73. V1 validation rules

Validate technically rather than attempting to provide medical guidance.

Examples:

- amount must be numeric and positive,
- interval must be valid,
- schedule requires appropriate anchor/time,
- phase must belong to course,
- unit must be supported,
- route must be supported,
- phase date cannot be outside course boundaries,
- future phases cannot create invalid chronology.

Do not introduce arbitrary “safe dose maximums” unless backed by a separate explicit medical-safety design.

---

# 74. Testing strategy

Prioritize high-value integration tests around domain invariants.

Critical integration cases:

### Scheduling

- E2D remains anchored after late actual dose.
- Daily multi-time schedule generates correct occurrences.
- Different times can use different amounts.
- Weekday recurrence generates correct dates.
- Every-N-hours recurrence stays interval based.
- Future phase changes future occurrences.
- Historical occurrences remain unchanged.
- Keeping a future phase preserves it.
- Replacing future phases removes them.
- Ending a course removes future occurrences.

### Logging

- scheduled and actual timestamps differ safely,
- edited actual amount affects PK,
- deleting log returns occurrence to Unlogged,
- historical occurrence can be logged,
- duplicate scheduled log is rejected,
- PRN log works without occurrence.

### Notifications

- logged occurrence does not notify,
- notification-disabled course does not notify,
- deleted occurrence does not notify,
- retry does not duplicate notification.

### PK

Use a small number of pure mathematical tests for:

- single dose,
- repeated doses,
- accumulation/superposition,
- late administration,
- changed amount,
- future projection,
- relative normalization,
- clearance threshold.

These are appropriate unit tests because the functions are deterministic numerical logic.

### Bloodwork

Integration-test:

- raw value preservation,
- normalization,
- display conversion,
- reference-range conversion,
- per-marker preferred display unit.

Avoid writing low-value tests for trivial UI implementation details.

---

# 75. V1 implementation sequence

Do not implement the entire feature as one giant change.

## Phase 0 — Repository reconnaissance

Before modifying code:

- inspect current navigation,
- inspect Home architecture,
- inspect design-system components,
- inspect Supabase migrations/RLS patterns,
- inspect API conventions,
- inspect current notification implementation,
- inspect date/time utilities,
- inspect query/cache architecture,
- inspect charting solution,
- inspect existing nutrition/bodyweight APIs.

Produce a short implementation plan mapping this specification onto existing repository architecture.

Do not introduce parallel abstractions when suitable ones already exist.

---

## Phase 1 — Domain + database foundation

Implement:

- compound definitions,
- PK model/source schema,
- courses,
- phases,
- occurrences,
- dose logs,
- RLS,
- typed domain models,
- migrations,
- seed framework for curated compounds.

Then implement recurrence compilation.

No large UI yet.

### Exit criteria

Backend can:

```text
create course
create phase
generate occurrences
change phase
end course
log occurrence
edit/delete log
```

with integration tests covering schedule invariants.

---

## Phase 2 — Protocol shell + compound management

Implement:

```text
Settings opt-in
single onboarding
Protocols root
Today
Compounds
Add Compound
Course detail
Edit schedule
future phase handling
course ending/deletion
```

Use temporary/mock PK output if necessary.

### Exit criteria

A user can completely manage and log a real course without Estimated Levels.

---

## Phase 3 — Home + logging polish

Implement:

- Home card,
- week strip,
- adaptive row density,
- countdown,
- overdue state,
- yesterday-unlogged callout,
- log bottom sheet,
- injection-site picker,
- historical logging,
- edit/delete logging.

### Exit criteria

Daily tracking is smooth enough that the user should not need Notes or alarms to remember what they did.

---

## Phase 4 — Notifications

Implement:

- per-course toggle,
- occurrence-based scheduled push,
- deep link into Log sheet,
- idempotent sending,
- schedule-change cancellation behavior.

### Exit criteria

Notifications always point to the correct live occurrence and never directly mark a dose taken.

---

## Phase 5 — PK engine + Levels

Implement:

- versioned PK model abstraction,
- compound model source metadata,
- first-order absorption/elimination,
- elimination fallback,
- repeated administration superposition,
- actual-vs-planned projection,
- Relative %,
- Estimated amount remaining,
- range selection,
- markers,
- phase annotations,
- scrubbing,
- 95% clearance.

### Exit criteria

Changing a real dose log visibly and correctly changes the historical/current modeled curve.

Changing a future phase changes only the future projection.

---

## Phase 6 — Compare

Implement temporary hypothetical schedule comparison.

Do not persist scenarios.

### Exit criteria

The user can compare:

```text
110 mg E2D
```

against:

```text
165 mg E3D
```

without changing their actual course.

---

## Phase 7 — Bloodwork

Implement:

- biomarker catalog,
- unit definitions,
- unit conversion,
- panels/results,
- manual entry,
- lab name,
- result-specific reference ranges,
- preferred display units,
- biomarker charts,
- bloodwork reminders.

### Exit criteria

A result entered as one supported unit can be charted in another without modifying the recorded raw value.

---

## Phase 8 — Trends

Integrate:

- bodyweight,
- calories,
- protein,
- 7-day rolling nutrition averages,
- protocol start/end markers,
- phase markers.

Reuse existing metric services.

Do not duplicate nutrition data.

---

## Phase 9 — Hardening

Verify:

- RLS,
- deletion behavior,
- sensitive-data logging,
- performance,
- notification retries,
- timezone persistence,
- date-boundary behavior,
- chart performance,
- empty/error states,
- Android/iOS UX,
- accessibility,
- large/small device layouts.

---

# 76. V1 acceptance checklist

The feature is ready only when the following flow works end-to-end:

```text
Enable Protocols

→ add Testosterone Enanthate

→ configure 110 mg E2D at 20:00

→ preview schedule

→ activate

→ see it on Home

→ receive notification

→ open Log sheet

→ change actual time to 21:14

→ choose injection site

→ confirm

→ see completed item

→ see actual dose marker in Levels

→ create future schedule change

→ see future calendar regenerate

→ see dotted PK projection change

→ compare against another hypothetical schedule

→ add bloodwork

→ view bloodwork in another compatible unit

→ view weight/calorie trend against phase changes

→ end course

→ later start a new independent course
```

All of this must work without:

- a local authoritative database,
- regimen recommendations,
- inventory management,
- reconstitution tooling,
- duplicated nutrition storage.

---

# 77. Engineering guardrails for Codex

Treat this specification as the product source of truth.

Before coding:

1. inspect the existing repositories and map these concepts onto existing conventions;
2. identify reusable navigation, forms, notifications, charts and API infrastructure;
3. create an implementation plan divided into small coherent stages;
4. identify any specification requirement that conflicts with existing architecture.

During implementation:

- write the minimum type-safe code necessary,
- keep scheduling and PK domain logic independent from React components,
- keep functions small and named,
- keep SQL responsible for persistence/querying rather than business scheduling logic,
- reuse current dependencies,
- do not introduce Redis or another database for this feature,
- do not create speculative abstractions for future peptides/web/export,
- avoid unrelated refactors,
- keep sensitive values out of telemetry,
- prioritize high-value integration tests.

Most importantly:

> **Do not simplify away the distinction between planned schedule and actual administration.**

That distinction is the foundation for calendar history, late-dose handling, notifications and Estimated Levels.

---

# 78. V1 product definition in one sentence

**Nouri Protocols is a clean compound tracker that records what a user planned and what they actually took, visualizes approximate pharmacokinetic levels, and places that timeline beside their bloodwork, bodyweight and nutrition without recommending what they should take.**
