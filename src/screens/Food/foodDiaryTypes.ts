import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type { FoodNutritionTotals, MealSlot } from "./foodUtils";

export type FoodDiaryMealBucket = {
  slot: MealSlot;
  label: string;
  entries: DBUserFoodLogEntry[];
  totals: FoodNutritionTotals;
};
