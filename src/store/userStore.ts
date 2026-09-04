import { NouriApiError } from "../API/nouri/client";
import {
  deleteWeightGoal,
  getMe,
  patchProfile,
  patchSettings,
  putWeightGoal,
  type ApiMe,
  type ApiSettings,
  type ApiWeightGoal,
} from "../API/nouri/meApi";
import {
  clearAllWeights,
  deleteWeight,
  listWeights,
  saveWeight,
  type ApiWeightEntry,
} from "../API/nouri/weightApi";
import {
  createRecommendation,
  listRecommendations,
  patchRecommendation,
  refreshAdaptive,
  type ApiAdaptiveRefreshResult,
  type ApiRecommendation,
} from "../API/nouri/adaptiveApi";
import { getSupabaseSessionUser } from "../API/supabase/client";
import { resolveGoalStrategy } from "../engine/goalStrategy";
import {
  measureDiaryRequest,
  measureDiaryStep,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
import type {
  AdaptiveCalorieRecommendationStatus,
  CreateAdaptiveCalorieRecommendationInput,
  DBAdaptiveCalorieRecommendation,
  DBUser,
  DBUserGender,
  DBUserSettings,
  DBWeightEntry,
  SaveUserSettingsInput,
  SaveWeightEntryInput,
  SaveWeightGoalInput,
  SoftDeleteWeightEntryInput,
  UpdateAdaptiveCalorieRecommendationInput,
  WeightEntryGoal,
} from "./DB_TYPES";

// Profile, settings, weight and adaptive recommendations, served by the Nouri
// API.
//
// Nothing here is stored on the device. Weight in particular used to write
// locally first and reconcile afterwards, with a `sync_error` state for writes
// the server had rejected — a local record that disagreed with Supabase and was
// still shown to the user as if it had saved. A failed write now fails.
//
// Reads throw when the API is unreachable. That surfaces as the screen's
// existing error state; it does not sign the user out, because the Supabase
// session is unaffected by the API being down.

// --- Mapping ---------------------------------------------------------------

const toDbUser = (me: ApiMe, localAccount: { createdAt?: string } | null): DBUser => ({
  id: 0,
  externalId: me.profile.id,
  provider: "email",
  displayName: me.profile.displayName,
  createdAt: me.profile.createdAt ?? localAccount?.createdAt ?? new Date().toISOString(),
  email: me.profile.email,
  birthdate: me.profile.birthdate,
  gender: me.profile.gender as DBUserGender,
  heightCm: me.profile.heightCm,
  activityLevel: me.profile.activityLevel,
  goal: me.profile.goal,
  goalStrategy: resolveGoalStrategy(me.profile.goal, me.profile.goalStrategy),
  trainingTypes: me.profile.trainingTypes,
  proteinFocus: me.profile.proteinFocus as DBUser["proteinFocus"],
  calorieAllowance: me.profile.calorieAllowance,
  proteinG: me.profile.proteinG,
  carbsG: me.profile.carbsG,
  fatG: me.profile.fatG,
});

const toDbSettings = (
  settings: ApiSettings,
  userExternalId: string,
): DBUserSettings => ({
  userExternalId,
  foodDiaryStartHour: settings.foodDiaryStartHour,
  foodDiaryEndHour: settings.foodDiaryEndHour,
  dailyCalorieOverrides: settings.dailyCalorieOverrides,
  adaptiveCaloriesEnabled: settings.adaptiveCaloriesEnabled,
  adaptiveMode: settings.adaptiveMode,
  adaptiveLastCalculatedAt: settings.adaptiveLastCalculatedAt,
  createdAt: settings.createdAt,
  updatedAt: settings.updatedAt,
});

const toDbWeightGoal = (
  goal: ApiWeightGoal,
  userExternalId: string,
): WeightEntryGoal => ({
  userExternalId,
  targetWeightKg: goal.targetWeightKg,
  targetDate: goal.targetDate,
  goalBandKg: goal.goalBandKg,
  createdAt: goal.createdAt,
  updatedAt: goal.updatedAt,
});

const toDbWeightEntry = (
  entry: ApiWeightEntry,
  userExternalId: string,
): DBWeightEntry => ({
  id: entry.id,
  userExternalId,
  measuredAt: entry.measuredAt,
  measuredAtLocalIso: entry.measuredAtLocalIso,
  zoneOffsetMinutes: entry.zoneOffsetMinutes,
  valueKg: entry.valueKg,
  valueOriginal: entry.valueOriginal,
  unitOriginal: "kg",
  source: entry.source as DBWeightEntry["source"],
  notes: entry.notes,
  clientGeneratedId: entry.clientGeneratedId,
  deviceId: entry.deviceId,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  deletedAt: entry.deletedAt,
  version: entry.version,
});

const toDbRecommendation = (
  rec: ApiRecommendation,
  userExternalId: string,
): DBAdaptiveCalorieRecommendation => ({
  id: rec.id,
  userExternalId,
  status: rec.status,
  algorithmVersion: rec.algorithmVersion,
  windowStart: rec.windowStart,
  windowEnd: rec.windowEnd,
  confidence: rec.confidence,
  currentBaseCalories: rec.currentBaseCalories,
  recommendedBaseCalories: rec.recommendedBaseCalories,
  estimatedTdee: rec.estimatedTdee,
  recommendedDelta: rec.recommendedDelta,
  avgLoggedCalories: rec.avgLoggedCalories,
  completeDaysUsed: rec.completeDaysUsed,
  weighInsUsed: rec.weighInsUsed,
  trendStartKg: rec.trendStartKg,
  trendEndKg: rec.trendEndKg,
  observedWeeklyChangeKg: rec.observedWeeklyChangeKg,
  reason: rec.reason,
  inputSummary: rec.inputSummary,
  respondedAt: rec.respondedAt,
  appliedAt: rec.appliedAt,
  createdAt: rec.createdAt,
  updatedAt: rec.updatedAt,
});

// --- Profile ---------------------------------------------------------------

export const upsertUser = async (input: DBUser): Promise<void> => {
  // The profile row is created by the handle_new_user() trigger at signup, so
  // this is always an update. Email is owned by Supabase Auth and is not sent.
  await patchProfile({
    displayName: input.displayName,
    birthdate: input.birthdate,
    gender: input.gender,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    goal: input.goal,
    goalStrategy: input.goalStrategy,
    trainingTypes: input.trainingTypes,
    proteinFocus: input.proteinFocus,
    calorieAllowance: input.calorieAllowance,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  });
};

export const getUserByExternalId = async (
  externalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBUser | null> => {
  const sessionUser = await measureDiaryStep(perfTrace, "user.session", () =>
    getSupabaseSessionUser(),
  );
  if (!sessionUser || sessionUser.id !== externalId) return null;

  const me = await measureDiaryRequest(perfTrace, "profile", "node-api", () => getMe());
  return toDbUser(me, null);
};

export const getFirstUser = async (
  perfTrace?: DiaryPerfTrace,
): Promise<DBUser | null> => {
  const sessionUser = await measureDiaryStep(perfTrace, "user.session", () =>
    getSupabaseSessionUser(),
  );
  if (!sessionUser?.id) return null;
  return getUserByExternalId(sessionUser.id, perfTrace);
};

// --- Settings --------------------------------------------------------------

export const getUserSettings = async (
  userExternalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBUserSettings | null> => {
  const me = await measureDiaryRequest(perfTrace, "settings", "node-api", () => getMe());
  return me.settings ? toDbSettings(me.settings, userExternalId) : null;
};

export const saveUserSettings = async (
  input: SaveUserSettingsInput,
): Promise<void> => {
  // Only the supplied fields are sent; the API updates column-wise so a partial
  // save cannot clobber a concurrent one.
  const patch: Record<string, unknown> = {};
  if (input.foodDiaryStartHour !== undefined) patch.foodDiaryStartHour = input.foodDiaryStartHour;
  if (input.foodDiaryEndHour !== undefined) patch.foodDiaryEndHour = input.foodDiaryEndHour;
  if (input.dailyCalorieOverrides !== undefined) patch.dailyCalorieOverrides = input.dailyCalorieOverrides;
  if (input.adaptiveCaloriesEnabled !== undefined) patch.adaptiveCaloriesEnabled = input.adaptiveCaloriesEnabled;
  if (input.adaptiveMode !== undefined) patch.adaptiveMode = input.adaptiveMode;
  if (input.adaptiveLastCalculatedAt !== undefined) patch.adaptiveLastCalculatedAt = input.adaptiveLastCalculatedAt;

  if (Object.keys(patch).length === 0) return;
  await patchSettings(patch);
};

// --- Adaptive recommendations ----------------------------------------------

export const listAdaptiveCalorieRecommendations = async ({
  userExternalId,
  limit = 20,
  status = null,
}: {
  userExternalId: string;
  limit?: number;
  status?: AdaptiveCalorieRecommendationStatus | null;
}): Promise<DBAdaptiveCalorieRecommendation[]> => {
  const { recommendations } = await listRecommendations({ limit, status });
  return recommendations.map((rec) => toDbRecommendation(rec, userExternalId));
};

export const getLatestAdaptiveCalorieRecommendation = async (
  userExternalId: string,
  status: AdaptiveCalorieRecommendationStatus | null = null,
): Promise<DBAdaptiveCalorieRecommendation | null> => {
  const rows = await listAdaptiveCalorieRecommendations({
    userExternalId,
    limit: 1,
    status,
  });
  return rows[0] ?? null;
};

/**
 * Runs the adaptive engine on the server and returns what it decided.
 *
 * The analysis and the write happen in one transaction on one machine. The app
 * used to fetch a month of diary days, entries and weigh-ins, compute the
 * result locally, and POST it back — three round trips with a window in between
 * in which any of the three could change underneath it.
 */
export const refreshAdaptiveCalories = async (
  userExternalId: string,
  options: { force?: boolean } = {},
): Promise<{
  result: ApiAdaptiveRefreshResult;
  recommendation: DBAdaptiveCalorieRecommendation | null;
}> => {
  const result = await refreshAdaptive({ force: options.force ?? false });
  return {
    result,
    recommendation: result.recommendation
      ? toDbRecommendation(result.recommendation, userExternalId)
      : null,
  };
};

export const createAdaptiveCalorieRecommendation = async (
  input: CreateAdaptiveCalorieRecommendationInput,
): Promise<DBAdaptiveCalorieRecommendation> => {
  const created = await createRecommendation({
    status: input.status ?? "proposed",
    algorithmVersion: input.algorithmVersion ?? "v1",
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    confidence: input.confidence,
    currentBaseCalories: input.currentBaseCalories ?? null,
    recommendedBaseCalories: input.recommendedBaseCalories,
    estimatedTdee: input.estimatedTdee,
    recommendedDelta: input.recommendedDelta,
    avgLoggedCalories: input.avgLoggedCalories,
    completeDaysUsed: input.completeDaysUsed,
    weighInsUsed: input.weighInsUsed,
    trendStartKg: input.trendStartKg,
    trendEndKg: input.trendEndKg,
    observedWeeklyChangeKg: input.observedWeeklyChangeKg ?? null,
    reason: input.reason,
    inputSummary: input.inputSummary ?? null,
  });
  return toDbRecommendation(created, input.userExternalId);
};

export const updateAdaptiveCalorieRecommendation = async (
  input: UpdateAdaptiveCalorieRecommendationInput,
): Promise<DBAdaptiveCalorieRecommendation | null> => {
  const patch: Parameters<typeof patchRecommendation>[1] = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.respondedAt !== undefined) patch.respondedAt = input.respondedAt;
  if (input.appliedAt !== undefined) patch.appliedAt = input.appliedAt;

  if (Object.keys(patch).length === 0) {
    return getLatestAdaptiveCalorieRecommendation(input.userExternalId);
  }

  try {
    const updated = await patchRecommendation(input.id, patch);
    return toDbRecommendation(updated, input.userExternalId);
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};

// --- Weight ----------------------------------------------------------------

interface ListWeightEntriesOptions {
  includeDeleted?: boolean | undefined;
  limit?: number | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export const listWeightEntries = async (
  userExternalId: string,
  options: ListWeightEntriesOptions = {},
): Promise<DBWeightEntry[]> => {
  const { entries } = await listWeights({
    start: options.startDate,
    end: options.endDate,
    includeDeleted: options.includeDeleted ?? false,
    limit: options.limit ?? 500,
  });
  return entries.map((entry) => toDbWeightEntry(entry, userExternalId));
};

export const listWeightEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBWeightEntry[]> =>
  listWeightEntries(userExternalId, {
    includeDeleted: false,
    limit: 2000,
    startDate,
    endDate,
  });

export const saveWeightEntry = async (
  input: SaveWeightEntryInput,
): Promise<DBWeightEntry> => {
  // One request. The API supersedes any other active entry for the same local
  // day and invalidates the adaptive calculation atomically.
  //
  // A rejected write throws. It used to be written locally with a `sync_error`
  // marker and returned as though it had saved, which showed the user a weight
  // Supabase had never accepted.
  const saved = await saveWeight({
    id: input.id,
    clientGeneratedId: input.clientGeneratedId,
    measuredAt: input.measuredAt,
    measuredAtLocalIso: input.measuredAtLocalIso,
    zoneOffsetMinutes: input.zoneOffsetMinutes,
    valueKg: input.valueKg,
    valueOriginal: input.valueOriginal,
    source: input.source,
    notes: input.notes ?? null,
    deviceId: input.deviceId ?? null,
  });
  return toDbWeightEntry(saved, input.userExternalId);
};

export const softDeleteWeightEntry = async (
  input: SoftDeleteWeightEntryInput,
): Promise<DBWeightEntry | null> => {
  try {
    const deleted = await deleteWeight(input.id);
    return toDbWeightEntry(deleted, input.userExternalId);
  } catch (error) {
    // Already gone server-side is the outcome the caller wanted.
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};

export const getWeightGoal = async (
  userExternalId: string,
): Promise<WeightEntryGoal | null> => {
  const me = await getMe();
  return me.weightGoal ? toDbWeightGoal(me.weightGoal, userExternalId) : null;
};

export const saveWeightGoal = async (
  input: SaveWeightGoalInput,
): Promise<WeightEntryGoal> => {
  const saved = await putWeightGoal({
    targetWeightKg: input.targetWeightKg,
    targetDate: input.targetDate ?? null,
    goalBandKg: input.goalBandKg ?? null,
  });
  return toDbWeightGoal(saved, input.userExternalId);
};

export const clearWeightGoal = async (_userExternalId: string): Promise<void> => {
  await deleteWeightGoal();
};

export const clearAllWeightData = async (
  _userExternalId: string,
): Promise<void> => {
  await clearAllWeights();
};
