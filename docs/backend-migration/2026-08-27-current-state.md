# Backend Migration — Current State & Target Architecture

**Repo:** `nouri` (Expo SDK 54 / React Native 0.81 calorie tracker)
**Date:** 2026-08-27
**Branch surveyed:** `feat/design-overhaul` @ `e4d76b4`
**Status:** Read-only investigation. Nothing in this document has been implemented.

**Goal of the migration**

```
FROM   React Native ──────────────────► Supabase (PostgREST + Auth)
TO     React Native ──► Node.js API ──► Supabase PostgreSQL
       React Native ──────────────────► Supabase Auth   (unchanged)
```

The Node API will be deployed to Google Cloud Run.

---

## 0. Executive summary

| Question | Answer |
| --- | --- |
| Total Supabase table call sites | **71** `.from(...)` calls |
| Files containing them | **3** (`supabaseFoodStore.ts` 50, `supabaseUserStore.ts` 19, `supabaseProfiles.ts` 2) |
| `supabase.rpc(...)` | **0** |
| `supabase.functions.invoke(...)` / Edge Functions | **0** |
| `supabase.storage.*` | **0** |
| Supabase Realtime / channels | **0** (the only `subscribe` is `auth.onAuthStateChange`) |
| Generated Supabase DB types | **0** — all row types are hand-written |
| Migration tooling (`supabase/` CLI project) | **None** — schema is one hand-applied file, `docs/supabase-schema.sql` |
| React Query / SWR / any HTTP cache lib | **None** — Redux Toolkit + a hand-rolled `expo-sqlite` cache |
| Tables with RLS enabled | **14** |
| RPCs that must stay SQL-side | **0 exist today**; 6 client-side sequences *should become* transactions |
| External API keys shipped to the client | **1** — `EXPO_PUBLIC_USDA_API_KEY` |

**Three findings that shape the whole migration:**

1. **The data layer is already isolated.** Every Supabase table read/write goes through three modules behind one facade (`src/store/DB.ts`). Screens never call Supabase directly. This is the single biggest asset — the migration is a *rewrite of 3 files*, not 60 screens.

2. **A 1:1 proxy would make the app measurably slower.** The Food Diary cold-load currently issues **7 to ~40 round trips** to Supabase, several of them *serially* (see §7). Wrapping each in a Node hop adds a full RTT per request. The migration only pays for itself with **screen-level endpoints**.

3. **Most write paths rely on RLS as their *only* authorization check.** `updateUserFoodLog`, `deleteUserFoodLog`, `updateUserRecipe`, `deleteUserRecipe`, `updateUserCustomMeal`, `deleteUserCustomMeal` and several reads filter by **`id` only** — no `user_id` predicate. Today RLS makes that safe. **If the Node API connects with the service-role key, every one of those becomes an IDOR.** See §9.

---

## 1. Architecture diagrams

### 1.1 Current

```
┌──────────────────────────── React Native / Expo ────────────────────────────┐
│                                                                             │
│  Screens (Food Diary, Home, Weight, Weekly Review, Settings, Onboarding)    │
│      │                                                                      │
│      │  DB.getUserFoodLogEntriesBetween(), DB.saveWeightEntry(), ...        │
│      ▼                                                                      │
│  ┌──────────────────── src/store/DB.ts  (facade) ─────────────────────┐     │
│  │  · thin re-export + change-event emitter (dataChangeEvents)        │     │
│  └───────┬────────────────────────────────────┬───────────────────────┘     │
│          │                                    │                             │
│          ▼                                    ▼                             │
│  supabaseFoodStore.ts (3741 L)      supabaseUserStore.ts (1702 L)           │
│  supabaseProfiles.ts (296 L)                                                │
│          │  read-through / write-through, local-first                       │
│          ├──────────────► cacheRepository.ts ──► expo-sqlite (local cache)  │
│          │                foodRepository / foodLogRepository /              │
│          │                recipeRepository / weightRepository (Expo Go only)│
│          ▼                                                                  │
│  src/API/supabase/client.ts  ── createClient(url, publishableKey)           │
│          │                       session in expo-secure-store               │
│          │                                                                  │
│  Business logic executed ON DEVICE:                                         │
│    engine/adaptiveCalories.ts (573 L)  · engine/calorieTargets.ts           │
│    engine/nutrition.ts · engine/micronutrients.ts · engine/goalStrategy.ts  │
│    screens/Food/foodSearch.ts (ranking) · foodLogCopyUtils.ts (dedupe)      │
│                                                                             │
│  Direct external calls:                                                     │
│    USDA FoodData Central  (api_key in bundle)  ── food search               │
│    Open Food Facts        (no key)             ── barcode lookup            │
└─────────────────────────────────────────────────────────────────────────────┘
             │  PostgREST (anon/publishable key + user JWT)      │
             ▼                                                   ▼
      ┌──────────────────────────────┐              ┌──────────────────────┐
      │  Supabase PostgreSQL         │              │  Supabase Auth       │
      │  14 tables, all RLS-enabled  │◄─── FK ──────│  auth.users          │
      │  9 updated_at triggers       │              │  email+password only │
      │  handle_new_user() trigger   │              └──────────────────────┘
      │  iso_text_date_prefix()      │
      │  generated col + partial UQ  │
      └──────────────────────────────┘
```

### 1.2 Target

```
┌──────────────────────────── React Native / Expo ────────────────────────────┐
│  Screens ──► DB.ts facade (UNCHANGED SIGNATURES) ──► apiClient.ts           │
│                                                        │  fetch + JWT       │
│              expo-sqlite cache layer  ◄────────────────┤  (kept as-is)      │
│                                                        │                    │
│  supabase.auth.*  ────────────────────────────────────┐│                    │
└───────────────────────────────────────────────────────┼┼────────────────────┘
                                                        ││
                    ┌───────────────────────────────────┘│
                    │                                    │
                    ▼                                    ▼
        ┌──────────────────────┐        ┌──────────────────────────────────┐
        │  Supabase Auth       │        │  Node API — Google Cloud Run     │
        │  (DIRECT, unchanged) │        │  min-instances ≥ 1               │
        │  issues JWT ─────────┼───────►│  · verifies JWT (JWKS)           │
        └──────────────────────┘        │  · screen-level endpoints        │
                                        │  · adaptive engine (moved)       │
                                        │  · search ranking (moved)        │
                                        │  · USDA / OFF keys (server-held) │
                                        └───────────┬──────────────────────┘
                                                    │ pg (Supavisor pooler)
                                                    │ SET LOCAL request.jwt.claims
                                                    ▼
                                        ┌──────────────────────────────────┐
                                        │  Supabase PostgreSQL             │
                                        │  RLS KEPT AND ENFORCED           │
                                        │  triggers/constraints KEPT       │
                                        │  + new transactional SQL fns     │
                                        └──────────────────────────────────┘
```

**Region rule:** Cloud Run and the Supabase project **must be in the same region**. A cross-region hop adds 30–100 ms to every single query and would erase most of the gains from collapsing requests.

---

## 2. Complete dependency inventory

### 2.1 Supabase client & configuration

