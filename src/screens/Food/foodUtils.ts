import type { DBFoodItem, DBUserFoodLogEntry } from "../../store/DB_TYPES";

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

const FOOD_BASIS_DEFAULTS = {
  "100g": { value: 100, unit: "g" },
  "100ml": { value: 100, unit: "ml" },
  serving: { value: 1, unit: "serving" },
} as const;

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

export const formatFoodTimelineDate = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatFoodHourLabel = (hour: number): string =>
  `${String(hour).padStart(2, "0")}:00`;

export const clampFoodHour = (hour: number): number => {
  if (hour < 0) {
    return 0;
  }
  if (hour > 23) {
    return 23;
  }
  return hour;
};

export const buildFoodLoggedAt = (
  dateKey: string,
  hour: number,
  minute = 0,
): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(
    year,
    (month || 1) - 1,
    day || 1,
    clampFoodHour(hour),
    Math.min(59, Math.max(0, minute)),
    0,
    0,
  ).toISOString();
};

export const formatFoodLoggedTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const getFoodLoggedHour = (iso: string): number => new Date(iso).getHours();

export const formatFoodServing = (
  amount: number | null | undefined,
  unit: string | null | undefined,
  empty = "--",
): string => {
  if (amount == null || !Number.isFinite(amount)) {
    return empty;
  }

  return `${roundTo(amount, 0).toFixed(0)} ${unit?.trim() || "g"}`;
};

export const formatFoodNumber = (
  value: number | null | undefined,
  suffix = "",
  places = 0,
  empty = "--",
): string => {
  if (value == null || !Number.isFinite(value)) {
    return empty;
  }

  return `${roundTo(value, places).toFixed(places)}${suffix}`;
};

export const normalizePositiveFoodInput = (
  value: string,
  fallback: number,
  places = 1,
): string => {
  const parsed = Number(value.trim().replace(",", "."));

  if (Number.isFinite(parsed) && parsed > 0) {
    return value;
  }

  const safeFallback =
    Number.isFinite(fallback) && fallback > 0 ? roundTo(fallback, places) : 1;

  if (Number.isInteger(safeFallback)) {
    return String(safeFallback);
  }

  return String(safeFallback);
};

export const getFoodResolvedServing = (
  food: Pick<DBFoodItem, "nutritionBasis" | "servingSizeValue" | "servingSizeUnit">,
) => {
  const fallback = FOOD_BASIS_DEFAULTS[food.nutritionBasis];

  return {
    value: food.servingSizeValue ?? fallback.value,
    unit: food.servingSizeUnit?.trim() || fallback.unit,
  };
};

export const getFoodDefaultLogAmount = (
  food: Pick<DBFoodItem, "nutritionBasis" | "servingSizeValue" | "servingSizeUnit">,
): number => getFoodResolvedServing(food).value;

export const formatFoodItemServing = (
  food: Pick<DBFoodItem, "nutritionBasis" | "servingSizeValue" | "servingSizeUnit">,
): string => {
  const serving = getFoodResolvedServing(food);
  return formatFoodServing(serving.value, serving.unit);
};

export const formatFoodMacro = (
  value: number | null | undefined,
  label: string,
): string => `${formatFoodNumber(value, "", 0)}${label}`;

export const formatFoodSourceLabel = (source: string): string => {
  switch (source) {
    case "recipe":
      return "Recipe";
    case "custom":
      return "Custom";
    case "manual":
      return "Manual";
    case "open_food_facts":
      return "Open Food Facts";
    case "import":
      return "Import";
    case "usda":
      return "USDA";
    default:
      return source
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
  }
};

export const calculateQuickAddCaloriesFromMacros = ({
  carbsG = 0,
  fatG = 0,
  proteinG = 0,
}: {
  carbsG?: number | null;
  fatG?: number | null;
  proteinG?: number | null;
}): number =>
  roundTo(
    (proteinG ?? 0) * 4 +
      (carbsG ?? 0) * 4 +
      (fatG ?? 0) * 9,
    0,
  );

export const calculateLoggedNutrition = (
  entry: DBUserFoodLogEntry,
): FoodNutritionTotals => {
  if (entry.entrySource === "quick_add") {
    return {
      calories: roundTo(entry.calories, 0),
      proteinG: roundTo(entry.proteinG),
      carbsG: roundTo(entry.carbsG),
      fatG: roundTo(entry.fatG),
    };
  }

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
): FoodNutritionTotals => {
  const totals = entries.reduce<FoodNutritionTotals>(
    (accumulator, entry) => {
      if (entry.entrySource === "quick_add") {
        accumulator.calories += entry.calories;
        accumulator.proteinG += entry.proteinG;
        accumulator.carbsG += entry.carbsG;
        accumulator.fatG += entry.fatG;
        return accumulator;
      }

      const factor =
        entry.servingSize > 0 ? entry.quantityG / entry.servingSize : 1;

      accumulator.calories += entry.calories * factor;
      accumulator.proteinG += entry.proteinG * factor;
      accumulator.carbsG += entry.carbsG * factor;
      accumulator.fatG += entry.fatG * factor;
      return accumulator;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    calories: roundTo(totals.calories, 0),
    proteinG: roundTo(totals.proteinG),
    carbsG: roundTo(totals.carbsG),
    fatG: roundTo(totals.fatG),
  };
};

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
  `${roundTo(totals.calories)}kcal`;
