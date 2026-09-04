import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as nutrition from "../src/engine/nutrition";
import * as calorieTargets from "../src/engine/calorieTargets";
import * as foodUtils from "../src/screens/Food/foodUtils";
import * as copyUtils from "../src/store/foodLogCopyUtils";
import {
  decodeFoodId,
  toSyntheticMealFoodId,
  toSyntheticRecipeFoodId,
} from "../src/domain/syntheticFoodIds";
import { computeRecipeNutrition } from "../src/domain/recipeNutrition";
import { applyAdaptiveRecommendationToTargets } from "../src/domain/adaptiveTargets";
import {
  formatGoalStrategyMeta,
  getGoalCalorieOffset,
  resolveGoalStrategy,
} from "../src/engine/goalStrategy";

/**
 * The mobile half of the domain conformance corpus.
 *
 * Nutrition, calorie-target and meal-slot logic is implemented independently
 * here and in nouri-api, because this app computes optimistic previews before
 * the round trip. The duplication is deliberate; the drift risk is not. Both
 * repositories run the SAME corpus against their own implementation, so the two
 * cannot diverge while both suites stay green.
 *
 * `conformance/domain-conformance.json` here is a byte-identical MIRROR of the
 * authoritative copy in nouri-api. `CHECKSUM` is asserted below, so editing one
 * copy without syncing fails immediately. Sync with:
 *   ../nouri-api/scripts/sync-conformance.sh sync
 *
 * Time-of-day cases are fixed to UTC, because the mobile helpers read the
 * device clock rather than taking a timezone argument. `test/setup/env.ts` sets
 * TZ before any module loads, so `new Date(...).getHours()` resolves in UTC.
 */

interface Case<I = unknown, E = unknown> {
  name: string;
  input: I;
  expected: E;
}
interface Corpus {
  version: number;
  suites: Record<string, Case[]>;
}

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const RAW = readFileSync(path.join(ROOT, "conformance", "domain-conformance.json"));
const corpus = JSON.parse(RAW.toString("utf8")) as Corpus;

/** Every suite this file actually asserts, recorded as it is requested. */
const asserted = new Set<string>();

const suite = <I, E>(name: string): Case<I, E>[] => {
  const cases = corpus.suites[name];
  if (!cases || cases.length === 0) throw new Error(`conformance suite missing: ${name}`);
  asserted.add(name);
  return cases as Case<I, E>[];
};

/**
 * Runs every case in a suite as one test, reporting all mismatches together.
 *
 * One test per suite rather than per case, deliberately: when an implementation
 * drifts it usually drifts for a family of inputs, and seeing all of them at
 * once is what tells you which rule changed.
 */
const conform = <I, E>(
  name: string,
  run: (input: I) => E,
  compare?: (actual: E, expected: E) => void,
) => {
  it(`conformance: ${name}`, () => {
    const failures: string[] = [];

    for (const c of suite<I, E>(name)) {
      let actual: E;
      try {
        actual = run(c.input);
      } catch (error) {
        failures.push(`${c.name}: threw ${(error as Error).message}`);
        continue;
      }
      try {
        if (compare) compare(actual, c.expected);
        else expect(actual).toEqual(c.expected);
      } catch {
        failures.push(
          `${c.name}\n      expected ${JSON.stringify(c.expected)}\n      actual   ${JSON.stringify(actual)}`,
        );
      }
    }

    expect(failures, `\n  ${failures.join("\n  ")}\n`).toEqual([]);
  });
};

/** For values produced by division, where exact equality is the wrong question. */
const closeTo = (a: number, b: number) => {
  expect(Math.abs(a - b), `${a} !== ${b}`).toBeLessThan(1e-10);
};

describe("corpus integrity", () => {
  it("matches its committed checksum", () => {
    const committed = readFileSync(
      path.join(ROOT, "conformance", "CHECKSUM"),
      "utf8",
    ).trim();
    expect(createHash("sha256").update(RAW).digest("hex")).toBe(committed);
  });
});

