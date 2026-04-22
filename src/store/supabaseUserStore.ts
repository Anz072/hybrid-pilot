import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  getSupabaseSessionUser,
  requireSupabaseSessionUser,
} from "../API/supabase/client";
import {
  buildSupabaseProfileInputFromDbUser,
  getSupabaseProfile,
  toDbUserFromSupabaseProfile,
  upsertSupabaseProfile,
  type SupabaseProfile,
} from "../API/supabase/supabaseProfiles";
import { getLocalAccount } from "../storage/localStore";
import type {
  AdaptiveCalorieMode,
  AdaptiveCalorieRecommendationConfidence,
  AdaptiveCalorieRecommendationStatus,
  CreateAdaptiveCalorieRecommendationInput,
  DBAdaptiveCalorieRecommendation,
  DBUser,
  DBUserSettings,
  DBWeightEntry,
  ListAdaptiveCalorieRecommendationsInput,
  SaveUserSettingsInput,
  UpdateAdaptiveCalorieRecommendationInput,
  SaveWeightEntryInput,
  SaveWeightGoalInput,
  SoftDeleteWeightEntryInput,
  WeightEntryGoal,
} from "./DB_TYPES";
import {
  clearAllWeightData as clearAllWeightDataLocal,
  clearWeightGoal as clearWeightGoalLocal,
  getWeightGoal as getWeightGoalLocal,
  listWeightEntries as listWeightEntriesLocal,
} from "./weightRepository";
import {
  DAILY_CALORIE_OVERRIDE_COUNT,
  DEFAULT_FOOD_DIARY_END_HOUR,
  DEFAULT_FOOD_DIARY_START_HOUR,
  getUserSettings as getUserSettingsLocal,
} from "./userSettingsRepository";
import {
  getUserByExternalId as getUserByExternalIdLocal,
} from "./userRepository";

const SUPABASE_USER_SETTINGS_TABLE = "user_settings";
const SUPABASE_WEIGHT_ENTRIES_TABLE = "weight_entries";
const SUPABASE_WEIGHT_GOALS_TABLE = "weight_goals";
const SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE =
  "adaptive_calorie_recommendations";

type ListWeightEntriesOptions = {
  includeDeleted?: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

type SupabaseUserSettingsRow = {
  user_id: string;
  food_diary_start_hour: number | string | null;
  food_diary_end_hour: number | string | null;
  daily_calorie_overrides: unknown;
  adaptive_calories_enabled: boolean | number | string | null;
  adaptive_mode: string | null;
  adaptive_last_calculated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseAdaptiveCalorieRecommendationRow = {
  id: number | string;
  user_id: string;
  status: string | null;
  algorithm_version: string | null;
  window_start: string;
  window_end: string;
  confidence: string | null;
  current_base_calories: number | string | null;
  recommended_base_calories: number | string;
  estimated_tdee: number | string;
  recommended_delta: number | string;
  avg_logged_calories: number | string;
  complete_days_used: number | string;
  weigh_ins_used: number | string;
  trend_start_kg: number | string;
  trend_end_kg: number | string;
  observed_weekly_change_kg: number | string | null;
  reason: string | null;
  input_summary: unknown;
  responded_at: string | null;
  applied_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseWeightEntryRow = {
  id: string;
  user_id: string;
  measured_at: string;
  measured_at_local_iso: string;
  measured_day_local?: string | null;
  zone_offset_minutes: number | string;
  value_kg: number | string;
  value_original: number | string;
  unit_original: string | null;
  source: string;
  notes: string | null;
  tags?: unknown;
  client_generated_id: string;
  device_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  version: number | string | null;
  sync_status: string | null;
  sync_error: string | null;
};

type SupabaseWeightGoalRow = {
  user_id: string;
  target_weight_kg: number | string;
  target_date: string | null;
  goal_band_kg: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRequiredNumber = (value: unknown, fallback = 0): number =>
  parseNullableNumber(value) ?? fallback;

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "t";
  }

  return false;
};

const parseAdaptiveMode = (value: unknown): AdaptiveCalorieMode =>
  value === "auto_apply" ? "auto_apply" : "recommend";

const parseAdaptiveRecommendationStatus = (
  value: unknown,
): AdaptiveCalorieRecommendationStatus => {
  switch (value) {
    case "accepted":
    case "rejected":
    case "applied":
    case "superseded":
      return value;
    default:
      return "proposed";
  }
};

const parseAdaptiveRecommendationConfidence = (
  value: unknown,
): AdaptiveCalorieRecommendationConfidence => {
  switch (value) {
    case "low":
    case "high":
      return value;
    default:
      return "medium";
  }
};

const normalizeDailyCalorieOverrides = (
  value: unknown,
): Array<number | null> | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = Array.from(
    { length: DAILY_CALORIE_OVERRIDE_COUNT },
    (_, index) => {
      const next = value[index];

      if (next == null || next === "") {
        return null;
      }

      const parsed =
        typeof next === "number" ? next : Number.parseFloat(String(next));

      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }

      return Math.round(parsed);
    },
  );

  return normalized.some((item) => item != null) ? normalized : null;
};

