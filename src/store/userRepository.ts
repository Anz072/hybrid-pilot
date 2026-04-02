import { getDb, initDb } from "../storage/sqlite";
import type { DBUser, DBUserRow } from "./DB_TYPES";

const rowToUser = (row: DBUserRow): DBUser => {
  return {
    id: row.id,
    externalId: row.external_id ?? row.externalId ?? "",
    provider: row.provider,
    displayName: row.display_name ?? row.displayName ?? null,
    createdAt: row.created_at ?? row.createdAt ?? "",
    email: row.email,
    birthdate: row.birthdate,
    gender: (row.gender as DBUser["gender"]) ?? null,
    heightCm: row.height_cm ?? row.heightCm ?? null,
    activityLevel: row.activity_level ?? row.activityLevel ?? null,
    goal: row.goal,
    calorieAllowance: row.calorieAllowance,
  };
};

export const upsertUser = async (input: DBUserRow): Promise<void> => {
  await initDb();
  const db = await getDb();

  const externalId = input.external_id ?? input.externalId;
  if (!externalId) {
    throw new Error("upsertUser requires external_id or externalId");
  }

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
      calorieAllowance
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
      provider = excluded.provider,
      display_name = excluded.display_name,
      email = excluded.email,
      birthdate = excluded.birthdate,
      gender = excluded.gender,
      height_cm = excluded.height_cm,
      activity_level = excluded.activity_level,
      goal = excluded.goal,
      calorieAllowance = excluded.calorieAllowance
    `,
    externalId,
    input.provider,
    input.display_name ?? input.displayName ?? null,
    input.created_at ?? input.createdAt ?? new Date().toISOString(),
    input.email,
    input.birthdate,
    input.gender,
    input.height_cm ?? input.heightCm ?? null,
    input.activity_level ?? input.activityLevel ?? null,
    input.goal,
    input.calorieAllowance,
  );
};

export const getFirstUser = async (): Promise<DBUser | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<DBUserRow>(
    `
    SELECT id, external_id, provider, display_name, created_at, email, birthdate, gender, height_cm, activity_level, goal, calorieAllowance
    FROM users
    ORDER BY id ASC
    LIMIT 1
    `,
  );

  return row ? rowToUser(row) : null;
};
