import { getDb, initDb } from "../storage/sqlite";
import type { DBUser } from "./DB_TYPES";

type RawDBUser = Omit<DBUser, "trainingTypes"> & {
  trainingTypes: string | null;
};

export const upsertUser = async (input: DBUser): Promise<void> => {
  await initDb();
  const db = await getDb();
  const trainingTypesJson =
    input.trainingTypes && input.trainingTypes.length > 0
      ? JSON.stringify(input.trainingTypes)
      : null;

  await db.runAsync(
    `
    INSERT INTO users (
      external_id,
      provider,
      display_name,
      created_at,
      email,
      birthdate,
      gender,
      height_cm,
      activity_level,
      goal,
      training_types,
      calorieAllowance,
      proteinG,
      carbsG,
      fatG
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
      provider = excluded.provider,
      display_name = excluded.display_name,
      email = excluded.email,
      birthdate = excluded.birthdate,
      gender = excluded.gender,
      height_cm = excluded.height_cm,
      activity_level = excluded.activity_level,
      goal = excluded.goal,
      training_types = excluded.training_types,
      calorieAllowance = excluded.calorieAllowance,
      proteinG = excluded.proteinG,
      carbsG = excluded.carbsG,
      fatG = excluded.fatG
    `,
    input.externalId,
    input.provider,
    input.displayName,
    input.createdAt,
    input.email,
    input.birthdate,
    input.gender,
    input.heightCm,
    input.activityLevel,
    input.goal,
    trainingTypesJson,
    input.calorieAllowance,
    input.proteinG,
    input.carbsG,
    input.fatG,
  );
};

export const getFirstUser = async (): Promise<DBUser | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<RawDBUser>(
    `
    SELECT
      id,
      external_id AS externalId,
      provider,
      display_name AS displayName,
      created_at AS createdAt,
      email,
      birthdate,
      gender,
      height_cm AS heightCm,
      activity_level AS activityLevel,
      goal,
      training_types AS trainingTypes,
      calorieAllowance,
      proteinG,
      carbsG,
      fatG
    FROM users
    ORDER BY id ASC
    LIMIT 1
    `,
  );

  if (!row) {
    return null;
  }

  return {
    ...row,
    gender: (row.gender as DBUser["gender"]) ?? null,
    trainingTypes:
      typeof row.trainingTypes === "string"
        ? (JSON.parse(row.trainingTypes) as string[])
        : null,
    calorieAllowance: row.calorieAllowance ?? null,
    proteinG: row.proteinG ?? null,
    carbsG: row.carbsG ?? null,
    fatG: row.fatG ?? null,
  };
};
