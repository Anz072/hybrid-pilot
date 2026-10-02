# Protocols V1 local implementation

The [implementation plan](protocols-v1-implementation-plan.md) and [product specification](plans/protocols-v1-spec.md) define the complete scope. Notifications remain deferred. This record tracks implementation evidence; it does not narrow acceptance to completed stages.

Latest local validation: [September 22 native hardening](qa/protocols-v1-2026-09-22.md).
The dated entries below are historical; use the final remaining-work matrix for current gaps.

## Working constraints

All changes and validation remain local. New migrations are authored here and exercised only in disposable local test databases. No linked-project migration, hosted database access, server deployment or remote job provisioning is authorized by this task. Preserve the mobile worktree's existing redesign.

## Domain decisions

The user authorized routine decisions without further confirmation. These resolve the plan's non-notification ambiguities:

- Use the declared injectable AAS / GLP-1 catalog scope. HCG and custom compounds are excluded. Ester identities stay separate. Publish PK parameters only with cited evidence; a missing model leaves logging fully available and explicitly marks Levels unavailable.
- Transport exact amounts and laboratory values as decimal strings. Dose units are catalog-specific; no implicit IU/mass or ester/base conversion. Numeric precision limits are storage/computation limits, never dosing guidance.
- Calendar schedules use the phase IANA zone. DST gaps move forward by the gap; folds use the earlier occurrence. Every-N-hours uses elapsed hours from an offset-bearing instant. Weekdays are Monday=0 through Sunday=6. Keep the existing diary timezone conversion unchanged.
- A phase change effective Today uses one captured server-now instant; future dates resolve to local midnight. Intervals are half-open. End dates include the selected local day (exclusive next midnight); backdated schedule/end rewrites are rejected. Logged and elapsed planned snapshots are preserved.
- Default phase insertion keeps later phases. Explicit replacement may remove only future phases without actual logs. Active/draft mutations carry an expected revision and a stable operation UUID; matching retries replay accepted results, conflicting reuse fails.
- Start/backfill and previews have technical budgets of 20 calendar years and 10,000 occurrences per computation. Materialize through 120 elapsed days from now. Outside persisted coverage, calendar reads expose compiled preview rows without logging IDs, rather than misleading empty dates. Past actual logging is allowed; future actual timestamps are rejected.
- Home card appears directly after CalorieRing. Its state/date/load remains independent of Diary and nutrition. Disabling hides tracking, retains all history, and allows re-enabling. All-Protocols deletion explicitly includes bloodwork and feature preferences but preserves nutrition and ordinary weight data.
- Bloodwork uses date-only collection, numeric decimal results and one entry per marker per panel. Qualitative/inequality values are outside this numeric V1 form. Preserve raw result/range values, including zero; never infer a laboratory range. Default display unit is the marker's canonical unit until a synced preference is saved.
- Nutrition averages use complete days only, including complete zero-entry days. Incomplete days remain gaps. Seven-calendar-day windows divide by eligible days and report coverage; today's incomplete entry does not depress the average.
- PK estimates use recorded actual administrations for history and unlogged future plans for projections. Active Compare branches now from identical actual history (or at a future start), with one shared normalization reference. Draft/ended comparisons simulate the whole course from its start, with explicitly hypothetical segments. Independent courses remain explicitly selectable; multiple series use Relative %. Normalization must not depend on the visible window. Amount is the spec's modeled dose-equivalent estimate, not measured systemic mass or serum concentration. Each model explicitly identifies systemic, apparent-terminal or depot-release parameters and any unit-scale convention; ester/base conversion is never implicit. Clearance is a sustained post-peak crossing below 5% of the stopped-scenario peak; indefinite courses show a stopped-now scenario, including hypothetical elapsed doses for drafts rather than a fictional end at the calculation horizon.

## Stage evidence

Implementation in progress. All non-notification stages 0–7 and 9–13 remain required. Stages 8a/8b are deferred, with their requirements retained in the plan. No current production-readiness claim is made.

### September 9 — database and operational API foundation

Implemented in `nouri-api`:

- `supabase/migrations/20260909191203_protocols_core.sql`: settings opt-in, read-only catalog/model/source tables, owned courses/phases/occurrences/actual logs, exact decimal storage, composite parent constraints, restrictive phase/log relationships, course/account cascades, RLS, restricted backend grants, and course-command replay receipts.
- `supabase/migrations/20260909192514_protocol_log_replay.sql`: owner-scoped actual-log replay receipts, cascading with their logs. No notification schema.
- `src/domain/protocolTypes.ts`, `protocolSchedule.ts`, `protocolSites.ts`: six recurrence variants, explicit IANA/DST behavior, stable per-slot identities, half-open phases, bounded computation, and site labels for recording history.
- `src/modules/protocols/`: strict Zod contracts and authenticated routes for catalog reads, write-free preview, paginated course lists, draft create/edit, activation/backfill, keep/replace phases, end/delete, occurrence context, scheduled/manual actual logging, log edit/delete/replay, paginated actual history, recent site/route defaults, Today/Home and month-calendar projections. Services/repositories follow the existing `UserDb` boundary.
- `src/modules/me/` and mobile `meApi.ts`, `DB_TYPES.ts`, `userStore.ts`: additive opt-in/introduction settings and preservation of existing partial-PATCH behavior. Mobile handles old-server missing fields as disabled; no Protocol screen is exposed yet.
- `docs/api/openapi.json` regenerated from route schemas. Seventeen Protocol resource paths currently declare the existing access-token contract.

