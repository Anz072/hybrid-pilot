# Mobile testing

**Date:** 2026-08-30 · **Applies to:** `hybrid-pilot` (React Native)

---

## What runs

`npm test` is `tsc --noEmit && vitest run`. **116 tests across 16 files**, plus
one that reports as skipped — see *Manual checks* below. It needs no simulator,
no emulator, no native module and no running stack, so it runs on any machine in
about a second.

Everything under `test/` is either pure logic or static analysis over the
source. Nothing renders a component or touches a native module, which is why the
environment is plain `node` and there is no React Native preset to keep working.

---

## Why it moved

The suite was 15 files of `.cjs` run by `node --test`, loading TypeScript
through a hand-rolled shim:

```js
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { … });
  module._compile(output.outputText, filename);
};
```

That transpiles. It does not typecheck. So the tests — the code whose whole job
is to be right about the code — were the only TypeScript in the repository
nobody checked.

The conversion found five type errors that had been sitting in green tests:

| | |
| --- | --- |
| `adaptiveCalories` passed a partial diary entry where the function declares a whole one | the fixture omitted six required fields |
| `foodLogCopyUtils` passed a `DBUserFoodLogEntry` to a function taking `FoodLogDuplicateShape` | two different shapes, structurally compatible by luck |
| `customFoodItem` read `result.input.*` off a `{ input } \| { error }` union | ten assertions that would have thrown "cannot read property of undefined" if the build ever failed |
| `remoteOnlyStorage` had eight implicit `any`s | including `RegExp.exec` results used without a null check |
| `nutrition` imported a type name that does not exist | `LoggedEntryNutrition` for `LoggedNutritionEntry` |

None was a *behavioural* bug — the tests were testing the right things. They
were, however, five places where a future change could break a test in a way the
test would not notice.

**Nothing lost.** Old suite: 112 tests across 15 files. New suite: the same 112,
file for file, plus four new architecture tests.

---

## How stubbing changed

The old files patched Node's module loader by hand:

```js
const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (parent && parent.filename === CLIENT_PATH && request === "./DB") return stub;
  return originalLoad.call(this, request, parent, isMain);
};
try { return require(CLIENT_PATH); } finally { Module._load = originalLoad; }
```

which works, and is thirteen lines of machinery per test file that has to be
right about `require.cache`, parent filenames and restoring a global on every
path out. It is now:

```ts
vi.mock("../src/store/DB", () => ({ DB: { getUser: () => getUser() } }));
```

`vi.resetModules()` replaces the `delete require.cache[...]` dance, and matters
in exactly the places it did before: `coalesce`, the Supabase client and the API
client all hold state at module scope, so each test needs a fresh copy.

---

## Manual checks

`test/manual/tokenRefreshE2E.test.ts` needs a running local Supabase stack and a
running `nouri-api`, sets `jwt_expiry = 60`, and waits out a genuine token
expiry — over a minute. It uses the real client, the real API, a real expired
token and a real GoTrue refresh; only the session store is stubbed, because the
app persists sessions in SecureStore.

It is **skipped, not excluded**:

```ts
describe.skipIf(!process.env.RUN_MANUAL_E2E)("token refresh, end to end", …)
```

so `npm test` lists it on every run. Excluding it by glob was tried first and
rejected for two reasons: the exclude also stopped it running *by name*, and a
check that vanishes from the output is a check nobody remembers exists.

```
RUN_MANUAL_E2E=1 npx vitest run test/manual/tokenRefreshE2E.test.ts
```

---

## Domain types

`src/store/DB_TYPES.ts` was 622 lines holding three different things: the
domain's vocabulary, the record shapes screens pass around, and the input types
store functions take. The file is named after a device SQLite database that no
longer exists.

The vocabulary moved to **`src/domain/types.ts`** — the closed sets of values
the app reasons about: `NutritionBasis`, `UserFoodLogSource`, `WeightEntrySource`,
`FoodSource`, `RecipeBuildMethod`, the adaptive-recommendation states, and the
identity/date aliases. They describe the domain, not a table.

This was not cosmetic. The dependency pointed the wrong way: `src/domain/` and
`src/engine/` — the modules the shared conformance corpus pins against
nouri-api — imported their own vocabulary from the storage layer. A rule that
depends on a storage module is a rule that cannot be compared to its counterpart
in another repository.

Two further changes followed from it:

* `src/engine/nutrition.ts` now **declares** `FoodServingFields`,
  `FoodMacroFields` and `LoggedNutritionEntry` instead of `Pick`ing them off
  `DBFoodItem` and `DBUserFoodLogEntry`. The equivalent module in nouri-api
  declares the same interfaces; that symmetry is what lets one corpus run
  against both. A `DBFoodItem` satisfies them structurally, so no caller changed.
* `src/domain/` now imports nothing from `src/store/`, `src/API/`,
  `src/screens/`, `src/navigation/`, `src/storage/`, React or Expo.

`DB_TYPES.ts` re-exports the vocabulary, so the ~45 files already importing from
there are untouched. New code should import from `src/domain/types`.

The record shapes kept the `DB_TYPES` name deliberately. It is a misnomer — they
are API responses now, mapped once at the transport boundary — but it is
load-bearing across 45 files, and renaming it is churn without a payoff. The
file says so at the top.

---

## What holds it

`test/architecture.test.ts`:

| # | Assertion |
| --- | --- |
| 1 | `src/domain/` imports nothing from storage, transport, screens, navigation, React or Expo |
| 2 | `src/engine/nutrition.ts` declares its own input types and never mentions `DB_TYPES` |
| 3 | The vocabulary is defined in `src/domain/types.ts`, re-exported by `DB_TYPES.ts`, and not redefined there |
| 4 | No `.test.cjs` is left behind in `scripts/` |

Each was checked by mutation: re-adding a `../store/DB_TYPES` import to a domain
module, redefining `NutritionBasis` in `DB_TYPES.ts`, and dropping a stray
`.test.cjs` into `scripts/`. All three were caught by the intended test.

The conformance corpus gained two cases in the same pass, for an unrelated
reason: a mutation that changed `caloriesPerServing` from whole numbers to one
decimal place was **not** caught, because every existing case happened to divide
evenly. `computeRecipeNutrition` now includes a case whose calories land on
`207.5` and one whose macros need rounding to one decimal — and that mutation is
now caught in both repositories.
