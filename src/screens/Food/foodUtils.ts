import type { DBFoodItem, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import {
  getFoodResolvedServing,
  roundNutrient,
  type FoodNutritionTotals,
} from "../../engine/nutrition";

// Nutrition math lives in src/engine/nutrition.ts; re-exported here so food
// screens keep one import site for both math and diary formatting helpers.
export {
  calculateLoggedNutrition,
  calculateQuickAddCaloriesFromMacros,
  getEntryScaleFactor,
  getFoodDefaultLogAmount,
  getFoodQuantityFactor,
  getFoodResolvedServing,
  getLoggedCaloriesRaw,
  getQuantityScaleFactor,
  scaleFoodNutritionForQuantity,
  sumLoggedNutrition,
} from "../../engine/nutrition";
export type { FoodNutritionTotals } from "../../engine/nutrition";

export const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

const roundTo = roundNutrient;

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

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snacks"];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

// Representative time-of-day used when logging into a meal on a past/future day,
// so entries stay roughly ordered without asking for an exact clock time.
export const MEAL_SLOT_DEFAULT_HOUR: Record<MealSlot, number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19,
  snacks: 16,
};

export const getMealSlotForHour = (hour: number): MealSlot => {
  if (hour < 11) {
    return "breakfast";
  }
  if (hour < 16) {
    return "lunch";
  }
  if (hour < 21) {
    return "dinner";
  }
  return "snacks";
};

export const getDefaultMealSlotForNow = (): MealSlot =>
  getMealSlotForHour(new Date().getHours());

export const getMealSlotFromLabel = (
  value: string | null | undefined,
): MealSlot | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("breakfast")) {
    return "breakfast";
  }
  if (normalized.includes("lunch")) {
    return "lunch";
  }
  if (normalized.includes("dinner")) {
    return "dinner";
  }
  if (normalized.includes("snack")) {
    return "snacks";
  }
  return null;
};

// Group any entry into a meal slot: trust an explicit mealType label when it maps
// to a known slot, otherwise fall back to the time it was logged (legacy entries).
export const resolveEntryMealSlot = (
  entry: Pick<DBUserFoodLogEntry, "mealType" | "loggedAt" | "createdAt">,
): MealSlot =>
  getMealSlotFromLabel(entry.mealType) ??
  getMealSlotForHour(getFoodLoggedHour(entry.loggedAt ?? entry.createdAt));

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