const clampHour = (value: number) =>
  Math.max(0, Math.min(23, Math.round(value)));

const normalizeFoodDiaryHours = (
  startHour: number,
  endHour: number,
): { foodDiaryStartHour: number; foodDiaryEndHour: number } => {
  const foodDiaryStartHour = clampHour(startHour);
  const foodDiaryEndHour = clampHour(endHour);

  if (foodDiaryEndHour <= foodDiaryStartHour) {
    return {
      foodDiaryStartHour: DEFAULT_FOOD_DIARY_START_HOUR,
      foodDiaryEndHour: DEFAULT_FOOD_DIARY_END_HOUR,
    };
  }

  return {
    foodDiaryStartHour,
    foodDiaryEndHour,
  };
};

const parseLegacyProvider = (value: unknown): DBUser["provider"] => {
  if (value === "local" || value === "google" || value === "apple" || value === "email") {
    return value;
  }

  return "google";
};

const toDbUserFromProfile = ({
  localAccount,
  profile,
  sessionUser,
  legacyUser,
}: {
  localAccount: Awaited<ReturnType<typeof getLocalAccount>>;
  profile: SupabaseProfile;
  sessionUser: User | null;
  legacyUser: DBUser | null;
}): DBUser => {
  const provider =
    (localAccount?.id === profile.id ? localAccount.provider : null) ??
    (typeof sessionUser?.app_metadata?.provider === "string"
      ? parseLegacyProvider(sessionUser.app_metadata.provider)
      : null) ??
    parseLegacyProvider(legacyUser?.provider);
  const base = toDbUserFromSupabaseProfile(profile, {
    localId: legacyUser?.id ?? 0,
    provider,
  });

  return {
    ...base,
    displayName:
      base.displayName ??
      legacyUser?.displayName ??
      (localAccount?.id === profile.id ? localAccount.displayName : null) ??
      null,
    email:
      base.email ??
      legacyUser?.email ??
      (localAccount?.id === profile.id ? localAccount.email : null) ??
      null,
    birthdate:
      base.birthdate ??
      legacyUser?.birthdate ??
      (localAccount?.id === profile.id ? localAccount.birthdate : null) ??
      null,
    gender: base.gender ?? legacyUser?.gender ?? null,
    heightCm: base.heightCm ?? legacyUser?.heightCm ?? null,
    activityLevel: base.activityLevel ?? legacyUser?.activityLevel ?? null,
    goal: base.goal ?? legacyUser?.goal ?? null,
    trainingTypes: base.trainingTypes ?? legacyUser?.trainingTypes ?? null,
    proteinFocus: base.proteinFocus ?? legacyUser?.proteinFocus ?? null,
    calorieAllowance:
      base.calorieAllowance ?? legacyUser?.calorieAllowance ?? null,
    proteinG: base.proteinG ?? legacyUser?.proteinG ?? null,
    carbsG: base.carbsG ?? legacyUser?.carbsG ?? null,
    fatG: base.fatG ?? legacyUser?.fatG ?? null,
    createdAt:
      legacyUser?.createdAt ??
      (localAccount?.id === profile.id ? localAccount.createdAt : null) ??
      base.createdAt,
  };
};

const isLocalOnlyAccount = (user: Pick<DBUser, "externalId" | "provider">) =>
  user.provider === "local" || user.externalId.startsWith("local-");

const resolveSupabaseUserId = async (
  userExternalId?: string | null,
) => {
  const sessionUser = await requireSupabaseSessionUser(userExternalId);
  return sessionUser.id;
};

const fetchSupabaseUserSettingsRow = async (
  userId: string,
): Promise<SupabaseUserSettingsRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_USER_SETTINGS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseUserSettingsRow | null) ?? null;
};

