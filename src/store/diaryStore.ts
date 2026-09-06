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
} from "../API/nouri/diaryApi";
import { NouriApiError } from "../API/nouri/client";
import { getSupabaseSessionUser } from "../API/supabase/client";
import {
  measureDiaryRequest,
  measureDiaryStep,
  recordDiaryRows,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
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

// The diary, served by the Nouri API.
//
// Every read here is a request. There is no on-device copy of the diary to read
// instead, and deliberately so: a second persistent store is a second thing that
// can disagree with Supabase, and the whole point of the migration was to make
// PostgreSQL the only place a diary entry exists.
//
// When the API is unreachable, a read throws and the screen shows its existing
// error state. It does not fall back to stale rows and present them as current,
// and it does not sign the user out — the Supabase session is unaffected by the
// API being down.
//
// Writes await the server and return its authoritative values. Callers refresh
// afterwards; there is no local write that later "syncs".

const resolveUserExternalId = async (): Promise<string> => {
  const sessionUser = await getSupabaseSessionUser();
  if (!sessionUser?.id) {
    throw new NouriApiError(
      "AUTH_REQUIRED",
      "Your session is no longer valid. Please sign in with email and password again.",
      401,
      null,
    );
  }
  return sessionUser.id;
};

export const getUserFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  const day = await getDiaryDay(date);
  return toDbEntries(day, userExternalId);
};

interface FoodLogEntriesReadOptions {
  perfTrace?: DiaryPerfTrace | undefined;
}

export const getUserFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
  options: FoodLogEntriesReadOptions = {},
): Promise<DBUserFoodLogEntry[]> => {
  const range = await measureDiaryRequest(
    options.perfTrace,
    "week-entries",
    "node-api",
    () => getDiaryRange(startDate, endDate),
  );
  const entries = range.days.flatMap((day) => toDbEntries(day, userExternalId));
  recordDiaryRows(options.perfTrace, "week-entries", entries.length);
  return entries;
};

/**
 * Reads one entry.
 *
 * Entries are addressable only through the day that contains them, so the date
 * is required. Callers navigate from a day they are already showing and have it
 * to hand; it used to be recovered from a local index, which is exactly the kind
 * of hidden dependency on an on-device database this change removes.
 */
export const getUserFoodLogEntryById = async (
  id: number,
  date: string,
): Promise<DBUserFoodLogEntry | null> => {
  const userExternalId = await resolveUserExternalId();
  const day = await getDiaryDay(date);
  return (
    toDbEntries(day, userExternalId).find((entry) => entry.id === id) ?? null
  );
};

export const addUserFoodLog = async (
  input: AddUserFoodLogInput,
): Promise<DBUserFoodLogEntry> => {
  const entry = await addFoodEntry({
    date: input.date,
    foodId: input.foodId,
    quantity: input.quantityG,
    mealType: input.mealType ?? null,
    loggedAt: input.loggedAt ?? new Date().toISOString(),
  });
  return toDbEntry(entry, input.userExternalId);
};

export const addQuickAddFoodLog = async (
  input: AddQuickAddFoodLogInput,
): Promise<DBUserFoodLogEntry> => {
  const entry = await addQuickAddEntry({
    date: input.date,
    name: input.name ?? null,
    calories: input.calories,
    proteinG: input.proteinG ?? null,
    carbsG: input.carbsG ?? null,
    fatG: input.fatG ?? null,
    alcoholG: input.alcoholG ?? null,
    mealType: input.mealType ?? null,
    loggedAt: input.loggedAt ?? new Date().toISOString(),
  });
  return toDbEntry(entry, input.userExternalId);
};

// The mutations below return the day the entry ended up on. Callers use it to
// invalidate exactly that day. It used to be recovered by reading the entry
// first, which cost a round trip and — because it read the state *before* the
// write — reported the wrong day whenever an edit moved an entry across
// midnight. The server already knows the answer and returns it.

export const updateUserFoodLog = async (
  input: UpdateUserFoodLogInput,
): Promise<string> => {
  const entry = await updateEntryRequest(input.id, {
    quantity: input.quantityG,
    mealType: input.mealType ?? null,
    ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
  });
  return entry.date;
};

export const updateQuickAddFoodLog = async (
  input: UpdateQuickAddFoodLogInput,
): Promise<string> => {
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
  return entry.date;
};

export const deleteUserFoodLog = async (id: number): Promise<string | null> => {
  try {
    const { date } = await deleteEntryRequest(id);
    return date;
  } catch (error) {
    // Already gone server-side is the outcome the caller wanted.
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};

export const copyFoodLogsFromDate = async (
  _userExternalId: string,
  fromDate: string,
  toDate: string,
): Promise<FoodLogCopyResult> => copyDay(toDate, fromDate);

// --- Diary day completion --------------------------------------------------

const toStatus = (
  userExternalId: string,
  date: string,
  isComplete: boolean,
  completedAt: string | null,
): DBDiaryDayStatus => {
  const stamp = completedAt ?? new Date().toISOString();
  return {
    userExternalId,
    date,
    isComplete,
    completedAt,
    createdAt: stamp,
    updatedAt: stamp,
  };
};

export const getDiaryDayStatus = async (
  userExternalId: string,
  date: string,
): Promise<DBDiaryDayStatus | null> => {
  const day = await getDiaryDay(date);
  return toDbDiaryDayStatus(day, userExternalId);
};

export const listDiaryDayStatusesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBDiaryDayStatus[]> => {
  const range = await measureDiaryRequest(
    perfTrace,
    "week-statuses",
    "node-api",
    () => getDiaryRange(startDate, endDate),
  );
  const statuses = range.days.map((day) =>
    toDbDiaryDayStatus(day, userExternalId),
  );
  recordDiaryRows(perfTrace, "week-statuses", statuses.length);
  return statuses;
};

/**
 * Marks a day complete or incomplete.
 *
 * Throws when the server rejects it. The previous implementation swallowed the
 * error and returned the value the caller had asked for, so a failed write was
 * indistinguishable from a successful one and the day silently reverted on the
 * next read.
 */
export const saveDiaryDayStatus = async (
  input: SaveDiaryDayStatusInput,
): Promise<DBDiaryDayStatus> => {
  const saved = await setDayComplete(input.date, input.isComplete);
  return toStatus(
    input.userExternalId,
    saved.date,
    saved.isComplete,
    saved.completedAt,
  );
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
