import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";

export const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export type FoodNutritionTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const roundTo = (value: number, places = 1): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const formatFoodDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseFoodDateKey = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

export const shiftFoodDate = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatFoodLongDate = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

export const formatFoodShortDate = (date: Date | string): string => {
  const resolved = typeof date === "string" ? parseFoodDateKey(date) : date;
  return resolved.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export const calculateLoggedNutrition = (
  entry: DBUserFoodLogEntry,
): FoodNutritionTotals => {
  const factor = entry.servingSize > 0 ? entry.quantityG / entry.servingSize : 1;

  return {
    calories: roundTo(entry.calories * factor, 0),
    proteinG: roundTo(entry.proteinG * factor),
    carbsG: roundTo(entry.carbsG * factor),
    fatG: roundTo(entry.fatG * factor),
  };
};

export const sumLoggedNutrition = (
  entries: DBUserFoodLogEntry[],
): FoodNutritionTotals =>
  entries.reduce<FoodNutritionTotals>(
    (accumulator, entry) => {
      const next = calculateLoggedNutrition(entry);
      accumulator.calories += next.calories;
      accumulator.proteinG += next.proteinG;
      accumulator.carbsG += next.carbsG;
      accumulator.fatG += next.fatG;
      return accumulator;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

export const clampFoodRatio = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

export const formatMacroLine = (totals: FoodNutritionTotals): string =>
  `${roundTo(totals.proteinG)}P  ${roundTo(totals.carbsG)}C  ${roundTo(totals.fatG)}F`;