const toDbUserSettings = (row: SupabaseUserSettingsRow): DBUserSettings => {
  const normalized = normalizeFoodDiaryHours(
    parseRequiredNumber(row.food_diary_start_hour, DEFAULT_FOOD_DIARY_START_HOUR),
    parseRequiredNumber(row.food_diary_end_hour, DEFAULT_FOOD_DIARY_END_HOUR),
  );

  return {
    userExternalId: row.user_id,
    ...normalized,
    dailyCalorieOverrides: normalizeDailyCalorieOverrides(
      row.daily_calorie_overrides,
    ),
    adaptiveCaloriesEnabled: parseBoolean(row.adaptive_calories_enabled),
    adaptiveMode: parseAdaptiveMode(row.adaptive_mode),
    adaptiveLastCalculatedAt: normalizeOptionalText(
      row.adaptive_last_calculated_at,
    ),
    createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
    updatedAt:
      normalizeOptionalText(row.updated_at) ??
      normalizeOptionalText(row.created_at) ??
      new Date().toISOString(),
  };
};

const upsertSupabaseUserSettings = async ({
  createdAt,
  input,
  userId,
}: {
  createdAt?: string | null;
  input: SaveUserSettingsInput;
  userId: string;
}): Promise<DBUserSettings> => {
  const existingRemote = await fetchSupabaseUserSettingsRow(userId);
  const baseSettings = existingRemote ? toDbUserSettings(existingRemote) : null;
  const normalized = normalizeFoodDiaryHours(
    input.foodDiaryStartHour ??
      baseSettings?.foodDiaryStartHour ??
      DEFAULT_FOOD_DIARY_START_HOUR,
    input.foodDiaryEndHour ??
      baseSettings?.foodDiaryEndHour ??
      DEFAULT_FOOD_DIARY_END_HOUR,
  );
  const dailyCalorieOverrides =
    input.dailyCalorieOverrides !== undefined
      ? normalizeDailyCalorieOverrides(input.dailyCalorieOverrides)
      : baseSettings?.dailyCalorieOverrides ?? null;
  const adaptiveCaloriesEnabled =
    input.adaptiveCaloriesEnabled ?? baseSettings?.adaptiveCaloriesEnabled ?? false;
  const adaptiveMode =
    input.adaptiveMode ?? baseSettings?.adaptiveMode ?? "recommend";
  const adaptiveLastCalculatedAt =
    input.adaptiveLastCalculatedAt !== undefined
      ? normalizeOptionalText(input.adaptiveLastCalculatedAt)
      : baseSettings?.adaptiveLastCalculatedAt ?? null;
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_USER_SETTINGS_TABLE)
    .upsert(
      {
        user_id: userId,
        food_diary_start_hour: normalized.foodDiaryStartHour,
        food_diary_end_hour: normalized.foodDiaryEndHour,
        daily_calorie_overrides: dailyCalorieOverrides,
        adaptive_calories_enabled: adaptiveCaloriesEnabled,
        adaptive_mode: adaptiveMode,
        adaptive_last_calculated_at: adaptiveLastCalculatedAt,
        created_at:
          normalizeOptionalText(existingRemote?.created_at) ??
          normalizeOptionalText(createdAt) ??
          now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toDbUserSettings(data as SupabaseUserSettingsRow);
};

const invalidateAdaptiveCalculationTimestamp = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_USER_SETTINGS_TABLE)
    .update({ adaptive_last_calculated_at: null })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};

