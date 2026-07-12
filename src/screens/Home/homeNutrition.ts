import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBFoodNutrientDetails,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import type { FoodNutritionTotals } from "../Food/foodUtils";
import {
  formatFoodDateKey,
  getEntryScaleFactor,
  shiftFoodDate,
  sumLoggedNutrition,
} from "../Food/foodUtils";

type MicronutrientGroup = "Vitamins" | "Minerals";
type MicronutrientUnit = "mg" | "ug";

export type MicronutrientKey =
  | "vitaminAUg"
  | "vitaminCMg"
  | "vitaminDUg"
  | "vitaminEMg"
  | "vitaminKUg"
  | "thiaminB1Mg"
  | "riboflavinB2Mg"
  | "niacinB3Mg"
  | "pantothenicAcidB5Mg"
  | "vitaminB6Mg"
  | "biotinB7Ug"
  | "folateB9Ug"
  | "vitaminB12Ug"
  | "cholineMg"
  | "calciumMg"
  | "ironMg"
  | "magnesiumMg"
  | "phosphorusMg"
  | "potassiumMg"
  | "sodiumMg"
  | "zincMg"
  | "copperMg"
  | "manganeseMg"
  | "seleniumUg"
  | "iodineUg"
  | "chromiumUg"
  | "molybdenumUg";

export type MicronutrientTotals = Record<MicronutrientKey, number>;

export type MicronutrientMeta = {
  group: MicronutrientGroup;
  key: MicronutrientKey;
  label: string;
  unit: MicronutrientUnit;
};

export type NutritionSnapshot = {
  dates: string[];
  entries: DBUserFoodLogEntry[];
  totals: FoodNutritionTotals;
  micronutrients: MicronutrientTotals;
  trackedMicronutrientCount: number;
};

type LoadNutritionSnapshotOptions = {
  forceRefresh?: boolean;
};

export const MICRONUTRIENT_META: MicronutrientMeta[] = [
  { key: "vitaminAUg", label: "Vitamin A", unit: "ug", group: "Vitamins" },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg", group: "Vitamins" },
  { key: "vitaminDUg", label: "Vitamin D", unit: "ug", group: "Vitamins" },
  { key: "vitaminEMg", label: "Vitamin E", unit: "mg", group: "Vitamins" },
  { key: "vitaminKUg", label: "Vitamin K", unit: "ug", group: "Vitamins" },
  { key: "thiaminB1Mg", label: "Vitamin B1", unit: "mg", group: "Vitamins" },
  {
    key: "riboflavinB2Mg",
    label: "Vitamin B2",
    unit: "mg",
    group: "Vitamins",
  },
  { key: "niacinB3Mg", label: "Vitamin B3", unit: "mg", group: "Vitamins" },
  {
    key: "pantothenicAcidB5Mg",
    label: "Vitamin B5",
    unit: "mg",
    group: "Vitamins",
  },
  { key: "vitaminB6Mg", label: "Vitamin B6", unit: "mg", group: "Vitamins" },
  { key: "biotinB7Ug", label: "Vitamin B7", unit: "ug", group: "Vitamins" },
  { key: "folateB9Ug", label: "Vitamin B9", unit: "ug", group: "Vitamins" },
  {
    key: "vitaminB12Ug",
    label: "Vitamin B12",
    unit: "ug",
    group: "Vitamins",
  },
  { key: "cholineMg", label: "Choline", unit: "mg", group: "Vitamins" },
  { key: "calciumMg", label: "Calcium", unit: "mg", group: "Minerals" },
  { key: "ironMg", label: "Iron", unit: "mg", group: "Minerals" },
  { key: "magnesiumMg", label: "Magnesium", unit: "mg", group: "Minerals" },
  { key: "phosphorusMg", label: "Phosphorus", unit: "mg", group: "Minerals" },
  { key: "potassiumMg", label: "Potassium", unit: "mg", group: "Minerals" },
  { key: "sodiumMg", label: "Sodium", unit: "mg", group: "Minerals" },
  { key: "zincMg", label: "Zinc", unit: "mg", group: "Minerals" },
  { key: "copperMg", label: "Copper", unit: "mg", group: "Minerals" },
  { key: "manganeseMg", label: "Manganese", unit: "mg", group: "Minerals" },
  { key: "seleniumUg", label: "Selenium", unit: "ug", group: "Minerals" },
  { key: "iodineUg", label: "Iodine", unit: "ug", group: "Minerals" },
  { key: "chromiumUg", label: "Chromium", unit: "ug", group: "Minerals" },
  {
    key: "molybdenumUg",
    label: "Molybdenum",
    unit: "ug",
    group: "Minerals",
  },
];

const MICRONUTRIENT_PREVIEW_ORDER: MicronutrientKey[] = [
  "vitaminDUg",
  "magnesiumMg",
  "ironMg",
  "potassiumMg",
];

