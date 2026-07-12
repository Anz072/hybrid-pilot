import type { DBFoodItem, DBUserFoodLogEntry } from "../store/DB_TYPES";

// Authoritative nutrition scaling + rounding for the whole app.
//
// Model: a food stores macros for exactly `servingSizeValue` units of its
// `nutritionBasis` (100g / 100ml / serving). A logged entry stores the food
// reference plus `quantityG` in the same units, so scaling is always
// `quantityG / servingSize`. Quick-add entries store absolute totals and are
// never scaled.
//
// Rounding policy: calories 0 dp, macro grams 1 dp. Totals are summed
// unrounded and rounded once at the end, so per-entry displayed values can
// differ from a displayed total by at most the rounding of each row.

export type FoodNutritionTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const roundNutrient = (value: number, places = 1): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const EMPTY_TOTALS: FoodNutritionTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

export const FOOD_BASIS_DEFAULTS = {
  "100g": { value: 100, unit: "g" },
  "100ml": { value: 100, unit: "ml" },
  serving: { value: 1, unit: "serving" },
} as const;

export type ResolvedFoodServing = {
  value: number;
  unit: string;
};

type FoodServingFields = Pick<
  DBFoodItem,
  "nutritionBasis" | "servingSizeValue" | "servingSizeUnit"
>;

type FoodMacroFields = FoodServingFields &
  Pick<DBFoodItem, "calories" | "proteinG" | "carbsG" | "fatG">;

// The serving the food's stored macros describe. A missing, zero, or negative
// stored serving size falls back to the nutrition basis (100 g / 100 ml /
// 1 serving) so scaling never divides by zero and previews and totals agree.
export const getFoodResolvedServing = (
  food: FoodServingFields,
): ResolvedFoodServing => {
  const fallback =
    FOOD_BASIS_DEFAULTS[food.nutritionBasis] ?? FOOD_BASIS_DEFAULTS["100g"];
  const value =
    food.servingSizeValue != null &&
    Number.isFinite(food.servingSizeValue) &&
    food.servingSizeValue > 0
      ? food.servingSizeValue
      : fallback.value;

  return {
    value,
    unit: food.servingSizeUnit?.trim() || fallback.unit,
  };
};

export const getFoodDefaultLogAmount = (food: FoodServingFields): number =>
  getFoodResolvedServing(food).value;

export const assertValidFoodLogQuantity = (quantity: number): void => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Food log quantity must be a positive number.");
  }
};

// quantity-per-serving factor; a non-positive or non-finite base degrades to 1
// (treat stored macros as the whole logged amount) rather than corrupting math.
export const getQuantityScaleFactor = (
  quantity: number,
  servingSize: number | null | undefined,
): number => {
  if (
    servingSize == null ||
    !Number.isFinite(servingSize) ||
    servingSize <= 0 ||
    !Number.isFinite(quantity)
  ) {
    return 1;
  }

  return quantity / servingSize;
};

export const getFoodQuantityFactor = (
  food: FoodServingFields,
  quantity: number,
): number => getQuantityScaleFactor(quantity, getFoodResolvedServing(food).value);

// Nutrition for `quantity` units of a food, from its per-serving base values.
// This is the single preview path: what it returns is exactly what the diary
// will show once the entry is stored.
export const scaleFoodNutritionForQuantity = (
  food: FoodMacroFields,
  quantity: number,
): FoodNutritionTotals => {
  const factor = getFoodQuantityFactor(food, quantity);

  return {
    calories: roundNutrient((food.calories ?? 0) * factor, 0),
    proteinG: roundNutrient((food.proteinG ?? 0) * factor),
    carbsG: roundNutrient((food.carbsG ?? 0) * factor),
    fatG: roundNutrient((food.fatG ?? 0) * factor),
  };
};

export const getEntryScaleFactor = (
  entry: Pick<DBUserFoodLogEntry, "entrySource" | "quantityG" | "servingSize">,
): number =>
  entry.entrySource === "quick_add"
    ? 1
    : getQuantityScaleFactor(entry.quantityG, entry.servingSize);

type LoggedNutritionEntry = Pick<
  DBUserFoodLogEntry,
  | "entrySource"
  | "quantityG"
  | "servingSize"
  | "calories"
  | "proteinG"
  | "carbsG"
  | "fatG"
>;

const getLoggedNutritionRaw = (
  entry: LoggedNutritionEntry,
): FoodNutritionTotals => {
  const factor = getEntryScaleFactor(entry);

  return {
    calories: (entry.calories ?? 0) * factor,
    proteinG: (entry.proteinG ?? 0) * factor,
    carbsG: (entry.carbsG ?? 0) * factor,
    fatG: (entry.fatG ?? 0) * factor,
  };
};

// Unrounded logged calories — for aggregations (adaptive engine, averages)
// that must not accumulate per-entry rounding error.
export const getLoggedCaloriesRaw = (entry: LoggedNutritionEntry): number =>
  getLoggedNutritionRaw(entry).calories;

export const calculateLoggedNutrition = (
  entry: LoggedNutritionEntry,
): FoodNutritionTotals => {
  const raw = getLoggedNutritionRaw(entry);

  return {
    calories: roundNutrient(raw.calories, 0),
    proteinG: roundNutrient(raw.proteinG),
    carbsG: roundNutrient(raw.carbsG),
    fatG: roundNutrient(raw.fatG),
  };
};

export const sumLoggedNutrition = (
  entries: LoggedNutritionEntry[],
): FoodNutritionTotals => {
  const totals = entries.reduce<FoodNutritionTotals>(
    (accumulator, entry) => {
      const raw = getLoggedNutritionRaw(entry);
      accumulator.calories += raw.calories;
      accumulator.proteinG += raw.proteinG;
      accumulator.carbsG += raw.carbsG;
      accumulator.fatG += raw.fatG;
      return accumulator;
    },
    { ...EMPTY_TOTALS },
  );

  return {
    calories: roundNutrient(totals.calories, 0),
    proteinG: roundNutrient(totals.proteinG),
    carbsG: roundNutrient(totals.carbsG),
    fatG: roundNutrient(totals.fatG),
  };
};

// Atwater factors, incl. alcohol at 7 kcal/g (stored on quick-add entries).
export const calculateQuickAddCaloriesFromMacros = ({
  carbsG = 0,
  fatG = 0,
  proteinG = 0,
  alcoholG = 0,
}: {
  carbsG?: number | null;
  fatG?: number | null;
  proteinG?: number | null;
  alcoholG?: number | null;
}): number =>
  roundNutrient(
    (proteinG ?? 0) * 4 +
      (carbsG ?? 0) * 4 +
      (fatG ?? 0) * 9 +
      (alcoholG ?? 0) * 7,
    0,
  );
