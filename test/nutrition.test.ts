import { describe, expect, it } from "vitest";
import {
  assertValidFoodLogQuantity,
  calculateQuickAddCaloriesFromMacros,
  getFoodResolvedServing,
  scaleFoodNutritionForQuantity,
  sumLoggedNutrition,
  type LoggedNutritionEntry,
} from "../src/engine/nutrition";
import type { DBFoodItem } from "../src/store/DB_TYPES";

type FoodShape = Pick<
  DBFoodItem,
  "nutritionBasis" | "servingSizeValue" | "servingSizeUnit" | "calories" | "proteinG" | "carbsG" | "fatG"
>;

const food = (overrides: Partial<FoodShape> = {}): FoodShape => ({
  nutritionBasis: "100g",
  servingSizeValue: 100,
  servingSizeUnit: "g",
  calories: 123.4,
  proteinG: 10.25,
  carbsG: 20.25,
  fatG: 5.25,
  ...overrides,
});

describe("nutrition", () => {
  it("serving resolution rejects non-positive stored sizes", () => {
    expect(getFoodResolvedServing(food({ servingSizeValue: 0 }))).toEqual({
      value: 100,
      unit: "g",
    });
    expect(
      getFoodResolvedServing(
        food({ nutritionBasis: "serving", servingSizeValue: -4, servingSizeUnit: "" }),
      ),
    ).toEqual({ value: 1, unit: "serving" });
  });

  it("food nutrition scales from one resolved serving with canonical rounding", () => {
    expect(scaleFoodNutritionForQuantity(food(), 50)).toEqual({
      calories: 62,
      proteinG: 5.1,
      carbsG: 10.1,
      fatG: 2.6,
    });
  });

  it("logged totals sum raw values before rounding once", () => {
    const base: LoggedNutritionEntry = {
      entrySource: "food_item",
      quantityG: 50,
      servingSize: 100,
      calories: 1,
      proteinG: 0.1,
      carbsG: 0.1,
      fatG: 0.1,
    };

    expect(sumLoggedNutrition([base, base])).toEqual({
      calories: 1,
      proteinG: 0.1,
      carbsG: 0.1,
      fatG: 0.1,
    });
  });

  it("quick-add energy includes alcohol at 7 kcal per gram", () => {
    expect(
      calculateQuickAddCaloriesFromMacros({
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
        alcoholG: 2,
      }),
    ).toBe(179);
  });

  it("write-path quantity validator rejects invalid amounts", () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertValidFoodLogQuantity(value)).toThrow(/positive number/);
    }
    expect(() => assertValidFoodLogQuantity(0.1)).not.toThrow();
  });
});