describe("nutrition", () => {
  conform<{ value: number; places: number }, number>("roundNutrient", (i) =>
    nutrition.roundNutrient(i.value, i.places),
  );

  conform<Parameters<typeof nutrition.getFoodResolvedServing>[0], nutrition.ResolvedFoodServing>(
    "getFoodResolvedServing",
    (i) => nutrition.getFoodResolvedServing(i),
  );

  conform<{ quantity: number; servingSize: number | null }, number>(
    "getQuantityScaleFactor",
    (i) => nutrition.getQuantityScaleFactor(i.quantity, i.servingSize),
    closeTo,
  );

  conform<
    { food: Parameters<typeof nutrition.scaleFoodNutritionForQuantity>[0]; quantity: number },
    nutrition.FoodNutritionTotals
  >("scaleFoodNutritionForQuantity", (i) =>
    nutrition.scaleFoodNutritionForQuantity(i.food, i.quantity),
  );

  // The corpus calls the logged amount `quantity`; this app's row type calls
  // the same field `quantityG`. One neutral name in the fixture, mapped per side.
  const toEntry = (i: { quantity: number }): nutrition.LoggedNutritionEntry =>
    ({ ...i, quantityG: i.quantity }) as unknown as nutrition.LoggedNutritionEntry;

  conform<{ quantity: number }, nutrition.FoodNutritionTotals>(
    "calculateLoggedNutrition",
    (i) => nutrition.calculateLoggedNutrition(toEntry(i)),
  );

  conform<{ quantity: number }, number>(
    "getLoggedCaloriesRaw",
    (i) => nutrition.getLoggedCaloriesRaw(toEntry(i)),
    closeTo,
  );

  conform<{ entries: { quantity: number }[] }, nutrition.FoodNutritionTotals>(
    "sumLoggedNutrition",
    (i) => nutrition.sumLoggedNutrition(i.entries.map(toEntry)),
  );

  conform<
    Parameters<typeof nutrition.calculateQuickAddCaloriesFromMacros>[0],
    number
  >("calculateQuickAddCaloriesFromMacros", (i) =>
    nutrition.calculateQuickAddCaloriesFromMacros(i),
  );
});

describe("calorie targets", () => {
  conform<{ value: number }, number>("clampCalorieTarget", (i) =>
    calorieTargets.clampCalorieTarget(i.value),
  );

  // The corpus expresses the day as a calendar date key. This app's helpers
  // take a Date and a settings object, so the case is adapted rather than the
  // rule.
  const dateFromKey = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y!, m! - 1, d!, 12, 0, 0); // local noon: no DST edge either side
  };

  conform<
    { dateKey: string; baseCalories: number | null; overrides: Array<number | null> | null },
    number | null
  >("getEffectiveCalorieTargetForDate", (i) =>
    calorieTargets.getEffectiveCalorieTargetForDate({
      date: dateFromKey(i.dateKey),
      baseCalories: i.baseCalories,
      settings:
        i.overrides == null
          ? null
          : ({ dailyCalorieOverrides: i.overrides } as Parameters<
              typeof calorieTargets.getEffectiveCalorieTargetForDate
            >[0]["settings"]),
    }),
  );

  conform<{ dateKey: string }, number>("getMondayFirstDayIndex", (i) =>
    calorieTargets.getMondayFirstDayIndex(dateFromKey(i.dateKey)),
  );
});

describe("meal slots", () => {
  conform<{ hour: number }, string>("getMealSlotForHour", (i) =>
    foodUtils.getMealSlotForHour(i.hour),
  );

  conform<{ value: string | null }, string | null>("getMealSlotFromLabel", (i) =>
    foodUtils.getMealSlotFromLabel(i.value),
  );
});

describe("copy-day duplicate key", () => {
  conform<
    { entry: Parameters<typeof copyUtils.buildFoodLogDuplicateKey>[0]; tz: string },
    string
  >("buildDuplicateKey", (i) => {
    expect(i.tz, "mobile duplicate keys are only conformance-tested in UTC").toBe("UTC");
    return copyUtils.buildFoodLogDuplicateKey(i.entry);
  });
});

describe("synthetic food ids", () => {
  // The sign is what makes an id synthetic; the magnitude only says which kind.
  // This suite pins the boundary where a real catalogue id reaches the meal
  // offset — the app must not decode a positive id as a custom meal, and the
  // backend must not either.
  conform<{ foodId: number }, ReturnType<typeof decodeFoodId>>("decodeFoodId", ({ foodId }) =>
    decodeFoodId(foodId),
  );
});

describe("recipe nutrition", () => {
  // The app computes this for the live preview in the recipe editor; the
  // backend recomputes it from the same ingredients and stores ITS answer. This
  // suite is what keeps the preview honest about what will be saved.
  conform<
    Parameters<typeof computeRecipeNutrition>[0],
    ReturnType<typeof computeRecipeNutrition>
  >("computeRecipeNutrition", (i) => computeRecipeNutrition(i));
});