const roundTo = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const createEmptyMicronutrientTotals = (): MicronutrientTotals =>
  Object.fromEntries(
    MICRONUTRIENT_META.map(({ key }) => [key, 0]),
  ) as MicronutrientTotals;

const getEntryFactor = (entry: DBUserFoodLogEntry) => {
  if (entry.foodId == null || entry.entrySource === "quick_add") {
    return 0;
  }

  return getEntryScaleFactor(entry);
};

const getMicronutrientValueFromFood = (
  food: DBFoodItem,
  key: MicronutrientKey,
): number => {
  if (key === "vitaminKUg") {
    return (
      food.vitaminKUg ??
      (food.vitaminK1Ug ?? 0) + (food.vitaminK2Ug ?? 0)
    );
  }

  const value = food[key as keyof DBFoodNutrientDetails];
  return typeof value === "number" ? value : 0;
};

const finalizeMicronutrientTotals = (
  totals: MicronutrientTotals,
): MicronutrientTotals =>
  Object.fromEntries(
    MICRONUTRIENT_META.map(({ key }) => [key, roundTo(totals[key])]),
  ) as MicronutrientTotals;

export const countTrackedMicronutrients = (
  totals: MicronutrientTotals,
): number =>
  MICRONUTRIENT_META.reduce(
    (count, { key }) => count + (totals[key] > 0.001 ? 1 : 0),
    0,
  );

export const averageMicronutrientTotals = (
  totals: MicronutrientTotals,
  divisor: number,
): MicronutrientTotals => {
  const safeDivisor = divisor > 0 ? divisor : 1;

  return Object.fromEntries(
    MICRONUTRIENT_META.map(({ key }) => [key, roundTo(totals[key] / safeDivisor)]),
  ) as MicronutrientTotals;
};

export const getMicronutrientRows = (totals: MicronutrientTotals) =>
  MICRONUTRIENT_META.map((meta) => ({
    ...meta,
    value: totals[meta.key],
  }));

export const getMicronutrientPreviewItems = (
  totals: MicronutrientTotals,
  limit = 4,
) => {
  const rows = getMicronutrientRows(totals);
  const rowMap = new Map(rows.map((row) => [row.key, row]));

  return MICRONUTRIENT_PREVIEW_ORDER.map((key) => rowMap.get(key))
    .filter((row): row is (typeof rows)[number] => Boolean(row))
    .slice(0, limit);
};

export const buildRecentDateKeys = (days: number, anchor = new Date()) =>
  Array.from({ length: Math.max(1, days) }, (_, index) =>
    formatFoodDateKey(shiftFoodDate(anchor, -index)),
  );

export const formatMicronutrientValue = (
  value: number,
  unit: MicronutrientUnit,
) => {
  const absolute = Math.abs(value);
  const maximumFractionDigits =
    absolute >= 100 ? 0 : absolute >= 10 ? 1 : absolute >= 1 ? 1 : 2;

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits,
  })} ${unit}`;
};

export const loadNutritionSnapshot = async (
  userExternalId: string,
  dates: string[],
  options: LoadNutritionSnapshotOptions = {},
): Promise<NutritionSnapshot> => {
  const safeDates = dates.length > 0 ? dates : [formatFoodDateKey(new Date())];
  const sortedDates = [...safeDates].sort();
  const requestedDateSet = new Set(safeDates);
  const readOptions = options.forceRefresh ? { forceRefresh: true } : undefined;
  const entriesInRange = await DB.getUserFoodLogEntriesBetween(
    userExternalId,
    sortedDates[0],
    sortedDates[sortedDates.length - 1],
    readOptions,
  );
  const entries = entriesInRange.filter((entry) =>
    requestedDateSet.has(entry.date),
  );
  const uniqueFoodIds = [...new Set(entries.map((entry) => entry.foodId).filter(
    (foodId): foodId is number => foodId != null,
  ))];
  const foods = await DB.getFoodItemsByIds(uniqueFoodIds);
  const foodMap = new Map<number, DBFoodItem>();

  for (const food of foods) {
    foodMap.set(food.id, food);
  }

  const micronutrients = entries.reduce<MicronutrientTotals>((accumulator, entry) => {
    if (entry.foodId == null) {
      return accumulator;
    }

    const food = foodMap.get(entry.foodId);
    if (!food) {
      return accumulator;
    }

    const factor = getEntryFactor(entry);
    if (factor <= 0) {
      return accumulator;
    }

    for (const { key } of MICRONUTRIENT_META) {
      accumulator[key] += getMicronutrientValueFromFood(food, key) * factor;
    }

    return accumulator;
  }, createEmptyMicronutrientTotals());

  const finalizedMicronutrients = finalizeMicronutrientTotals(micronutrients);

  return {
    dates: safeDates,
    entries,
    totals: sumLoggedNutrition(entries),
    micronutrients: finalizedMicronutrients,
    trackedMicronutrientCount: countTrackedMicronutrients(finalizedMicronutrients),
  };
};
