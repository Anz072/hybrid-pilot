import {
  createRecommendation,
  listRecommendations,
  patchRecommendation,
  type ApiRecommendation,
} from "../API/nouri/adaptiveApi";
import { NouriApiError } from "../API/nouri/client";
import {
  deleteWeightGoal,
  getMe,
  patchProfile,
  patchSettings,
  putWeightGoal,
  type ApiMe,
  type ApiProfile,
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
import { getSupabaseSessionUser } from "../API/supabase/client";
import {
  EXPO_GO_DEV_USER_ID,
  isExpoGoDevUserId,
  shouldUseExpoGoDevLocalStore,
} from "../dev/expoGoDevAuth";
import { resolveGoalStrategy } from "../engine/goalStrategy";
import {
  measureDiaryRequest,
  measureDiaryStep,
  recordDiaryCachePath,
  recordDiaryRows,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
import { getLocalAccount } from "../storage/localStore";
import {
  listCachedAdaptiveRecommendations,
  upsertCachedAdaptiveRecommendations,
} from "./cacheRepository";
import type {
  AdaptiveCalorieRecommendationStatus,
  CreateAdaptiveCalorieRecommendationInput,
  DBAdaptiveCalorieRecommendation,
  DBUser,
  DBUserGender,
  DBUserSettings,
  DBWeightEntry,
  ListAdaptiveCalorieRecommendationsInput,
  SaveUserSettingsInput,
  SaveWeightEntryInput,
  SaveWeightGoalInput,
  SoftDeleteWeightEntryInput,
  UpdateAdaptiveCalorieRecommendationInput,
  WeightEntryGoal,
} from "./DB_TYPES";
import {
  getUserByExternalId as getUserByExternalIdLocal,
  upsertUser as upsertUserLocal,
} from "./userRepository";
import {
  getUserSettings as getUserSettingsLocal,
  saveUserSettings as saveUserSettingsLocal,
} from "./userSettingsRepository";
import {
  clearAllWeightData as clearAllWeightDataLocal,
  clearWeightGoal as clearWeightGoalLocal,
  getWeightGoal as getWeightGoalLocal,
  listWeightEntries as listWeightEntriesLocal,
  markWeightEntrySyncError,
  saveWeightEntry as saveWeightEntryLocal,
  saveWeightGoal as saveWeightGoalLocal,
  softDeleteWeightEntry as softDeleteWeightEntryLocal,
  upsertSyncedWeightEntries,
} from "./weightRepository";

// Profile, settings, weight and adaptive recommendations, served by the Nouri API.
//
// Replaces the direct-to-Supabase implementation in supabaseUserStore.ts. Local
// SQLite remains the read cache; the API replaces PostgREST as the remote.
//
// Legacy local->remote migration paths from the old store are deliberately NOT
// carried over. They existed to lift pre-Supabase local data into Supabase and
// fired on every empty remote read, costing extra round trips forever. A
// one-shot server-side import is the right tool if that data still matters.

const resolveUserId = async (
  userExternalId?: string | null,
): Promise<string | null> => {
  if (await shouldUseExpoGoDevLocalStore(userExternalId)) {
    return null;
  }
  const sessionUser = await getSupabaseSessionUser();
  return sessionUser?.id ?? null;
};

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
  syncStatus: "synced",
  syncError: null,
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
  if (isExpoGoDevUserId(input.externalId)) {
    await upsertUserLocal(input);
    return;
  }

  const userId = await resolveUserId(input.externalId);
  if (!userId) {
    await upsertUserLocal(input);
    return;
  }

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
  await upsertUserLocal(input);
};

export const getUserByExternalId = async (
  externalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBUser | null> => {
  if (isExpoGoDevUserId(externalId)) {
    return getUserByExternalIdLocal(externalId);
  }

  const [localAccount, sessionUser] = await measureDiaryStep(
    perfTrace,
    "user.local-and-session",
    () => Promise.all([getLocalAccount(), getSupabaseSessionUser()]),
  );

  if (!sessionUser || sessionUser.id !== externalId) {
    return null;
  }

  let me: ApiMe;
  try {
    me = await measureDiaryRequest(perfTrace, "profile", "supabase", () => getMe());
  } catch (error) {
    // This resolves the signed-in user, and the navigator treats a null result
    // as "not logged in". Every other read in this store is cache-first; this
    // one was not, so an unreachable API dropped the user back to the sign-in
    // screen even though the Supabase session was still valid. Verified on a
    // device: stop the API, restart the app, and you are logged out.
    //
    // Only a transport failure falls back. An auth failure or a missing
    // profile is a real answer and must still propagate, or a revoked session
    // would keep working offline forever.
    if (error instanceof NouriApiError && error.code === "NETWORK_ERROR") {
      const cached = await getUserByExternalIdLocal(externalId);
      if (cached) return cached;
    }
    throw error;
  }

  const user = toDbUser(me, localAccount);
  await upsertUserLocal(user);

  // GET /v1/me also carries settings and the weight goal; cache them so the
  // screens that need them next do not make another round trip.
  if (me.settings) {
    await saveUserSettingsLocal(toDbSettings(me.settings, externalId));
  }
  if (me.weightGoal) {
    const goal = toDbWeightGoal(me.weightGoal, externalId);
    await saveWeightGoalLocal({
      userExternalId: goal.userExternalId,
      targetWeightKg: goal.targetWeightKg,
      targetDate: goal.targetDate,
      goalBandKg: goal.goalBandKg,
    });
  }

  return user;
};

export const getFirstUser = async (
  perfTrace?: DiaryPerfTrace,
): Promise<DBUser | null> => {
  if (await shouldUseExpoGoDevLocalStore()) {
    return getUserByExternalIdLocal(EXPO_GO_DEV_USER_ID);
  }

  const sessionUser = await measureDiaryStep(
    perfTrace,
    "user.session",
    getSupabaseSessionUser,
  );
  if (!sessionUser?.id) {
    return null;
  }
  return getUserByExternalId(sessionUser.id, perfTrace);
};

// --- Settings --------------------------------------------------------------

export const getUserSettings = async (
  userExternalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<DBUserSettings | null> => {
  const userId = await measureDiaryStep(perfTrace, "settings.resolve-session", () =>
    resolveUserId(userExternalId),
  );
  if (!userId) {
    return getUserSettingsLocal(userExternalId);
  }

  const cached = await measureDiaryRequest(perfTrace, "settings", "sqlite", () =>
    getUserSettingsLocal(userExternalId),
  );

  const refresh = async (source: "supabase" | "background-supabase") => {
    const me = await measureDiaryRequest(perfTrace, "settings", source, () => getMe());
    if (!me.settings) return null;
    const settings = toDbSettings(me.settings, userExternalId);
    await saveUserSettingsLocal(settings);
    return settings;
  };

  if (cached) {
    recordDiaryCachePath(perfTrace, "settings", "sqlite-nonempty-hit");
    recordDiaryRows(perfTrace, "settings", 1);
    void refresh("background-supabase").catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "settings", "empty-or-unknown");
  return refresh("supabase");
};

export const saveUserSettings = async (
  input: SaveUserSettingsInput,
): Promise<void> => {
  await saveUserSettingsLocal(input);

  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return;
  }

  // Only the supplied fields are sent; the API updates column-wise so a partial
  // save cannot clobber a concurrent one.
  const patch: Record<string, unknown> = {};
  if (input.foodDiaryStartHour !== undefined) patch.foodDiaryStartHour = input.foodDiaryStartHour;
  if (input.foodDiaryEndHour !== undefined) patch.foodDiaryEndHour = input.foodDiaryEndHour;
  if (input.dailyCalorieOverrides !== undefined) patch.dailyCalorieOverrides = input.dailyCalorieOverrides;
  if (input.adaptiveCaloriesEnabled !== undefined) patch.adaptiveCaloriesEnabled = input.adaptiveCaloriesEnabled;
  if (input.adaptiveMode !== undefined) patch.adaptiveMode = input.adaptiveMode;
  if (input.adaptiveLastCalculatedAt !== undefined) patch.adaptiveLastCalculatedAt = input.adaptiveLastCalculatedAt;

  if (Object.keys(patch).length === 0) {
    return;
  }

  const saved = await patchSettings(patch);
  await saveUserSettingsLocal(toDbSettings(saved, input.userExternalId));
};

// --- Adaptive recommendations ----------------------------------------------

export const listAdaptiveCalorieRecommendations = async ({
  userExternalId,
  limit = 20,
  status = null,
}: ListAdaptiveCalorieRecommendationsInput): Promise<
  DBAdaptiveCalorieRecommendation[]
> => {
  const userId = await resolveUserId(userExternalId).catch(() => null);
  if (!userId) {
    return [];
  }

  const cached = await listCachedAdaptiveRecommendations({
    userExternalId,
    limit,
    status,
  });

  const refresh = async () => {
    const { recommendations } = await listRecommendations({ status, limit });
    const mapped = recommendations.map((rec) => toDbRecommendation(rec, userExternalId));
    await upsertCachedAdaptiveRecommendations(userExternalId, mapped);
    return mapped;
  };

  if (cached.length > 0) {
    void refresh().catch(() => undefined);
    return cached;
  }

  return refresh();
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

export const createAdaptiveCalorieRecommendation = async (
  input: CreateAdaptiveCalorieRecommendationInput,
): Promise<DBAdaptiveCalorieRecommendation> => {
  const userId = await resolveUserId(input.userExternalId);
  const now = new Date().toISOString();
  const status = input.status ?? "proposed";

  if (!userId) {
    return {
      id: Date.now(),
      userExternalId: input.userExternalId,
      status,
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
      respondedAt: input.respondedAt ?? null,
      appliedAt: input.appliedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const created = await createRecommendation({
    status,
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

  const mapped = toDbRecommendation(created, input.userExternalId);
  await upsertCachedAdaptiveRecommendations(input.userExternalId, [mapped]);
  return mapped;
};

export const updateAdaptiveCalorieRecommendation = async (
  input: UpdateAdaptiveCalorieRecommendationInput,
): Promise<DBAdaptiveCalorieRecommendation | null> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return null;
  }

  const patch: Parameters<typeof patchRecommendation>[1] = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.respondedAt !== undefined) patch.respondedAt = input.respondedAt;
  if (input.appliedAt !== undefined) patch.appliedAt = input.appliedAt;

  if (Object.keys(patch).length === 0) {
    return getLatestAdaptiveCalorieRecommendation(input.userExternalId);
  }

  try {
    const updated = await patchRecommendation(input.id, patch);
    const mapped = toDbRecommendation(updated, input.userExternalId);
    await upsertCachedAdaptiveRecommendations(input.userExternalId, [mapped]);
    return mapped;
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
};

// --- Weight ----------------------------------------------------------------

type ListWeightEntriesOptions = {
  includeDeleted?: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export const listWeightEntries = async (
  userExternalId: string,
  options: ListWeightEntriesOptions = {},
): Promise<DBWeightEntry[]> => {
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return listWeightEntriesLocal(userExternalId, options);
  }

  const cached = await listWeightEntriesLocal(userExternalId, options);

  const refresh = async () => {
    const { entries } = await listWeights({
      start: options.startDate,
      end: options.endDate,
      includeDeleted: options.includeDeleted ?? false,
      limit: options.limit ?? 500,
    });
    const mapped = entries.map((entry) => toDbWeightEntry(entry, userExternalId));
    await upsertSyncedWeightEntries(mapped);
    return mapped;
  };

  if (cached.length > 0) {
    void refresh().catch(() => undefined);
    return cached;
  }

  return refresh();
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
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return saveWeightEntryLocal(input);
  }

  // Optimistic local write first, so the chart updates immediately.
  await saveWeightEntryLocal(input);

  try {
    // One request. The API supersedes any other active entry for the same local
    // day and invalidates the adaptive calculation atomically.
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

    const mapped = toDbWeightEntry(saved, input.userExternalId);
    await upsertSyncedWeightEntries([mapped], { overwritePending: true });
    return mapped;
  } catch (error) {
    const failed = await markWeightEntrySyncError(
      input.id,
      input.userExternalId,
      error,
    );
    if (failed) {
      return failed;
    }
    throw error;
  }
};

export const softDeleteWeightEntry = async (
  input: SoftDeleteWeightEntryInput,
): Promise<DBWeightEntry | null> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return softDeleteWeightEntryLocal(input);
  }

  const pending = await softDeleteWeightEntryLocal(input);

  try {
    const deleted = await deleteWeight(input.id);
    const mapped = toDbWeightEntry(deleted, input.userExternalId);
    await upsertSyncedWeightEntries([mapped], { overwritePending: true });
    return mapped;
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      return pending;
    }
    const failed = await markWeightEntrySyncError(
      input.id,
      input.userExternalId,
      error,
    );
    return failed ?? pending;
  }
};

export const getWeightGoal = async (
  userExternalId: string,
): Promise<WeightEntryGoal | null> => {
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return getWeightGoalLocal(userExternalId);
  }

  const cached = await getWeightGoalLocal(userExternalId);

  const refresh = async () => {
    const me = await getMe();
    if (!me.weightGoal) return null;
    const goal = toDbWeightGoal(me.weightGoal, userExternalId);
    await saveWeightGoalLocal({
      userExternalId: goal.userExternalId,
      targetWeightKg: goal.targetWeightKg,
      targetDate: goal.targetDate,
      goalBandKg: goal.goalBandKg,
    });
    return goal;
  };

  if (cached) {
    void refresh().catch(() => undefined);
    return cached;
  }

  return refresh();
};

export const saveWeightGoal = async (
  input: SaveWeightGoalInput,
): Promise<WeightEntryGoal> => {
  const local = await saveWeightGoalLocal(input);
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return local;
  }

  const saved = await putWeightGoal({
    targetWeightKg: input.targetWeightKg,
    targetDate: input.targetDate ?? null,
    goalBandKg: input.goalBandKg ?? null,
  });
  const goal = toDbWeightGoal(saved, input.userExternalId);
  await saveWeightGoalLocal({
    userExternalId: goal.userExternalId,
    targetWeightKg: goal.targetWeightKg,
    targetDate: goal.targetDate,
    goalBandKg: goal.goalBandKg,
  });
  return goal;
};

export const clearWeightGoal = async (userExternalId: string): Promise<void> => {
  await clearWeightGoalLocal(userExternalId);
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return;
  }
  await deleteWeightGoal();
};

export const clearAllWeightData = async (
  userExternalId: string,
): Promise<void> => {
  await clearAllWeightDataLocal(userExternalId);
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return;
  }
  await clearAllWeights();
};
