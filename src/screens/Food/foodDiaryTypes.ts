import type { DBFoodItem, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type { FoodNutritionTotals, MealSlot } from "./foodUtils";

export type FoodDiaryFavoriteFood = DBFoodItem & {
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FoodDiaryMealBucket = {
  slot: MealSlot;
  label: string;
  entries: DBUserFoodLogEntry[];
  totals: FoodNutritionTotals;
};
