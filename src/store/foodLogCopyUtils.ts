import type { DBUserFoodLogEntry, UserFoodLogSource } from "./DB_TYPES";

export type FoodLogCopyResult = {
  sourceCount: number;
  destinationCount: number;
  copiedCount: number;
  skippedDuplicates: number;
};

export type FoodLogDuplicateShape = {
  entrySource: UserFoodLogSource;
  foodId: number | null;
  loggedAt: string | null;
  createdAt: string | null;
  quantityValue: number | null;
  mealType: string | null;
  displayName: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  alcoholG: number | null;
  systemCalculatedCalories: number | null;
  isEnergyManuallySet: boolean;
  quickAddName: string | null;
};

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const formatNumber = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  return String(value);
};

const getTimeOfDayKey = (
  loggedAt: string | null | undefined,
  createdAt: string | null | undefined,
) => {
  const source = loggedAt ?? createdAt;
  if (!source) {
    return "no-time";
  }

  const parsed = new Date(source);
  if (!Number.isFinite(parsed.getTime())) {
    return source;
  }

  return [
    String(parsed.getHours()).padStart(2, "0"),
    String(parsed.getMinutes()).padStart(2, "0"),
    String(parsed.getSeconds()).padStart(2, "0"),
  ].join(":");
};

export const buildFoodLogDuplicateKey = (entry: FoodLogDuplicateShape) => {
  const baseParts = [
    entry.entrySource,
    entry.foodId == null ? "" : String(entry.foodId),
    getTimeOfDayKey(entry.loggedAt, entry.createdAt),
    formatNumber(entry.quantityValue),
    normalizeText(entry.mealType),
  ];

  if (entry.entrySource === "quick_add") {
    return [
      ...baseParts,
      normalizeText(entry.quickAddName || entry.displayName),
      formatNumber(entry.calories),
      formatNumber(entry.proteinG),
      formatNumber(entry.carbsG),
      formatNumber(entry.fatG),
      formatNumber(entry.alcoholG),
      formatNumber(entry.systemCalculatedCalories),
      entry.isEnergyManuallySet ? "1" : "0",
    ].join("|");
  }

  return baseParts.join("|");
};

export const toFoodLogDuplicateShape = (
  entry: DBUserFoodLogEntry,
): FoodLogDuplicateShape => ({
  entrySource: entry.entrySource,
  foodId: entry.foodId,
  loggedAt: entry.loggedAt ?? null,
  createdAt: entry.createdAt ?? null,
  quantityValue: entry.quantityG,
  mealType: entry.mealType ?? null,
  displayName: entry.foodName ?? null,
  calories: entry.calories ?? null,
  proteinG: entry.proteinG ?? null,
  carbsG: entry.carbsG ?? null,
  fatG: entry.fatG ?? null,
  alcoholG: entry.alcoholG ?? null,
  systemCalculatedCalories: entry.systemCalculatedCalories ?? null,
  isEnergyManuallySet: Boolean(entry.isEnergyManuallySet),
  quickAddName: entry.quickAddName ?? null,
});

export const countFoodLogsByDuplicateKey = (
  entries: FoodLogDuplicateShape[],
) => {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const key = buildFoodLogDuplicateKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
};

export const getFoodLogEntriesToCopy = (
  sourceEntries: DBUserFoodLogEntry[],
  destinationEntries: DBUserFoodLogEntry[],
): DBUserFoodLogEntry[] => {
  const remainingDestinationMatches = countFoodLogsByDuplicateKey(
    destinationEntries.map(toFoodLogDuplicateShape),
  );

  return sourceEntries.filter((entry) => {
    const key = buildFoodLogDuplicateKey(toFoodLogDuplicateShape(entry));
    const availableMatches = remainingDestinationMatches.get(key) ?? 0;

    if (availableMatches > 0) {
      remainingDestinationMatches.set(key, availableMatches - 1);
      return false;
    }

    return true;
  });
};

export const getFoodLogCopyPreview = (
  sourceEntries: DBUserFoodLogEntry[],
  destinationEntries: DBUserFoodLogEntry[],
): FoodLogCopyResult => {
  const entriesToCopy = getFoodLogEntriesToCopy(
    sourceEntries,
    destinationEntries,
  );
  const skippedDuplicates = sourceEntries.length - entriesToCopy.length;

  return {
    sourceCount: sourceEntries.length,
    destinationCount: destinationEntries.length,
    copiedCount: entriesToCopy.length,
    skippedDuplicates,
  };
};
