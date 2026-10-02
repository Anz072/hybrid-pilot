# Protocols native hardening — September 22, 2026

This increment follows the user's authorization for items 1–4: warm font changes,
native acceptance, error/session/date robustness, and accessibility/performance.
Notifications remain deferred, with their requirements retained. No hosted
operation, deployment, database reset, whole-feature deletion, commit or push
was performed. This evidence supplements, rather than replaces, the older
[acceptance record](protocols-v1.md).

## Changes

- `plugins/withFontScale.cjs` and its `app.json` registration preserve the Android
  Activity during `fontScale` changes, publish updated dimensions, and request
  measurement on the Fabric surface. Bootstrap enables only RN 0.81.5's existing
  font-scale layout-invalidation flag while retaining the stable flag provider.
  The plugin rejects unsupported RN/new-architecture configurations and unexpected
  generated-source anchors. Review/remove this compatibility fix on an RN upgrade.
- `src/components/ui/AppText.tsx` refreshes only its native iOS paragraph when
  Dynamic Type changes. Screen, navigation and form instances remain mounted.
  The tested iOS native flag override was ineffective and was removed; the final
  iOS build contains no such override. Font scaling remains enabled and uncapped.
- `src/navigation/ProtocolsTabs.tsx` allows two-line labels and reserves height
  for the current font scale. It preserves the iOS tab/position announcements
  that React Navigation otherwise loses with a custom label renderer.
- `ProtocolDateField.tsx` keeps the Android picker callback stable across parent
  clock/focus renders. The installed picker reopens/updates its dialog when that
  callback changes; previously this could replace an unconfirmed selection with
  the old form value. Only a confirmed `set` event changes the form value.
- `TodayScreen.tsx`, `ProtocolHomeCard.tsx`, `ProtocolCalendarScreen.tsx` and
  `navigation/protocolTypes.ts` now keep the selected date in navigation state.
  Explicit `null` follows today; a date string selects a fixed day. Previously,
  opening Today from Home and clearing its nested date to `undefined` could
  restore the initial day after a timezone/date change. The failure reproduced
  twice; the fixed native foreground regression passed without tapping Today.
- All three Protocol chart components expose dates and values to accessibility.
  Trends and bloodwork gain adjustable actions; point buttons announce the newly
  selected value. Bloodwork includes exact raw/display values and that result's
  reference bounds. Levels identifies recorded versus planned administrations;
  dense readouts are bounded and direct users to course history for the rest.

## Environment and fixtures

Dedicated Android 16/API 36.1 AVD `Nouri_Protocols_0922` (`emulator-5556`),
1080×2424 at 420 dpi; iPhone 17e/iOS 26.5 simulator
`9F5E1AB1-FFDE-4CD3-8F12-5AC28CF831CA`. The retained disposable Supabase project
uses gateway/Auth 55421 and database 55422. It was started without resetting or
applying migrations. The ordinary development stack was not modified.

API 4200 and Metro 8085 run on loopback. Every loaded production-transform bundle
was checked for those API/Auth endpoints, absence of hosted endpoints and absence
of the development environment-module import. iOS was built with ad-hoc signing
for normal SecureStore operation; both apps use genuine Supabase password login.
There is no app auth bypass, token injection or test-only app data layer.

Synthetic fixtures were created through ordinary Auth/API/native UI operations:
one every-two-day 110 mg course starting September 21, two-result bloodwork,
60 older laboratory panels, 2,005 weight dates, and complete/incomplete/missing
nutrition days including a complete zero-intake day. Values are test inputs.
The fixtures are retained. Credentials, bundles, command logs and screenshots
remain private under `/private/tmp/nouri-native-0922`; do not commit that folder.

## Observed passes

