import {
  addFoodEntry,
  addQuickAddEntry,
  copyDay,
  deleteEntry as deleteEntryRequest,
  getDiaryDay,
  getDiaryRange,
  setDayComplete,
  toDbDiaryDayStatus,
  toDbEntries,
  toDbEntry,
  updateEntry as updateEntryRequest,
  type ApiDiaryDay,
} from "../API/nouri/diaryApi";
import { NouriApiError } from "../API/nouri/client";
import { getSupabaseSessionUser } from "../API/supabase/client";
import { getFoodResolvedServing } from "../engine/nutrition";
import { shouldUseExpoGoDevLocalStore } from "../dev/expoGoDevAuth";
import {
  measureDiaryRequest,
  measureDiaryStep,
  recordDiaryCachePath,
  recordDiaryRows,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
import {
  deleteCachedFoodLogEntry,
  getCachedDiaryDayStatus,
  getCachedFoodLogEntriesBetween,
  getCachedFoodLogEntriesByDate,
  getCachedFoodLogEntryById,
  listCachedDiaryDayStatusesBetween,
  markCachedFoodLogEntryDeleted,
  replaceCachedFoodLogEntriesBetween,
  replaceCachedFoodLogEntriesForDate,
  restoreCachedFoodLogEntry,
  upsertCachedDiaryDayStatuses,
  upsertCachedFoodLogEntries,
} from "./cacheRepository";
import type {
  AddQuickAddFoodLogInput,
  AddUserFoodLogInput,
  DBDiaryDayStatus,
  DBUserFoodLogEntry,
  SaveDiaryDayStatusInput,
  UpdateQuickAddFoodLogInput,
  UpdateUserFoodLogInput,
} from "./DB_TYPES";
import type { FoodLogCopyResult } from "./foodLogCopyUtils";
import { getFoodItemById as getCachedFoodItemById } from "./foodRepository";
import {
  addQuickAddFoodLog as addQuickAddFoodLogLocal,
  addUserFoodLog as addUserFoodLogLocal,
  copyFoodLogsFromDate as copyFoodLogsFromDateLocal,
  deleteUserFoodLog as deleteUserFoodLogLocal,
  getUserFoodLogEntriesBetween as getUserFoodLogEntriesBetweenLocal,
  getUserFoodLogEntriesByDate as getUserFoodLogEntriesByDateLocal,
  getUserFoodLogEntryById as getUserFoodLogEntryByIdLocal,
  updateQuickAddFoodLog as updateQuickAddFoodLogLocal,
  updateUserFoodLog as updateUserFoodLogLocal,
} from "./foodLogRepository";

// The diary, served by the Nouri API.
//
// This replaces the direct-to-Supabase implementation that used to live in
// supabaseFoodStore.ts. The read pattern is unchanged and deliberately so:
// answer from the local SQLite cache when it has rows, refresh in the
// background, and only block on the network when the cache is empty. The API
// simply replaces PostgREST as the remote.
//
// What did change: the server now computes meal grouping, per-meal totals, day
// totals and goals, so one request replaces the several the app used to make.
//
// There is no write fallback to Supabase. A failed write fails visibly and its
// optimistic cache row is rolled back, exactly as before.

const FOOD_LOG_READ_SOURCE = "supabase" as const;

let pendingFoodLogIdSequence = 0;

// Negative, monotonic ids for optimistic rows so they cannot collide with real
// server ids and are easy to sweep if a write is interrupted.
const nextPendingFoodLogCacheId = () => {
  pendingFoodLogIdSequence = (pendingFoodLogIdSequence + 1) % 1000;
  return -(Date.now() * 1000 + pendingFoodLogIdSequence);
};

// Expo Go development runs entirely against local SQLite and never reaches the
// network. Resolving to null here short-circuits every remote path below.
const resolveUserId = async (
  userExternalId?: string | null,
): Promise<string | null> => {
  if (await shouldUseExpoGoDevLocalStore(userExternalId)) {
    return null;
  }

  const sessionUser = await getSupabaseSessionUser();
  return sessionUser?.id ?? null;
};

const cacheDay = async (day: ApiDiaryDay, userExternalId: string) => {
  const entries = toDbEntries(day, userExternalId);
  await replaceCachedFoodLogEntriesForDate(userExternalId, day.date, entries);
  await upsertCachedDiaryDayStatuses(userExternalId, [
    toDbDiaryDayStatus(day, userExternalId),
  ]);
  return entries;
};

export const getUserFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  const userId = await resolveUserId(userExternalId);

  if (!userId) {
    return getUserFoodLogEntriesByDateLocal(userExternalId, date);
  }

  const cached = await getCachedFoodLogEntriesByDate(userExternalId, date);
  if (cached.length > 0) {
    void getDiaryDay(date)
      .then((day) => cacheDay(day, userExternalId))
      .catch(() => undefined);
    return cached;
  }

  const day = await getDiaryDay(date);
  return cacheDay(day, userExternalId);
};

