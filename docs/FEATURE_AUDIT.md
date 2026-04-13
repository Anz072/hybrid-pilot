# HybridPilot Feature Audit

Date: 2026-04-12

Supersedes: 2026-04-07 audit

## Scope

This refresh uses the 2026-04-07 audit as context and re-audits the current `hybrid-pilot` codebase as of 2026-04-12. It focuses on user-visible behavior, persistence, validation, and release readiness across the whole app.

## Validation Snapshot

- Ran `npx tsc --noEmit` on 2026-04-12.
- Result: failed in `src/API/supabase/endpoints.ts` because `Food` is implicitly `any`, `supabase` is undefined, and `setFoods` is undefined.
- `package.json` still has no `typecheck`, `lint`, or `test` scripts.
- No `*.test*`, `*.spec*`, or `__tests__` files were found under `src`.

## Executive Summary

- The strongest part of the app is now the local-first food plus weight workflow: onboarding, calorie target setup, food search/logging, barcode lookup, custom food creation, quick add, recipe creation, and a much more mature weight diary.
- The app has materially progressed since 2026-04-07. Recipes are now real, USDA search is wired into food discovery, and More has become a functional settings area with calorie, goal, training, schedule, and diary-hour controls.
- The app is still not release-ready. TypeScript does not pass, Home and Login are still placeholders, auth/restore is incomplete, and a few food/recipe flows are misleading or hidden.

## What Changed Since 2026-04-07

- Added real recipe creation backed by `user_recipes`, `user_recipe_ingredients`, and a linked `food_items` row with computed per-serving nutrition.
- Added USDA text search into food search and recipe ingredient search when `EXPO_PUBLIC_USDA_API_KEY` is configured.
- Expanded More from mostly debug into a real settings hub with calorie allowance editing, automatic goal/activity recalculation, training type editing, daily calorie schedule overrides, and diary timeline hour controls.
- Food search now has a recipes mode and clearer separation of favorites, recent, and recipe results.
- Weight remains the most polished vertical slice and is still ahead of the rest of the app in UX completeness.

## Status Legend

- Implemented: usable end-to-end in the current app.
- Partial: real workflow exists but has meaningful UX, product, or architecture gaps.
- Placeholder: visible shell with no meaningful underlying workflow.
- Schema only: table/type exists but there is no surfaced product flow.

## Whole-App Feature Map

### App Shell And Local Data Foundation

- Implemented: Expo/React Native app with local SQLite, Redux user hydration, font loading, splash animation, and migration-driven schema evolution.
- Implemented: boot flow gates between onboarding, main app, and login based on onboarding completion plus a locally hydrated user.
- Partial: the user model is effectively single-user and local-only. The app always loads the first DB user and there is no real restore, sign-out, or account switching.
- Partial: `supabase` is present in dependencies and the API folder, but the actual integration is an unused broken stub that blocks TypeScript.

### Onboarding And Local Account Creation

- Implemented: welcome -> goal -> goal pace -> body data -> activity -> training -> fuel plan -> account -> success.
- Implemented: calorie and macro targets are computed from onboarding inputs and stored on the local user profile.
- Implemented: finishing onboarding writes the local account, onboarding profile, onboarding-complete flag, and an initial weight entry.
- Partial: the onboarding account step requires display name, email, and birthdate for a local-only account, but there is no post-onboarding profile editor for display name, birthdate, height, sex, or email.
- Placeholder: Welcome still shows `I already have an account` with no handler.
- Placeholder: Login is still a visual stub with a Sign In button and no restore/auth implementation.

### Food Diary And Logging

- Implemented: weekly diary strip, selected-day macro and energy progress, visible timeline hours, hourly buckets, add-food entry points, edit/delete flows, and copy-yesterday.
- Implemented: standard food logging supports quantity, time, meal label, nutrition preview, save, edit, and delete.
- Implemented: quick add supports calories plus macros/alcohol, optional custom name, time editing, manual versus auto-calculated energy, and edit flow for existing quick-add entries.
- Implemented: custom food creation supports a grams-based serving, core macros, and a large advanced nutrition section, then immediately logs the new food into the diary.
- Partial: deleting food diary entries has no undo, while weight deletes do.
- Partial: copy-yesterday duplicates entries without warning when the destination day already has food logs.
- Partial: favorite quick-add cards exist in code, are loaded in the screen, and have a dedicated component, but the component is commented out in `FoodDiaryScreen`, so favorites are not actually surfaced there right now.
- Partial: `FoodDiaryMoreSection` receives `onQuickAddFood` but does not render a quick-add action card, so part of the intended diary action set is currently hidden.

### Food Search, Barcode, And Library

- Implemented: Add Food supports local search, recent foods, favorites, recipe search mode, USDA remote results, barcode scanning, and custom food fallback.
- Implemented: scanned barcode flow validates EAN, UPC, and GTIN patterns, checks local DB first, then Open Food Facts, and persists newly found foods locally before logging.
- Implemented: foods can be favorited per user and recent foods are derived from actual log history.
- Partial: USDA search silently returns no remote results when `EXPO_PUBLIC_USDA_API_KEY` is missing, so the experience degrades to local-only without explicit user feedback.
- Partial: barcode scanning still relies entirely on camera flow. There is no manual barcode entry fallback.
- Partial: barcode and API flows still emit several debug `console.log` and `console.error` calls that should be dev-guarded or removed before release.
- Partial: Food Library is still presented as a debug/local DB viewer with destructive delete behavior rather than a safe user-facing food manager.

