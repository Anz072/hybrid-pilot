require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertValidFoodLogQuantity,
  calculateQuickAddCaloriesFromMacros,
  getFoodResolvedServing,
  scaleFoodNutritionForQuantity,
  sumLoggedNutrition,
} = require("../src/engine/nutrition.ts");

const food = (overrides = {}) => ({
  nutritionBasis: "100g",
  servingSizeValue: 100,
  servingSizeUnit: "g",
  calories: 123.4,
  proteinG: 10.25,
  carbsG: 20.25,
  fatG: 5.25,
  ...overrides,
});

test("serving resolution rejects non-positive stored sizes", () => {
  assert.deepEqual(
    getFoodResolvedServing(food({ servingSizeValue: 0 })),
    { value: 100, unit: "g" },
  );
  assert.deepEqual(
    getFoodResolvedServing(
      food({ nutritionBasis: "serving", servingSizeValue: -4, servingSizeUnit: "" }),
    ),
    { value: 1, unit: "serving" },
  );
});

test("food nutrition scales from one resolved serving with canonical rounding", () => {
  assert.deepEqual(scaleFoodNutritionForQuantity(food(), 50), {
    calories: 62,
    proteinG: 5.1,
    carbsG: 10.1,
    fatG: 2.6,
  });
});

test("logged totals sum raw values before rounding once", () => {
  const base = {
    entrySource: "food_item",
    quantityG: 50,
    servingSize: 100,
    calories: 1,
    proteinG: 0.1,
    carbsG: 0.1,
    fatG: 0.1,
  };

  assert.deepEqual(sumLoggedNutrition([base, base]), {
    calories: 1,
    proteinG: 0.1,
    carbsG: 0.1,
    fatG: 0.1,
  });
});

test("quick-add energy includes alcohol at 7 kcal per gram", () => {
  assert.equal(
    calculateQuickAddCaloriesFromMacros({
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      alcoholG: 2,
    }),
    179,
  );
});

test("write-path quantity validator rejects invalid amounts", () => {
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertValidFoodLogQuantity(value), /positive number/);
  }
  assert.doesNotThrow(() => assertValidFoodLogQuantity(0.1));
});