| Area | Evidence and scope |
| --- | --- |
| Android warm fonts | Settings 100% → 200% → 100% returned identical text/control bounds without restarting the Activity. A course draft retained interval/amount; a dose sheet retained actual amount/time through a warm increase. Native Android builds passed. |
| Android picker retention | With the fix loaded, the selected September 22 date remained selected after **48 seconds** with the dialog untouched. The checked-in confirm flow passed, saved the panel at revision 4, and retained both exact results and reference bounds. The unfixed build reverted the date in repeated attempts. |
| iOS warm fonts | The old build clipped text after an accessibility-size increase. The paragraph fix passed normal → accessibility-medium settings and reminder-form checks in the final native build without the discarded iOS override. The reminder title and date/time survived; labels wrapped and controls remained scrollable. |
| Android course/logging | Opt-in, introduction, preview and activation; historical planned rows did not become actuals. The September 21 plan stayed **110 mg at 20:00**, while the actual was entered as **105 mg at 21:14**, then edited to **106 mg**. The interval anchor remained September 21. |
| Ambiguous dose response | A local fault proxy forwarded an edit, then returned 503 after the API accepted it. The native error retained the command; explicit Retry confirmation sent the identical body hash. Exactly one actual log remained at revision 2, unchanged by retry. A separate disconnected-response case was automatically replayed by OkHTTP and was also idempotent; that case alone is not UI-retry evidence. |
| Failed reminder save | A synthetic pre-write 503 retained title/date/time and displayed Retry save. Retry created one record. Android changed its time to 16:30 and later moved September 23 → September 22; the accepted record had revision 2. |
| Calendar reminders | Android day activity showed separate scheduled-dose/reminder counts and the 16:30 item, with an accessible Edit reminder control after scrolling. iOS saved a reminder after changing September 22 → September 23 using the native wheel, including at accessibility text size. No device alert was added. |
| Multi-result bloodwork | iOS created total testosterone `34.7 nmol/L` with lower bound `0` and upper bound `52.05`, plus estradiol `125.125 pmol/L` without bounds. A native collection-date edit preserved both results. |
| Concurrent panel edit | An ordinary API edit advanced the panel while an older native form was open. Save showed the conflict; Review saved panel displayed the accepted remote revision without overwriting it. |
| Bloodwork history | Native conversion displayed `1000 ng/dL`, range `0–1500`, while retaining raw `34.7 nmol/L`. Previous-result and same-day navigation, the 50-result page and 11 older results, and newer-page navigation passed on iOS. |
| Levels | Android 1W/3M/All, relative/amount controls and Previous/Next event controls passed. Modeled history remained distinct from future planned estimates. |
| Native chart scrubbing | An iOS horizontal drag changed the accessible selected point from September 22 at 16:39 / 36.02% to September 25 at 05:10 / 58.15%. The prior warm Dynamic Type change retained the selection while resizing the tabs. This verifies a real gesture, separately from point buttons. |
| Trends | Both platforms rendered all 2,005 weight dates and navigated points. Android complete-day calorie coverage and iOS calorie/Protein/Carbs/Fat controls and 3M navigation passed. A native Weight edit from 79.35 to 80.25 kg was accepted by Weight and displayed as 80.25 kg in Protocol Trends. |
| Independent Home | A targeted Protocol Home 503 left the calorie card loaded at 0 of 2,400 kcal while Protocols showed its own error/retry. Restoring the successful read did not require signing in again. A later native flow showed the reminder in Protocol Today while Home displayed Nothing scheduled today, with no reminder card. |
| Reduced motion, iOS | Native Settings confirmed Reduce Motion = 1 before the successful Protocol Add-sheet open/dismiss flow. A label-only first attempt had left the switch off and is excluded. The original off setting was restored afterward. |
| Reduced motion, Android | `transition_animation_scale` was set to 0 on the dedicated emulator (the setting RN reads), then Add opened and dismissed successfully. The corrected flow used the actual Bloodwork reminder and Close labels; an earlier incorrect label assertion is excluded. The original scale 1.0 was restored. |
| Ordinary account switch | Native sign-out and normal password sign-in changed account A's 2,400 kcal target to account B's 2,100 kcal target. B had No compounds yet, No records in this range, and no inherited dose/reminder activity. Fixtures were kept. This alone does not prove the pending-response race. |
| Pending read across sign-out | The corrected B → A run held B's real Home response for 14,541 ms. Native Login was confirmed at 14:25:08.721 UTC; A's credentials were submitted at 14:25:15.884; the old HTTP 200 arrived at 14:25:16.792, before A's profile hydration. A's Home then showed 2,400 kcal, its recorded September 21 administration and future scheduled doses. The late response did not restore B's session or empty course state. `pending-switch-timing.json`, `pending-signout-login.xml` and `proxy.jsonl` distinguish this pass from the earlier misnavigation. |
| Foreground date change | From a fresh Home → Today entry, backgrounding and changing only the Android timezone from Europe/Vilnius (September 22) to Pacific/Kiritimati (September 23) reproduced the pinned-date defect twice. The final bundle passed the checked-in rollover flow, showing September 23 and the new zone without tapping Today or restarting. No system clock or server date was changed; this is not a literal overnight test. |
| Calendar selection | Both final bundles passed September → October → September month navigation. Android selected September 21 through the month grid and retained that explicit historical date when backgrounded and restored to Europe/Vilnius. |
| Diary completion → Trends | B's native Diary changed the empty September 22 from incomplete to complete. Returning to calorie Trends showed `0 kcal`, `7-day average · 1/7 complete days` and `Recorded this day: 0 kcal · Complete`. This validates the real Diary mutation/refresh path and complete-zero-day semantics; a separate food-quantity edit was not performed. |
| DST resolution | Normal local HTTP checks passed Vilnius spring gap/fall fold and Lord Howe's half-hour gap cases. These are API evidence, separate from native midnight/foreground behavior. |