type FoodLogEntriesReadOptions = {
  forceRefresh?: boolean;
  perfTrace?: DiaryPerfTrace;
};

export const getUserFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
  options: FoodLogEntriesReadOptions = {},
): Promise<DBUserFoodLogEntry[]> => {
  const perfTrace = options.perfTrace;
  const userId = await measureDiaryStep(perfTrace, "week-entries.resolve-session", () =>
    resolveUserId(userExternalId),
  );

  if (!userId) {
    return getUserFoodLogEntriesBetweenLocal(userExternalId, startDate, endDate);
  }

  const cached = await measureDiaryRequest(perfTrace, "week-entries", "sqlite", () =>
    getCachedFoodLogEntriesBetween(userExternalId, startDate, endDate),
  );

  const refresh = async (source: "supabase" | "background-supabase") => {
    const range = await measureDiaryRequest(perfTrace, "week-entries", source, () =>
      getDiaryRange(startDate, endDate),
    );
    const entries = range.days.flatMap((day) => toDbEntries(day, userExternalId));
    await measureDiaryStep(perfTrace, "week-entries.cache-write", async () => {
      await replaceCachedFoodLogEntriesBetween(
        userExternalId,
        startDate,
        endDate,
        entries,
      );
      await upsertCachedDiaryDayStatuses(
        userExternalId,
        range.days.map((day) => toDbDiaryDayStatus(day, userExternalId)),
      );
    });
    return entries;
  };

  if (!options.forceRefresh && cached.length > 0) {
    recordDiaryCachePath(perfTrace, "week-entries", "sqlite-nonempty-hit");
    recordDiaryRows(perfTrace, "week-entries", cached.length);
    void refresh("background-supabase").catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "week-entries", "empty-or-unknown");
  const entries = await refresh(FOOD_LOG_READ_SOURCE);
  recordDiaryRows(perfTrace, "week-entries", entries.length);
  return entries;
};

export const getUserFoodLogEntryById = async (
  id: number,
): Promise<DBUserFoodLogEntry | null> => {
  const userId = await resolveUserId();

  if (!userId) {
    return getUserFoodLogEntryByIdLocal(id);
  }

  // Entries are only addressable through the day that contains them, so the
  // cache is the lookup index. A cache miss means we do not know the date and
  // cannot fetch the row without scanning; callers always read a day first.
  return getCachedFoodLogEntryById(id, userId);
};

export const addUserFoodLog = async (
  input: AddUserFoodLogInput,
): Promise<void> => {
  const userId = await resolveUserId(input.userExternalId);

  if (!userId) {
    return addUserFoodLogLocal(input);
  }

  const loggedAt = input.loggedAt ?? new Date().toISOString();
  const pendingId = nextPendingFoodLogCacheId();

  // Optimistic row, built from the locally cached food so the diary shows the
  // real name and a correct preview immediately. The server response replaces
  // it with the authoritative values a moment later; the two agree because both
  // scale the same per-serving numbers the same way.
  const cachedFood = await getCachedFoodItemById(input.foodId).catch(() => null);
  const optimisticServing = cachedFood
    ? getFoodResolvedServing(cachedFood)
    : { value: 1, unit: "g" };

  await upsertCachedFoodLogEntries(
    input.userExternalId,
    [
      {
        id: pendingId,
        userExternalId: input.userExternalId,
        foodId: input.foodId,
        date: input.date,
        loggedAt,
        quantityG: input.quantityG,
        mealType: input.mealType ?? null,
        createdAt: loggedAt,
        entrySource: "food_item",
        foodName: cachedFood?.name ?? "",
        servingSize: optimisticServing.value,
        servingUnit: optimisticServing.unit,
        calories: cachedFood?.calories ?? 0,
        proteinG: cachedFood?.proteinG ?? 0,
        carbsG: cachedFood?.carbsG ?? 0,
        fatG: cachedFood?.fatG ?? 0,
        alcoholG: cachedFood?.alcoholG ?? null,
        systemCalculatedCalories: null,
        isEnergyManuallySet: false,
        quickAddName: null,
      },
    ],
    "pending",
  );

  try {
    const entry = await addFoodEntry({
      date: input.date,
      foodId: input.foodId,
      quantity: input.quantityG,
      mealType: input.mealType ?? null,
      loggedAt,
    });
    await deleteCachedFoodLogEntry(pendingId, input.userExternalId);
    await upsertCachedFoodLogEntries(input.userExternalId, [
      toDbEntry(entry, input.userExternalId),
    ]);
    await markDayIncompleteInCache(input.userExternalId, input.date);
  } catch (error) {
    // A failed add must leave no trace, or totals keep counting an entry that
    // was never saved.
    await deleteCachedFoodLogEntry(pendingId, input.userExternalId);
    throw error;
  }
};