Validation completed against the current foundation:

| Check | Result |
| --- | --- |
| API `pnpm verify` with Node 22.11 and disposable loopback PostgreSQL 17 | Passed: typecheck, lint, 263 pure tests and 301 database tests |
| API `pnpm build` / `pnpm openapi` | Passed; reviewed generated resource/security contract and whitespace diff |
| API `pnpm test:security:isolated` | Passed: 89 real Supabase tests in a temporary project, including both new migrations, real-JWT log writes, backend RLS, PostgREST denials, mismatched parents, protected phase deletion, and account cascades |
| Mobile `npm test` | Passed: typecheck and 184 tests; the existing opt-in token-refresh E2E remained skipped |
| Native Protocol interaction | Not yet implemented or exercised |

The initial shell selected Node 20 and two tooling tests failed before reaching their fixtures. Running the supported Node 22 resolved that environment issue. One existing cache-cleanup test assumed the login was literally `postgres`; it now captures the original connection role and verifies restoration, so the same security assertion works with Homebrew's developer-owned disposable database. No application cache behavior was changed.

New regression evidence lives in API `test/protocolSchedule.test.ts` (independently expected calendar/DST cases), `test/protocolCourses.test.ts` (nine end-to-end transaction/read-model scenarios), and `test/protocolSupabaseSecurity.test.ts` (three real-stack scenarios). They prove late/different actual doses do not move future plans, raw dose precision survives, ambiguous-response retries do not overwrite later edits, deletion restores Unlogged, concurrent logging/phase changes preserve reality, old snapshots survive keep/replace/end, preview writes nothing, and beyond-horizon calendar rows have no fabricated logging IDs.

### September 9 — rolling occurrence materialization

- Added `20260909194410_protocol_worker.sql`, a separate restricted `ProtocolWorkerDb` runner, and `src/jobs/protocols/{index,repository,materialize}.ts`. The worker shares the recurrence compiler and course-lock order; bounded per-course transactions preserve progress across interruption, overlaps and outages. It appends plans from durable coverage and never reads or modifies actual dose logs.
- Selected a finite CLI Cloud Run Job instead of a private HTTP worker service. It uses the same image with a different command and exposes no HTTP listener. The authored deployment script defaults to dry-run; no cloud resource was provisioned or invoked. Notification dispatch remains deferred.
- `pnpm verify` passed typecheck/lint, 263 pure tests and 305 database tests. The four new job scenarios cover overlaps, stale coverage, finite/future/PRN/draft courses, restart, per-course failure isolation, role restrictions and public-route denial. `pnpm build` passed.
- The isolated real Supabase run passed all 90 tests, including the new worker role and real-token security scenario. The compiled CLI ran against disposable `nouri_api_test`: exit 0, no failed or remaining courses. Deployment shell syntax and dry-run output were checked; no deployment was attempted.

### September 9 — curated catalog, PK primitives and coherent reads

- Added local migration `20260909200258_protocol_catalog.sql`: nine separate compound identities (four testosterone esters, two nandrolone esters and three injectable incretins), eight published route-specific models, original-source references, formulation/regulatory context and explicit model-unavailable rationale for Testosterone Propionate. No illustrative dose or regimen presets were seeded. The declared catalog categories remain the launch scope; custom compounds and HCG remain excluded.
- The source audit and numerical choices are recorded in [PK model evidence](../../nouri-api/docs/domain/protocol-pk-models.md). Conventional F=1 scales, reported bioavailability, midpoint choices, apparent terminal decay and depot release are distinguished explicitly. The undecanoate fallback is a depot-dose-equivalent tail, not systemic elimination. No inaccessible paper, duration-above-threshold observation or competitor value was substituted for a fitted parameter.
- Added pure `protocolPk.ts`: exponential and stable Bateman contributions, equal-rate limit, slow absorption, time-to-peak inversion, compatible mass-unit conversion and linear superposition. Seven analytic tests cover these primitives; they are not evidence that timeline normalization, clearance or the Levels API is complete.
- Added `pkSchemas.ts`, `pkRepository.ts`, `pkService.ts` and an additive Compound Info response containing versions, parameters, evidence and limitations. Unpublished/future model versions and their sources remain private under RLS. The generated OpenAPI contract was refreshed and its fields/security reviewed.
- Protocol GET projections now opt into a read-only repeatable-read transaction through the existing `withUserDb` runner. Course, phase, occurrence and log queries see one committed timeline during a concurrent phase replacement; mutations retain their previous isolation/locking. New integration cases exercise concurrent API edits, denied writes in read snapshots, pooled cleanup and account isolation.

Final validation for this increment: API `pnpm verify` passed typecheck, lint, **270 pure + 311 database tests**; `pnpm build` passed; the final isolated local Supabase run passed **91 tests**. Catalog scenarios validate all seeded model definitions, latest-published selection, source privacy and actual logging without a model. No Protocol mobile screen or end-to-end native Levels flow exists yet. Application changes in this increment are backend-only; the mobile's earlier validation is historical, not new native coverage.

Automatic approval review initially interpreted the isolated harness as hosted-project creation. Inspection of `scripts/lib/isolatedSupabase.ts` and `localTarget.ts` proved it starts only a new local Docker stack with enforced loopback URLs. The same command was subsequently approved and passed. No hosted project, normal developer database, credentials or deployment was changed.

### September 10 — canonical Levels, unsaved preview and temporary Compare APIs