const toDbAdaptiveCalorieRecommendation = (
  row: SupabaseAdaptiveCalorieRecommendationRow,
): DBAdaptiveCalorieRecommendation => ({
  id: parseRequiredNumber(row.id),
  userExternalId: row.user_id,
  status: parseAdaptiveRecommendationStatus(row.status),
  algorithmVersion: normalizeOptionalText(row.algorithm_version) ?? "v1",
  windowStart: row.window_start,
  windowEnd: row.window_end,
  confidence: parseAdaptiveRecommendationConfidence(row.confidence),
  currentBaseCalories: parseNullableNumber(row.current_base_calories),
  recommendedBaseCalories: parseRequiredNumber(
    row.recommended_base_calories,
  ),
  estimatedTdee: parseRequiredNumber(row.estimated_tdee),
  recommendedDelta: parseRequiredNumber(row.recommended_delta),
  avgLoggedCalories: parseRequiredNumber(row.avg_logged_calories),
  completeDaysUsed: parseRequiredNumber(row.complete_days_used),
  weighInsUsed: parseRequiredNumber(row.weigh_ins_used),
  trendStartKg: parseRequiredNumber(row.trend_start_kg),
  trendEndKg: parseRequiredNumber(row.trend_end_kg),
  observedWeeklyChangeKg: parseNullableNumber(row.observed_weekly_change_kg),
  reason: normalizeOptionalText(row.reason) ?? "Adaptive recommendation",
  inputSummary:
    row.input_summary != null &&
    typeof row.input_summary === "object" &&
    !Array.isArray(row.input_summary)
      ? (row.input_summary as Record<string, unknown>)
      : null,
  respondedAt: normalizeOptionalText(row.responded_at),
  appliedAt: normalizeOptionalText(row.applied_at),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const toDbWeightEntry = (row: SupabaseWeightEntryRow): DBWeightEntry => ({
  id: row.id,
  userExternalId: row.user_id,
  measuredAt: row.measured_at,
  measuredAtLocalIso: row.measured_at_local_iso,
  zoneOffsetMinutes: parseRequiredNumber(row.zone_offset_minutes),
  valueKg: parseRequiredNumber(row.value_kg),
  valueOriginal: parseRequiredNumber(row.value_original),
  unitOriginal: "kg",
  source: row.source as DBWeightEntry["source"],
  notes: normalizeOptionalText(row.notes),
  clientGeneratedId: row.client_generated_id,
  deviceId: normalizeOptionalText(row.device_id),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
  deletedAt: normalizeOptionalText(row.deleted_at),
  version: parseRequiredNumber(row.version, 1),
  syncStatus: (normalizeOptionalText(row.sync_status) as DBWeightEntry["syncStatus"]) ?? "synced",
  syncError: normalizeOptionalText(row.sync_error),
});

const fetchSupabaseWeightEntryRowById = async (
  userId: string,
  id: string,
): Promise<SupabaseWeightEntryRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseWeightEntryRow | null) ?? null;
};

const fetchSupabaseWeightEntryRows = async (
  userId: string,
  options: ListWeightEntriesOptions = {},
): Promise<SupabaseWeightEntryRow[]> => {
  const supabase = getSupabaseClient();
  let builder = supabase
    .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 500);

  if (!options.includeDeleted) {
    builder = builder.is("deleted_at", null);
  }

  if (options.startDate) {
    builder = builder.gte("measured_day_local", options.startDate);
  }

  if (options.endDate) {
    builder = builder.lte("measured_day_local", options.endDate);
  }

  const { data, error } = await builder;

  if (error) {
    throw error;
  }

  return (data as SupabaseWeightEntryRow[]) ?? [];
};

const toSupabaseWeightEntryPayload = ({
  createdAt,
  deletedAt,
  deviceId,
  id,
  measuredAt,
  measuredAtLocalIso,
  notes,
  source,
  syncError,
  syncStatus,
  updatedAt,
  userId,
  valueKg,
  valueOriginal,
  version,
  zoneOffsetMinutes,
  clientGeneratedId,
}: {
  clientGeneratedId: string;
  createdAt: string;
  deletedAt: string | null;
  deviceId: string | null;
  id: string;
  measuredAt: string;
  measuredAtLocalIso: string;
  notes: string | null;
  source: DBWeightEntry["source"];
  syncError: string | null;
  syncStatus: DBWeightEntry["syncStatus"];
  updatedAt: string;
  userId: string;
  valueKg: number;
  valueOriginal: number;
  version: number;
  zoneOffsetMinutes: number;
}) => ({
  id,
  user_id: userId,
  measured_at: measuredAt,
  measured_at_local_iso: measuredAtLocalIso,
  zone_offset_minutes: zoneOffsetMinutes,
  value_kg: valueKg,
  value_original: valueOriginal,
  unit_original: "kg",
  source,
  notes,
  client_generated_id: clientGeneratedId,
  device_id: deviceId,
  created_at: createdAt,
  updated_at: updatedAt,
  deleted_at: deletedAt,
  version,
  sync_status: syncStatus,
  sync_error: syncError,
});

const upsertSupabaseWeightEntryPayload = async (
  payload: ReturnType<typeof toSupabaseWeightEntryPayload>,
): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw error;
  }
};

const fetchSupabaseWeightGoalRow = async (
  userId: string,
): Promise<SupabaseWeightGoalRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_WEIGHT_GOALS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseWeightGoalRow | null) ?? null;
};

