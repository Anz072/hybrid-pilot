# Diary interaction fixes

Implemented the September 5 Diary review locally. The meal list keeps independent disclosures, while logging now finishes at the saved entry and repeated additions stay in the same search session.

## Changes

| Change | Main owners | Scope |
| --- | --- | --- |
| Quick-pick **Edit** opens the exact accepted entry, with Save changes and Delete entry | FoodDiaryScreen, DB, diaryStore | Diary + mutation return/event contract |
| Returning from Add or edit opens the destination meal, reveals the saved row with minimal scrolling, and briefly highlights it | FoodDiaryScreen, FoodDiaryMainStrip, useDiaryScroll | Diary |
| Expanding/collapsing a meal no longer changes the Quick picks or Repeat destination | FoodDiaryMainStrip, FoodDiaryQuickAdds, MealBucketSelect | Diary; shared selector reused |
| Bottom collapse preserves the tapped header position; temporary trailing space retires during upward scrolling | useDiaryScroll, diaryScrollGeometry | Diary scroll geometry |
| Quick logs stay in search with per-item feedback, an added count and Done; quantity forms return to search | AddFoodScreen, ScannedFoodLogScreen, QuickAddFoodScreen | Logging navigation |
| Frequent food order stays stable for the open search session, including return from a quantity form | AddFoodScreen | Search |
| Empty meal headers open Add directly; populated headers retain independent expansion choices per day | FoodDiaryMainStrip | Diary |
| Removed meal icons, selected tint and visible item counts; compacted calendar and meal spacing | FoodDiaryMainStrip, FoodDiaryHeroCard | Local styles |
| Added button/expanded semantics, separate 48 dp Add targets and restrained row pressed feedback | FoodDiaryMainStrip, MealBucketSelect | Diary accessibility |
| Changed transitions respect the existing reduced-motion hook; large text stacks meal totals below names | MainStrip, QuickAdds, HeroCard, useDiaryScroll | Diary motion and layout |

Existing AppButton, IconButton, AppText, MealBucketSelect, colors and spacing tokens are reused. No global token changes, new dependencies, backend changes or persistent storage were needed. The saved-entry handoff extends the existing data-change event with an optional entry ID. Accepted IDs and dates come from successful API responses. Quick Add preserves its public numeric return contract.

## Verification

- `npm test`: TypeScript passed; **144 tests passed, 1 existing manual token-refresh test skipped**. Eight new tests cover accepted entry IDs/dates, correcting the same entry with PATCH, rejected saves, Quick Add compatibility, and scroll boundaries.
- Actual native Android development build: Pixel 10 emulator, Android 16, 1080 × 2424, density 420. Normal screenshots use font scale 1.0. A separate accessibility capture uses 2.0 after restarting the app.
- Collapsed Breakfast → Add → Done revealed the saved food; Lunch and Dinner retained their expansion state.
- The lower Dinner header remained at y=272 before and after collapse. The original review measured a 147 px / 56 dp jump.
- Ten consecutive additions stayed in one search session. Done revealed the last row. A typed query remained intact after quick logging. Returning from quantity editing preserved all four Frequent rows' order and coordinates.
- Two rapid taps added one food. Quick-pick Edit changed a temporary Nutella entry from 100 g to 200 g without increasing Dinner's two-entry count.
- Empty-header Add, separate destination selection, meal toggles with Android reduced motion enabled, swipe Delete, Undo, and editor Delete were exercised. Undo restored the expected three-entry count.
- All temporary diary entries were removed. September 5 returned to zero; August 31 retained its original four entries and 1,589 kcal. Emulator text/motion/accessibility settings were restored.

TalkBack setup was blocked by Android Accessibility Suite's notification prompt, so spoken-navigation verification remains outstanding. Accessibility roles, labels, expanded state and touch bounds were inspected, but that is not a substitute for a complete TalkBack pass. No iOS run or frame-rate benchmark was performed in this task.

## Local evidence

[Before/after gallery](../../../nouri-diary-ux-review/implementation.html) · [Original diagnosis](../../../nouri-diary-ux-review/review.md)

Eleven existing app files changed, plus two Diary scroll helpers and one test file. Earlier workspace changes were preserved. Nothing was committed or pushed remotely.