describe("goal strategies", () => {
  // The offset is what a recommendation is built from — estimated maintenance
  // plus this number. If the two repositories disagree about what "normal
  // deficit" means, they disagree about every calorie target that follows.
  conform<{ goal: string | null; goalStrategy: string | null }, string | null>(
    "resolveGoalStrategy",
    (i) => resolveGoalStrategy(i.goal, i.goalStrategy),
  );

  conform<{ goal: string | null; goalStrategy: string | null }, number>(
    "getGoalCalorieOffset",
    (i) => getGoalCalorieOffset(i.goal, i.goalStrategy),
  );
});

describe("adaptive calories", () => {
  // Only the *apply* step is still implemented here. The analysis moved to
  // nouri-api; see BACKEND_ONLY_SUITES below.
  conform<
    Parameters<typeof applyAdaptiveRecommendationToTargets>[0],
    ReturnType<typeof applyAdaptiveRecommendationToTargets>
  >("applyAdaptiveRecommendationToTargets", (i) =>
    applyAdaptiveRecommendationToTargets(i),
  );
});

/**
 * Suites the corpus carries that this repository does not implement.
 *
 * The adaptive engine — the 28-day window, the TDEE estimate, the confidence
 * bands, the whole decision — runs on the server now. Its rules are still in
 * the shared corpus, because that is where the rules live and because the
 * expectations there were recorded from this app's implementation before it was
 * deleted. There is simply nothing on this side left to run them against.
 *
 * Listing them is deliberate: the coverage check below still fails for a suite
 * that is merely *forgotten*, and adding a name here is a decision someone has
 * to write down.
 */
const BACKEND_ONLY_SUITES = new Set([
  "estimateAdaptiveTdee",
  "getAdaptiveRecommendationConfidence",
  "buildAdaptiveRecommendation",
]);

describe("closing the corpus gaps", () => {
  // Found by auditing which functions exist in BOTH repositories but were not
  // pinned by any suite. Each is reachable from something already covered, so
  // none was unprotected — but "covered through a caller" is not the same as
  // covered, and the caller's cases were not chosen to exercise them.
  conform<{ entrySource: string; quantity: number; servingSize: number }, number>(
    "getEntryScaleFactor",
    (i) =>
      nutrition.getEntryScaleFactor({
        entrySource: i.entrySource,
        quantityG: i.quantity,
        servingSize: i.servingSize,
      } as Parameters<typeof nutrition.getEntryScaleFactor>[0]),
    closeTo,
  );

  // The encode direction. `decodeFoodId` was pinned; nothing checked that what
  // this produces is what that reads.
  conform<{ kind: "recipe" | "meal"; id: number }, number>("encodeFoodId", (i) =>
    i.kind === "recipe" ? toSyntheticRecipeFoodId(i.id) : toSyntheticMealFoodId(i.id),
  );

  // This string is written into a stored recommendation's `reason` and shown to
  // the user, so the two repositories have to phrase it identically.
  conform<{ goal: string | null; goalStrategy: string | null }, string>(
    "formatGoalStrategyMeta",
    (i) => formatGoalStrategyMeta(i.goal, i.goalStrategy),
  );

  // Same adaptation as `getEffectiveCalorieTargetForDate` above: the corpus
  // states the day as a date key, this app's helper takes a Date and a settings
  // object.
  conform<
    { dateKey: string; overrides: Array<number | null> | null },
    number | null
  >("getDailyCalorieOverrideForDate", (i) => {
    const [y, m, d] = i.dateKey.split("-").map(Number);
    return calorieTargets.getDailyCalorieOverrideForDate(
      new Date(y!, m! - 1, d!, 12, 0, 0),
      i.overrides == null
        ? null
        : ({ dailyCalorieOverrides: i.overrides } as Parameters<
            typeof calorieTargets.getDailyCalorieOverrideForDate
          >[1]),
    );
  });
});

describe("coverage", () => {
  it("every suite in the corpus is asserted here", () => {
    // The corpus is the contract, so a suite that exists in it but is asserted
    // by only one of the two repositories protects nothing. `conform` records
    // each name as it registers, and registration happens during collection —
    // before any test runs — so by now every assertion above has declared itself.
    const expected = Object.keys(corpus.suites)
      .filter((name) => !BACKEND_ONLY_SUITES.has(name))
      .sort();
    expect([...asserted].sort()).toEqual(expected);

    // And every name on the backend-only list must actually be in the corpus,
    // so the list cannot quietly accumulate suites that no longer exist.
    for (const name of BACKEND_ONLY_SUITES) {
      expect(Object.keys(corpus.suites), `${name} is not in the corpus`).toContain(name);
    }
  });
});