const toDbWeightGoal = (row: SupabaseWeightGoalRow): WeightEntryGoal => ({
  userExternalId: row.user_id,
  targetWeightKg: parseRequiredNumber(row.target_weight_kg),
  targetDate: normalizeOptionalText(row.target_date),
  goalBandKg: parseNullableNumber(row.goal_band_kg),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const upsertSupabaseWeightGoal = async ({
  createdAt,
  input,
  userId,
}: {
  createdAt?: string | null;
  input: SaveWeightGoalInput;
  userId: string;
}): Promise<WeightEntryGoal> => {
  const existingRemote = await fetchSupabaseWeightGoalRow(userId);
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_WEIGHT_GOALS_TABLE)
    .upsert(
      {
        user_id: userId,
        target_weight_kg: input.targetWeightKg,
        target_date: normalizeOptionalText(input.targetDate),
        goal_band_kg: input.goalBandKg ?? 0.3,
        created_at:
          normalizeOptionalText(existingRemote?.created_at) ??
          normalizeOptionalText(createdAt) ??
          now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toDbWeightGoal(data as SupabaseWeightGoalRow);
};

const migrateLegacyUserToSupabase = async (
  legacyUser: DBUser,
): Promise<SupabaseProfile | null> => {
  const authUserId = await resolveSupabaseUserId(legacyUser.externalId);

  if (!authUserId) {
    return null;
  }

  return upsertSupabaseProfile(buildSupabaseProfileInputFromDbUser(legacyUser));
};

const migrateLegacyUserSettingsToSupabase = async (
  legacySettings: DBUserSettings,
): Promise<DBUserSettings | null> => {
  const authUserId = await resolveSupabaseUserId(legacySettings.userExternalId);

  if (!authUserId) {
    return null;
  }

  return upsertSupabaseUserSettings({
    createdAt: legacySettings.createdAt,
    input: {
      userExternalId: legacySettings.userExternalId,
      foodDiaryStartHour: legacySettings.foodDiaryStartHour,
      foodDiaryEndHour: legacySettings.foodDiaryEndHour,
      dailyCalorieOverrides: legacySettings.dailyCalorieOverrides,
    },
    userId: authUserId,
  });
};

const migrateLegacyWeightsToSupabase = async (
  legacyExternalId: string,
  userId: string,
): Promise<void> => {
  const [legacyEntries, legacyGoal] = await Promise.all([
    listWeightEntriesLocal(legacyExternalId, {
      includeDeleted: true,
      limit: 2000,
    }),
    getWeightGoalLocal(legacyExternalId),
  ]);

  if (legacyEntries.length > 0) {
    const payload = legacyEntries.map((entry) =>
      toSupabaseWeightEntryPayload({
        clientGeneratedId: entry.clientGeneratedId,
        createdAt: entry.createdAt,
        deletedAt: entry.deletedAt,
        deviceId: entry.deviceId,
        id: entry.id,
        measuredAt: entry.measuredAt,
        measuredAtLocalIso: entry.measuredAtLocalIso,
        notes: entry.notes,
        source: entry.source,
        syncError: null,
        syncStatus: "synced",
        updatedAt: entry.updatedAt,
        userId,
        valueKg: entry.valueKg,
        valueOriginal: entry.valueOriginal,
        version: entry.version,
        zoneOffsetMinutes: entry.zoneOffsetMinutes,
      }),
    );

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
      .upsert(payload, { onConflict: "id" });

    if (error) {
      throw error;
    }
  }

  if (legacyGoal) {
    const remoteGoal = await fetchSupabaseWeightGoalRow(userId);
    if (!remoteGoal) {
      await upsertSupabaseWeightGoal({
        createdAt: legacyGoal.createdAt,
        input: {
          userExternalId: legacyGoal.userExternalId,
          targetWeightKg: legacyGoal.targetWeightKg,
          targetDate: legacyGoal.targetDate,
          goalBandKg: legacyGoal.goalBandKg,
        },
        userId,
      });
    }
  }
};

export const upsertUser = async (input: DBUser): Promise<void> => {
  if (isLocalOnlyAccount(input)) {
    throw new Error("Local-only accounts are no longer supported.");
  }

  await resolveSupabaseUserId(input.externalId);
  await upsertSupabaseProfile(buildSupabaseProfileInputFromDbUser(input));
};

export const getUserByExternalId = async (
  externalId: string,
): Promise<DBUser | null> => {
  const [localAccount, legacyUser, sessionUser] = await Promise.all([
    getLocalAccount(),
    getUserByExternalIdLocal(externalId),
    getSupabaseSessionUser(),
  ]);

  if (!sessionUser || sessionUser.id !== externalId) {
    return null;
  }

  let profile = await getSupabaseProfile(externalId);

  if (!profile && legacyUser) {
    try {
      profile = await migrateLegacyUserToSupabase(legacyUser);
    } catch {
      return legacyUser;
    }
  }

  if (profile) {
    return toDbUserFromProfile({
      localAccount,
      profile,
      sessionUser,
      legacyUser,
    });
  }

  return legacyUser;
};

export const getFirstUser = async (): Promise<DBUser | null> => {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser?.id) {
    return null;
  }

  return getUserByExternalId(sessionUser.id);
};

export const getUserSettings = async (
  userExternalId: string,
): Promise<DBUserSettings | null> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  const remoteRow = await fetchSupabaseUserSettingsRow(authUserId);
  if (remoteRow) {
    return toDbUserSettings(remoteRow);
  }

  const legacySettings = await getUserSettingsLocal(userExternalId);
  if (!legacySettings) {
    return null;
  }

  try {
    return await migrateLegacyUserSettingsToSupabase(legacySettings);
  } catch {
    return legacySettings;
  }
};

export const saveUserSettings = async (
  input: SaveUserSettingsInput,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const legacySettings = await getUserSettingsLocal(input.userExternalId);
  await upsertSupabaseUserSettings({
    createdAt: legacySettings?.createdAt,
    input,
    userId: authUserId,
  });
};

export const listAdaptiveCalorieRecommendations = async ({
  userExternalId,
  limit = 20,
  status = null,
}: ListAdaptiveCalorieRecommendationsInput): Promise<
  DBAdaptiveCalorieRecommendation[]
> => {
  let authUserId: string;

  try {
    authUserId = await resolveSupabaseUserId(userExternalId);
  } catch {
    return [];
  }

  const supabase = getSupabaseClient();
  let builder = supabase
    .from(SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE)
    .select("*")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    builder = builder.eq("status", status);
  }

  const { data, error } = await builder;

  if (error) {
    throw error;
  }

  return ((data as SupabaseAdaptiveCalorieRecommendationRow[]) ?? []).map(
    toDbAdaptiveCalorieRecommendation,
  );
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
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const now = new Date().toISOString();
  const status = input.status ?? "proposed";
  const supabase = getSupabaseClient();

  if (status === "proposed") {
    const { error: supersedeError } = await supabase
      .from(SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE)
      .update({
        status: "superseded",
        responded_at: now,
      })
      .eq("user_id", authUserId)
      .eq("status", "proposed");

    if (supersedeError) {
      throw supersedeError;
    }
  }

  const { data, error } = await supabase
    .from(SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE)
    .insert({
      user_id: authUserId,
      status,
      algorithm_version: normalizeOptionalText(input.algorithmVersion) ?? "v1",
      window_start: input.windowStart,
      window_end: input.windowEnd,
      confidence: input.confidence,
      current_base_calories: input.currentBaseCalories ?? null,
      recommended_base_calories: input.recommendedBaseCalories,
      estimated_tdee: input.estimatedTdee,
      recommended_delta: input.recommendedDelta,
      avg_logged_calories: input.avgLoggedCalories,
      complete_days_used: input.completeDaysUsed,
      weigh_ins_used: input.weighInsUsed,
      trend_start_kg: input.trendStartKg,
      trend_end_kg: input.trendEndKg,
      observed_weekly_change_kg: input.observedWeeklyChangeKg ?? null,
      reason: input.reason,
      input_summary: input.inputSummary ?? null,
      responded_at: normalizeOptionalText(input.respondedAt) ?? null,
      applied_at: normalizeOptionalText(input.appliedAt) ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (status === "proposed" && error.code === "23505") {
      const latestOpen = await getLatestAdaptiveCalorieRecommendation(
        input.userExternalId,
        "proposed",
      );

      if (latestOpen) {
        return latestOpen;
      }
    }

    throw error;
  }

  return toDbAdaptiveCalorieRecommendation(
    data as SupabaseAdaptiveCalorieRecommendationRow,
  );
};

export const updateAdaptiveCalorieRecommendation = async (
  input: UpdateAdaptiveCalorieRecommendationInput,
): Promise<DBAdaptiveCalorieRecommendation | null> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const updatePayload: Record<string, string | null> = {};
  const now = new Date().toISOString();

  if (input.status !== undefined) {
    updatePayload.status = input.status;
  }

  if (input.respondedAt !== undefined) {
    updatePayload.responded_at = normalizeOptionalText(input.respondedAt);
  } else if (input.status === "accepted" || input.status === "rejected") {
    updatePayload.responded_at = now;
  }

  if (input.appliedAt !== undefined) {
    updatePayload.applied_at = normalizeOptionalText(input.appliedAt);
  } else if (input.status === "applied") {
    updatePayload.applied_at = now;
  }

  if (Object.keys(updatePayload).length === 0) {
    const currentRows = await listAdaptiveCalorieRecommendations({
      userExternalId: input.userExternalId,
      limit: 100,
    });
    return currentRows.find((item) => item.id === input.id) ?? null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE)
    .update(updatePayload)
    .eq("user_id", authUserId)
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toDbAdaptiveCalorieRecommendation(
        data as SupabaseAdaptiveCalorieRecommendationRow,
      )
    : null;
};

