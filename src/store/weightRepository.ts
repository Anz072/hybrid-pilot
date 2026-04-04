import { getDb, initDb } from "../storage/sqlite";
import type {
  AddWeightLogInput,
  DBWeightEntry,
  DBWeightLog,
  SaveWeightEntryInput,
  SaveWeightGoalInput,
  SoftDeleteWeightEntryInput,
  WeightEntryGoal,
} from "./DB_TYPES";

type RawWeightEntryRow = Omit<DBWeightEntry, "tags"> & {
  tags: string | null;
};

type ListWeightEntriesOptions = {
  includeDeleted?: boolean;
  limit?: number;
};

const safeParseTags = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const mapWeightEntryRow = (row: RawWeightEntryRow): DBWeightEntry => ({
  ...row,
  unitOriginal: "kg",
  tags: safeParseTags(row.tags),
});

const getWeightEntryById = async (
  id: string,
  userExternalId: string,
): Promise<DBWeightEntry | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<RawWeightEntryRow>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      measured_at AS measuredAt,
      measured_at_local_iso AS measuredAtLocalIso,
      zone_offset_minutes AS zoneOffsetMinutes,
      value_kg AS valueKg,
      value_original AS valueOriginal,
      unit_original AS unitOriginal,
      source,
      notes,
      tags,
      client_generated_id AS clientGeneratedId,
      device_id AS deviceId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt,
      version,
      sync_status AS syncStatus,
      sync_error AS syncError
    FROM weight_entries
    WHERE id = ? AND user_external_id = ?
    LIMIT 1
    `,
    id,
    userExternalId,
  );

  return row ? mapWeightEntryRow(row) : null;
};

export const saveWeightEntry = async (
  input: SaveWeightEntryInput,
): Promise<DBWeightEntry> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO weight_entries (
      id,
      user_external_id,
      measured_at,
      measured_at_local_iso,
      zone_offset_minutes,
      value_kg,
      value_original,
      unit_original,
      source,
      notes,
      tags,
      client_generated_id,
      device_id,
      created_at,
      updated_at,
      deleted_at,
      version,
      sync_status,
      sync_error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      measured_at = excluded.measured_at,
      measured_at_local_iso = excluded.measured_at_local_iso,
      zone_offset_minutes = excluded.zone_offset_minutes,
      value_kg = excluded.value_kg,
      value_original = excluded.value_original,
      unit_original = excluded.unit_original,
      source = excluded.source,
      notes = excluded.notes,
      tags = excluded.tags,
      client_generated_id = excluded.client_generated_id,
      device_id = excluded.device_id,
      updated_at = excluded.updated_at,
      deleted_at = NULL,
      version = weight_entries.version + 1,
      sync_status = 'pending',
      sync_error = NULL
    `,
    input.id,
    input.userExternalId,
    input.measuredAt,
    input.measuredAtLocalIso,
    input.zoneOffsetMinutes,
    input.valueKg,
    input.valueOriginal,
    "kg",
    input.source,
    input.notes ?? null,
    JSON.stringify(input.tags ?? []),
    input.clientGeneratedId,
    input.deviceId ?? null,
    now,
    now,
    null,
    1,
    "pending",
    null,
  );

  const saved = await getWeightEntryById(input.id, input.userExternalId);
  if (!saved) {
    throw new Error("Failed to save weight entry.");
  }

  return saved;
};

