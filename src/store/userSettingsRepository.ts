import { getDb, initDb } from "../storage/sqlite";
import type {
  AdaptiveCalorieMode,
  DBUserSettings,
  SaveUserSettingsInput,
} from "./DB_TYPES";

export const DEFAULT_FOOD_DIARY_START_HOUR = 7;
export const DEFAULT_FOOD_DIARY_END_HOUR = 22;
export const DAILY_CALORIE_OVERRIDE_COUNT = 7;

const clampHour = (value: number) =>
  Math.max(0, Math.min(23, Math.round(value)));

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

const parseAdaptiveMode = (value: unknown): AdaptiveCalorieMode =>
  value === "auto_apply" ? "auto_apply" : "recommend";

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

const toUserSettings = (
  row: Record<string, unknown>,
): DBUserSettings => {
  let parsedDailyCalorieOverrides: unknown = row.dailyCalorieOverrides;

  if (
    typeof row.dailyCalorieOverrides === "string" &&
    row.dailyCalorieOverrides.length > 0
  ) {
    try {
      parsedDailyCalorieOverrides = JSON.parse(row.dailyCalorieOverrides);
    } catch {
      parsedDailyCalorieOverrides = null;
    }
  }

  const normalized = normalizeFoodDiaryHours(
    Number(row.foodDiaryStartHour),
    Number(row.foodDiaryEndHour),
  );
  const dailyCalorieOverrides = normalizeDailyCalorieOverrides(
    parsedDailyCalorieOverrides,
  );

  return {
    userExternalId: String(row.userExternalId ?? ""),
    ...normalized,
    dailyCalorieOverrides,
    adaptiveCaloriesEnabled: parseBoolean(row.adaptiveCaloriesEnabled),
    adaptiveMode: parseAdaptiveMode(row.adaptiveMode),
    adaptiveLastCalculatedAt:
      typeof row.adaptiveLastCalculatedAt === "string" &&
      row.adaptiveLastCalculatedAt.length > 0
        ? row.adaptiveLastCalculatedAt
        : null,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? ""),
  };
};

export const getUserSettings = async (
  userExternalId: string,
): Promise<DBUserSettings | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    SELECT
      user_external_id AS userExternalId,
      food_diary_start_hour AS foodDiaryStartHour,
      food_diary_end_hour AS foodDiaryEndHour,
      daily_calorie_overrides AS dailyCalorieOverrides,
      adaptive_calories_enabled AS adaptiveCaloriesEnabled,
      adaptive_mode AS adaptiveMode,
      adaptive_last_calculated_at AS adaptiveLastCalculatedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_settings
    WHERE user_external_id = ?
    LIMIT 1
    `,
    userExternalId,
  );

  return row ? toUserSettings(row) : null;
};

export const saveUserSettings = async (
  input: SaveUserSettingsInput,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await getUserSettings(input.userExternalId);
  const normalized = normalizeFoodDiaryHours(
    input.foodDiaryStartHour ?? existing?.foodDiaryStartHour ?? DEFAULT_FOOD_DIARY_START_HOUR,
    input.foodDiaryEndHour ?? existing?.foodDiaryEndHour ?? DEFAULT_FOOD_DIARY_END_HOUR,
  );
  const dailyCalorieOverrides =
    input.dailyCalorieOverrides !== undefined
      ? normalizeDailyCalorieOverrides(input.dailyCalorieOverrides)
      : existing?.dailyCalorieOverrides ?? null;
  const adaptiveCaloriesEnabled =
    input.adaptiveCaloriesEnabled ?? existing?.adaptiveCaloriesEnabled ?? false;
  const adaptiveMode = input.adaptiveMode ?? existing?.adaptiveMode ?? "recommend";
  const adaptiveLastCalculatedAt =
    input.adaptiveLastCalculatedAt !== undefined
      ? input.adaptiveLastCalculatedAt?.trim() || null
      : existing?.adaptiveLastCalculatedAt ?? null;

  await db.runAsync(
    `
    INSERT INTO user_settings (
      user_external_id,
      food_diary_start_hour,
      food_diary_end_hour,
      daily_calorie_overrides,
      adaptive_calories_enabled,
      adaptive_mode,
      adaptive_last_calculated_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_external_id) DO UPDATE SET
      food_diary_start_hour = excluded.food_diary_start_hour,
      food_diary_end_hour = excluded.food_diary_end_hour,
      daily_calorie_overrides = excluded.daily_calorie_overrides,
      adaptive_calories_enabled = excluded.adaptive_calories_enabled,
      adaptive_mode = excluded.adaptive_mode,
      adaptive_last_calculated_at = excluded.adaptive_last_calculated_at,
      updated_at = excluded.updated_at
    `,
    input.userExternalId,
    normalized.foodDiaryStartHour,
    normalized.foodDiaryEndHour,
    dailyCalorieOverrides ? JSON.stringify(dailyCalorieOverrides) : null,
    adaptiveCaloriesEnabled ? 1 : 0,
    adaptiveMode,
    adaptiveLastCalculatedAt,
    existing?.createdAt ?? now,
    now,
  );
};