export const listWeightEntries = async (
  userExternalId: string,
  options: ListWeightEntriesOptions = {},
): Promise<DBWeightEntry[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  let remoteRows = await fetchSupabaseWeightEntryRows(authUserId, options);

  if (remoteRows.length === 0) {
    const legacyEntries = await listWeightEntriesLocal(userExternalId, {
      includeDeleted: true,
      limit: 2000,
    });

    if (legacyEntries.length > 0) {
      try {
        await migrateLegacyWeightsToSupabase(userExternalId, authUserId);
        remoteRows = await fetchSupabaseWeightEntryRows(authUserId, options);
      } catch {
        // Keep the remote store authoritative when legacy migration fails.
      }
    }
  }

  return remoteRows.map(toDbWeightEntry);
};

export const listWeightEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBWeightEntry[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  let remoteRows = await fetchSupabaseWeightEntryRows(authUserId, {
    includeDeleted: false,
    limit: 2000,
    startDate,
    endDate,
  });

  if (remoteRows.length === 0) {
    const legacyEntries = await listWeightEntriesLocal(userExternalId, {
      includeDeleted: false,
      limit: 2000,
    });

    if (legacyEntries.length > 0) {
      try {
        await migrateLegacyWeightsToSupabase(userExternalId, authUserId);
        remoteRows = await fetchSupabaseWeightEntryRows(authUserId, {
          includeDeleted: false,
          limit: 2000,
          startDate,
          endDate,
        });
      } catch {
        return legacyEntries.filter((entry) => {
          const localDate = entry.measuredAtLocalIso.slice(0, 10);
          return (
            entry.deletedAt == null &&
            localDate >= startDate &&
            localDate <= endDate
          );
        });
      }
    }
  }

  return remoteRows.map(toDbWeightEntry);
};