- Completed `src/domain/protocolCurve.ts` and `protocolLevels.ts`, plus `modules/protocols/levels{Schemas,Repository,Service,Routes}.ts`. Three authenticated endpoints now provide canonical Levels, unsaved-draft Levels preview and temporary Compare. OpenAPI contains 20 Protocol resource paths. No notification schema or integration was added.
- Inputs load through one owned read-only repeatable-read snapshot; numerical work begins after the transaction releases. Actual history includes carry-in before the viewport. Historical unlogged plans contribute nothing, while future phases are compiled beyond durable occurrence coverage. Early actual logs exclude their original future slot; stable slot keys also retain this exclusion in temporary comparisons.
- Finite/nonrepeating references include the complete modeled timeline and its peaks. Indefinite references use a separate settled seasonal window and explicit residual tolerance, including earlier history/transition peaks. Range or anchor changes do not redefine 100%. Every indefinite series continues through a shared All viewport. Curves remain separate per course and multi-course selection forces Relative %.
- Added sustained post-peak clearance for exponential and absorption models, with explicit no-dose/not-reached outcomes. A clearance failure does not hide an otherwise usable chart. Draft stopping behavior is hypothetical; the normalization horizon is never treated as the course end. Numerical/reference conventions, bounded calculations and API view semantics are documented in [PK model evidence](../../nouri-api/docs/domain/protocol-pk-models.md#canonical-levels-previews-and-comparison).
- Compare can change amount, schedule type, interval and time together. Active scenarios share actual history; draft/ended scenarios simulate from course start. Both use a shared reference and annotation sampling boundaries. Integration snapshots prove that Compare and unsaved previews create or modify no course, phase, occurrence, log, command receipt or user setting.

Validation for this increment:

| Check | Result |
| --- | --- |
| API `pnpm verify`, supported Node 22 and disposable loopback PostgreSQL | Passed: typecheck, lint, **274 pure + 318 database tests** |
| `pnpm build` / `pnpm openapi` | Passed; all three new paths declare authentication and success/error schemas |
| `pnpm test:security:isolated` | Passed: **92 real Supabase tests**, including actual-dose projection with published models and cross-user Levels/Compare denial |
| Focused numerical/API evidence | Eleven PK tests and seven Levels API/DB scenarios; independent clearance identities, mixed-rate peaks, dose edits/deletion, past carry-in, early logging, beyond-horizon phases, zoom invariance, same-compound overlays, PRN/drafts, unavailable outcomes and zero-write previews |
| Mobile/native evidence | No new mobile code or native checks in this increment; Levels/Compare UI remains required |

The first full run exposed a Levels fixture left active for the subsequent cross-user materialization suite. Test teardown now removes its own courses/catalog/model; the full rerun passed. Numerical checks also corrected distant one-time normalization, shared All projection coverage, duplicate millisecond samples and draft clearance horizon handling. The isolated Supabase harness completed and cleaned up its own local Docker project. No ordinary development database, hosted migration or cloud deployment was changed.

### September 10 — mobile transport, store and account lifecycle

- Added domain schedule vocabulary in `src/domain/types.ts`, transport shapes in `src/API/nouri/protocolTypes.ts`, and typed calls for all 20 current Protocol resource paths in `protocolsApi.ts`. These preserve exact decimal strings and separate planned snapshots from actual doses. Recurrence and PK remain backend-only.
- Added `src/store/protocolsStore.ts` and DB facade methods for courses, phases, scheduled/manual logs, operational projections, catalog/model info, schedule previews, Levels and Compare. Only pending requests coalesce. An accepted mutation advances the read generation before DB emits a Protocol change event; old in-flight responses cannot overwrite newer data. Preview/Compare POSTs remain reads with no mutation event.
- Shared API requests can bind `expectedUserId`. Protocol operations, profile hydration and settings reads/writes check that account before sending, after responses, and around token refresh/retry. A synchronous singleton Supabase auth listener tracks sign-out/account generations, including A → B → A. Redux hydration accepts only its current request ID. Settings writes return server-accepted settings and emit an event after success; Home's nutrition listener filters out Protocol/settings events.
- Added contract fixtures validated against the actual sibling Zod schemas/OpenAPI, and six facade-to-HTTP lifecycle scenarios. Added a reusable isolated local HTTP runner, `nouri-api/scripts/test-mobile-protocols.ts`, and `test/manual/protocolsE2E.test.ts`. The existing genuine token-expiry check now uses the same temporary stack instead of requiring edits to normal development configuration.

Validation for this increment:

| Check | Result |
| --- | --- |
| Mobile `npm test`, supported Node 22 | Passed: typecheck and **195 tests**; two opt-in HTTP checks reported skipped in this default run |
| Isolated local mobile HTTP runner | **Both opt-in checks passed separately**, with a newly migrated local Supabase project, real JWTs, real API HTTP and RLS-backed writes; genuine token expiry took 68 seconds and the retry wrote exactly once |
| Protocol HTTP scenario | Passed settings/catalog/model reads, preview/draft/start, late actual log/replay, immutable planned values, Levels, nonpersistent Compare, future phase/log edits, cross-user denial, log/course deletion and disable |
| API `pnpm verify` / `pnpm build` | Passed: typecheck, lint, **274 pure + 318 database tests**, and production compilation. The first verifier attempt caught a runner lint error; it was fixed before the successful rerun |
| Native Protocol UI | Still required. This increment adds no Protocol screens or rendered UI; HTTP checks do not prove navigation, sheet/keyboard behavior or native account-state clearing |

The isolated runner exited successfully after cleaning up its temporary Docker project. No normal development migration, hosted database change, notification scaffolding or deployment occurred. Existing mobile redesign changes were preserved. Navigation remounting/account-state cleanup, feature screens and their native QA remain part of Stages 6–7 rather than being inferred from transport tests.

### September 10 — bloodwork history, in-app reminders and whole-feature deletion

The working tree now also contains the operational mobile screens, independent Home card, course history, Levels/Compare/unsaved preview and their native SVG presentation. These use the existing DB/store/auth boundary; source presence and bundling do not establish native acceptance. The four-section Protocol root/global Add and metric Trends still need implementation.

- Bloodwork now has panel list/create/edit/delete screens, a curated result-entry sheet and single-marker history chart. Exact decimal strings, comma decimal keyboards, explicit zero/absent bounds, date-only collection and raw inputs are preserved. Compatible graph values and each result's bounds come from the API. Panel edits keep stable replay commands after ambiguous failures. Marker history uses a bounded date/panel cursor, separate from panel-list paging; every result remains reachable.
- Added `GET /v1/bloodwork/biomarkers/:id/results` and `GET /v1/protocols/annotations`. The latter projects owned course starts/phase changes/ends onto display dates, without dose markers or invented lab sample times. Bloodwork chart guides are bounded by pixel columns; the course/event controls page native views while retaining access to all annotations.
- Local migration `20260909235144_protocol_reminders.sql` adds one-time owned calendar items and replay receipts, with RLS and explicit backend grants. Reminder CRUD preserves the original entered timezone, serializes corrections, rejects stale revisions and hides foreign IDs. Today/week/month reads include reminders; Home and course-filtered projections exclude them. The mobile form resolves civil date/time through the existing API. No notification transport, configuration, delivery table or dependency was added.
- `DELETE /v1/protocols/data` removes the caller's courses and cascading phases/occurrences/actual logs/receipts, reminders, bloodwork panels/results/receipts and marker preferences in one transaction. It resets Protocol opt-in/introduction preferences while preserving ordinary settings, diary and weights. Settings has an explicit destructive confirmation naming bloodwork. A failed request emits no success event; accepted deletion invalidates pending Protocol/bloodwork reads and refreshes visibility/settings.
- Course-list projection now batches catalog/phases into a fixed three-query read, with a real database test comparing small and larger pages and all returned detail fields.

Validation for this increment:

| Check | Result |
| --- | --- |
| API `pnpm verify`, Node 22.11, disposable loopback PostgreSQL | Passed: typecheck, lint, **279 pure + 333 database tests** |
| API `pnpm build` / `pnpm openapi` | Passed; generated contract includes reminder CRUD, marker history, annotations and whole-feature deletion |
| `pnpm test:security:isolated` | Passed: **95 real Supabase tests**, including reminder ownership/receipt policies, worker denials, account cascades and whole-feature deletion preserving ordinary diary/weight data |
| Mobile `npm test` | Passed: typecheck and **208 tests**; two opt-in HTTP checks skipped in this default command |
| Real local mobile HTTP | **Both opt-in checks passed** in the final isolated runner: the expanded Protocol scenario includes marker history, annotations, reminders, ownership and whole-feature deletion; genuine token expiry took 68 seconds and refresh/retry wrote once. The runner exited successfully after cleanup |
| iOS + Android production JavaScript export | Passed with `EXPO_NO_DOTENV=1`, output `/private/tmp/nouri-protocols-v1-export`; this is bundle validation, not native rendering or interaction evidence |
| Disposable schema reference | `scripts/schema-reference.ts` completed and refreshed API `docs/database/reference.json` from all ten local migrations, including bloodwork/reminder tables, roles and policies; no hosted capture or comparison was performed |
| Native interaction | Unverified. CUA native pipe startup failed. Read-only `simctl` outside the shell sandbox confirms iOS 26.5 devices are available but shut down; no device was erased, booted or used to claim acceptance |

The first database verifier attempt could not connect through the shell sandbox; the approved loopback-only rerun passed. During this increment, incorrect test fixtures (missing nullable site/DTO fields, wrong settings GET path and a stale endpoint-count assertion) were corrected against the provider contracts. The contract test now compares its covered paths to actual generated OpenAPI paths. The two initial mobile reminder formatter type errors were fixed. No check listed as passing relies on a skipped suite. All migrations were exercised only in disposable test databases, with no ordinary development-stack or hosted migration and no deployment.

See [acceptance evidence and remaining native checks](qa/protocols-v1.md). Notification stages remain deferred and retained in the plan.

### September 10 — metric Trends and four-section navigation

Implemented locally:

- `GET /v1/protocols/trends` reads the existing diary/weight tables through their module services in one owned read-only snapshot. Slim history projections avoid Diary's 400-day and Weight's 2,000-entry screen limits. No migration or second metric store was added.
- Nutrition reuses Diary's quantity scaling and aggregate rounding. Seven-calendar-day averages include complete days only, with six days of warm-up, explicit complete zero days, incomplete/missing-day gaps and coverage. Stored diary/weight dates remain unchanged by the annotation timezone.
- `TrendsScreen` offers bodyweight, calories, protein, carbs and fat, one axis, 1W/1M/3M/All, date controls, exact point readouts, display-only weight units and course-event filters. SVG sampling reduces geometry only; every returned source point remains inspectable and gaps retain their identities.
- `ProtocolsTabs` provides Today/Levels/Trends/Compounds. Bloodwork is inside Trends; the shared Add sheet opens Compound, Bloodwork and Bloodwork reminder. Home, calendar, detail, intro and settings links now target the nested routes. Reminder creation reuses the form as a page, avoiding two native modal sheets during global Add.
- Accepted diary completion, food and weight changes invalidate pending metric reads before publishing events. Trends observes those events without invalidating Levels on every food edit. No settled cache, offline queue or new app dependency was added.

Terminal checks for this increment: API `pnpm verify` passed typecheck/lint, **279 pure + 336 database tests**; build and generated OpenAPI passed. Mobile `npm test` passed typecheck and **211 tests**, with the two opt-in tests skipped in that command. Both opt-in tests passed separately in the isolated real HTTP runner, including Trends ownership, complete-day refresh, metric preservation after Protocol deletion and genuine token expiry. Both native module graphs/Hermes bundles exported to `/private/tmp/nouri-protocols-v1-trends-export`.

Native QA is now possible through a temporary Maestro CLI after CUA's native bridge failed. A fresh iPhone 17e simulator (`Nouri Protocols QA`, iOS 26.5) and the ad-hoc signed debug app use `nouri-api/scripts/start-protocols-native-qa.ts`: real Supabase signup/password authentication, normal API fixtures and loopback Metro. Native sign-in, opt-in/root navigation and selected Trends readouts have passed. The [native setup](qa/protocols-v1-native-setup.md) records the unsigned-build failure, Expo development environment trap and explicit verified-bundle launch requirements. Full acceptance remains incomplete; exact outcomes belong in [QA evidence](qa/protocols-v1.md).

### September 10 — native reminder lifecycle

iOS execution exposed a real loading-to-form modal race: the reminder fetch unmounted one native sheet and immediately presented another. The reminder now retains one frame through loading, error and editing, following the dose sheet's existing pattern. Its full-page variant also guards native navigation against unsaved/ambiguous work and allows accepted saves to exit before checking busy state. Current-source native runs passed reminder creation, title edit, reopen, deletion, empty-day refresh, and Back → Keep editing / Leave. The root navigation and selected Trends checks passed again in the same local setup. These passes do not cover native date/time editing, all calendar variants, other forms or Android.

The native harness now uses `CI=0` so Metro watches current source. A subsequent served-bundle hash changed after an edit without restarting the stack; API/Auth endpoint checks still proved loopback configuration. The application has no fixture mode or alternate auth path. Reusable Maestro flows live in `test/manual/native/`; credentials remain private parameters. Verification after the changes: mobile `npm test` typecheck plus **211 passed, two opt-in skipped**; API `pnpm verify` typecheck/lint plus **279 pure + 336 database passed**, and `pnpm build`. Notifications remain deferred and retained. No ordinary development/hosted migration or cloud update was performed.

### September 10 — native bloodwork entry and result protection

The complete single-result iOS flow passed through global Add, decimal entry and reference bounds, panel save, graph-unit switch, raw-value preservation and panel deletion. The fixture converts 34.7 nmol/L to 1000 ng/dL and its 17.35–52.05 bounds to 500–1500, while the reopened panel keeps the original values and unit. A subsequent source review fixed silent loss of unfinished result fields: closing or replacing a marker now asks to discard changes. The shared sheet backdrop remains touch-dismissable but is excluded from accessibility focus; the labeled header Close control remains available.

Current-source native validation passed Keep editing, Discard and the complete bloodwork flow again in `/private/tmp/nouri-bloodwork-final-verify.log`. Mobile typecheck/211 tests and both iOS/Android JavaScript exports passed after these changes. Native Android, multi-result/date/long-history bloodwork cases and the full course/dose/Levels/Compare walkthrough remain required. See [the scoped acceptance evidence](qa/protocols-v1.md); these passes do not establish full V1 completion.

### September 10 — native actual-dose truth and exact Levels events

Native course creation/preview/activation passed for 110 mg every two days at 20:00. Home's September 9 selection remained independent of Food Diary's September 10 date. Native logging recorded 105 mg at 21:14, right delt, while the completed item and normal authenticated API retained planned 110 mg at 20:00 and the original schedule anchor. Screenshot inspection then found an actual chart bug: interpolation between samples produced 3.735 mg at the exact first Bateman administration, which must be zero in this model.

The backend now sends each marker's exact modeled series value, including prior carry-in and simultaneous doses, separately from its entered dose amount. Mobile cursor/readout values use it instead of interpolation at an event. Sampling always retains the first visible administration and includes sparse dose boundaries while keeping the 1,200-point budget. Dense-history marker accuracy does not require an unbounded polyline or a mobile PK implementation. OpenAPI and the mobile DTO are aligned.

Validation passed: API `pnpm verify` typecheck/lint, **280 pure + 338 database tests**; `pnpm build` and OpenAPI generation; mobile `npm test` typecheck and **212 passed, two opt-in skipped**; both real local HTTP tests separately, including exact first-dose marker transport and genuine token expiry; iOS/Android exports at `/private/tmp/nouri-levels-marker-export`. The refreshed isolated local API and bundle passed the iOS [exact-marker regression](qa/protocols-v1.md), and its screenshot shows 0 mg/0% at 21:14 with the recorded 105 mg intact. Native future-phase/Compare/end/new-course/deletion, Android and the broader hardening matrix remain required.

### September 10 — future-phase and Compare native acceptance

The iOS future-phase walkthrough passed: 90 mg every three days from September 12, with the September 9 anchor retained. Calendar checks kept the September 11 old-phase 110 mg dose, showed the September 12 new-phase 90 mg dose, and removed September 13's superseded slot. Levels showed the new 90 mg planned event. The original phase and actual/planned dose log remained byte-for-byte equal in authenticated API snapshots. A native 70 mg every-seven-days Compare scenario rendered separate curves, one-week and three-month ranges, equal branch values and returned to Levels without changing the stored course/phases/log.

This work also fixed review screens retaining the form's scrolled-to-bottom position. Editing and preview/Compare now use distinct scroll-container identities, so review begins at its summary; parent form values and range interactions retain their state. The corrected phase flow and Compare passed natively; mobile typecheck/212 tests and both platform exports passed again. [QA evidence](qa/protocols-v1.md) records exact logs, screenshots and remaining platform/flow gaps.

### September 10 — course ending, independent restart and enable state

Course ending now guards unsaved dates and ambiguous saves; course presentation excludes retained phases at/after its exclusive end. The focused end-boundary test covers later clocks selecting the last effective historical phase. Native Keep editing/Leave, End today, future calendar removal, and preserved actual/planned history passed. Under the chosen inclusive-date rule, End today remains ACTIVE until next local midnight. An independently API-created already-ended fixture validated the native Start new course action without altering clocks: dose input stayed blank, the old schedule was not copied, and the newly activated course had its own identity and no inherited history. Existing courses and logs were unchanged in normal API snapshots.

Native disable/re-enable also preserved all Protocol/lab/reminder/preference and nutrition/weight fixtures; only the expected settings update timestamp changed. A final lab-card assertion needed its full accessible label, as recorded in [QA evidence](qa/protocols-v1.md). Native whole-feature deletion is awaiting explicit approval after automatic review rejected the destructive test twice, including after loopback/account verification; no deletion was executed. This is not a blocker to other remaining work and does not negate the existing automated deletion coverage. Final mobile typecheck/**213 tests** and both exports passed; API code remains the verified **280 pure + 338 database** version with passing build, OpenAPI and real local HTTP tests.

### September 10 — bounded course pages, planned-history reads and Android sign-in

Compounds and the Levels picker now use `useProtocolCourses` to render an initial 30-course page and load more explicitly. The additive API `order=activity` orders active, planned and historical courses by descending start/UUID; the existing UUID-order default remains compatible. Cursor ownership and anchor changes are checked, and the evaluation time is retained across pages. This is not a cross-request database snapshot. Focus or accepted-mutation refresh replaces the head and drops its old tail; pending work remains session guarded. Scheduled-log history now loads linked planned snapshots in one batch per page, keeping planned and actual values separate.

The previous verification process was confirmed terminal with exit 0: API typecheck/lint, **280 pure + 340 database tests**, then production compilation. Its integration scenarios cover multi-page ordering/ownership/stale anchors and fixed query counts for actual history with exact planned snapshots. Mobile typecheck/**214 tests** passed, with two opt-in HTTP tests skipped. These results precede the additional Levels metadata change below.

A separate account was created through ordinary Auth in the retained disposable local Supabase project and seeded through the normal API with 33 synthetic courses. Real HTTP reads returned 30 then 3 courses, including the final historical course. A dedicated Android emulator, `Nouri_Protocols_QA` on `emulator-5556`, was booted and received the existing debug APK. The production-mode Android bundle was checked for API `127.0.0.1:4200`, Auth `127.0.0.1:55421` and absence of hosted environment URLs; its SHA-256 was `f2f5518b7b5c85b3d45d3cf781368537cf0413d250fa9defdc0aace6097c9c31`. Ordinary native password sign-in reached the authenticated Food Diary, confirmed by screenshot and native hierarchy. Maestro's email input stopped before completion; Android's normal input events completed the form. This proves sign-in only, not Protocol navigation or pagination acceptance. The earlier native deletion fixture/account was retained and untouched.

Prepared next changes give every Levels series its original `courseStartAt` and `courseStartTimezone`, independently of the visible chart markers or loaded course pages. Mobile labels use those fields, and selected courses outside loaded pages remain available in the picker. Both decorative syringe navigation icons were replaced with the installed neutral `CirclesThreeIcon`. Mobile typecheck and **214 tests** passed after these changes; the provider regression is authored but not executed, and OpenAPI has not yet been regenerated for the new fields.

**Validation hold:** automatic approval review rejected the API verification/build/OpenAPI command twice, including after `get_goal` confirmed the active implementation objective. It stated that the earlier planning-only instruction remained binding and did not accept the goal as trusted authorization. An explicit approval question for continuing local implementation/validation is pending. Do not bypass the rejection through a different database or indirect command. Keep the prepared source changes marked unverified on the provider/native boundary. This hold is separate from the older pending approval for native whole-feature deletion. No ordinary development/hosted migration or cloud deployment occurred.

### September 10 — renewed validation attempt and contract audit

The renewed goal instruction requests complete local implementation and validation. The exact prepared API verification/build/OpenAPI command was attempted again. Its sandboxed run passed TypeScript, ESLint and **280 pure tests**, then stopped before any database tests because connecting to `127.0.0.1:5432` returned `EPERM`. The terminal process exited 1; the chained build and OpenAPI commands did not run. Evidence is `/private/tmp/nouri-course-identity-api.log`.

The same command was submitted for loopback access, explicitly describing the disposable `nouri_api_test` target and the renewed user instruction. Automatic approval review rejected it again: it still considered the earlier planning-only instruction binding and the renewed authorization untrusted. No alternate database, indirect command or separately executed generation step was used to bypass that rejection. Explicit approval for local implementation/validation is pending; ordinary development/hosted migrations and cloud deployment remain excluded.

Read-only contract inspection confirmed a concrete unresolved boundary: route schemas and mobile series consumers require `courseStartAt` and `courseStartTimezone`, but generated OpenAPI lacks both fields on Levels, Compare and unsaved-preview responses. The authored provider scenario checks identifying an off-page course outside its start-marker viewport and preserving its original timezone during Compare. It has **not run**; the pure suite does not cover that database integration case. After authorization, run the provider verification, build and generator, review the resulting contract, then validate selected-course identity and pagination on a freshly verified native bundle. Do not count earlier 340-database-test or Android sign-in results as evidence for this newer change.

This increment changed documentation only. Native interaction, large-text/accessibility, outage/account-switch and long-history acceptance remain incomplete, alongside the separately blocked native whole-feature deletion check. Notifications alone remain deferred. The feature is not complete.

### September 10 — safe Android continuation, accessibility and static contract completion

Safe local implementation and validation resumed while the exact database-rebuild and synthetic-account whole-feature deletion checks stayed pending. No migration, database reset, account cleanup or hosted operation was performed in this increment. The existing disposable Auth/database and separate pagination QA account were retained. Only the stopped API/Metro processes were restarted, on loopback 4200/8085.

Implemented and verified locally:

- Levels course options now use the existing `OptionCard` multiple-selection mode. Native Android hierarchy inspection changed from `RadioButton` to `CheckBox` and confirmed two independently checked courses, including a selected historical course outside the loaded page.
- Course-card accessibility labels include their identifying dates, status, schedule/amount/route and next dose. The start date uses the original phase timezone consistently with Levels identity. The three existing iOS walkthrough selectors now include their fixture's start date, so they remain unambiguous after the label change; those modified iOS flows were not rerun here.
- Shared `AppButton` now enforces a 48-point minimum width as well as height, fixing narrow week/month arrow controls. The Protocol settings switch also has a 48×48 target. At 420 dpi, Android hierarchy measurements showed 126×126 physical pixels for the switch and at least 126 pixels in both dimensions for the week controls.
- API `pnpm build` and `pnpm openapi` passed independently as static, non-destructive commands. Inspection of `emit-openapi.ts` confirmed generation does not contact a database or real JWKS. Generated Levels, Compare and unsaved-preview series now require `courseStartAt`/`courseStartTimezone`. This resolves the generated-contract gap recorded above; it does **not** replace the pending provider database scenario.

Native device: dedicated `Nouri_Protocols_QA`, Android 16/API 36, `emulator-5556`. The authenticated app used a verified production-mode bundle containing only loopback API/Auth endpoints. The initial identity bundle SHA-256 was `40ec6aef511902151bdb5927304cfdb203f919a9aa7e5377c0d11101728cf4c5`; the checkbox/card-label bundle used by the successful pagination flow was `b8469a7b0ec29dea20dea117b528998b7d9e4cb6e97b87f6aede76289191d49a`. The final touch-target bundle was `bf7a85a4c5cb3383540522d2e66bc6178615504f2fd14798e2b719838df24675`.

Observed Android passes: ordinary opt-in/introduction; Today planned dose, countdown and yesterday item; explicit 30-course page → Load more → final historical course; direct detail → Levels identity; selecting two courses; one-week range; retaining both selections and the off-page course after Trends → Levels focus refresh. The new [Android pagination walkthrough](../test/manual/native/protocols-android-pagination.yaml) exited 0 in `/private/tmp/nouri-android-pagination-native.log`. Its initial attempt timed out scrolling the long first page; the bounded scroll timeout was corrected before the successful run. Native hierarchy and screenshots were inspected separately, including `/private/tmp/nouri-android-selected-checkboxes.{xml,png}` and `/private/tmp/nouri-android-final-course-page.{xml,png}`.

At 150% text, settings, Today controls and the Levels picker were checked at the original 1080×2424 physical size and at a temporary 945×1680 override (360×640 dp). Picker labels wrapped and Done/Close remained accessible; these are scoped passes, not whole-app large-text or TalkBack acceptance. Changing Android font scale while the app was running initially left stale text measurements; a full app restart was required before reliable layout inspection. Record that warm configuration-change limitation rather than claiming it passed. Evidence includes `/private/tmp/nouri-android-large-settings.{xml,png}` and `/private/tmp/nouri-android-compact-picker.{xml,png}`.

A cold-start outage check removed only the emulator's API port forward, leaving Auth and Metro reachable. The app displayed “Could not start the app” / “Could not reach the server” with Try again, without sending the signed-in user to Login/onboarding. Restoring the forward and tapping Try again returned to the authenticated Food Diary without credentials. `/private/tmp/nouri-android-cold-outage.{xml,png}` and `/private/tmp/nouri-android-outage-recovered.{xml,png}` record the inspected states. This does not cover account switching during a pending request, lost-response writes or failed-form retention. The emulator was restored to font scale 1.0, physical size 1080×2424 and all three original port forwards; no fixture was deleted.

Final mobile `npm test` passed typecheck and **214 tests**, with the two opt-in HTTP tests explicitly skipped (`/private/tmp/nouri-android-safe-final-mobile.log`). Static API logs are `/private/tmp/nouri-safe-local-build.log` and `/private/tmp/nouri-safe-local-openapi.log`. No database/security suite or full HTTP harness was rerun. Continue the other safe native/form/chart/account acceptance work; only the specifically rejected destructive checks remain pending approval. Notifications remain deferred and retained; the feature is still incomplete.

### September 22 — native font, form, error and accessibility hardening

The user authorized remaining-work items 1–4. The warm Android font-change defect
is fixed with a narrowly pinned RN 0.81.5 config plugin; navigation and drafts
survive changes and text remeasures in both directions. iOS refreshes only native
paragraphs for Dynamic Type. Protocol tabs grow with the text and retain explicit
iOS accessibility labels. Both native builds passed. Revisit the native flag
override when upgrading React Native.

Native investigation also found an Android date-dialog regression: the bloodwork
form's clock refresh reset a selected but unconfirmed day. A stable picker callback
fix passed an untouched 48-second dialog check and saved both laboratory results
unchanged. Paired checked-in Maestro flows reproduce this boundary. All three
charts now expose selected dates/values and announce point-button changes, with
recorded and planned doses distinguished in Levels.

A second native regression reproduced Home → Today remaining pinned to the old
date after a foreground timezone/date change. Date selection now lives in route
state, with explicit `null` for following today. The checked-in native rollover
flow passes on the final Android bundle; an explicitly selected historical date
remains fixed. Ordinary account A → B sign-in shows B's own target and empty
courses/trends. A corrected B → A run also verified a delayed old-account response
arriving after native sign-out, followed by A's correct target and dose history.
Both platforms' reduced-motion Add-sheet and month-navigation checks passed.
Native Diary completion refreshed calorie Trends with 0 kcal and 1/7 complete-day
coverage; a separate food-quantity edit was not performed.

The dedicated Android and iOS simulators exercised course activation/actual logging,
multi-result laboratory entry/date changes/concurrent conflicts, reminder save
failure/retry, ranges and metric controls, 2,005-point weight history, and native
Weight → Trends refresh. A deliberately lost successful dose response was retried
with the identical command and left one accepted revision. Protocol Home failure
did not hide nutrition, and a calendar reminder remained outside Home's dose card.
Normal local HTTP checks covered DST gaps/folds. See the dated evidence for the
platform and exact boundary of each pass; this is not blanket native acceptance.

Final mobile typechecking and **214 tests** passed, with two opt-in HTTP tests
skipped; **280 API pure tests** passed. No API source was changed. No database
rebuild/security suite, whole-feature deletion, hosted operation, commit or push
was performed. Notifications remain deferred with requirements retained.

### Remaining work and next validation

| Plan stages | Current state / next work |
| --- | --- |
| 0–1 | Core choices, storage/security, launch compound catalog, model metadata and biomarker catalog/conversions are implemented locally. The disposable schema reference includes the reminder migration; refresh again if migrations change. Local seeds are not a hosted deployment. |
| 2 | Compiler and preview implemented with all six kinds and DST fixtures. Reuse this compiler for worker/Levels/Compare; add evidence if those consumers expose new edge cases. |
| 3 | Course transactions implemented. Broaden integrated acceptance with finite-past/future-start courses, phases beyond the horizon and worker coverage recovery as those stages join. |
| 4 | Actual logging, snapshot-consistent operational reads, distant next-dose previews, reminder integration and batched course-list details are implemented and database-tested. Android actual-versus-planned logging/replay and native reminder/calendar checks now pass. Finish the remaining cross-platform date/operational scenarios in the QA matrix. |
| 5 | Implemented and locally validated, including real Supabase restrictions and compiled CLI execution. Deployment files are authored only; provisioning and cloud execution remain separate tasks. |
| 6–7 | Transport/session guards and mobile screens are implemented. Warm font/draft retention, failed saves, ambiguous replay, concurrent panel edits and independent Home loading now have native evidence. The dated QA record scopes account/date and remaining cross-platform flow coverage. Existing mobile redesign is preserved. |
| 8a–8b | Deferred only; retain requirements and do not implement notifications. |
| 9–10 | Canonical APIs, charts and Compare are implemented. Native ranges, metric controls, point navigation and iOS drag scrubbing pass; earlier iOS phase/Compare evidence remains. Finish untested platform/scenario combinations, actual screen-reader interaction and dense multi-course release-device performance. |
| 11 | Bloodwork and reminders are implemented. Native multi-result/date/conversion/history pagination, conflict handling, failed reminder retry and calendar/Home separation pass. Keep remaining platform-specific form/chart cases explicit; notification dispatch remains deferred. |
| 12 | Diary/weight projections and data-layer tests pass. Both platforms rendered 2,005 weight points; native Weight edits and Diary completion refreshed Trends; calorie coverage and macro controls were exercised. A separate native food-quantity edit and low-end release performance still need acceptance. |
| 13 | Whole-feature deletion is implemented with existing automated/HTTP evidence; its native destructive check and the previously rejected database rebuild remain separately gated. Actual VoiceOver/TalkBack interaction and remaining native scenarios are still required. The feature is not yet fully accepted for release. |

Local commands require the supported Node runtime. The validated database command used `TEST_ADMIN_DATABASE_URL=postgresql://rokasskerath@127.0.0.1:5432/postgres` and `NOURI_DISPOSABLE_DB=1`; that harness rebuilds only `nouri_api_test`. The isolated Supabase harness creates/removes its own temporary project, leaving the existing developer stack untouched. No migration was applied to the ordinary development stack or any hosted environment, and no server was deployed.
