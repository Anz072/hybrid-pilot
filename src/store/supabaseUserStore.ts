import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../API/supabase/client";
import {
  buildSupabaseProfileInputFromDbUser,
  getSupabaseProfile,
  toDbUserFromSupabaseProfile,
  upsertSupabaseProfile,
  type SupabaseProfile,
} from "../API/supabase/supabaseProfiles";
import { getLocalAccount } from "../storage/localStore";
import type {
  DBUser,
  DBUserSettings,
  DBWeightEntry,
  SaveUserSettingsInput,
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
  saveWeightEntry as saveWeightEntryLocal,
  saveWeightGoal as saveWeightGoalLocal,
  softDeleteWeightEntry as softDeleteWeightEntryLocal,
} from "./weightRepository";
import {
  DAILY_CALORIE_OVERRIDE_COUNT,
  DEFAULT_FOOD_DIARY_END_HOUR,
  DEFAULT_FOOD_DIARY_START_HOUR,
  getUserSettings as getUserSettingsLocal,
  saveUserSettings as saveUserSettingsLocal,
} from "./userSettingsRepository";
import {
  getFirstUser as getFirstUserLocal,
  getUserByExternalId as getUserByExternalIdLocal,
  upsertUser as upsertUserLocal,
} from "./userRepository";

const SUPABASE_USER_SETTINGS_TABLE = "user_settings";
const SUPABASE_WEIGHT_ENTRIES_TABLE = "weight_entries";
const SUPABASE_WEIGHT_GOALS_TABLE = "weight_goals";

type ListWeightEntriesOptions = {
  includeDeleted?: boolean;
  limit?: number;
};

type SupabaseUserSettingsRow = {
  user_id: string;
  food_diary_start_hour: number | string | null;
  food_diary_end_hour: number | string | null;
  daily_calorie_overrides: unknown;
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

const getSupabaseSessionUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    return session?.user ?? null;
  } catch {
    return null;
  }
};

const resolveSupabaseUserId = async (
  userExternalId?: string | null,
): Promise<string | null> => {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser) {
    return null;
  }

  if (userExternalId && sessionUser.id !== userExternalId) {
    return null;
  }

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
    return upsertUserLocal(input);
  }

  const authUserId = await resolveSupabaseUserId(input.externalId);

  if (!authUserId) {
    return upsertUserLocal(input);
  }

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

  if (localAccount?.provider === "local" && localAccount.id === externalId) {
    return legacyUser;
  }

  if (sessionUser?.id === externalId) {
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
  }

  return legacyUser;
};

export const getFirstUser = async (): Promise<DBUser | null> => {
  const [localAccount, sessionUser] = await Promise.all([
    getLocalAccount(),
    getSupabaseSessionUser(),
  ]);

  if (localAccount?.provider === "local") {
    return (
      (await getUserByExternalIdLocal(localAccount.id)) ??
      (await getFirstUserLocal())
    );
  }

  if (localAccount?.provider === "google" && localAccount.id) {
    const matchedRemoteUser =
      sessionUser?.id === localAccount.id
        ? await getUserByExternalId(localAccount.id)
        : null;

    if (matchedRemoteUser) {
      return matchedRemoteUser;
    }

    const legacyGoogleUser = await getUserByExternalIdLocal(localAccount.id);
    if (legacyGoogleUser) {
      return legacyGoogleUser;
    }
  }

  if (sessionUser?.id) {
    const remoteUser = await getUserByExternalId(sessionUser.id);
    if (remoteUser) {
      return remoteUser;
    }
  }

  return getFirstUserLocal();
};

export const getUserSettings = async (
  userExternalId: string,
): Promise<DBUserSettings | null> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getUserSettingsLocal(userExternalId);
  }

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

  if (!authUserId) {
    return saveUserSettingsLocal(input);
  }

  const legacySettings = await getUserSettingsLocal(input.userExternalId);
  await upsertSupabaseUserSettings({
    createdAt: legacySettings?.createdAt,
    input,
    userId: authUserId,
  });
};

export const listWeightEntries = async (
  userExternalId: string,
  options: ListWeightEntriesOptions = {},
): Promise<DBWeightEntry[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return listWeightEntriesLocal(userExternalId, options);
  }

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
        return listWeightEntriesLocal(userExternalId, options);
      }
    }
  }

  return remoteRows.map(toDbWeightEntry);
};

export const saveWeightEntry = async (
  input: SaveWeightEntryInput,
): Promise<DBWeightEntry> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return saveWeightEntryLocal(input);
  }

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

  return toDbWeightEntry(savedRow);
};

export const softDeleteWeightEntry = async (
  input: SoftDeleteWeightEntryInput,
): Promise<DBWeightEntry | null> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return softDeleteWeightEntryLocal(input);
  }

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

  const deleted = await fetchSupabaseWeightEntryRowById(authUserId, input.id);
  return deleted ? toDbWeightEntry(deleted) : null;
};

export const getWeightGoal = async (
  userExternalId: string,
): Promise<WeightEntryGoal | null> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getWeightGoalLocal(userExternalId);
  }

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

  if (!authUserId) {
    return saveWeightGoalLocal(input);
  }

  const legacyGoal = await getWeightGoalLocal(input.userExternalId);
  return upsertSupabaseWeightGoal({
    createdAt: legacyGoal?.createdAt,
    input,
    userId: authUserId,
  });
};

export const clearWeightGoal = async (userExternalId: string): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return clearWeightGoalLocal(userExternalId);
  }

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

  if (!authUserId) {
    return clearAllWeightDataLocal(userExternalId);
  }

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
