import { initDb, getDb } from "../storage/sqlite";
import type {
  AddWeightLogInput,
  DBWeightLog,
  DBWeightLogRow,
} from "./DB_TYPES";
import { DB } from "./DB";

const rowToWeightLog = (row: DBWeightLogRow): DBWeightLog => {
  return {
    id: row.id,
    userExternalId: row.user_external_id,
    weightKg: row.weight_kg,
    note: row.note,
    loggedAt: row.logged_at,
    createdAt: row.created_at,
  };
};

export const addWeightLog = async (input: AddWeightLogInput): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await DB.addUser({
    externalId: input.userExternalId,
    provider: "local",
    displayName: "Local Athlete",
  });

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

  const rows = await db.getAllAsync<DBWeightLogRow>(
    `
    SELECT id, user_external_id, weight_kg, note, logged_at, created_at
    FROM weight_logs
    WHERE user_external_id = ?
    ORDER BY datetime(logged_at) DESC
    LIMIT ?
    `,
    userExternalId,
    limit,
  );

  return rows.map(rowToWeightLog);
};
