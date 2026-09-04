import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getFoodDefaultLogAmount,
  getQuantityScaleFactor,
  scaleFoodNutritionForQuantity,
} from "../src/engine/nutrition";
import type { DBFoodItem } from "../src/store/DB_TYPES";

/**
 * What "quantity" means when logging a food.
 *
 * The API presents recipes and custom meals as ONE-SERVING foods: nutrition
 * basis "serving", `servingSizeValue: 1`, unit "serving", with the macros
 * already per serving. A catalogue food is usually per 100 g. So the quantity a
 * log carries has to be expressed in the unit that food's serving is measured
 * in — and `getFoodDefaultLogAmount` is what answers that.
 *
 * The custom-meal editor passed its "default serving" field, which is a number
 * of GRAMS, as the quantity for a one-serving food. The scale factor became
 * 100/1, and a 450 kcal meal was logged as 45,000 — a whole day reading 45,600
 * against a 2,300 target.
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

type FoodShape = Pick<
  DBFoodItem,
  "nutritionBasis" | "servingSizeValue" | "servingSizeUnit" | "calories" | "proteinG" | "carbsG" | "fatG"
>;

const expectEqual = (actual: unknown, expected: unknown, message?: string) =>
  expect(actual, message).toEqual(expected);

const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("log quantity", () => {
it("a one-serving food scaled by a gram amount is off by that many times", () => {
  const meal: FoodShape = {
    nutritionBasis: "serving",
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    calories: 450,
    proteinG: 30,
    carbsG: 55,
    fatG: 12,
  };

  // What the editor did.
  expectEqual(getQuantityScaleFactor(100, 1), 100);
  expectEqual(
    scaleFoodNutritionForQuantity(meal, 100).calories,
    45000,
    "this is the wrong answer the bug produced",
  );

  // What it does now.
  expectEqual(getFoodDefaultLogAmount(meal), 1);
  expectEqual(
    scaleFoodNutritionForQuantity(meal, getFoodDefaultLogAmount(meal))
      .calories,
    450,
  );
});

it("a 100 g-basis food still logs its whole serving by default", () => {
  const food: FoodShape = {
    nutritionBasis: "100g",
    servingSizeValue: 100,
    servingSizeUnit: "g",
    calories: 100,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  };
  expectEqual(getFoodDefaultLogAmount(food), 100);
  expectEqual(
    scaleFoodNutritionForQuantity(food, getFoodDefaultLogAmount(food))
      .calories,
    100,
  );
});

it("no screen invents a log quantity from its own gram field", () => {
  // Every `quantityG:` must come from the food itself, from an amount the user
  // typed into that log, or be an explicit 1 for a one-serving food. A local
  // variable holding a serving size in grams is the mistake this catches.
  const SCREENS = [
    "src/screens/Food/AddFoodScreen.tsx",
    "src/screens/Food/CreateCustomFoodScreen.tsx",
    "src/screens/Food/CreateRecipeScreen.tsx",
    "src/screens/Food/EditFoodEntryScreen.tsx",
    "src/screens/Food/FoodDiaryScreen.tsx",
    "src/screens/Food/ScannedFoodLogScreen.tsx",
  ];

  const ALLOWED = [
    /^getFoodDefaultLogAmount\(/, // derived from the food
    /^quantity$/,                 // the amount the user typed on this screen
    /^entry\.quantityG$/,         // carried from the entry being repeated
    /^1$/,                        // an explicit single serving
  ];

  const violations: string[] = [];
  for (const screen of SCREENS) {
    const src = strip(readFileSync(path.join(ROOT, screen), "utf8"));
    for (const m of src.matchAll(/quantityG:\s*([^,\n]+)/g)) {
      const expr = m[1].trim();
      if (!ALLOWED.some((rule) => rule.test(expr))) {
        violations.push(`${screen}: quantityG: ${expr}`);
      }
    }
  }

  expectEqual(violations, [], `\n${violations.join("\n")}\n`);
});
});