export const listWeightEntries = async (
  userExternalId: string,
  options: ListWeightEntriesOptions = {},
): Promise<DBWeightEntry[]> => {
  await initDb();
  const db = await getDb();
  const includeDeleted = options.includeDeleted === true;
  const limit = options.limit ?? 500;

  const rows = await db.getAllAsync<RawWeightEntryRow>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      measured_at AS measuredAt,
      measured_at_local_iso AS measuredAtLocalIso,
      zone_offset_minutes AS zoneOffsetMinutes,
      value_kg AS valueKg,
      value_original AS valueOriginal,
      unit_original AS unitOriginal,
      source,
      notes,
      tags,
      client_generated_id AS clientGeneratedId,
      device_id AS deviceId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt,
      version,
      sync_status AS syncStatus,
      sync_error AS syncError
    FROM weight_entries
    WHERE user_external_id = ?
      AND (? = 1 OR deleted_at IS NULL)
    ORDER BY datetime(measured_at) DESC, datetime(created_at) DESC
    LIMIT ?
    `,
    userExternalId,
    includeDeleted ? 1 : 0,
    limit,
  );

  return rows.map(mapWeightEntryRow);
};

export const softDeleteWeightEntry = async (
  input: SoftDeleteWeightEntryInput,
): Promise<DBWeightEntry | null> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    UPDATE weight_entries
    SET
      deleted_at = ?,
      updated_at = ?,
      version = version + 1,
      sync_status = 'pending',
      sync_error = NULL
    WHERE id = ? AND user_external_id = ?
    `,
    now,
    now,
    input.id,
    input.userExternalId,
  );

  return getWeightEntryById(input.id, input.userExternalId);
};

export const getWeightGoal = async (
  userExternalId: string,
): Promise<WeightEntryGoal | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<WeightEntryGoal>(
    `
    SELECT
      user_external_id AS userExternalId,
      target_weight_kg AS targetWeightKg,
      target_date AS targetDate,
      goal_band_kg AS goalBandKg,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM weight_goals
    WHERE user_external_id = ?
    LIMIT 1
    `,
    userExternalId,
  );

  return row ?? null;
};

export const saveWeightGoal = async (
  input: SaveWeightGoalInput,
): Promise<WeightEntryGoal> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO weight_goals (
      user_external_id,
      target_weight_kg,
      target_date,
      goal_band_kg,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_external_id) DO UPDATE SET
      target_weight_kg = excluded.target_weight_kg,
      target_date = excluded.target_date,
      goal_band_kg = excluded.goal_band_kg,
      updated_at = excluded.updated_at
    `,
    input.userExternalId,
    input.targetWeightKg,
    input.targetDate ?? null,
    input.goalBandKg ?? 0.3,
    now,
    now,
  );

  const saved = await getWeightGoal(input.userExternalId);
  if (!saved) {
    throw new Error("Failed to save weight goal.");
  }

  return saved;
};

export const clearWeightGoal = async (userExternalId: string): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `DELETE FROM weight_goals WHERE user_external_id = ?`,
    userExternalId,
  );
};

export const clearAllWeightData = async (
  userExternalId: string,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `DELETE FROM weight_entries WHERE user_external_id = ?`,
    userExternalId,
  );
  await db.runAsync(
    `DELETE FROM weight_goals WHERE user_external_id = ?`,
    userExternalId,
  );
};

const createLegacyWeightEntryId = (): string =>
  `legacy-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export const addWeightLog = async (input: AddWeightLogInput): Promise<void> => {
  const now = input.loggedAt ?? new Date().toISOString();

  await saveWeightEntry({
    id: createLegacyWeightEntryId(),
    userExternalId: input.userExternalId,
    measuredAt: now,
    measuredAtLocalIso: now,
    zoneOffsetMinutes: 0,
    valueKg: input.weightKg,
    valueOriginal: input.weightKg,
    unitOriginal: "kg",
    source: "manual",
    notes: input.note ?? null,
    tags: [],
    clientGeneratedId: createLegacyWeightEntryId(),
  });
};

export const getRecentWeightLogs = async (
  userExternalId: string,
  limit = 30,
): Promise<DBWeightLog[]> => {
  const entries = await listWeightEntries(userExternalId, { limit });

  return entries.map((entry, index) => ({
    id: limit - index,
    userExternalId: entry.userExternalId,
    weightKg: entry.valueKg,
    note: entry.notes,
    loggedAt: entry.measuredAt,
    createdAt: entry.createdAt,
  }));
};
