import { initDb, getDb } from "../storage/sqlite";
import type { AddWeightLogInput, DBWeightLog } from "./DB_TYPES";
import { DB } from "./DB";

export const addWeightLog = async (input: AddWeightLogInput): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO weight_logs (user_external_id, weight_kg, note, logged_at, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    input.userExternalId,
    input.weightKg,
    input.note ?? null,
    input.loggedAt ?? now,
    now,
  );
};

export const getRecentWeightLogs = async (
  userExternalId: string,
  limit = 30,
): Promise<DBWeightLog[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<DBWeightLog>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      weight_kg AS weightKg,
      note,
      logged_at AS loggedAt,
      created_at AS createdAt
    FROM weight_logs
    WHERE user_external_id = ?
    ORDER BY datetime(logged_at) DESC
    LIMIT ?
    `,
    userExternalId,
    limit,
  );

  return rows;
};