### Recipes

- Implemented: recipe builder supports manual creation, ingredient search from local foods plus USDA, barcode scanning for ingredients, per-ingredient amounts, servings, optional prepared weight, prep/cook time, link field, freeform description, and step list.
- Implemented: saving a recipe creates both recipe records and a linked food item with computed per-serving calories, macros, and rolled-up nutrient data.
- Implemented: saved recipes show up in Add Food under Recipes and can be logged like normal food items.
- Partial: there is no recipe edit, duplicate, archive, or dedicated recipe details screen after save.
- Partial: Add Food has recipe search mode, but there is no visible create-recipe CTA there even though the empty-state copy implies one exists.
- Partial: the diary copy says recipe creation will log one serving, but the current save flow only persists the recipe and closes the screen. It does not add a diary entry.
- Partial: `CreateRecipeScreen` still has leftover UI inconsistencies, including a hero title that says `Quick Add`.
- Placeholder: link import and AI import are sketched in code/comments but not actually enabled.

### Weight

- Implemented: manual add/edit/delete, notes, local time handling, future timestamp confirmation, unusual-weight confirmation, same-day replacement logic, optimistic saves, delete undo, goal setting, target date, pace helper, chart ranges, trend line, goal band, insights, and collapsible history.
- Implemented: weight entries keep source metadata and local sync status fields, so the data model is already shaped for future sync/import work.
- Partial: sync status is purely local state management today. There is no server sync, device sync, or retry pipeline behind the pending/error states.
- Partial: weight input is kg-only. There is no lb/lbs option.
- Partial: same-day replacement is a deliberate product choice, but the UX still reads like a generic history logger, so some users may expect multiple weigh-ins per day to coexist.

### Settings And Profile Management

- Implemented: More now acts as a real settings hub with calorie allowance, automatic goal/activity recalculation, training types, daily calorie schedule overrides, weekly budget preview, and diary timeline hours.
- Implemented: automatic calorie recalculation uses the latest logged body weight plus stored body/profile data.
- Partial: there is still no surfaced editor for body data, birthdate, height, sex, email, units, privacy, or export.
- Partial: the debug tools and Food Library remain directly accessible from the main More experience rather than behind a strict dev gate.

### Home And Auth Surfaces

- Placeholder: Home is still a centered text placeholder and does not function as a dashboard.
- Placeholder: Login is still a placeholder screen with no authentication or restore behavior.
- Partial: because onboarding completion and active-user hydration are separate checks, the app conceptually supports a post-onboarding restore path, but that path has not been built.

### Schema-Only Or Mostly Unsurfaced Areas

- Schema only: `activities` table exists, but there is no exercise/activity logging UI.
- Schema only: `custom_meals` repository exists, but there is no surfaced custom-meal management flow.
- Mostly unsurfaced: detailed micronutrient data is stored and rolled up, but there is no micronutrient dashboard or nutrient insight UI yet.

## Biggest Release Blockers

- `src/API/supabase/endpoints.ts` breaks `npx tsc --noEmit`, so the baseline quality gate is red.
- Home is still a placeholder, which leaves one of the main tabs effectively empty.
- Login/restore is not implemented, while onboarding still advertises an existing-account path.
- Recipe creation copy currently promises diary logging that does not happen.
- There is no automated test coverage and no standard scripts for typecheck, lint, or test.

## MVP View

### If MVP Means "Useful Single-User Local Nutrition Plus Weight Tracker"

The app already contains most of the product surface needed for that MVP:

- onboarding and local account creation,
- calorie and macro target setup,
- food diary with search, favorites, recent, barcode scan, quick add, custom foods, and recipe logging,
- weight diary with chart, goal, and history,
- settings for calories, goal/activity, training, daily schedule, and diary hours.

### What Must Be Fixed Before Calling That MVP Shippable

- Fix TypeScript so the codebase compiles cleanly.
- Replace the Home placeholder with a real dashboard or remove the tab until it exists.
- Either implement restore/login or remove the fake login and existing-account affordances.
- Fix the recipe flow mismatch so diary copy matches actual behavior.
- Decide whether debug tools and Food Library are developer-only or user-facing, then gate or redesign them accordingly.
- Add at least a minimal `typecheck` script and a handful of tests around food log math, copy-yesterday, quick add calculations, and weight goal math.

### What Is Outside MVP And Can Wait

- cloud auth and cross-device sync,
- activity logging,
- water tracking,
- fasting,
- wearable or health platform integration,
- micronutrient dashboards,
- export/import,
- AI recipe import or AI food logging.

## Recommended Next Pass

1. Remove or disable the broken supabase stub and add `typecheck`, `lint`, and `test` scripts.
2. Finish the shell surfaces: Home, login/restore decision, and Welcome existing-account path.
3. Tighten food UX: restore diary favorites quick-adds, add delete undo for food logs, add copy-yesterday duplicate guard, and add manual barcode entry.
4. Finish recipes as a true product slice: correct the UI copy/title, then decide whether saving a recipe should optionally log it immediately.
5. Keep advanced features like activity, sync, water, and micronutrient insights as post-MVP tracks.
