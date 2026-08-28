import type {
  DBDiaryDayStatus,
  DBUserFoodLogEntry,
  UserFoodLogSource,
} from "../../store/DB_TYPES";
import type { FoodLogCopyResult } from "../../store/foodLogCopyUtils";
import { apiRequest, getDeviceTimeZone } from "./client";

// Diary transport.
//
// The API returns a whole day — meals, entries, per-meal totals, day totals and
// goals — in one response. `toDbEntries` flattens that back into the
// `DBUserFoodLogEntry[]` shape the existing screens consume, so the migration
// does not require rewriting every screen at once. Screens that want the richer
// representation can use `getDiaryDay` directly.

export type ApiNutritionTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type ApiMealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

export type ApiDiaryEntry = {
  id: number;
  entryType: UserFoodLogSource;
  foodId: number | null;
  date: string;
  loggedAt: string;
  createdAt: string;
  mealType: string | null;
  mealSlot: ApiMealSlot;
  quantity: number;
  unit: string;
  servingSize: number;
  servingUnit: string;
  displayName: string;
  quickAddName: string | null;
  isEnergyManuallySet: boolean;
  systemCalculatedCalories: number | null;
  alcoholG: number | null;
  nutrition: ApiNutritionTotals;
};

export type ApiDiaryMeal = {
  slot: ApiMealSlot;
  label: string;
  totals: ApiNutritionTotals;
  entries: ApiDiaryEntry[];
};

export type ApiDiaryDay = {
  date: string;
  timezone: string;
  isComplete: boolean;
  completedAt: string | null;
  totals: ApiNutritionTotals;
  goals: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  };
  meals: ApiDiaryMeal[];
  entryCount: number;
};

// The API returns nutrition already scaled for the logged quantity, but
// DBUserFoodLogEntry stores per-serving values that screens re-scale via
// `getEntryScaleFactor`. Convert back so both paths agree.
const toPerServing = (entry: ApiDiaryEntry, value: number): number => {
  if (entry.entryType === "quick_add") {
    return value;
  }
  const factor =
    entry.servingSize > 0 && entry.quantity > 0
      ? entry.quantity / entry.servingSize
      : 1;
  return factor === 0 ? 0 : value / factor;
};

export const toDbEntry = (
  entry: ApiDiaryEntry,
  userExternalId: string,
): DBUserFoodLogEntry => ({
  id: entry.id,
  userExternalId,
  foodId: entry.foodId,
  date: entry.date,
  loggedAt: entry.loggedAt,
  quantityG: entry.quantity,
  mealType: entry.mealType,
  createdAt: entry.createdAt,
  entrySource: entry.entryType,
  foodName: entry.displayName,
  servingSize: entry.servingSize,
  servingUnit: entry.servingUnit,
  calories: toPerServing(entry, entry.nutrition.calories),
  proteinG: toPerServing(entry, entry.nutrition.proteinG),
  carbsG: toPerServing(entry, entry.nutrition.carbsG),
  fatG: toPerServing(entry, entry.nutrition.fatG),
  alcoholG: entry.alcoholG,
  systemCalculatedCalories: entry.systemCalculatedCalories,
  isEnergyManuallySet: entry.isEnergyManuallySet,
  quickAddName: entry.quickAddName,
});

export const toDbEntries = (
  day: ApiDiaryDay,
  userExternalId: string,
): DBUserFoodLogEntry[] =>
  day.meals
    .flatMap((meal) => meal.entries)
    .map((entry) => toDbEntry(entry, userExternalId))
    .sort((left, right) => left.loggedAt.localeCompare(right.loggedAt));

export const toDbDiaryDayStatus = (
  day: ApiDiaryDay,
  userExternalId: string,
): DBDiaryDayStatus => ({
  userExternalId,
  date: day.date,
  isComplete: day.isComplete,
  completedAt: day.completedAt,
  createdAt: day.completedAt ?? new Date().toISOString(),
  updatedAt: day.completedAt ?? new Date().toISOString(),
});

export type ApiDiaryRange = {
  startDate: string;
  endDate: string;
  timezone: string;
  days: ApiDiaryDay[];
};

// One request for a whole window. Home, weekly review and export use this
// instead of looping over single days.
export const getDiaryRange = (
  startDate: string,
  endDate: string,
): Promise<ApiDiaryRange> =>
  apiRequest<ApiDiaryRange>("/v1/diary", {
    query: { start: startDate, end: endDate, tz: getDeviceTimeZone() },
  });

export const getDiaryDay = (date: string): Promise<ApiDiaryDay> =>
  apiRequest<ApiDiaryDay>(`/v1/diary/${date}`, {
    query: { tz: getDeviceTimeZone() },
  });

export const addFoodEntry = (input: {
  date: string;
  foodId: number;
  quantity: number;
  mealType?: string | null;
  loggedAt?: string | null;
}): Promise<ApiDiaryEntry> =>
  apiRequest<ApiDiaryEntry>(`/v1/diary/${input.date}/entries`, {
    method: "POST",
    query: { tz: getDeviceTimeZone() },
    body: {
      kind: "food",
      foodId: input.foodId,
      quantity: input.quantity,
      mealType: input.mealType ?? null,
      loggedAt: input.loggedAt ?? null,
    },
  });

export const addQuickAddEntry = (input: {
  date: string;
  name?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  alcoholG?: number | null;
  mealType?: string | null;
  loggedAt?: string | null;
}): Promise<ApiDiaryEntry> =>
  apiRequest<ApiDiaryEntry>(`/v1/diary/${input.date}/entries`, {
    method: "POST",
    query: { tz: getDeviceTimeZone() },
    body: { kind: "quick_add", ...input, date: undefined },
  });

export const updateEntry = (
  id: number,
  patch: {
    quantity?: number;
    mealType?: string | null;
    loggedAt?: string;
    name?: string | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    alcoholG?: number | null;
  },
): Promise<ApiDiaryEntry> =>
  apiRequest<ApiDiaryEntry>(`/v1/diary/entries/${id}`, {
    method: "PATCH",
    query: { tz: getDeviceTimeZone() },
    body: patch,
  });

export const deleteEntry = (
  id: number,
): Promise<{ deleted: true; date: string }> =>
  apiRequest(`/v1/diary/entries/${id}`, { method: "DELETE" });

export const copyDay = (
  toDate: string,
  fromDate: string,
): Promise<FoodLogCopyResult> =>
  apiRequest<FoodLogCopyResult>(`/v1/diary/${toDate}/copy-from`, {
    method: "POST",
    query: { tz: getDeviceTimeZone() },
    body: { fromDate },
  });

export const setDayComplete = (
  date: string,
  isComplete: boolean,
): Promise<{ date: string; isComplete: boolean; completedAt: string | null }> =>
  apiRequest(`/v1/diary/${date}/complete`, {
    method: "PUT",
    body: { isComplete },
  });