The native flows were driven using current hierarchy and screenshots. Several
initial driver attempts matched label text rather than the actual button, used
an incomplete card label, or reached a control hidden by the keyboard; corrected
steps were rerun. They are not counted as product passes merely because the
driver sent a tap. Android Back can open an unsaved-changes dialog when the
keyboard is already hidden; inspect the visible keyboard before dismissing it.

The final post-rollover-fix production-transform bundles were verified against
loopback API/Auth before native launch:

- Android SHA-256: `f150d9e37e0692e4865d1b3ae0a33b7b5c27ae59f734d456ac0ee5618cce4d17`.
- iOS SHA-256: `e0b664ced4d7110aa3e45b133a17f52ac29ca5b1e0da1608f32d2bc4dce34b65`.

## Validation boundaries

Mobile typechecking and 214 tests pass, with the two opt-in HTTP tests explicitly
skipped. API pure tests pass (280). No database/security rebuild suite was rerun.
Android and signed iOS native builds passed. Reapplying the Android config plugin
left all three generated Android files unchanged. The native driver and real
HTTP checks above supplement the existing lifecycle/integration tests.

Local API timing with this fixture: six All-weight reads returned 2,005 points
in approximately 9–13 ms; calorie 3M reads took 1.9–4.5 ms; one-course All Levels
took 19–28 ms. Native full-history interaction did not establish release-build
frame budgets or low-end-device performance. Do not present emulator/debug timings
as production benchmarks.

Physical VoiceOver remains unverified: the available iPhone and iPad were both
unavailable. Apple's [accessibility testing guidance](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app)
requires a device for VoiceOver; simulator hierarchy checks are not a substitute.
TalkBack was installed and bound in the dedicated headless Android emulator, but
that alone does not verify speech/focus/gestures. Complete actual screen-reader
acceptance with a usable device/emulator surface. The prior separately gated
database rebuild and native whole-feature deletion checks remain excluded.

For the Android date regression, use the paired
[open](../../test/manual/native/protocols-android-date-open.yaml) and
[confirm](../../test/manual/native/protocols-android-date-confirm.yaml) flows,
waiting at least 35 seconds between them. This tests the real native dialog
across the form's 30-second clock refresh rather than mirroring the callback
implementation in a unit test.

The [foreground rollover flow](../../test/manual/native/protocols-today-rollover.yaml)
checks the native navigation/date boundary after entering from Home. Change only
the dedicated emulator's timezone while backgrounded, verify the new day/zone
without tapping Today, and restore the original zone afterward. Also verify that
an explicitly selected historical day remains selected across the same change.

## Remaining acceptance

- Actual VoiceOver and TalkBack speech, focus and gestures on a usable device.
- A native Diary food-quantity edit → Trends refresh, plus the platform/scenario
  combinations still absent from the combined dated QA records (including
  Android phase/Compare/end/restart and chart unavailable states).
- Release-build frame/interaction measurements on slower hardware and dense
  multi-course histories. The large weight-history/local latency checks above
  establish narrower evidence.
- The separately gated database rebuild/provider scenario and native whole-feature
  deletion. Notifications remain deferred and retained.

Temporary QA settings were restored: Android font scale 1.0, original animation
settings and Europe/Vilnius zone; TalkBack off; iOS normal Large text size and
Reduce Motion off. Synthetic accounts/data remain available for follow-up. Normal
global sign-out of account A on Android invalidated its earlier iOS session;
ordinary password sign-in restored iOS before its final route check.

The task's API (4200), fault proxy (4201), Metro (8085) and dedicated simulators
were stopped after validation. The retained disposable Supabase containers and
all synthetic fixtures were kept; the ordinary development stack was untouched.
