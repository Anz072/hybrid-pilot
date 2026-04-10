import { getDb, initDb } from "../storage/sqlite";
import type { DBUserSettings, SaveUserSettingsInput } from "./DB_TYPES";

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

  await db.runAsync(
    `
    INSERT INTO user_settings (
      user_external_id,
      food_diary_start_hour,
      food_diary_end_hour,
      daily_calorie_overrides,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_external_id) DO UPDATE SET
      food_diary_start_hour = excluded.food_diary_start_hour,
      food_diary_end_hour = excluded.food_diary_end_hour,
      daily_calorie_overrides = excluded.daily_calorie_overrides,
      updated_at = excluded.updated_at
    `,
    input.userExternalId,
    normalized.foodDiaryStartHour,
    normalized.foodDiaryEndHour,
    dailyCalorieOverrides ? JSON.stringify(dailyCalorieOverrides) : null,
    existing?.createdAt ?? now,
    now,
  );
};
