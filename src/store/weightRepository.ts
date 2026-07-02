import { getDb, initDb } from "../storage/sqlite";
import type {
  DBWeightEntry,
  SaveWeightEntryInput,
  SaveWeightGoalInput,
  SoftDeleteWeightEntryInput,
  WeightEntryGoal,
} from "./DB_TYPES";

type ListWeightEntriesOptions = {
  includeDeleted?: boolean;
  limit?: number;
};

type RawWeightEntryRow = DBWeightEntry;

const mapWeightEntryRow = (row: RawWeightEntryRow): DBWeightEntry => ({
  ...row,
  unitOriginal: "kg",
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
  const localDateKey = input.measuredAtLocalIso.slice(0, 10);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      UPDATE weight_entries
      SET
        deleted_at = ?,
        updated_at = ?,
        version = version + 1,
        sync_status = 'pending',
        sync_error = NULL
      WHERE user_external_id = ?
        AND id != ?
        AND deleted_at IS NULL
        AND substr(measured_at_local_iso, 1, 10) = ?
      `,
      now,
      now,
      input.userExternalId,
      input.id,
      localDateKey,
    );

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
        client_generated_id,
        device_id,
        created_at,
        updated_at,
        deleted_at,
        version,
        sync_status,
        sync_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        measured_at = excluded.measured_at,
        measured_at_local_iso = excluded.measured_at_local_iso,
        zone_offset_minutes = excluded.zone_offset_minutes,
        value_kg = excluded.value_kg,
        value_original = excluded.value_original,
        unit_original = excluded.unit_original,
        source = excluded.source,
        notes = excluded.notes,
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
      input.clientGeneratedId,
      input.deviceId ?? null,
      now,
      now,
      null,
      1,
      "pending",
      null,
    );
  });

  const saved = await getWeightEntryById(input.id, input.userExternalId);
  if (!saved) {
    throw new Error("Failed to save weight entry.");
  }

  return saved;
};

export const upsertSyncedWeightEntries = async (
  entries: DBWeightEntry[],
  {
    overwritePending = false,
  }: {
    overwritePending?: boolean;
  } = {},
): Promise<void> => {
  if (entries.length === 0) {
    return;
  }

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  for (const entry of entries) {
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
        client_generated_id,
        device_id,
        created_at,
        updated_at,
        deleted_at,
        version,
        sync_status,
        sync_error,
        cached_at,
        last_synced_at,
        server_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        measured_at = excluded.measured_at,
        measured_at_local_iso = excluded.measured_at_local_iso,
        zone_offset_minutes = excluded.zone_offset_minutes,
        value_kg = excluded.value_kg,
        value_original = excluded.value_original,
        unit_original = excluded.unit_original,
        source = excluded.source,
        notes = excluded.notes,
        client_generated_id = excluded.client_generated_id,
        device_id = excluded.device_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        version = excluded.version,
        sync_status = 'synced',
        sync_error = NULL,
        cached_at = excluded.cached_at,
        last_synced_at = excluded.last_synced_at,
        server_updated_at = excluded.server_updated_at
      WHERE ? = 1 OR weight_entries.sync_status != 'pending'
      `,
      entry.id,
      entry.userExternalId,
      entry.measuredAt,
      entry.measuredAtLocalIso,
      entry.zoneOffsetMinutes,
      entry.valueKg,
      entry.valueOriginal,
      "kg",
      entry.source,
      entry.notes,
      entry.clientGeneratedId,
      entry.deviceId,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt,
      entry.version,
      now,
      now,
      entry.updatedAt,
      overwritePending ? 1 : 0,
    );
  }
};

export const markWeightEntrySyncError = async (
  id: string,
  userExternalId: string,
  error: unknown,
): Promise<DBWeightEntry | null> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE weight_entries
    SET sync_status = 'error', sync_error = ?
    WHERE id = ? AND user_external_id = ?
    `,
    error instanceof Error ? error.message : String(error),
    id,
    userExternalId,
  );

  return getWeightEntryById(id, userExternalId);
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
