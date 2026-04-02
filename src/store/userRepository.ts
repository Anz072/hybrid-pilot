import { getDb, initDb } from "../storage/sqlite";
import type { DBUser, DBUserRow, UpsertUserInput } from "./DB_TYPES";

const rowToUser = (row: DBUserRow): DBUser => {
  return {
    id: row.id,
    externalId: row.external_id,
    provider: row.provider,
    displayName: row.display_name,
    createdAt: row.created_at,
    email: row.email,
    birthdate: row.birthdate,
    gender: (row.gender as DBUser["gender"]) ?? null,
    heightCm: row.height_cm,
    activityLevel: row.activity_level,
    goal: row.goal,
  };
};

export const upsertUser = async (input: UpsertUserInput): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO users (external_id, provider, display_name, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
      provider = excluded.provider,
      display_name = excluded.display_name
    `,
    input.externalId,
    input.provider,
    input.displayName ?? null,
    now,
  );
};

export const getFirstUser = async (): Promise<DBUser | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<DBUserRow>(
    `
    SELECT id, external_id, provider, display_name, created_at, email, birthdate, gender, height_cm, activity_level, goal
    FROM users
    ORDER BY id ASC
    LIMIT 1
    `,
  );

  return row ? rowToUser(row) : null;
};
