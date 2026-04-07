import { getDb, initDb } from "../storage/sqlite";
import type { DBUserSettings, SaveUserSettingsInput } from "./DB_TYPES";

const DEFAULT_FOOD_DIARY_START_HOUR = 7;
const DEFAULT_FOOD_DIARY_END_HOUR = 22;

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

const toUserSettings = (
  row: Record<string, unknown>,
): DBUserSettings => {
  const normalized = normalizeFoodDiaryHours(
    Number(row.foodDiaryStartHour),
    Number(row.foodDiaryEndHour),
  );

  return {
    userExternalId: String(row.userExternalId ?? ""),
    ...normalized,
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
  const normalized = normalizeFoodDiaryHours(
    input.foodDiaryStartHour,
    input.foodDiaryEndHour,
  );

  await db.runAsync(
    `
    INSERT INTO user_settings (
      user_external_id,
      food_diary_start_hour,
      food_diary_end_hour,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_external_id) DO UPDATE SET
      food_diary_start_hour = excluded.food_diary_start_hour,
      food_diary_end_hour = excluded.food_diary_end_hour,
      updated_at = excluded.updated_at
    `,
    input.userExternalId,
    normalized.foodDiaryStartHour,
    normalized.foodDiaryEndHour,
    now,
    now,
  );
};
