import { getDb, initDb } from "../storage/sqlite";
import type {
  GoalStrategy,
  ProteinFocus,
} from "../navigation/onboardingTypes";
import { resolveGoalStrategy } from "../engine/goalStrategy";
import type { DBUser } from "./DB_TYPES";

type RawDBUser = Omit<DBUser, "trainingTypes" | "proteinFocus" | "goalStrategy"> & {
  trainingTypes: string | null;
  goalStrategy: string | null;
  proteinFocus: string | null;
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
      goal_strategy,
      training_types,
      protein_focus,
      calorieAllowance,
      proteinG,
      carbsG,
      fatG
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
      provider = excluded.provider,
      display_name = excluded.display_name,
      email = excluded.email,
      birthdate = excluded.birthdate,
      gender = excluded.gender,
      height_cm = excluded.height_cm,
      activity_level = excluded.activity_level,
      goal = excluded.goal,
      goal_strategy = excluded.goal_strategy,
      training_types = excluded.training_types,
      protein_focus = excluded.protein_focus,
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
    input.goalStrategy,
    trainingTypesJson,
    input.proteinFocus,
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
      goal_strategy AS goalStrategy,
      training_types AS trainingTypes,
      protein_focus AS proteinFocus,
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
    goalStrategy:
      resolveGoalStrategy(
        row.goal,
        (row.goalStrategy as GoalStrategy | null) ?? null,
      ) ?? null,
    trainingTypes:
      typeof row.trainingTypes === "string"
        ? (JSON.parse(row.trainingTypes) as string[])
        : null,
    proteinFocus: (row.proteinFocus as ProteinFocus | null) ?? null,
    calorieAllowance: row.calorieAllowance ?? null,
    proteinG: row.proteinG ?? null,
    carbsG: row.carbsG ?? null,
    fatG: row.fatG ?? null,
  };
};

export const getUserByExternalId = async (
  externalId: string,
): Promise<DBUser | null> => {
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
      goal_strategy AS goalStrategy,
      training_types AS trainingTypes,
      protein_focus AS proteinFocus,
      calorieAllowance,
      proteinG,
      carbsG,
      fatG
    FROM users
    WHERE external_id = ?
    LIMIT 1
    `,
    externalId,
  );

  if (!row) {
    return null;
  }

  return {
    ...row,
    gender: (row.gender as DBUser["gender"]) ?? null,
    goalStrategy:
      resolveGoalStrategy(
        row.goal,
        (row.goalStrategy as GoalStrategy | null) ?? null,
      ) ?? null,
    trainingTypes:
      typeof row.trainingTypes === "string"
        ? (JSON.parse(row.trainingTypes) as string[])
        : null,
    proteinFocus: (row.proteinFocus as ProteinFocus | null) ?? null,
    calorieAllowance: row.calorieAllowance ?? null,
    proteinG: row.proteinG ?? null,
    carbsG: row.carbsG ?? null,
    fatG: row.fatG ?? null,
  };
};