export const addQuickAddFoodLog = async (
  input: AddQuickAddFoodLogInput,
): Promise<number> => {
  const userId = await resolveUserId(input.userExternalId);

  if (!userId) {
    return addQuickAddFoodLogLocal(input);
  }

  const loggedAt = input.loggedAt ?? new Date().toISOString();
  const pendingId = nextPendingFoodLogCacheId();

  await upsertCachedFoodLogEntries(
    input.userExternalId,
    [
      {
        id: pendingId,
        userExternalId: input.userExternalId,
        foodId: null,
        date: input.date,
        loggedAt,
        quantityG: 1,
        mealType: input.mealType ?? null,
        createdAt: loggedAt,
        entrySource: "quick_add",
        foodName: input.name?.trim() || "Quick Add",
        servingSize: 1,
        servingUnit: "entry",
        calories: input.calories,
        proteinG: input.proteinG ?? 0,
        carbsG: input.carbsG ?? 0,
        fatG: input.fatG ?? 0,
        alcoholG: input.alcoholG ?? 0,
        systemCalculatedCalories: input.systemCalculatedCalories ?? null,
        isEnergyManuallySet: Boolean(input.isEnergyManuallySet),
        quickAddName: input.name ?? null,
      },
    ],
    "pending",
  );

  try {
    const entry = await addQuickAddEntry({
      date: input.date,
      name: input.name ?? null,
      calories: input.calories,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      alcoholG: input.alcoholG ?? null,
      mealType: input.mealType ?? null,
      loggedAt,
    });
    await deleteCachedFoodLogEntry(pendingId, input.userExternalId);
    await upsertCachedFoodLogEntries(input.userExternalId, [
      toDbEntry(entry, input.userExternalId),
    ]);
    await markDayIncompleteInCache(input.userExternalId, input.date);
    return entry.id;
  } catch (error) {
    await deleteCachedFoodLogEntry(pendingId, input.userExternalId);
    throw error;
  }
};

export const updateUserFoodLog = async (
  input: UpdateUserFoodLogInput,
): Promise<void> => {
  const userId = await resolveUserId();

  if (!userId) {
    return updateUserFoodLogLocal(input);
  }

  const entry = await updateEntryRequest(input.id, {
    quantity: input.quantityG,
    mealType: input.mealType ?? null,
    ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
  });

  await upsertCachedFoodLogEntries(userId, [toDbEntry(entry, userId)]);
  await markDayIncompleteInCache(userId, entry.date);
};

export const updateQuickAddFoodLog = async (
  input: UpdateQuickAddFoodLogInput,
): Promise<void> => {
  const userId = await resolveUserId();

  if (!userId) {
    return updateQuickAddFoodLogLocal(input);
  }

  const entry = await updateEntryRequest(input.id, {
    name: input.name ?? null,
    calories: input.calories,
    proteinG: input.proteinG ?? null,
    carbsG: input.carbsG ?? null,
    fatG: input.fatG ?? null,
    alcoholG: input.alcoholG ?? null,
    mealType: input.mealType ?? null,
    ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
  });

  await upsertCachedFoodLogEntries(userId, [toDbEntry(entry, userId)]);
  await markDayIncompleteInCache(userId, entry.date);
};

export const deleteUserFoodLog = async (id: number): Promise<void> => {
  const userId = await resolveUserId();

  if (!userId) {
    return deleteUserFoodLogLocal(id);
  }

  // Hide optimistically, restore if the server rejects it, so local and remote
  // state never silently diverge.
  await markCachedFoodLogEntryDeleted(id, userId);

  try {
    const result = await deleteEntryRequest(id);
    await deleteCachedFoodLogEntry(id, userId);
    await markDayIncompleteInCache(userId, result.date);
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      // Already gone server-side; converge rather than resurrect it.
      await deleteCachedFoodLogEntry(id, userId);
      return;
    }
    await restoreCachedFoodLogEntry(id, userId);
    throw error;
  }
};