export const saveWeightEntry = async (
  input: SaveWeightEntryInput,
): Promise<DBWeightEntry> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const localDateKey = input.measuredAtLocalIso.slice(0, 10);

  try {
    await migrateLegacyWeightsToSupabase(input.userExternalId, authUserId);
  } catch {
    // Continue with the server write even if legacy import is unavailable.
  }

  const currentExisting = await fetchSupabaseWeightEntryRowById(authUserId, input.id);
  const { data: sameDayRows, error: sameDayError } = await supabase
    .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", authUserId)
    .eq("measured_day_local", localDateKey)
    .is("deleted_at", null)
    .neq("id", input.id);

  if (sameDayError) {
    throw sameDayError;
  }

  for (const row of (sameDayRows as SupabaseWeightEntryRow[]) ?? []) {
    await upsertSupabaseWeightEntryPayload(
      toSupabaseWeightEntryPayload({
        clientGeneratedId: row.client_generated_id,
        createdAt: normalizeOptionalText(row.created_at) ?? now,
        deletedAt: now,
        deviceId: normalizeOptionalText(row.device_id),
        id: row.id,
        measuredAt: row.measured_at,
        measuredAtLocalIso: row.measured_at_local_iso,
        notes: normalizeOptionalText(row.notes),
        source: row.source as DBWeightEntry["source"],
        syncError: null,
        syncStatus: "synced",
        updatedAt: now,
        userId: authUserId,
        valueKg: parseRequiredNumber(row.value_kg),
        valueOriginal: parseRequiredNumber(row.value_original),
        version: parseRequiredNumber(row.version, 1) + 1,
        zoneOffsetMinutes: parseRequiredNumber(row.zone_offset_minutes),
      }),
    );
  }

  await upsertSupabaseWeightEntryPayload(
    toSupabaseWeightEntryPayload({
      clientGeneratedId: input.clientGeneratedId,
      createdAt: normalizeOptionalText(currentExisting?.created_at) ?? now,
      deletedAt: null,
      deviceId: normalizeOptionalText(input.deviceId),
      id: input.id,
      measuredAt: input.measuredAt,
      measuredAtLocalIso: input.measuredAtLocalIso,
      notes: normalizeOptionalText(input.notes),
      source: input.source,
      syncError: null,
      syncStatus: "synced",
      updatedAt: now,
      userId: authUserId,
      valueKg: input.valueKg,
      valueOriginal: input.valueOriginal,
      version: parseRequiredNumber(currentExisting?.version, 0) + 1,
      zoneOffsetMinutes: input.zoneOffsetMinutes,
    }),
  );

  const savedRow = await fetchSupabaseWeightEntryRowById(authUserId, input.id);
  if (!savedRow) {
    throw new Error("Failed to save weight entry.");
  }

  await invalidateAdaptiveCalculationTimestamp(authUserId);

  return toDbWeightEntry(savedRow);
};