| File | What it does | Disposition |
| --- | --- | --- |
| [src/API/supabase/client.ts](src/API/supabase/client.ts) | `createClient`, session helpers, `requireSupabaseSessionUser`, SecureStore adapter. `autoRefreshToken: false`, `persistSession: true`. | **Keep** (auth only). Strip the PostgREST usage. Note `autoRefreshToken:false` — the Node API will see expired JWTs; see §9.5. |
| [src/API/supabase/auth.ts](src/API/supabase/auth.ts) | `signInWithEmailPassword`, `signUpWithEmailPassword`, `signOutSupabaseSession`, `upsertSupabaseAuthUserAccount`. | **Keep in Supabase**, except `upsertSupabaseAuthUserAccount` which writes a profile → moves to Node. |
| [src/API/supabase/supabaseProfiles.ts](src/API/supabase/supabaseProfiles.ts) | `profiles` read/upsert + row↔domain mappers. | **Move to Node** (mappers stay client-side or move wholesale). |
| [src/navigation/AppNavigator.tsx:110-131](src/navigation/AppNavigator.tsx#L110-L131) | `supabase.auth.onAuthStateChange` → `hydrateUserFromDb`. | **Keep.** |

### 2.2 `supabase.from(...)` — full inventory

Legend for **Verdict**: `→Node` = move to Node API · `SQL` = becomes a SQL function/transaction · `keep` = stays direct.

#### A. `profiles` — `src/API/supabase/supabaseProfiles.ts`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 1 | [:201](src/API/supabase/supabaseProfiles.ts#L201) | `select * eq(id)` maybeSingle | App bootstrap → `getUserByExternalId`, every hydrate | R | `profiles_self_select (id = auth.uid())` | →Node `GET /v1/me` |
| 2 | [:228](src/API/supabase/supabaseProfiles.ts#L228) | `upsert onConflict:id .select().single()` | Onboarding Account step, Profile settings, adaptive apply, legacy migration | W | `profiles_self_insert` + `profiles_self_update` | →Node `PATCH /v1/me` |

**Auth assumption:** `requireAuthenticatedUser()` calls `auth.getUser()` (a network call to Supabase Auth) before each *current-user* variant. Ownership is `id = auth.uid()`, enforced purely by RLS.

#### B. `food_items` (shared catalog) — `src/store/supabaseFoodStore.ts`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 3 | [:733](src/store/supabaseFoodStore.ts#L733) | `select * in(id, ids)` | Diary micros, favorites hydration, recipe ingredient hydration | R | `food_items_read_authenticated` | →Node (internal join) |
| 4 | [:748](src/store/supabaseFoodStore.ts#L748) | `select * eq(id)` | Food detail, recents N+1 loop | R | same | →Node (internal join) |
| 5 | [:770](src/store/supabaseFoodStore.ts#L770) | `select * eq(barcode) limit 1` | Barcode scanner | R | same | →Node `GET /v1/food/barcode/:code` |
| 6 | [:1222](src/store/supabaseFoodStore.ts#L1222) | `select *` + `.or(ilike)` chain, order, limit | Food Library, Add Food search | R | same | →Node `GET /v1/food/search` |
| 7 | [:1263](src/store/supabaseFoodStore.ts#L1263) | `select id eq(id)` | `saveFoodItem` dedupe by id | R | same | →Node (internal) |
| 8 | [:1278](src/store/supabaseFoodStore.ts#L1278) | `select id eq(source,source_id)` | `saveFoodItem` dedupe | R | same | →Node (internal) |
| 9 | [:1296](src/store/supabaseFoodStore.ts#L1296) | `select id eq(source,barcode)` | `saveFoodItem` dedupe | R | same | →Node (internal) |
| 10 | [:1777](src/store/supabaseFoodStore.ts#L1777) | `insert .select("id").single()` | Save USDA/OFF/manual food into catalog | W | `food_items_insert_submitter (submitted_by_user_id = auth.uid())` | →Node `POST /v1/food/items` (idempotent) |

**Notes.** `food_items` has **no UPDATE and no DELETE policy** — normal users can never modify or remove a catalog row. `deleteFoodItem()` [:1920](src/store/supabaseFoodStore.ts#L1920) throws `"Shared Supabase catalog items are read-only in the app."`. `saveFoodItem` therefore implements *find-or-insert*: three sequential lookup queries (#7–9), then insert, then a re-read (#4). **On the current path a brand-new food costs 5 round trips.**

#### C. `user_food_favorites`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 11 | [:1954](src/store/supabaseFoodStore.ts#L1954) | `upsert onConflict:"user_id,food_item_id" ignoreDuplicates` | Favorite toggle (Add Food, Scanned Food) | W | `user_food_favorites_self_insert` — also asserts the `food_item` exists | →Node `PUT /v1/food/items/:id/favorite` |
| 12 | [:1970](src/store/supabaseFoodStore.ts#L1970) | `delete eq(user_id) eq(food_item_id)` | Unfavorite | W | `..._self_delete` | →Node `DELETE` same route |
| 13 | [:2011](src/store/supabaseFoodStore.ts#L2011) | `select food_item_id eq(user_id) order` — **background refresh** | Diary favorites strip | R | `..._self_select` | →Node, folded into `/diary/week` |
| 14 | [:2036](src/store/supabaseFoodStore.ts#L2036) | same, foreground path | Diary favorites strip, Add Food | R | same | →Node, folded |

#### D. `custom_recipes` + `custom_recipe_ingredients`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 15 | [:882](src/store/supabaseFoodStore.ts#L882) | `select * eq(id)` — **no owner predicate** | Recipe detail, recents, log-entry hydration | R | `custom_recipes_read_public_or_creator` | →Node (⚠ must add explicit predicate) |
| 16 | [:899](src/store/supabaseFoodStore.ts#L899) | `select * eq(recipe_id) order(sort_order,id)` | Recipe detail / synthetic recipe food | R | `custom_recipe_ingredients_read_visible_recipe` | →Node (single JOIN) |
| 17 | [:976](src/store/supabaseFoodStore.ts#L976) | `select * eq(created_by_user_id) order limit` | Search — **own** recipes | R | same | →Node, merged with #18 |
| 18 | [:985](src/store/supabaseFoodStore.ts#L985) | `select * eq(is_public,true) neq(created_by) order limit` | Search — **public** recipes | R | same | →Node, merged with #17 |
| 19 | [:2219](src/store/supabaseFoodStore.ts#L2219) | `select * eq(created_by_user_id) order limit` | User-Created Food Library | R | same | →Node `GET /v1/me/library` |
| 20 | [:2408](src/store/supabaseFoodStore.ts#L2408) | `insert .select("*").single()` | Create Recipe | W | `custom_recipes_insert_creator` | →Node **SQL txn** |
| 21 | [:2447](src/store/supabaseFoodStore.ts#L2447) | `insert` ingredient rows | Create Recipe | W | `custom_recipe_ingredients_modify_creator_recipe` | →Node **SQL txn** |
| 22 | [:2451](src/store/supabaseFoodStore.ts#L2451) | `delete eq(id)` — **compensating rollback** | Create Recipe failure path | W | `custom_recipes_delete_creator` | Removed by real txn |
| 23 | [:2564](src/store/supabaseFoodStore.ts#L2564) | `update ... eq(id)` — **no owner predicate** | Edit Recipe | W | `custom_recipes_update_creator` | →Node **SQL txn** ⚠ |
| 24 | [:2592](src/store/supabaseFoodStore.ts#L2592) | `delete eq(recipe_id)` — wipes all ingredients | Edit Recipe | W | ingredients modify policy | →Node **SQL txn** ⚠ |
| 25 | [:2610](src/store/supabaseFoodStore.ts#L2610) | `insert` new ingredient rows | Edit Recipe | W | same | →Node **SQL txn** |
| 26 | [:2639](src/store/supabaseFoodStore.ts#L2639) | `delete eq(id)` — **no owner predicate** | Delete Recipe | W | `custom_recipes_delete_creator` | →Node ⚠ |

> **⚠ Non-atomic edit.** `updateUserRecipe` = *update recipe* → *delete all ingredients* → *insert new ingredients* as three separate requests with **no transaction**. A failure between step 2 and 3 leaves a recipe with zero ingredients and stale denormalized `calories_per_serving`. This is a real, present bug that the migration should fix.

#### E. `custom_meals` + `custom_meal_items`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 27 | [:917](src/store/supabaseFoodStore.ts#L917) | `select * eq(id)` | Meal detail, recents, entry hydration | R | `custom_meals_read_public_or_creator` | →Node |
| 28 | [:1023](src/store/supabaseFoodStore.ts#L1023) | `select * eq(created_by_user_id)` | Search — own meals | R | same | →Node, merged |
| 29 | [:1032](src/store/supabaseFoodStore.ts#L1032) | `select * eq(is_public,true) neq(created_by)` | Search — public meals | R | same | →Node, merged |
| 30 | [:2248](src/store/supabaseFoodStore.ts#L2248) | `select * eq(created_by_user_id)` | User-Created Food Library | R | same | →Node `GET /v1/me/library` |
| 31 | [:2730](src/store/supabaseFoodStore.ts#L2730) | `insert .select("*").single()` | Create Custom Food | W | `custom_meals_insert_creator` | →Node |
| 32 | [:2865](src/store/supabaseFoodStore.ts#L2865) | `update eq(id)` — **no owner predicate** | Edit Custom Food | W | `custom_meals_update_creator` | →Node ⚠ |
| 33 | [:2908](src/store/supabaseFoodStore.ts#L2908) | `delete eq(id)` — **no owner predicate** | Delete Custom Food | W | `custom_meals_delete_creator` | →Node ⚠ |

> `custom_meal_items` has a table, indexes and two RLS policies but **the app never reads or writes it**. Custom meals are stored as flat per-serving nutrition only. Dead surface — decide whether to build it out or drop it.

#### F. `user_food_entries` (the diary — hottest table)

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 34 | [:1629](src/store/supabaseFoodStore.ts#L1629) | `select * eq(id)` — **no owner predicate** | Pre-read before every update/delete | R | `user_food_entries_self_select` | →Node ⚠ (eliminated by RETURNING) |
| 35 | [:1655](src/store/supabaseFoodStore.ts#L1655) | `select * eq(user_id) order limit(limit*6)` | Recents list — **head of an N+1** | R | same | →Node `GET /v1/food/recents` (1 query) |
| 36 | [:2983](src/store/supabaseFoodStore.ts#L2983) | `insert .select("*").single()` | Log a food | W | `..._self_insert` (validates referenced recipe/meal visibility) | →Node `POST /v1/diary/entries` |
| 37 | [:3029](src/store/supabaseFoodStore.ts#L3029) | `insert .select("*").single()` | Quick Add | W | same | →Node, same route |
| 38 | [:3092](src/store/supabaseFoodStore.ts#L3092) | `update eq(id)` — **no owner predicate** | Edit diary entry | W | `..._self_update` | →Node ⚠ |
| 39 | [:3151](src/store/supabaseFoodStore.ts#L3151) | `update eq(id) eq(entry_type,'quick_add')` | Edit quick add | W | same | →Node ⚠ |
| 40 | [:3186](src/store/supabaseFoodStore.ts#L3186) | `delete eq(id)` — **no owner predicate** | Delete diary entry | W | `..._self_delete` | →Node ⚠ |
| 41 | [:3272](src/store/supabaseFoodStore.ts#L3272) | `select * eq(user_id) gte/lte(date) order×3` — background | Diary week, Weekly Review, Home, Adaptive, Export | R | `..._self_select` | →Node, folded into screen endpoints |
| 42 | [:3309](src/store/supabaseFoodStore.ts#L3309) | same, foreground | same | R | same | →Node, folded |
| 43 | [:3548](src/store/supabaseFoodStore.ts#L3548) | `select * eq(user_id) eq(date)` — background | Single-day reads (copy/repeat) | R | same | →Node, folded |
| 44 | [:3570](src/store/supabaseFoodStore.ts#L3570) | same, foreground | same | R | same | →Node, folded |
| 45 | [:3601](src/store/supabaseFoodStore.ts#L3601) | `select * eq(user_id) eq(date,fromDate)` | Copy day / Repeat yesterday | R | same | →Node `POST /v1/diary/days/:date/copy-from` |
| 46 | [:3717](src/store/supabaseFoodStore.ts#L3717) | `insert(rows[]) .select("*")` | Copy day — bulk insert | W | `..._self_insert` | →Node, same route |

#### G. `user_diary_days`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 47 | [:1536](src/store/supabaseFoodStore.ts#L1536) | `select * eq(user_id) eq(date)` | Day-complete badge; pre-read in the cascade | R | `user_diary_days_self_all` | →Node, folded |
| 48 | [:1556](src/store/supabaseFoodStore.ts#L1556) | `select * eq(user_id) gte/lte(date) order` | Diary week strip, Weekly Review, Adaptive window | R | same | →Node, folded |
| 49 | [:1608](src/store/supabaseFoodStore.ts#L1608) | `update {is_complete:false, completed_at:null}` | **Cascade** on any diary mutation | W | same | →Node **SQL txn** |
| 50 | [:3500](src/store/supabaseFoodStore.ts#L3500) | `upsert onConflict:"user_id,date" .select().single()` | Mark day complete/incomplete | W | same | →Node `PUT /v1/diary/days/:date/complete` |

#### H. `user_settings`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 51 | [:1573](src/store/supabaseFoodStore.ts#L1573) | `update {adaptive_last_calculated_at:null} eq(user_id)` | Cascade from diary mutation | W | `user_settings_self_all` | →Node **SQL txn** |
| 52 | [userStore:374](src/store/supabaseUserStore.ts#L374) | `select * eq(user_id)` maybeSingle | Every screen that needs calorie schedule | R | same | →Node, folded into `/v1/me` + screen endpoints |
| 53 | [userStore:478](src/store/supabaseUserStore.ts#L478) | `upsert onConflict:user_id .select().single()` | Calorie Schedule, Adaptive settings, Fuel Plan | W | same | →Node `PATCH /v1/me/settings` |
| 54 | [userStore:509](src/store/supabaseUserStore.ts#L509) | `update {adaptive_last_calculated_at:null}` | After any weight write | W | same | →Node **SQL txn** |

> ⚠ **Read-modify-write race.** `upsertSupabaseUserSettings` [userStore:444](src/store/supabaseUserStore.ts#L444) does `SELECT` → merge in JS → `UPSERT` of *the whole row*. Two concurrent partial updates (e.g. Calorie Schedule + Adaptive toggle) will silently clobber each other. Fix in Node with a column-level `UPDATE ... SET x = COALESCE($1, x)`.

#### I. `weight_entries`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 55 | [userStore:614](src/store/supabaseUserStore.ts#L614) | `select * eq(user_id) eq(id)` | Pre-read before every weight write | R | `weight_entries_self_all` | →Node (eliminated by RETURNING) |
| 56 | [userStore:633](src/store/supabaseUserStore.ts#L633) | `select * eq(user_id) [is(deleted_at,null)] [gte/lte(measured_day_local)] order×2 limit` | Weight screen, Home summary, Adaptive, Export | R | same | →Node `GET /v1/weights` |
| 57 | [userStore:723](src/store/supabaseUserStore.ts#L723) | `upsert onConflict:id` | Save / soft-delete / same-day supersede / legacy import | W | same | →Node **SQL txn** |
| 58 | [userStore:868](src/store/supabaseUserStore.ts#L868) | `upsert(payload[], onConflict:id)` | Legacy local→remote weight migration | W | same | →Node one-shot import, then **delete** |
| 59 | [userStore:1433](src/store/supabaseUserStore.ts#L1433) | `select * eq(user_id) eq(measured_day_local) is(deleted_at,null) neq(id)` | Same-day supersede scan | R | same | →Node **SQL txn** |
| 60 | [userStore:1686](src/store/supabaseUserStore.ts#L1686) | `delete eq(user_id)` — **hard delete all** | Settings → clear all weight data | W | same | →Node `DELETE /v1/weights` |

#### J. `weight_goals`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 61 | [userStore:736](src/store/supabaseUserStore.ts#L736) | `select * eq(user_id)` maybeSingle | Weight screen, Home summary, Export | R | `weight_goals_self_all` | →Node, folded into `/v1/me` |
| 62 | [userStore:773](src/store/supabaseUserStore.ts#L773) | `upsert onConflict:user_id .select().single()` | Set goal weight | W | same | →Node `PUT /v1/me/weight-goal` |
| 63 | [userStore:1666](src/store/supabaseUserStore.ts#L1666) | `delete eq(user_id)` | Clear goal | W | same | →Node `DELETE` same route |
| 64 | [userStore:1695](src/store/supabaseUserStore.ts#L1695) | `delete eq(user_id)` | Clear all weight data | W | same | →Node, part of #60 |

#### K. `adaptive_calorie_recommendations`

| # | Line | Operation | Screen / feature | R/W | RLS policy | Verdict |
|---|---|---|---|---|---|---|
| 65 | [foodStore:1586](src/store/supabaseFoodStore.ts#L1586) | `update {status:'superseded'} eq(user_id) eq(status,'proposed')` | Cascade from diary mutation | W | `adaptive_calorie_recommendations_self_all` | →Node **SQL txn** |
| 66 | [userStore:1070](src/store/supabaseUserStore.ts#L1070) | `select * eq(user_id) [eq(status)] order limit` — background | Diary banner, More, Weekly Review | R | same | →Node, folded |
| 67 | [userStore:1095](src/store/supabaseUserStore.ts#L1095) | same, foreground | same | R | same | →Node, folded |
| 68 | [userStore:1168](src/store/supabaseUserStore.ts#L1168) | `update {status:'superseded'} eq(user_id) eq(status,'proposed')` | Before creating a new recommendation | W | same | →Node **SQL txn** |
| 69 | [userStore:1182](src/store/supabaseUserStore.ts#L1182) | `insert .select("*").single()` | Adaptive engine output | W | same | →Node **SQL txn** |
| 70 | [userStore:1269](src/store/supabaseUserStore.ts#L1269) | `update eq(user_id) eq(id) .select().maybeSingle()` | Accept / reject / apply / supersede | W | same | →Node `POST /v1/adaptive/recommendations/:id/:action` |

> ⚠ **Race against a unique index.** Steps #68 → #69 are two separate requests guarded by `ux_adaptive_calorie_recommendations_one_open`. The code catches `23505` and re-reads [userStore:1273](src/store/supabaseUserStore.ts#L1273) — a workaround for the missing transaction. A SQL function makes this correct by construction.

#### L. `activities`

Table exists (columns, index, `activities_self_all` RLS policy). **Never referenced by the app.** Dead — drop it or keep it as a reserved surface, but do not build an endpoint for it.

### 2.3 Direct external API calls from the mobile app

| Service | File | Auth | Called from | Verdict |
| --- | --- | --- | --- | --- |
| **USDA FoodData Central** `POST https://api.nal.usda.gov/fdc/v1/foods/search` | [src/API/USDA/usdaEndpoints.ts:48-92](src/API/USDA/usdaEndpoints.ts#L48-L92) | `api_key` query param from `EXPO_PUBLIC_USDA_API_KEY` — **shipped in the JS bundle** | [foodSearch.ts:365](src/screens/Food/foodSearch.ts#L365) → Add Food, Create Recipe, Create Food Item | **Move to Node.** Key becomes a Cloud Run secret. Adds server-side response caching into `food_items`. |
| **Open Food Facts** `GET https://world.openfoodfacts.org/api/v2/product/:barcode` | [src/API/OpenFoods/openFoodsEndpoints.ts:23](src/API/OpenFoods/openFoodsEndpoints.ts#L23) | none | [FoodBarcodeScannerShared.tsx:166](src/screens/Food/FoodBarcodeScannerShared.tsx#L166) | **Move to Node** (fold into `GET /v1/food/barcode/:code`). No key, but server-side caching + normalization is a real win. |

Shared `axios` instance: [src/API/axios.client.ts](src/API/axios.client.ts) — 5 s timeout, no retry, no auth interceptor.

### 2.4 Caching / data-fetching layer

**There is no React Query, SWR, Apollo, or RTK Query.** The app hand-rolls a local-first cache:

| Layer | File | Role |
| --- | --- | --- |
| SQLite schema + migrations | [src/storage/sqlite.ts](src/storage/sqlite.ts) | Versioned `expo-sqlite` migrations, `app_kv`, cache tables |
| Cache repository | [src/store/cacheRepository.ts](src/store/cacheRepository.ts) (1395 L) | 30 exported cache ops: food items, search results, barcode hit/miss, food-log entries, favorites, diary-day statuses, adaptive recs, home summary, eviction, `getCacheHealth` |
| Expo-Go-only local repos | `foodRepository`, `foodLogRepository`, `recipeRepository`, `weightRepository`, `userRepository`, `userSettingsRepository` | Full offline implementations used **only** when `shouldUseExpoGoDevLocalStore()` is true |
| Key/value + session prefs | [src/storage/localStore.ts](src/storage/localStore.ts) | Onboarding flags, local account, recent searches, last-seen recommendation id |
| In-memory memoization | [homeDashboardSummary.ts:34](src/screens/Home/homeDashboardSummary.ts#L34), [addFoodStaticListsCache.ts:13](src/screens/Food/addFoodStaticListsCache.ts#L13) | Per-process snapshot + in-flight coalescing |
| Change events | [src/store/dataChangeEvents.ts](src/store/dataChangeEvents.ts) | `food_log` / `weight` notifications drive re-fetch |
| Perf instrumentation | [src/performance/diaryPerformance.ts](src/performance/diaryPerformance.ts) | Traces every request with a `DiaryPerfRequestSource` of `sqlite` / `supabase` / `background-supabase` / `logical` |

**The universal read pattern** (in every store function):

```
1. resolve session user             (SecureStore, local)
2. read local SQLite cache
3. if cache non-empty  → return immediately,
                         fire a background Supabase refresh (void, errors swallowed)
4. if cache empty      → await Supabase, write cache, return
```

**Migration implication:** this whole layer is **transport-agnostic**. Swapping PostgREST for `fetch(NODE_API)` inside steps 3–4 leaves the cache, the perf traces, and every screen untouched. Keep it. The `DiaryPerfRequestSource` union gains a `"node-api"` member and the existing traces become your before/after benchmark for free.

### 2.5 Environment variables & secrets

| Variable | Where | Value shipped to device? | Target |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | [.env](.env), [client.ts:18](src/API/supabase/client.ts#L18) | **Yes** | Keep (Auth only) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | [.env](.env), [client.ts:15](src/API/supabase/client.ts#L15) | **Yes** — safe by design (RLS-gated) | Keep (Auth only) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | fallback at [client.ts:16](src/API/supabase/client.ts#L16); still in `.env.example` | **Yes** | Keep as fallback; drop from `.env.example` |
| `EXPO_PUBLIC_USDA_API_KEY` | [.env](.env), [usdaEndpoints.ts:52](src/API/USDA/usdaEndpoints.ts#L52) | **Yes — real key, extractable from any APK/IPA** | **Move to Cloud Run secret. Rotate the current key.** |
| *(new)* `EXPO_PUBLIC_API_BASE_URL` | — | Yes (not a secret) | Cloud Run URL |
| *(new)* `SUPABASE_DB_URL`, `SUPABASE_JWT_JWKS_URL`, `USDA_API_KEY` | — | **No** | Cloud Run / Secret Manager only |

`.env` **is** gitignored (twice, at the bottom of [.gitignore](.gitignore)). `.env.example` is committed and contains only placeholders. Build-time injection is `EXPO_PUBLIC_*` inlining by Metro — **any `EXPO_PUBLIC_` value is public**.

---

## 3. Tables containing user-owned data

| Table | Ownership column | Kind | Cross-user readable? |
| --- | --- | --- | --- |
| `profiles` | `id` (= `auth.uid()`) | direct | No |
| `user_settings` | `user_id` | direct | No |
| `user_food_favorites` | `user_id` (composite PK with `food_item_id`) | direct | No |
| `custom_recipes` | `created_by_user_id` | direct | **Yes** when `is_public = true` |
| `custom_recipe_ingredients` | *(none)* → via `recipe_id` | **indirect** | Yes, inherits parent visibility |
| `custom_meals` | `created_by_user_id` | direct | **Yes** when `is_public = true` |
| `custom_meal_items` | *(none)* → via `meal_id` | **indirect** | Yes, inherits parent |
| `user_food_entries` | `user_id` | direct | No |
| `user_diary_days` | `user_id` (composite PK with `date`) | direct | No |
| `weight_entries` | `user_id` | direct | No |
| `weight_goals` | `user_id` (PK) | direct | No |
| `activities` | `user_id` | direct (**unused**) | No |
| `adaptive_calorie_recommendations` | `user_id` | direct | No |
| `food_items` | `submitted_by_user_id` — **attribution, not ownership** | shared catalog | **Yes, to every authenticated user** |

### Cross-user / admin operations

* **Public recipe & meal browsing** — the only genuine cross-user read. Implemented as *two* queries per entity type (own + public, then merged and truncated client-side): [foodStore:963](src/store/supabaseFoodStore.ts#L963) and [foodStore:1010](src/store/supabaseFoodStore.ts#L1010). One SQL `WHERE is_public OR created_by_user_id = $me` replaces both.
* **Shared `food_items` catalog** — insert-only for users; anyone signed in can read everything.
* **There are no admin operations, no service-role usage, and no elevated roles anywhere in the app.** The only privilege escalation in the system is the `SECURITY DEFINER` function `handle_new_user()`.
* **There is no way to correct a bad catalog row.** No UPDATE/DELETE policy on `food_items`, and the app throws on delete. A Node service using an admin-scoped path could finally provide moderation — a genuine new capability, not just a port.

---

## 4. Database constraints that currently protect correctness

**Keep every one of these.** They are the correctness floor and must not be replaced by application checks.

| Constraint | Table | Protects |
| --- | --- | --- |
| `user_food_entries_target_matches_type` | `user_food_entries` | Exactly one of `food_item_id` / `custom_recipe_id` / `custom_meal_id` is set, matching `entry_type`; `quick_add` has none |
| `ux_weight_entries_one_active_per_local_day` (partial UQ on generated col, `WHERE deleted_at IS NULL`) | `weight_entries` | At most one active weigh-in per local calendar day |
| `ux_weight_entries_user_client_generated_id` | `weight_entries` | **Idempotency key** — safe retries |
| `ux_adaptive_calorie_recommendations_one_open` (partial UQ `WHERE status='proposed'`) | `adaptive_calorie_recommendations` | At most one open recommendation per user |
| `ux_food_items_source_source_id` / `ux_food_items_source_barcode` (partial UQ) | `food_items` | Catalog de-duplication across USDA/OFF imports |
| `measured_day_local` — `GENERATED ALWAYS AS (public.iso_text_date_prefix(measured_at_local_iso)) STORED` | `weight_entries` | Timezone-correct local-day bucketing; the column the partial UQ and range filters use |
| `user_settings_hours_valid` (`end_hour > start_hour`) | `user_settings` | Legacy diary-window sanity |
| `amount_value > 0` | entries / ingredients / meal items | No zero or negative quantities |
| `servings > 0` | recipes / meals | No division by zero in per-serving math |
| `CHECK (... IN ...)` enums | `gender`, `protein_focus`, `goal_strategy`, `nutrition_basis`, `source`, `entry_type`, `adaptive_mode`, `status`, `confidence`, `sync_status`, `unit_original='kg'` | Value-domain integrity |
| `jsonb_typeof(...) = 'array'` | `profiles.training_types`, `user_settings.daily_calorie_overrides`, `custom_recipes.steps`, `weight_entries.tags` | JSONB shape |
| `ON DELETE CASCADE` on `profiles(id)` | all user tables | Account deletion cleans up |
| `ON DELETE SET NULL` on `user_food_entries.food_item_id` / `custom_recipe_id` / `custom_meal_id` | `user_food_entries` | Deleting a recipe does not destroy diary history (snapshot values survive) |

### Triggers & functions

| Object | Type | Keep? |
| --- | --- | --- |
| `set_updated_at()` + 9 `BEFORE UPDATE` triggers | `profiles`, `user_settings`, `food_items`, `custom_recipes`, `custom_meals`, `weight_entries`, `user_diary_days`, `weight_goals`, `adaptive_calorie_recommendations` | **Keep** |
| `iso_text_date_prefix(text) → date` (`IMMUTABLE`) | required by the generated column | **Keep — cannot move** |
| `handle_new_user()` (`SECURITY DEFINER`) + `on_auth_user_created` on `auth.users` | auto-creates a `profiles` row on signup | **Keep** (see conflict note below) |

> **Missing `updated_at`.** `user_food_entries`, `custom_recipe_ingredients`, `custom_meal_items`, `user_food_favorites` and `activities` have only `created_at` and no update trigger. If you ever want **delta sync** (`?since=`) through the Node API — and you should — add `updated_at` + triggers to at least `user_food_entries` first.

> **Behavioural conflict to resolve.** The DB trigger `handle_new_user()` inserts a `profiles` row on every signup, but [auth.ts:170-175](src/API/supabase/auth.ts#L170-L175) refuses to sign a user in when `DB.getUserByExternalId()` finds nothing and throws *"No app account exists for this email yet."* The two sources of truth disagree about when a profile exists. Decide explicitly in the Node design: either the trigger owns creation (and the app stops asserting), or drop the trigger and let `POST /v1/onboarding/complete` be the only creator.

---

## 5. Business rules enforced **only** in React Native

Every item below is currently unenforceable server-side. A modified client, a replayed request, or a future second client can violate all of them.

| # | Rule | Where | Risk if violated |
| --- | --- | --- | --- |
| 1 | **Entire adaptive TDEE algorithm** — 28-day window, ≥14 complete days, ≥5 weigh-ins, ≥14-day span, EMA weight trend, 7700 kcal/kg, max ±150 kcal/day shift, ≥100 kcal min delta, confidence tiers | [engine/adaptiveCalories.ts](src/engine/adaptiveCalories.ts) (573 L) | Arbitrary `recommended_base_calories` can be written; DB has no bounds check |
| 2 | **7-day recalculation cadence** | [adaptiveCaloriesActions.ts:27-52](src/screens/User_Settings/adaptiveCaloriesActions.ts#L27-L52) | Unbounded recompute |
| 3 | **Calorie target clamp 800–7000, step 50** | [calorieTargets.ts:40-64](src/engine/calorieTargets.ts#L40-L64) | `profiles.calorie_allowance` is a bare `integer` with **no CHECK** — a dangerous target can be persisted |
| 4 | **Macro target derivation** from protein focus (g/kg) + goal strategy offsets | [calorieTargets.ts:134-224](src/engine/calorieTargets.ts#L134-L224), [proteinFocus.ts](src/engine/proteinFocus.ts), [goalStrategy.ts](src/engine/goalStrategy.ts) | Macros can drift from calories |
| 5 | **Resolved-serving & nutrition scaling** (the single calculation path per [docs/food-tracking-data-model.md](docs/food-tracking-data-model.md)) | [engine/nutrition.ts](src/engine/nutrition.ts) | Entry `calories`/macros are **stored denormalized**; the server never validates them against the food |
| 6 | **Recipe per-serving nutrition + weight metrics** | `buildRecipeNutrition` / `buildRecipeWeightMetrics`, [foodStore:~600-705](src/store/supabaseFoodStore.ts#L600-L705) | `custom_recipes.calories_per_serving` is stored and trusted with zero server validation |
| 7 | **Copy/repeat duplicate detection** — key includes second-precision timestamp and the full quick-add nutrition shape | [foodLogCopyUtils.ts](src/store/foodLogCopyUtils.ts) | Duplicate diary rows |
| 8 | **Diary-mutation cascade**: any entry write → un-complete the day → null `adaptive_last_calculated_at` → supersede open recommendation. **Three separate requests, no transaction** | [foodStore:1599-1621](src/store/supabaseFoodStore.ts#L1599-L1621) | Process death mid-cascade leaves a "complete" day containing an unaccounted entry, or a live recommendation built on stale data |
| 9 | **One weigh-in per local day** — the client loops and soft-deletes same-day rows before upserting | [userStore:1424-1462](src/store/supabaseUserStore.ts#L1424-L1462) | Partially protected: the partial UQ index will *reject* a second active row, but the client is what actually produces the soft-deletes |
| 10 | **Search ranking, scoring and dedupe** (~250 lines of heuristics) | [foodSearch.ts:148-345](src/screens/Food/foodSearch.ts#L148-L345) | Not a security rule, but result quality is unversionable and untestable server-side |
| 11 | **`provider === 'email'` enforcement** | [client.ts:24-27](src/API/supabase/client.ts#L24-L27), [auth.ts:41-50](src/API/supabase/auth.ts#L41-L50) | OAuth users could be admitted if the check is bypassed |
| 12 | **Recipe / meal ownership on edit & delete** | [foodStore:2535](src/store/supabaseFoodStore.ts#L2535), [:2628](src/store/supabaseFoodStore.ts#L2628), [:2848](src/store/supabaseFoodStore.ts#L2848), [:2900](src/store/supabaseFoodStore.ts#L2900) | Belt-and-braces only — **RLS is the real enforcement** |
| 13 | **Recipe/meal visibility filter** `canAccessOwnedOrPublicRow` | [foodStore:940](src/store/supabaseFoodStore.ts#L940) | Mirrors RLS; redundant today, load-bearing the moment RLS is bypassed |

---

## 6. Business rules enforced **only** through RLS

**These are the rules that break silently if the Node API connects with the service-role key.**

| # | Rule | Policy |
| --- | --- | --- |
| 1 | **Per-user row isolation** on all 12 private tables | `*_self_select` / `*_self_all` |
| 2 | **`food_items` is immutable to users** — no UPDATE and no DELETE policy exists at all | absence of policy |
| 3 | **`food_items.submitted_by_user_id` must equal the inserter** | `food_items_insert_submitter` |
| 4 | **Recipe/meal visibility** = `is_public OR created_by_user_id = auth.uid()` | `custom_recipes_read_public_or_creator`, `custom_meals_read_public_or_creator` |
| 5 | **Ingredient/meal-item visibility inherits the parent**, via `EXISTS` subquery | `custom_recipe_ingredients_read_visible_recipe`, `custom_meal_items_read_visible_meal` |
| 6 | **Ingredients are writable only by the recipe's creator** | `custom_recipe_ingredients_modify_creator_recipe` |
| 7 | **⭐ Referential authorization on diary writes** — a `user_food_entries` INSERT/UPDATE is rejected unless the referenced `food_item` exists, or the referenced recipe/meal is *visible to this user*. Non-trivial logic that exists **nowhere else in the codebase**. | `user_food_entries_self_insert`, `user_food_entries_self_update` |
| 8 | **Favorites can only point at real catalog rows** | `user_food_favorites_self_insert` (`EXISTS` on `food_items`) |

**Requirement:** if Node uses service-role, rules 2, 3, 4, 5, 6, 7 and 8 must be **re-implemented as explicit SQL predicates in every query** and covered by tests. Rule 7 in particular is easy to forget and directly enables writing diary entries that reference another user's private recipe.

---

## 7. Performance: why a 1:1 proxy makes this worse

### 7.1 Measured request counts today

Counted from the call graph. "Cold" = local SQLite cache empty (first launch, post-logout, cache eviction, or a forced refresh).

| Flow | Supabase requests (cold) | Serial? | Notes |
| --- | --- | --- | --- |
| **Food Diary screen** | **7 – 40+** | **partly serial** | favorites (2) + recents (**1 + N, serial loop**) + settings (1) + week entries (1) + week statuses (1) + profile (1) |
| ↳ `getRecentSupabaseItems` [foodStore:1641](src/store/supabaseFoodStore.ts#L1641) | **1 + up to 36** | **fully serial `for` loop** | 1 entry query, then per distinct entry: 1 for a food, **3 for a recipe** (recipe + ingredients + ingredient foods) |
| **Add Food screen static lists** | **8 – 44** | partly serial | profile (1) + recipes (2) + meals (2) + recents (1+N) + favorites (2) |
| **Adaptive refresh** (background, on diary focus) | **11 – 13** | **fully serial phases** | user, settings, latest rec, diary days, entries, weights, save-settings (2), supersede+insert (2), re-read settings (2) |
| **Weekly Review** | **6** | parallel | settings, entries, statuses, weights, proposed rec, latest rec |
| **Home dashboard** | **5** | parallel | entries, foods-by-ids, settings, weights, goal |
| **Save a weight entry** | **6 – 10** | **fully serial** | legacy migration probe, fetch-by-id, same-day scan, N soft-delete upserts, main upsert, re-read, invalidate adaptive |
| **Log one food** | **2 – 6** | serial | (food lookup) + insert + day pre-read [+ un-complete + null adaptive ts + supersede] |
| **Copy a day** | **4 – 7** | serial | source select, dest select, bulk insert, cascade |
| **Save a new catalog food** | **5** | **fully serial** | 3 dedupe lookups + insert + re-read |
| **Cold food search** | **5** + 1 external | parallel | catalog + own recipes + public recipes + own meals + public meals, plus USDA |
| **Data export** | **4** | parallel | settings, goal, weights, full food log |

### 7.2 The arithmetic

Let `R_direct` = RN→Supabase RTT, `R_hop` = RN→CloudRun RTT, `R_db` = CloudRun→Postgres RTT (same region ≈ 1–5 ms).

* **Today:** `N × R_direct`
* **1:1 proxy:** `N × (R_hop + R_db)` ≈ `N × R_direct + N × R_db` — **strictly worse for every N**, plus Cloud Run cold-start risk.
* **Collapsed:** `1 × (R_hop + k × R_db)` — one mobile round trip, `k` cheap in-region DB queries.

On the Food Diary at N ≈ 20 and `R_direct` ≈ 120 ms, today's ~2.4 s of network becomes **~0.15 s**. A 1:1 proxy would push it *past* 2.4 s.

**Rule for this migration: no endpoint may exist that maps 1:1 onto a single `.from()` call that a screen used to make. Every endpoint is a screen or a domain operation.**

### 7.3 Cloud Run specifics

| Item | Requirement | Why |
| --- | --- | --- |
| Region | **Same as the Supabase project** | Cross-region adds 30–100 ms per DB query — multiplied by `k` |
| `min-instances` | **≥ 1** | Node cold start 1–3 s would dwarf every gain |
| Concurrency | 80 (default) is fine | Node is I/O-bound here |
| DB connections | **Supavisor / pgBouncer transaction pooling**, small per-instance pool | Cloud Run scales horizontally; direct Postgres connections will exhaust the limit |
| HTTP | HTTP/2, keep-alive to the client | Amortizes TLS across the session |
| Compression | gzip/br responses | The diary week payload is large (every entry carries a full nutrition snapshot) |

---

## 8. Proposed API endpoint matrix

`Collapses` = number of current Supabase requests folded into one call.

### 8.1 Screen-level (the whole point of the migration)

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/diary/week?start=&end=` → `{ entries, dayStatuses, settings, favorites, recents, adaptiveBanner }` | Food Diary `loadData` + `loadWeekData` | **7 → 40+ ⇒ 1** | **High** — needs the recents N+1 rewritten as one JOIN |
| `GET` | `/v1/home/summary?date=` → `{ calorieTarget, todayTotals, todayMicros, trackedMicronutrientCount, currentWeightKg, sevenDayAverageWeightKg, goalProgressPercent }` | `homeDashboardSummary` + `homeNutrition` | **5 ⇒ 1** | Medium — moves micronutrient aggregation server-side |
| `GET` | `/v1/weekly-review?start=&end=` | `WeeklyReviewScreen` | **6 ⇒ 1** | Low |
| `GET` | `/v1/food/add-screen?query=` → `{ recents, favorites, recipes, customMeals, results }` | `addFoodStaticListsCache` + `AddFoodScreen` | **8 → 44 ⇒ 1** | Medium |
| `GET` | `/v1/me` → `{ profile, settings, weightGoal }` | `getUserByExternalId` + `getUserSettings` + `getWeightGoal` | **3 ⇒ 1** | Low |
| `GET` | `/v1/export` → full backup JSON | `DataExportScreen.loadAll` | **4 ⇒ 1** | Low |

### 8.2 Food catalog & search

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/food/search?q=&limit=` — catalog + own/public recipes + own/public meals + **USDA**, ranked server-side | `searchFoodItems` + `fetchVisibleRecipeRows` + `fetchVisibleMealRows` + `usdaAPI.getFood` | **5 + 1 external ⇒ 1** | **High** — port ~250 lines of ranking; replace `.or(ilike)` chains with real FTS/`pg_trgm` |
| `GET` | `/v1/food/barcode/:code` — catalog → OFF fallback → auto-insert → return | `getFoodItemByBarcode` + `openFoodsAPI.getByBarcode` + `saveFoodItem` | **2 + 1 external ⇒ 1** | Medium |
| `GET` | `/v1/food/items/:id` | `getFoodItemById` (incl. synthetic recipe/meal ids) | 1–3 ⇒ 1 | Medium — synthetic-id offsets (`SYNTHETIC_MEAL_FOOD_ID_OFFSET`) must move server-side |
| `POST` | `/v1/food/items` — idempotent find-or-insert | `saveFoodItem` | **5 ⇒ 1** | Low — one `INSERT … ON CONFLICT DO NOTHING RETURNING` |
| `PUT`/`DELETE` | `/v1/food/items/:id/favorite` | `setFoodItemFavorite` | 1 ⇒ 1 | Low |

### 8.3 Diary

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/diary/entries` (food **and** quick-add) → `{ entry, dayStatus, adaptiveSuperseded }` | `addUserFoodLog` / `addQuickAddFoodLog` + cascade | **2–6 ⇒ 1** | Medium — **must be a transaction** |
| `PATCH` | `/v1/diary/entries/:id` | `updateUserFoodLog` / `updateQuickAddFoodLog` | **4–7 ⇒ 1** | Medium — ⚠ add `user_id` predicate |
| `DELETE` | `/v1/diary/entries/:id` | `deleteUserFoodLog` | **3–6 ⇒ 1** | Medium — ⚠ add `user_id` predicate |
| `GET` | `/v1/diary/days/:date/entries` | `getUserFoodLogEntriesByDate` | 1 ⇒ 1 | Low |
| `POST` | `/v1/diary/days/:date/copy-from` `{ fromDate }` → `{ copied, skippedDuplicates, ... }` | `copyFoodLogsFromDate` + dedupe | **4–7 ⇒ 1** | **High** — dedupe logic must move server-side |
| `PUT` | `/v1/diary/days/:date/complete` `{ isComplete }` → `{ dayStatus, recommendation }` | `saveDiaryDayStatus` + `refreshAdaptive…` | **~15 ⇒ 1** | **High** |

### 8.4 Weight

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/weights?start=&end=&includeDeleted=` | `listWeightEntries(Between)` | 1 ⇒ 1 | Low |
| `POST` | `/v1/weights` — idempotent on `client_generated_id`, supersedes same-day, invalidates adaptive | `saveWeightEntry` | **6–10 ⇒ 1** | **High** — **must be a transaction** |
| `DELETE` | `/v1/weights/:id` (soft) | `softDeleteWeightEntry` | 4 ⇒ 1 | Medium |
| `DELETE` | `/v1/weights` (clear all + goal) | `clearAllWeightData` | 2 ⇒ 1 | Low |
| `PUT`/`DELETE` | `/v1/me/weight-goal` | `saveWeightGoal` / `clearWeightGoal` | 2 ⇒ 1 | Low |

### 8.5 Profile, settings, adaptive

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `PATCH` | `/v1/me` | `upsertUser` → `upsertSupabaseProfile` | 2 ⇒ 1 | Low — fix the clamp (rule 5.3) here |
| `PATCH` | `/v1/me/settings` — **column-level**, not whole-row upsert | `saveUserSettings` | **2 ⇒ 1** | Medium — fixes the lost-update race |
| `POST` | `/v1/onboarding/complete` — profile + settings + first weight, atomically | `AccountScreen.completeOnboardingAccount` | 3+ ⇒ 1 | Medium |
| `GET` | `/v1/adaptive/recommendations?status=&limit=` | `listAdaptiveCalorieRecommendations` | 1 ⇒ 1 | Low |
| `POST` | `/v1/adaptive/refresh` — **whole engine server-side** | `refreshAdaptiveRecommendationForUser` | **11–13 ⇒ 1** | **Very high** — port 573 lines + `weightUtils` EMA |
| `POST` | `/v1/adaptive/recommendations/:id/apply` → returns updated profile | `applyAdaptiveRecommendationForUser` | **5 ⇒ 1** | Medium — **must be a transaction** |
| `POST` | `/v1/adaptive/recommendations/:id/reject` | `rejectAdaptive…` | 2 ⇒ 1 | Low |

### 8.6 Library / recipes / meals

| Method | Endpoint | Replaces | Collapses | Complexity |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/me/library` → `{ recipes, customMeals }` | `listUserCreatedRecipeFoods` + `listUserCreatedCustomMealFoods` | **2 ⇒ 1** | Low |
| `GET` | `/v1/recipes/:id` → recipe + ingredients + hydrated foods | `getUserRecipeDetailsById` | **3 ⇒ 1** | Medium |
| `POST` | `/v1/recipes` | `createUserRecipe` | **2–3 ⇒ 1** | Medium — **transaction**, removes compensating delete |
| `PUT` | `/v1/recipes/:id` | `updateUserRecipe` | **5–6 ⇒ 1** | **High** — **transaction**, fixes the non-atomic ingredient wipe |
| `DELETE` | `/v1/recipes/:id` | `deleteUserRecipe` | 2 ⇒ 1 | Low — ⚠ add owner predicate |
| `POST`/`PUT`/`DELETE` | `/v1/meals[/:id]` | `create/update/deleteUserCustomMeal` | 2–3 ⇒ 1 | Low — ⚠ add owner predicate |

### 8.7 Transactional SQL functions to add

None exist today. These six client-side sequences should become `plpgsql` functions (or Node-managed `BEGIN…COMMIT`) — **SQL-side is preferable** because each is a tight multi-statement unit over a single user's rows.

| Function | Wraps | Fixes |
| --- | --- | --- |
| `log_diary_entry(...)` | insert entry + un-complete day + null adaptive ts + supersede open rec | Rule 5.8 cascade |
| `copy_diary_day(...)` | read source + dedupe + bulk insert + cascade | Partial copies |
| `save_weight_entry(...)` | supersede same-day + upsert + invalidate adaptive | Rule 5.9, 6–10 round trips |
| `upsert_recipe_with_ingredients(...)` | recipe upsert + ingredient replace | Recipe-with-zero-ingredients bug |
| `create_adaptive_recommendation(...)` | supersede + insert | `23505` race workaround |
| `apply_adaptive_recommendation(...)` | update profile + settings + mark applied | Partial application |

---

## 9. Security & RLS considerations

### 9.1 🔴 The critical decision: how does Node connect to Postgres?

| Option | Isolation | Complexity | Verdict |
| --- | --- | --- | --- |
| **A. Per-request user JWT** — pass the caller's JWT so `auth.uid()` resolves and **all 8 RLS rules from §6 keep working unchanged** | **Automatic** | Low | ✅ **Recommended for phases 1–4** |
| **B. Service role + explicit predicates** — full-privilege connection; every query must hand-write `user_id = $1` and re-implement §6 rules 2–8 | **Manual, easy to get wrong** | High | Only where A is impossible (e.g. moderation) |
| **C. Hybrid** — A by default, B for a small audited admin surface | Best | Medium | ✅ **Recommended end state** |

**Concretely, under option B these six call sites become IDORs on day one** (they filter by `id` with no `user_id`):

| Call site | Operation |
| --- | --- |
| [foodStore:1629](src/store/supabaseFoodStore.ts#L1629) | read any diary entry |
| [foodStore:3092](src/store/supabaseFoodStore.ts#L3092) | update any diary entry |
| [foodStore:3186](src/store/supabaseFoodStore.ts#L3186) | delete any diary entry |
| [foodStore:2564](src/store/supabaseFoodStore.ts#L2564) / [:2639](src/store/supabaseFoodStore.ts#L2639) | update / delete any recipe |
| [foodStore:2865](src/store/supabaseFoodStore.ts#L2865) / [:2908](src/store/supabaseFoodStore.ts#L2908) | update / delete any custom meal |
| [foodStore:882](src/store/supabaseFoodStore.ts#L882) / [:917](src/store/supabaseFoodStore.ts#L917) | read any recipe / meal, ignoring `is_public` |

**Whatever you choose, keep RLS enabled.** It costs nothing under option A and is defence in depth under B.

### 9.2 🔴 USDA API key exposure

`EXPO_PUBLIC_USDA_API_KEY` is inlined into the JS bundle by Metro and is trivially extractable from a shipped APK/IPA. It is currently a live key in [.env](.env). **Rotate it and move it to a Cloud Run secret.**

### 9.3 JWT verification in Node

* Verify against the Supabase project **JWKS** endpoint (cache the keys), not a shared secret.
* Check `exp`, `aud`, `iss`.
* Derive `user_id` **only** from the verified `sub` claim. Never trust a `userExternalId` from the request body — the current client sends it in nearly every call (`DB.getUserSettings(user.externalId)`, `addUserFoodLog({ userExternalId, … })`, …).
* Re-implement the `provider === 'email'` gate (rule 5.11) as a claim check.

### 9.4 Preserve the RLS semantics the app depends on

Regardless of connection strategy, these must hold at the API boundary:

1. `user_food_entries` writes validate that a referenced recipe/meal is **visible to the caller** (`is_public OR creator`).
2. `food_items` remain **insert-only** for user-scoped routes; `submitted_by_user_id` is set from the JWT, never from the body.
3. Recipe/meal reads honour `is_public OR created_by_user_id = caller`.
4. Ingredient/meal-item access derives from the parent's visibility.
5. Favorites reference an existing `food_items` row.

### 9.5 Token refresh

The client sets `autoRefreshToken: false` ([client.ts:61](src/API/supabase/client.ts#L61)). Today PostgREST accepts the stored token until it expires and the user is bounced to login. With a Node API in front you must decide explicitly: enable `autoRefreshToken`, or have the API return a distinguishable `401 token_expired` that the client handles by refreshing. **Do not leave this implicit** — it is the most likely source of "randomly logged out" reports after the cutover.

### 9.6 Other

* **Rate limiting** — none exists today (Supabase provides some). Add per-user limits on `/v1/food/search` (proxies a rate-limited USDA key) and on write routes.
* **Input validation** — the client validates food nutrition, quantities and calorie clamps. Re-validate everything server-side (zod/valibot at the boundary).
* **Expo Go dev bypass** — [expoGoDevAuth.ts](src/dev/expoGoDevAuth.ts) is `__DEV__ && isRunningInExpoGo()`-gated and touches only local SQLite; it never reaches Supabase. Confirm the Node client path preserves the same short-circuit so Expo Go keeps working offline.
* **Developer account** — `dev@dev.dev` ([developerAccount.ts](src/dev/developerAccount.ts)) gates UI only, no data privilege. Keep it client-side; do **not** turn it into a server role.
* **PII** — email, birthdate, gender, height, weight history, full food diary. Health-adjacent. Log user ids, never payloads; scrub before any APM.

---

## 10. Migration order

Each phase is independently shippable and independently revertable. Ship the Node route behind a per-domain feature flag in the client, keeping the Supabase path alive until the flag flips.

### Phase 0 — Foundations (no client change)
1. Move `docs/supabase-schema.sql` into a real migration tool (Supabase CLI or Atlas/Sqitch). **Nothing else in the migration is safe without this.**
2. Add `updated_at` + `set_updated_at` triggers to `user_food_entries` (unblocks delta sync).
3. Decide and document the connection strategy from §9.1.
4. Scaffold the Node service: Cloud Run (same region, `min-instances=1`), Supavisor pooling, JWKS verification, structured logging, `/healthz`.
5. Add a shared `apiClient.ts` in the app + `EXPO_PUBLIC_API_BASE_URL`; extend `DiaryPerfRequestSource` with `"node-api"`.
6. **Capture a baseline** with the existing perf traces — Diary cold/warm, Add Food, Weekly Review, Home. This is your before/after evidence.

### Phase 1 — Read-only, low risk *(prove the architecture)*
`GET /v1/me` · `GET /v1/weekly-review` · `GET /v1/export` · `GET /v1/me/library`
Pure reads, easy rollback, immediately collapses 3+6+4+2 = **15 requests into 4**.

### Phase 2 — Secrets off the device *(highest security value)*
`GET /v1/food/search` · `GET /v1/food/barcode/:code` · `POST /v1/food/items`
Rotate the USDA key. Port ranking from [foodSearch.ts](src/screens/Food/foodSearch.ts). Replace the `.or(ilike)` chains with `pg_trgm`/FTS. Add server-side caching of USDA and OFF responses into `food_items`.

### Phase 3 — The hot screens *(highest performance value)*
`GET /v1/diary/week` · `GET /v1/home/summary` · `GET /v1/food/add-screen`
Rewrite the recents N+1 as a single JOIN. Expect the biggest measurable win here.

### Phase 4 — Writes + transactions
`POST/PATCH/DELETE /v1/diary/entries` · `POST /v1/diary/days/:date/copy-from` · `PUT /v1/diary/days/:date/complete` · `POST /v1/weights` · recipes & meals CRUD · `PATCH /v1/me/settings`
Introduce the six SQL functions from §8.7. Fixes the non-atomic recipe edit, the settings lost-update, and the cascade.

### Phase 5 — The adaptive engine
`POST /v1/adaptive/refresh` · `/apply` · `/reject`
Port [adaptiveCalories.ts](src/engine/adaptiveCalories.ts) + the EMA helpers from [weightUtils.ts](src/screens/Weight/weightUtils.ts). **Run both implementations in parallel over historical data and diff the outputs before cutting over.** Keep [scripts/adaptive-calories.test.cjs](scripts/adaptive-calories.test.cjs) as the shared conformance suite.

### Phase 6 — Cleanup
Delete `supabaseFoodStore.ts` / `supabaseUserStore.ts` / `supabaseProfiles.ts` PostgREST code (~5 700 lines). Reduce the Supabase client to auth only. Delete the legacy local→remote migration paths ([userStore:798-890](src/store/supabaseUserStore.ts#L798-L890)) once a one-shot server-side import has run. Tighten RLS to *deny by default* for any role the API does not use. Add server-side rate limiting. Consider dropping the unused `activities` and `custom_meal_items` tables.

---

## 11. Expected performance wins

| Flow | Before (requests) | After | Expected mobile latency change |
| --- | --- | --- | --- |
| Food Diary, cold | 7 – 40+, partly serial | **1** | **−1.5 s to −4 s** |
| Add Food static lists | 8 – 44 | **1** | **−1 s to −4 s** |
| Adaptive refresh | 11 – 13 serial | **1** | **−1.5 s** (and it stops competing with the diary render) |
| Save a weight entry | 6 – 10 serial | **1** | **−0.7 s to −1.2 s** |
| Log one food | 2 – 6 | **1** | −0.2 s to −0.6 s |
| Copy a day | 4 – 7 | **1** | −0.4 s to −0.8 s |
| Save a new catalog food | 5 serial | **1** | −0.5 s |
| Weekly Review | 6 parallel | **1** | −0.1 s (already parallel; win is payload + battery) |
| Home dashboard | 5 parallel | **1** | −0.1 s |
| Cold food search | 5 + USDA | **1** | −0.3 s, plus server-cached USDA results |

**Secondary wins**

* **Payload size.** Every list read is `select("*")` — `food_items` alone has **~90 nutrient columns**. Screen endpoints can project only what the screen renders. On the diary week this is a large reduction over cellular.
* **Battery / radio.** Collapsing ~40 requests to 1 avoids repeatedly waking the radio.
* **Server-side USDA/OFF caching** turns repeated external lookups into local catalog hits for all users.
* **Real full-text search** replaces chained `ilike` filters (which today AND together across tokens — multi-word queries silently require *every* token to match name-or-description).
* **Fixes shipped alongside:** non-atomic recipe edit, settings lost-update race, adaptive `23505` race, un-transacted diary cascade.

**Where it gets slower and you must watch**

* Any endpoint that is not collapsed. Budget: no endpoint may add more than one mobile RTT versus today for the same amount of data.
* Cloud Run cold starts if `min-instances` drops to 0.
* Cross-region deployment. Non-negotiable: co-locate.

---

## 12. Risks & blockers

### Blockers (resolve before Phase 1)

| # | Blocker | Why it blocks |
| --- | --- | --- |
| B1 | **No migration tooling.** The schema is a single hand-applied `docs/supabase-schema.sql`. There is no record of what is actually deployed. | You cannot safely add columns, functions or policies without it. Verify the live schema matches the file *first*. |
| B2 | **§9.1 connection strategy undecided.** | Determines whether §6's eight RLS rules survive or must be hand-written. Changes the shape of every query. |
| B3 | **`handle_new_user()` vs. `upsertSupabaseAuthUserAccount` disagree** about who creates a profile (§4). | Onboarding and login will break in confusing ways during the cutover. |
| B4 | **Token-refresh behaviour undefined** (`autoRefreshToken: false`, §9.5). | Guaranteed "randomly logged out" bug reports. |

### High risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **IDOR on six write paths** if service-role is used (§9.1) | Prefer option A; if B, add explicit `user_id` predicates + an integration test per route that asserts another user's row is untouched |
| R2 | **Adaptive engine port drift** — 573 lines of float math with cascading thresholds | Dual-run against historical data, diff outputs, share [scripts/adaptive-calories.test.cjs](scripts/adaptive-calories.test.cjs) |
| R3 | **Recents N+1 rewrite** — synthetic id offsets, three entry types, per-type visibility | Cover with fixtures for each `entry_type` before touching it |
| R4 | **Latency regression** from a partial migration | Enforce the "no 1:1 endpoints" rule; gate each phase on the perf-trace baseline from Phase 0 |
| R5 | **Cache-shape coupling.** [cacheRepository.ts](src/store/cacheRepository.ts) persists rows in the exact shape the Supabase mappers produce. | Keep the domain types (`DBFoodItem`, `DBUserFoodLogEntry`, …) byte-identical; the Node API returns **domain shapes, not DB rows** |
| R6 | **Two write paths during rollout** (old client on Supabase, new on Node) for the same non-transactional cascades | Ship SQL functions in Phase 4 *before* flipping any write flag, so both paths use them |
| R7 | **Search-quality regression** — ~250 lines of hand-tuned heuristics | Snapshot the top-10 for a fixed query corpus; treat regressions as blocking |

### Medium risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R8 | Cloud Run cold starts | `min-instances ≥ 1`; alert on p99 |
| R9 | Connection-pool exhaustion under horizontal scale | Supavisor transaction pooling; small per-instance pool |
| R10 | Client cannot be force-updated — old versions keep hitting Supabase directly | Version the API (`/v1`); keep RLS enabled indefinitely so old clients stay safe |
| R11 | Legacy local→remote migration paths ([userStore:798-890](src/store/supabaseUserStore.ts#L798-L890)) fire on empty remote reads and cost extra round trips | Run a one-shot server-side import, then delete the client paths in Phase 6 |
| R12 | No offline mutation queue exists ([docs/food-tracking-data-model.md](docs/food-tracking-data-model.md)) — failed writes are rolled back and surfaced | Do not regress this. The optimistic-write + rollback contract must be preserved exactly through the Node client. |

---

## 13. Things that should **NOT** be migrated

| # | Keep as-is | Why |
| --- | --- | --- |
| 1 | **Supabase Auth** — `signInWithPassword`, `signUp`, `signOut`, `getSession`, `getUser`, `onAuthStateChange` | Explicitly out of scope. Proxying auth adds latency, breaks refresh, and buys nothing. Node verifies the JWT. |
| 2 | **`expo-secure-store` session storage** ([client.ts:29-39](src/API/supabase/client.ts#L29-L39)) | Correct place for a token on-device. |
| 3 | **`handle_new_user()` trigger** | Guarantees a profile exists at signup, atomically with the auth insert. Node cannot do this as reliably. |
| 4 | **`iso_text_date_prefix()` + `measured_day_local` generated column** | Required by a generated column and a partial unique index. Cannot move. |
| 5 | **All 9 `set_updated_at` triggers** | Free, atomic, unbypassable. |
| 6 | **All CHECK / UNIQUE / partial-unique / FK constraints (§4)** | Correctness floor. Application checks are additive, never a replacement. |
| 7 | **RLS policies** | Free under connection option A; defence in depth under B; the only protection for older client versions still talking to Supabase. |
| 8 | **The entire `expo-sqlite` cache layer** ([cacheRepository.ts](src/store/cacheRepository.ts), [sqlite.ts](src/storage/sqlite.ts)) | Not a Supabase dependency — it is the app's offline + perceived-performance layer. It gets *more* valuable with a Node API in front. |
| 9 | **The `DB.ts` facade and its method signatures** | The whole migration hides behind it. Changing it would touch 30+ screens. |
| 10 | **`dataChangeEvents` + Redux store + `usePreferences` / `displayPreferences`** | Purely client state. |
| 11 | **Expo Go dev bypass** ([expoGoDevAuth.ts](src/dev/expoGoDevAuth.ts)) and the local repositories it uses | Offline development mode. Never touches Supabase. Must keep short-circuiting *before* any Node call. |
| 12 | **Barcode camera handling** ([FoodBarcodeScannerShared.tsx](src/screens/Food/FoodBarcodeScannerShared.tsx)) | Device-only. Only the *network lookup* moves. |
| 13 | **UI-side formatting/display helpers** — `formatMicronutrientValue`, chart maths in [WeightTrendChart.tsx](src/screens/Weight/WeightTrendChart.tsx), [CalorieBudgetChart.tsx](src/screens/User_Settings/CalorieBudgetChart.tsx) | Presentation. Server should return numbers, not strings. |
| 14 | **`developerAccount.ts` gate** | UI-only affordance; must not become a server privilege. |

### Open questions for the team

1. **`activities`** — table + RLS exist, zero app usage. Drop, or is a planned feature?
2. **`custom_meal_items`** — table + 2 RLS policies exist, zero app usage. Custom meals currently store flat nutrition only. Build out, or drop?
3. **`user_settings.food_diary_start_hour` / `end_hour`** — documented as "legacy sync contract fields, not the authoritative date-boundary model" ([docs/food-tracking-data-model.md](docs/food-tracking-data-model.md)). Carry forward or retire?
4. **Offline mutation queue** — deliberately absent today. Does the Node API change that calculus? (It should not be assumed to.)
5. **Catalog moderation** — with a Node service you could finally fix bad `food_items` rows, which RLS makes impossible today. In scope?
