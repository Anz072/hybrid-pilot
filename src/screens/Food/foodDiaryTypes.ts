import type { DBFoodItem, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type { FoodNutritionTotals } from "./foodUtils";

export type FoodDiaryFavoriteFood = DBFoodItem & {
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FoodDiaryHourBucket = {
  hour: number;
  entries: DBUserFoodLogEntry[];
  totals: FoodNutritionTotals;
};
