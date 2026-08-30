// The mobile half of the domain conformance corpus.
//
// Nutrition, calorie-target and meal-slot logic is implemented independently
// here and in nouri-api, because this app computes optimistic previews before
// the round trip. The duplication is deliberate; the drift risk is not. Both
// repositories run the SAME corpus against their own implementation, so the two
// cannot diverge while both suites stay green.
//
// conformance/domain-conformance.json here is a byte-identical MIRROR of the
// authoritative copy in nouri-api. `CHECKSUM` is asserted below, so editing one
// copy without syncing fails immediately. Sync with:
//   ../nouri-api/scripts/sync-conformance.sh sync
//
// Time-of-day cases are fixed to UTC, because the mobile helpers read the
// device clock rather than taking a timezone argument. TZ is set before the
// modules load so `new Date(...).getHours()` resolves in UTC.
process.env.TZ = "UTC";

require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const nutrition = require("../src/engine/nutrition.ts");
const calorieTargets = require("../src/engine/calorieTargets.ts");
const foodUtils = require("../src/screens/Food/foodUtils.ts");
const copyUtils = require("../src/store/foodLogCopyUtils.ts");

const CORPUS_PATH = path.join(__dirname, "..", "conformance", "domain-conformance.json");
const RAW = fs.readFileSync(CORPUS_PATH);
const corpus = JSON.parse(RAW.toString("utf8"));

const suite = (name) => {
  const cases = corpus.suites[name];
  if (!cases || cases.length === 0) throw new Error(`conformance suite missing: ${name}`);
  return cases;
};

/** Runs every case in a suite as one test, reporting all mismatches together. */
const conform = (name, run, compare) => {
  test(`conformance: ${name}`, () => {
    const failures = [];
    for (const c of suite(name)) {
      let actual;
      try {
        actual = run(c.input);
      } catch (error) {
        failures.push(`${c.name}: threw ${error.message}`);
        continue;
      }
      try {
        (compare ?? assert.deepEqual)(actual, c.expected);
      } catch {
        failures.push(
          `${c.name}\n      expected ${JSON.stringify(c.expected)}\n      actual   ${JSON.stringify(actual)}`,
        );
      }
    }
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
  });
};

const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} !== ${b}`);

test("corpus matches its committed checksum", () => {
  const committed = fs
    .readFileSync(path.join(__dirname, "..", "conformance", "CHECKSUM"), "utf8")
    .trim();
  assert.equal(crypto.createHash("sha256").update(RAW).digest("hex"), committed);
});

// --- nutrition -------------------------------------------------------------

conform("roundNutrient", (i) => nutrition.roundNutrient(i.value, i.places));

conform("getFoodResolvedServing", (i) => nutrition.getFoodResolvedServing(i));

conform(
  "getQuantityScaleFactor",
  (i) => nutrition.getQuantityScaleFactor(i.quantity, i.servingSize),
  closeTo,
);

conform("scaleFoodNutritionForQuantity", (i) =>
  nutrition.scaleFoodNutritionForQuantity(i.food, i.quantity),
);

// The corpus calls the logged amount `quantity`; this app's row type calls the
// same field `quantityG`. One neutral name in the fixture, mapped per side.
const toEntry = (i) => ({ ...i, quantityG: i.quantity });

conform("calculateLoggedNutrition", (i) => nutrition.calculateLoggedNutrition(toEntry(i)));

conform("getLoggedCaloriesRaw", (i) => nutrition.getLoggedCaloriesRaw(toEntry(i)), closeTo);

conform("sumLoggedNutrition", (i) => nutrition.sumLoggedNutrition(i.entries.map(toEntry)));

conform("calculateQuickAddCaloriesFromMacros", (i) =>
  nutrition.calculateQuickAddCaloriesFromMacros(i),
);

// --- calorie targets -------------------------------------------------------

conform("clampCalorieTarget", (i) => calorieTargets.clampCalorieTarget(i.value));

// The corpus expresses the day as a calendar date key. This app's helpers take
// a Date and a settings object, so the case is adapted rather than the rule.
const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // local noon: no DST edge either side
};

conform("getEffectiveCalorieTargetForDate", (i) =>
  calorieTargets.getEffectiveCalorieTargetForDate({
    date: dateFromKey(i.dateKey),
    baseCalories: i.baseCalories,
    settings: i.overrides == null ? null : { dailyCalorieOverrides: i.overrides },
  }),
);

conform("getMondayFirstDayIndex", (i) =>
  calorieTargets.getMondayFirstDayIndex(dateFromKey(i.dateKey)),
);

// --- meal slots ------------------------------------------------------------

conform("getMealSlotForHour", (i) => foodUtils.getMealSlotForHour(i.hour));

conform("getMealSlotFromLabel", (i) => foodUtils.getMealSlotFromLabel(i.value));

// --- copy-day duplicate key ------------------------------------------------

conform("buildDuplicateKey", (i) => {
  assert.equal(i.tz, "UTC", "mobile duplicate keys are only conformance-tested in UTC");
  return copyUtils.buildFoodLogDuplicateKey(i.entry);
});