export const copyFoodLogsFromDate = async (
  userExternalId: string,
  fromDate: string,
  toDate: string,
): Promise<FoodLogCopyResult> => {
  const userId = await resolveUserId(userExternalId);

  if (!userId) {
    return copyFoodLogsFromDateLocal(userExternalId, fromDate, toDate);
  }

  const result = await copyDay(toDate, fromDate);

  if (result.copiedCount > 0) {
    const day = await getDiaryDay(toDate);
    await cacheDay(day, userExternalId);
  }

  return result;
};

// --- Diary day completion --------------------------------------------------

const markDayIncompleteInCache = async (
  userExternalId: string,
  date: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await upsertCachedDiaryDayStatuses(userExternalId, [
    {
      userExternalId,
      date,
      isComplete: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
};

export const getDiaryDayStatus = async (
  userExternalId: string,
  date: string,
): Promise<DBDiaryDayStatus | null> => {
  const userId = await resolveUserId(userExternalId).catch(() => null);

  if (!userId) {
    return getCachedDiaryDayStatus(userExternalId, date);
  }

  const cached = await getCachedDiaryDayStatus(userExternalId, date);
  if (cached) {
    void getDiaryDay(date)
      .then((day) =>
        upsertCachedDiaryDayStatuses(userExternalId, [
          toDbDiaryDayStatus(day, userExternalId),
        ]),
      )
      .catch(() => undefined);
    return cached;
  }

  const day = await getDiaryDay(date);
  const status = toDbDiaryDayStatus(day, userExternalId);
  await upsertCachedDiaryDayStatuses(userExternalId, [status]);
  return status;
};

export const listDiaryDayStatusesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBDiaryDayStatus[]> => {
  const userId = await measureDiaryStep(
    perfTrace,
    "week-statuses.resolve-session",
    () => resolveUserId(userExternalId),
  ).catch(() => null);

  if (!userId) {
    return listCachedDiaryDayStatusesBetween(userExternalId, startDate, endDate);
  }

  const cached = await measureDiaryRequest(perfTrace, "week-statuses", "sqlite", () =>
    listCachedDiaryDayStatusesBetween(userExternalId, startDate, endDate),
  );

  const refresh = async (source: "supabase" | "background-supabase") => {
    const range = await measureDiaryRequest(perfTrace, "week-statuses", source, () =>
      getDiaryRange(startDate, endDate),
    );
    const statuses = range.days.map((day) =>
      toDbDiaryDayStatus(day, userExternalId),
    );
    await upsertCachedDiaryDayStatuses(userExternalId, statuses);
    return statuses;
  };

  if (cached.length > 0) {
    recordDiaryCachePath(perfTrace, "week-statuses", "sqlite-nonempty-hit");
    recordDiaryRows(perfTrace, "week-statuses", cached.length);
    void refresh("background-supabase").catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "week-statuses", "empty-or-unknown");
  const statuses = await refresh(FOOD_LOG_READ_SOURCE);
  recordDiaryRows(perfTrace, "week-statuses", statuses.length);
  return statuses;
};

export const saveDiaryDayStatus = async (
  input: SaveDiaryDayStatusInput,
): Promise<DBDiaryDayStatus> => {
  const now = new Date().toISOString();
  const optimistic: DBDiaryDayStatus = {
    userExternalId: input.userExternalId,
    date: input.date,
    isComplete: input.isComplete,
    completedAt: input.isComplete ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  const userId = await resolveUserId(input.userExternalId).catch(() => null);

  if (!userId) {
    await upsertCachedDiaryDayStatuses(input.userExternalId, [optimistic]);
    return optimistic;
  }

  await upsertCachedDiaryDayStatuses(
    input.userExternalId,
    [optimistic],
    "pending",
  );

  try {
    const saved = await setDayComplete(input.date, input.isComplete);
    const status: DBDiaryDayStatus = {
      userExternalId: input.userExternalId,
      date: saved.date,
      isComplete: saved.isComplete,
      completedAt: saved.completedAt,
      createdAt: saved.completedAt ?? now,
      updatedAt: saved.completedAt ?? now,
    };
    await upsertCachedDiaryDayStatuses(input.userExternalId, [status]);
    return status;
  } catch (error) {
    await upsertCachedDiaryDayStatuses(
      input.userExternalId,
      [optimistic],
      "error",
      error instanceof Error ? error.message : "Failed to save.",
    );
    return optimistic;
  }
};

// Re-exported so screens can adopt the richer server-computed representation
// (meals, per-meal totals, goals) without going through the flattened shape.
export { getDiaryDay, getDiaryRange } from "../API/nouri/diaryApi";
export type {
  ApiDiaryDay,
  ApiDiaryEntry,
  ApiDiaryMeal,
  ApiDiaryRange,
} from "../API/nouri/diaryApi";