export const softDeleteWeightEntry = async (
  input: SoftDeleteWeightEntryInput,
): Promise<DBWeightEntry | null> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const existing = await fetchSupabaseWeightEntryRowById(authUserId, input.id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  await upsertSupabaseWeightEntryPayload(
    toSupabaseWeightEntryPayload({
      clientGeneratedId: existing.client_generated_id,
      createdAt: normalizeOptionalText(existing.created_at) ?? now,
      deletedAt: now,
      deviceId: normalizeOptionalText(existing.device_id),
      id: existing.id,
      measuredAt: existing.measured_at,
      measuredAtLocalIso: existing.measured_at_local_iso,
      notes: normalizeOptionalText(existing.notes),
      source: existing.source as DBWeightEntry["source"],
      syncError: null,
      syncStatus: "synced",
      updatedAt: now,
      userId: authUserId,
      valueKg: parseRequiredNumber(existing.value_kg),
      valueOriginal: parseRequiredNumber(existing.value_original),
      version: parseRequiredNumber(existing.version, 1) + 1,
      zoneOffsetMinutes: parseRequiredNumber(existing.zone_offset_minutes),
    }),
  );

  await invalidateAdaptiveCalculationTimestamp(authUserId);

  const deleted = await fetchSupabaseWeightEntryRowById(authUserId, input.id);
  return deleted ? toDbWeightEntry(deleted) : null;
};

export const getWeightGoal = async (
  userExternalId: string,
): Promise<WeightEntryGoal | null> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  const remoteRow = await fetchSupabaseWeightGoalRow(authUserId);
  if (remoteRow) {
    return toDbWeightGoal(remoteRow);
  }

  const legacyGoal = await getWeightGoalLocal(userExternalId);
  if (!legacyGoal) {
    return null;
  }

  try {
    return await upsertSupabaseWeightGoal({
      createdAt: legacyGoal.createdAt,
      input: {
        userExternalId: legacyGoal.userExternalId,
        targetWeightKg: legacyGoal.targetWeightKg,
        targetDate: legacyGoal.targetDate,
        goalBandKg: legacyGoal.goalBandKg,
      },
      userId: authUserId,
    });
  } catch {
    return legacyGoal;
  }
};

export const saveWeightGoal = async (
  input: SaveWeightGoalInput,
): Promise<WeightEntryGoal> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const legacyGoal = await getWeightGoalLocal(input.userExternalId);
  return upsertSupabaseWeightGoal({
    createdAt: legacyGoal?.createdAt,
    input,
    userId: authUserId,
  });
};

export const clearWeightGoal = async (userExternalId: string): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_WEIGHT_GOALS_TABLE)
    .delete()
    .eq("user_id", authUserId);

  if (error) {
    throw error;
  }

  await clearWeightGoalLocal(userExternalId);
};

export const clearAllWeightData = async (
  userExternalId: string,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);
  const supabase = getSupabaseClient();
  const { error: entriesError } = await supabase
    .from(SUPABASE_WEIGHT_ENTRIES_TABLE)
    .delete()
    .eq("user_id", authUserId);

  if (entriesError) {
    throw entriesError;
  }

  const { error: goalError } = await supabase
    .from(SUPABASE_WEIGHT_GOALS_TABLE)
    .delete()
    .eq("user_id", authUserId);

  if (goalError) {
    throw goalError;
  }

  await clearAllWeightDataLocal(userExternalId);
};
