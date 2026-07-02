import { getDb, initDb } from "../storage/sqlite";
import type {
  DBAdaptiveCalorieRecommendation,
  DBDiaryDayStatus,
  DBFoodItem,
  DBUserFoodLogEntry,
} from "./DB_TYPES";
import {
  getFoodItemById,
  getFoodItemsByIds,
  saveFoodItem,
} from "./foodRepository";

export type CacheSyncStatus = "pending" | "synced" | "error";

export type CachedBarcodeLookup =
  | {
      food: DBFoodItem;
      status: "hit";
    }
  | {
      food: null;
      status: "miss";
    };

export type CacheHealthRow = {
  count: number;
  errorCount: number;
  newestCachedAt: string | null;
  oldestCachedAt: string | null;
  pendingCount: number;
  table: string;
};

const TYPED_SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BARCODE_HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BARCODE_MISS_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_FOOD_CACHE_LIMIT = 500;

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseJsonArray = (value: string | null): unknown[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const addMs = (ms: number) => new Date(Date.now() + ms).toISOString();

const searchCacheKey = (query: string, source: string | null) =>
  `${source ?? "all"}:${query.trim().toLowerCase().replace(/\s+/g, " ")}`;

const mapCachedFoodEntryRow = (
  row: Record<string, unknown>,
): DBUserFoodLogEntry => ({
  id: Number(row.id),
  userExternalId: String(row.userExternalId),
  foodId: row.foodId == null ? null : Number(row.foodId),
  date: String(row.date),
  loggedAt: String(row.loggedAt),
  quantityG: Number(row.quantityG),
  mealType: normalizeOptionalText(
    typeof row.mealType === "string" ? row.mealType : null,
  ),
  createdAt: String(row.createdAt),
  entrySource:
    row.entrySource === "custom_recipe" ||
    row.entrySource === "custom_meal" ||
    row.entrySource === "quick_add"
      ? row.entrySource
      : "food_item",
  foodName: String(row.foodName ?? ""),
  servingSize: Number(row.servingSize ?? 1),
  servingUnit: normalizeOptionalText(
    typeof row.servingUnit === "string" ? row.servingUnit : null,
  ),
  calories: Number(row.calories ?? 0),
  proteinG: Number(row.proteinG ?? 0),
  carbsG: Number(row.carbsG ?? 0),
  fatG: Number(row.fatG ?? 0),
  alcoholG: row.alcoholG == null ? null : Number(row.alcoholG),
  systemCalculatedCalories:
    row.systemCalculatedCalories == null
      ? null
      : Number(row.systemCalculatedCalories),
  isEnergyManuallySet:
    row.isEnergyManuallySet === true ||
    row.isEnergyManuallySet === 1 ||
    row.isEnergyManuallySet === "1",
  quickAddName: normalizeOptionalText(
    typeof row.quickAddName === "string" ? row.quickAddName : null,
  ),
});

const cachedFoodEntrySelect = `
  SELECT
    id,
    user_external_id AS userExternalId,
    food_id AS foodId,
    date,
    logged_at AS loggedAt,
    quantity_g AS quantityG,
    meal_type AS mealType,
    created_at AS createdAt,
    entry_source AS entrySource,
    food_name AS foodName,
    serving_size AS servingSize,
    serving_unit AS servingUnit,
    calories,
    protein_g AS proteinG,
    carbs_g AS carbsG,
    fat_g AS fatG,
    alcohol_g AS alcoholG,
    system_calculated_calories AS systemCalculatedCalories,
    is_energy_manually_set AS isEnergyManuallySet,
    quick_add_name AS quickAddName
  FROM cached_food_entries
`;

export const upsertCachedFoodItems = async (
  foods: DBFoodItem[],
): Promise<void> => {
  for (const food of foods) {
    await saveFoodItem(food);
  }
};

export const touchCachedFoodItems = async (foodIds: number[]): Promise<void> => {
  const ids = [...new Set(foodIds.filter((id) => Number.isInteger(id)))];
  if (ids.length === 0) {
    return;
  }

  await initDb();
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `
    UPDATE food_items
    SET last_accessed_at = ?
    WHERE id IN (${placeholders})
    `,
    new Date().toISOString(),
    ...ids,
  );
};

export const getCachedSearchResults = async (
  query: string,
  {
    limit = 30,
    source = "usda",
  }: {
    limit?: number;
    source?: string | null;
  } = {},
): Promise<DBFoodItem[] | null> => {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  await initDb();
  const db = await getDb();
  const key = searchCacheKey(normalized, source);
  const row = await db.getFirstAsync<{
    expiresAt: string;
    resultFoodIds: string;
  }>(
    `
    SELECT result_food_ids AS resultFoodIds, expires_at AS expiresAt
    FROM cached_search_results
    WHERE query_key = ?
    LIMIT 1
    `,
    key,
  );

  if (!row) {
    return null;
  }

  if (Date.parse(row.expiresAt) <= Date.now()) {
    await db.runAsync(`DELETE FROM cached_search_results WHERE query_key = ?`, key);
    return null;
  }

  await db.runAsync(
    `
    UPDATE cached_search_results
    SET hit_count = hit_count + 1
    WHERE query_key = ?
    `,
    key,
  );

  const ids = parseJsonArray(row.resultFoodIds)
    .map((id) => Number(id))
    .filter(Number.isInteger)
    .slice(0, limit);
  const foods = await getFoodItemsByIds(ids);
  const byId = new Map(foods.map((food) => [food.id, food]));

  await touchCachedFoodItems(ids);

  return ids
    .map((id) => byId.get(id) ?? null)
    .filter((food): food is DBFoodItem => food != null);
};

export const saveCachedSearchResults = async (
  query: string,
  foods: DBFoodItem[],
  {
    source = "usda",
    ttlMs = TYPED_SEARCH_TTL_MS,
  }: {
    source?: string | null;
    ttlMs?: number;
  } = {},
): Promise<void> => {
  const normalized = query.trim();
  if (!normalized) {
    return;
  }

  const cappedFoods = foods.slice(0, 50);
  await upsertCachedFoodItems(cappedFoods);

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `
    INSERT INTO cached_search_results (
      query_key,
      query,
      result_food_ids,
      result_payloads,
      source,
      cached_at,
      expires_at,
      hit_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(query_key) DO UPDATE SET
      query = excluded.query,
      result_food_ids = excluded.result_food_ids,
      result_payloads = excluded.result_payloads,
      source = excluded.source,
      cached_at = excluded.cached_at,
      expires_at = excluded.expires_at
    `,
    searchCacheKey(normalized, source),
    normalized,
    JSON.stringify(cappedFoods.map((food) => food.id)),
    JSON.stringify(cappedFoods),
    source ?? "all",
    now,
    addMs(ttlMs),
  );

  await evictPublicFoodCache();
};

export const getCachedBarcodeLookup = async (
  barcode: string,
): Promise<CachedBarcodeLookup | null> => {
  const normalized = barcode.trim();
  if (!normalized) {
    return null;
  }

  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{
    expiresAt: string;
    foodId: number | null;
    status: string;
  }>(
    `
    SELECT food_id AS foodId, status, expires_at AS expiresAt
    FROM cached_barcode_lookups
    WHERE barcode = ?
    LIMIT 1
    `,
    normalized,
  );

  if (!row) {
    return null;
  }

  if (Date.parse(row.expiresAt) <= Date.now()) {
    await db.runAsync(`DELETE FROM cached_barcode_lookups WHERE barcode = ?`, normalized);
    return null;
  }

  if (row.status === "miss") {
    return { food: null, status: "miss" };
  }

  if (row.foodId == null) {
    return null;
  }

  const food = await getFoodItemById(row.foodId);
  return food ? { food, status: "hit" } : null;
};

export const saveCachedBarcodeHit = async (
  barcode: string,
  food: DBFoodItem,
): Promise<void> => {
  const normalized = barcode.trim();
  if (!normalized) {
    return;
  }

  await upsertCachedFoodItems([food]);
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO cached_barcode_lookups (
      barcode,
      food_id,
      status,
      payload,
      cached_at,
      expires_at
    )
    VALUES (?, ?, 'hit', ?, ?, ?)
    ON CONFLICT(barcode) DO UPDATE SET
      food_id = excluded.food_id,
      status = excluded.status,
      payload = excluded.payload,
      cached_at = excluded.cached_at,
      expires_at = excluded.expires_at
    `,
    normalized,
    food.id,
    JSON.stringify(food),
    now,
    addMs(BARCODE_HIT_TTL_MS),
  );
};

export const saveCachedBarcodeMiss = async (
  barcode: string,
): Promise<void> => {
  const normalized = barcode.trim();
  if (!normalized) {
    return;
  }

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO cached_barcode_lookups (
      barcode,
      food_id,
      status,
      payload,
      cached_at,
      expires_at
    )
    VALUES (?, NULL, 'miss', NULL, ?, ?)
    ON CONFLICT(barcode) DO UPDATE SET
      food_id = NULL,
      status = excluded.status,
      payload = NULL,
      cached_at = excluded.cached_at,
      expires_at = excluded.expires_at
    `,
    normalized,
    now,
    addMs(BARCODE_MISS_TTL_MS),
  );
};

export const upsertCachedFoodLogEntries = async (
  userExternalId: string,
  entries: DBUserFoodLogEntry[],
  syncStatus: CacheSyncStatus = "synced",
  syncError: string | null = null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const lastSyncedAt = syncStatus === "synced" ? now : null;

  for (const entry of entries) {
    if (entry.userExternalId !== userExternalId) {
      continue;
    }

    await db.runAsync(
      `
      INSERT INTO cached_food_entries (
        id,
        user_external_id,
        food_id,
        date,
        logged_at,
        quantity_g,
        meal_type,
        created_at,
        entry_source,
        food_name,
        serving_size,
        serving_unit,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        alcohol_g,
        system_calculated_calories,
        is_energy_manually_set,
        quick_add_name,
        cached_at,
        last_synced_at,
        server_updated_at,
        sync_status,
        sync_error,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        user_external_id = excluded.user_external_id,
        food_id = excluded.food_id,
        date = excluded.date,
        logged_at = excluded.logged_at,
        quantity_g = excluded.quantity_g,
        meal_type = excluded.meal_type,
        created_at = excluded.created_at,
        entry_source = excluded.entry_source,
        food_name = excluded.food_name,
        serving_size = excluded.serving_size,
        serving_unit = excluded.serving_unit,
        calories = excluded.calories,
        protein_g = excluded.protein_g,
        carbs_g = excluded.carbs_g,
        fat_g = excluded.fat_g,
        alcohol_g = excluded.alcohol_g,
        system_calculated_calories = excluded.system_calculated_calories,
        is_energy_manually_set = excluded.is_energy_manually_set,
        quick_add_name = excluded.quick_add_name,
        cached_at = excluded.cached_at,
        last_synced_at = COALESCE(excluded.last_synced_at, cached_food_entries.last_synced_at),
        server_updated_at = excluded.server_updated_at,
        sync_status = excluded.sync_status,
        sync_error = excluded.sync_error,
        deleted_at = NULL
      `,
      entry.id,
      userExternalId,
      entry.foodId,
      entry.date,
      entry.loggedAt,
      entry.quantityG,
      entry.mealType,
      entry.createdAt,
      entry.entrySource,
      entry.foodName,
      entry.servingSize,
      entry.servingUnit,
      entry.calories,
      entry.proteinG,
      entry.carbsG,
      entry.fatG,
      entry.alcoholG,
      entry.systemCalculatedCalories,
      entry.isEnergyManuallySet ? 1 : 0,
      entry.quickAddName,
      now,
      lastSyncedAt,
      entry.createdAt,
      syncStatus,
      syncError,
    );
  }
};

export const replaceCachedFoodLogEntriesForDate = async (
  userExternalId: string,
  date: string,
  entries: DBUserFoodLogEntry[],
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    DELETE FROM cached_food_entries
    WHERE user_external_id = ?
      AND date = ?
      AND sync_status = 'synced'
    `,
    userExternalId,
    date,
  );
  await upsertCachedFoodLogEntries(userExternalId, entries, "synced");
};

export const replaceCachedFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
  entries: DBUserFoodLogEntry[],
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    DELETE FROM cached_food_entries
    WHERE user_external_id = ?
      AND date >= ?
      AND date <= ?
      AND sync_status = 'synced'
    `,
    userExternalId,
    startDate,
    endDate,
  );
  await upsertCachedFoodLogEntries(userExternalId, entries, "synced");
};

export const getCachedFoodLogEntryById = async (
  id: number,
  userExternalId?: string | null,
): Promise<DBUserFoodLogEntry | null> => {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    ${cachedFoodEntrySelect}
    WHERE id = ?
      AND deleted_at IS NULL
      AND (? IS NULL OR user_external_id = ?)
    LIMIT 1
    `,
    id,
    userExternalId ?? null,
    userExternalId ?? null,
  );

  return row ? mapCachedFoodEntryRow(row) : null;
};

export const getCachedFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    ${cachedFoodEntrySelect}
    WHERE user_external_id = ?
      AND date = ?
      AND deleted_at IS NULL
    ORDER BY datetime(COALESCE(loggedAt, createdAt)) ASC
    `,
    userExternalId,
    date,
  );

  return rows.map(mapCachedFoodEntryRow);
};

export const getCachedFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBUserFoodLogEntry[]> => {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    ${cachedFoodEntrySelect}
    WHERE user_external_id = ?
      AND date >= ?
      AND date <= ?
      AND deleted_at IS NULL
    ORDER BY date ASC, datetime(COALESCE(loggedAt, createdAt)) ASC
    `,
    userExternalId,
    startDate,
    endDate,
  );

  return rows.map(mapCachedFoodEntryRow);
};

export const getRecentCachedFoodItems = async (
  userExternalId: string,
  limit = 20,
): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<{ foodId: number }>(
    `
    SELECT food_id AS foodId
    FROM cached_food_entries
    WHERE user_external_id = ?
      AND food_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY food_id
    ORDER BY MAX(datetime(COALESCE(logged_at, created_at))) DESC
    LIMIT ?
    `,
    userExternalId,
    limit,
  );
  const ids = rows.map((row) => row.foodId);
  const foods = await getFoodItemsByIds(ids);
  const byId = new Map(foods.map((food) => [food.id, food]));

  return ids
    .map((id) => byId.get(id) ?? null)
    .filter((food): food is DBFoodItem => food != null);
};

export const markCachedFoodLogEntryDeleted = async (
  id: number,
  userExternalId?: string | null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    UPDATE cached_food_entries
    SET deleted_at = ?, sync_status = 'pending', sync_error = NULL
    WHERE id = ?
      AND (? IS NULL OR user_external_id = ?)
    `,
    new Date().toISOString(),
    id,
    userExternalId ?? null,
    userExternalId ?? null,
  );
};

export const deleteCachedFoodLogEntry = async (
  id: number,
  userExternalId?: string | null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    DELETE FROM cached_food_entries
    WHERE id = ?
      AND (? IS NULL OR user_external_id = ?)
    `,
    id,
    userExternalId ?? null,
    userExternalId ?? null,
  );
};

export const markCachedFoodLogEntryError = async (
  id: number,
  error: unknown,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    UPDATE cached_food_entries
    SET sync_status = 'error', sync_error = ?
    WHERE id = ?
    `,
    error instanceof Error ? error.message : String(error),
    id,
  );
};

export const replaceCachedFavoriteFoodIds = async (
  userExternalId: string,
  foodIds: number[],
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM user_food_favorites WHERE user_external_id = ?`,
      userExternalId,
    );

    for (const foodId of foodIds) {
      await db.runAsync(
        `
        INSERT OR IGNORE INTO user_food_favorites (
          user_external_id,
          food_id,
          created_at,
          cached_at,
          last_synced_at,
          sync_status,
          sync_error
        )
        VALUES (?, ?, ?, ?, ?, 'synced', NULL)
        `,
        userExternalId,
        foodId,
        now,
        now,
        now,
      );
    }
  });
};

export const upsertCachedDiaryDayStatuses = async (
  userExternalId: string,
  statuses: DBDiaryDayStatus[],
  syncStatus: CacheSyncStatus = "synced",
  syncError: string | null = null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const lastSyncedAt = syncStatus === "synced" ? now : null;

  for (const status of statuses) {
    if (status.userExternalId !== userExternalId) {
      continue;
    }

    await db.runAsync(
      `
      INSERT INTO user_diary_days (
        user_external_id,
        date,
        is_complete,
        completed_at,
        created_at,
        updated_at,
        cached_at,
        last_synced_at,
        server_updated_at,
        sync_status,
        sync_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_external_id, date) DO UPDATE SET
        is_complete = excluded.is_complete,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        cached_at = excluded.cached_at,
        last_synced_at = COALESCE(excluded.last_synced_at, user_diary_days.last_synced_at),
        server_updated_at = excluded.server_updated_at,
        sync_status = excluded.sync_status,
        sync_error = excluded.sync_error
      `,
      userExternalId,
      status.date,
      status.isComplete ? 1 : 0,
      status.completedAt,
      status.createdAt,
      status.updatedAt,
      now,
      lastSyncedAt,
      status.updatedAt,
      syncStatus,
      syncError,
    );
  }
};

const mapDiaryStatusRow = (row: Record<string, unknown>): DBDiaryDayStatus => ({
  userExternalId: String(row.userExternalId),
  date: String(row.date),
  isComplete:
    row.isComplete === true || row.isComplete === 1 || row.isComplete === "1",
  completedAt: normalizeOptionalText(
    typeof row.completedAt === "string" ? row.completedAt : null,
  ),
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});

export const getCachedDiaryDayStatus = async (
  userExternalId: string,
  date: string,
): Promise<DBDiaryDayStatus | null> => {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    SELECT
      user_external_id AS userExternalId,
      date,
      is_complete AS isComplete,
      completed_at AS completedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_diary_days
    WHERE user_external_id = ? AND date = ?
    LIMIT 1
    `,
    userExternalId,
    date,
  );

  return row ? mapDiaryStatusRow(row) : null;
};

export const listCachedDiaryDayStatusesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBDiaryDayStatus[]> => {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT
      user_external_id AS userExternalId,
      date,
      is_complete AS isComplete,
      completed_at AS completedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_diary_days
    WHERE user_external_id = ?
      AND date >= ?
      AND date <= ?
    ORDER BY date ASC
    `,
    userExternalId,
    startDate,
    endDate,
  );

  return rows.map(mapDiaryStatusRow);
};

const mapAdaptiveRecommendationRow = (
  row: Record<string, unknown>,
): DBAdaptiveCalorieRecommendation => ({
  id: Number(row.id),
  userExternalId: String(row.userExternalId),
  status:
    row.status === "accepted" ||
    row.status === "rejected" ||
    row.status === "applied" ||
    row.status === "superseded"
      ? row.status
      : "proposed",
  algorithmVersion: String(row.algorithmVersion ?? "v1"),
  windowStart: String(row.windowStart),
  windowEnd: String(row.windowEnd),
  confidence:
    row.confidence === "low" || row.confidence === "high"
      ? row.confidence
      : "medium",
  currentBaseCalories:
    row.currentBaseCalories == null ? null : Number(row.currentBaseCalories),
  recommendedBaseCalories: Number(row.recommendedBaseCalories),
  estimatedTdee: Number(row.estimatedTdee),
  recommendedDelta: Number(row.recommendedDelta),
  avgLoggedCalories: Number(row.avgLoggedCalories),
  completeDaysUsed: Number(row.completeDaysUsed),
  weighInsUsed: Number(row.weighInsUsed),
  trendStartKg: Number(row.trendStartKg),
  trendEndKg: Number(row.trendEndKg),
  observedWeeklyChangeKg:
    row.observedWeeklyChangeKg == null
      ? null
      : Number(row.observedWeeklyChangeKg),
  reason: String(row.reason ?? ""),
  inputSummary: parseJsonObject(
    typeof row.inputSummary === "string" ? row.inputSummary : null,
  ),
  respondedAt: normalizeOptionalText(
    typeof row.respondedAt === "string" ? row.respondedAt : null,
  ),
  appliedAt: normalizeOptionalText(
    typeof row.appliedAt === "string" ? row.appliedAt : null,
  ),
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});

export const upsertCachedAdaptiveRecommendations = async (
  userExternalId: string,
  recommendations: DBAdaptiveCalorieRecommendation[],
  syncStatus: CacheSyncStatus = "synced",
  syncError: string | null = null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const lastSyncedAt = syncStatus === "synced" ? now : null;

  for (const item of recommendations) {
    if (item.userExternalId !== userExternalId) {
      continue;
    }

    await db.runAsync(
      `
      INSERT INTO adaptive_calorie_recommendations (
        id,
        user_external_id,
        status,
        algorithm_version,
        window_start,
        window_end,
        confidence,
        current_base_calories,
        recommended_base_calories,
        estimated_tdee,
        recommended_delta,
        avg_logged_calories,
        complete_days_used,
        weigh_ins_used,
        trend_start_kg,
        trend_end_kg,
        observed_weekly_change_kg,
        reason,
        input_summary,
        responded_at,
        applied_at,
        created_at,
        updated_at,
        cached_at,
        last_synced_at,
        server_updated_at,
        sync_status,
        sync_error,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        user_external_id = excluded.user_external_id,
        status = excluded.status,
        algorithm_version = excluded.algorithm_version,
        window_start = excluded.window_start,
        window_end = excluded.window_end,
        confidence = excluded.confidence,
        current_base_calories = excluded.current_base_calories,
        recommended_base_calories = excluded.recommended_base_calories,
        estimated_tdee = excluded.estimated_tdee,
        recommended_delta = excluded.recommended_delta,
        avg_logged_calories = excluded.avg_logged_calories,
        complete_days_used = excluded.complete_days_used,
        weigh_ins_used = excluded.weigh_ins_used,
        trend_start_kg = excluded.trend_start_kg,
        trend_end_kg = excluded.trend_end_kg,
        observed_weekly_change_kg = excluded.observed_weekly_change_kg,
        reason = excluded.reason,
        input_summary = excluded.input_summary,
        responded_at = excluded.responded_at,
        applied_at = excluded.applied_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        cached_at = excluded.cached_at,
        last_synced_at = COALESCE(excluded.last_synced_at, adaptive_calorie_recommendations.last_synced_at),
        server_updated_at = excluded.server_updated_at,
        sync_status = excluded.sync_status,
        sync_error = excluded.sync_error,
        deleted_at = NULL
      `,
      item.id,
      userExternalId,
      item.status,
      item.algorithmVersion,
      item.windowStart,
      item.windowEnd,
      item.confidence,
      item.currentBaseCalories,
      item.recommendedBaseCalories,
      item.estimatedTdee,
      item.recommendedDelta,
      item.avgLoggedCalories,
      item.completeDaysUsed,
      item.weighInsUsed,
      item.trendStartKg,
      item.trendEndKg,
      item.observedWeeklyChangeKg,
      item.reason,
      item.inputSummary ? JSON.stringify(item.inputSummary) : null,
      item.respondedAt,
      item.appliedAt,
      item.createdAt,
      item.updatedAt,
      now,
      lastSyncedAt,
      item.updatedAt,
      syncStatus,
      syncError,
    );
  }
};

export const listCachedAdaptiveRecommendations = async ({
  limit = 20,
  status = null,
  userExternalId,
}: {
  limit?: number;
  status?: DBAdaptiveCalorieRecommendation["status"] | null;
  userExternalId: string;
}): Promise<DBAdaptiveCalorieRecommendation[]> => {
  await initDb();
  const db = await getDb();
  const statusClause = status ? "AND status = ?" : "";
  const params: Array<number | string> = [userExternalId];
  if (status) {
    params.push(status);
  }
  params.push(limit);
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      status,
      algorithm_version AS algorithmVersion,
      window_start AS windowStart,
      window_end AS windowEnd,
      confidence,
      current_base_calories AS currentBaseCalories,
      recommended_base_calories AS recommendedBaseCalories,
      estimated_tdee AS estimatedTdee,
      recommended_delta AS recommendedDelta,
      avg_logged_calories AS avgLoggedCalories,
      complete_days_used AS completeDaysUsed,
      weigh_ins_used AS weighInsUsed,
      trend_start_kg AS trendStartKg,
      trend_end_kg AS trendEndKg,
      observed_weekly_change_kg AS observedWeeklyChangeKg,
      reason,
      input_summary AS inputSummary,
      responded_at AS respondedAt,
      applied_at AS appliedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM adaptive_calorie_recommendations
    WHERE user_external_id = ?
      AND deleted_at IS NULL
      ${statusClause}
    ORDER BY datetime(created_at) DESC
    LIMIT ?
    `,
    ...params,
  );

  return rows.map(mapAdaptiveRecommendationRow);
};

export const getCachedHomeSummary = async <T>(
  userExternalId: string,
): Promise<T | null> => {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    `
    SELECT payload
    FROM cached_home_summaries
    WHERE user_external_id = ?
    LIMIT 1
    `,
    userExternalId,
  );

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
};

export const saveCachedHomeSummary = async (
  userExternalId: string,
  payload: unknown,
  sourceDataVersion?: string | null,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
    INSERT INTO cached_home_summaries (
      user_external_id,
      payload,
      cached_at,
      source_data_version
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_external_id) DO UPDATE SET
      payload = excluded.payload,
      cached_at = excluded.cached_at,
      source_data_version = excluded.source_data_version
    `,
    userExternalId,
    JSON.stringify(payload),
    new Date().toISOString(),
    sourceDataVersion ?? null,
  );
};

export const clearCachedHomeSummary = async (
  userExternalId: string,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM cached_home_summaries WHERE user_external_id = ?`,
    userExternalId,
  );
};

export const clearUserCache = async (userExternalId: string): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const recipeRows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM user_recipes WHERE user_external_id = ?`,
      userExternalId,
    );
    const recipeIds = recipeRows.map((row) => row.id);
    if (recipeIds.length > 0) {
      const placeholders = recipeIds.map(() => "?").join(", ");
      await db.runAsync(
        `DELETE FROM user_recipe_ingredients WHERE recipe_id IN (${placeholders})`,
        ...recipeIds,
      );
    }

    await db.runAsync(
      `DELETE FROM cached_food_entries WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM user_diary_days WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM adaptive_calorie_recommendations WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM cached_home_summaries WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(`DELETE FROM cached_search_results`);
    await db.runAsync(`DELETE FROM cached_barcode_lookups`);
    await db.runAsync(
      `DELETE FROM user_food_favorites WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM user_food_log WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM user_quick_food_log WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM activities WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM user_recipes WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `
      DELETE FROM food_items
      WHERE source = 'recipe'
        AND raw_payload LIKE ?
      `,
      `%"createdByUserExternalId":"${userExternalId}"%`,
    );
    await db.runAsync(
      `DELETE FROM weight_entries WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM weight_goals WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM user_settings WHERE user_external_id = ?`,
      userExternalId,
    );
    await db.runAsync(
      `DELETE FROM users WHERE external_id = ?`,
      userExternalId,
    );
  });
};

export const clearPublicFoodCache = async (): Promise<void> => {
  await initDb();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM cached_search_results`);
    await db.runAsync(`DELETE FROM cached_barcode_lookups`);
    await db.runAsync(
      `
      DELETE FROM food_items
      WHERE is_public = 1
        AND id NOT IN (SELECT food_id FROM user_food_favorites)
        AND id NOT IN (SELECT food_id FROM user_food_log)
        AND id NOT IN (SELECT food_id FROM user_recipe_ingredients)
        AND id NOT IN (SELECT linked_food_id FROM user_recipes)
        AND id NOT IN (
          SELECT food_id
          FROM cached_food_entries
          WHERE food_id IS NOT NULL
        )
      `,
    );
  });
};

export const evictPublicFoodCache = async (
  maxRows = PUBLIC_FOOD_CACHE_LIMIT,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM food_items WHERE is_public = 1`,
  );
  const excess = Math.max(0, (row?.count ?? 0) - maxRows);
  if (excess <= 0) {
    return;
  }

  await db.runAsync(
    `
    DELETE FROM food_items
    WHERE id IN (
      SELECT id
      FROM food_items
      WHERE is_public = 1
        AND id NOT IN (SELECT food_id FROM user_food_favorites)
        AND id NOT IN (SELECT food_id FROM user_food_log)
        AND id NOT IN (SELECT food_id FROM user_recipe_ingredients)
        AND id NOT IN (SELECT linked_food_id FROM user_recipes)
        AND id NOT IN (
          SELECT food_id
          FROM cached_food_entries
          WHERE food_id IS NOT NULL
        )
      ORDER BY datetime(COALESCE(last_accessed_at, cached_at, updated_at, created_at)) ASC
      LIMIT ?
    )
    `,
    excess,
  );
};

export const getCacheHealth = async (
  userExternalId: string,
): Promise<CacheHealthRow[]> => {
  await initDb();
  const db = await getDb();
  const scopedTables = [
    "cached_food_entries",
    "user_diary_days",
    "adaptive_calorie_recommendations",
    "cached_home_summaries",
    "user_food_favorites",
    "weight_entries",
    "weight_goals",
    "user_settings",
  ] as const;
  const rows: CacheHealthRow[] = [];

  for (const table of scopedTables) {
    if (table === "cached_home_summaries") {
      const row = await db.getFirstAsync<{
        count: number;
        newestCachedAt: string | null;
        oldestCachedAt: string | null;
      }>(
        `
        SELECT
          COUNT(*) AS count,
          MIN(cached_at) AS oldestCachedAt,
          MAX(cached_at) AS newestCachedAt
        FROM cached_home_summaries
        WHERE user_external_id = ?
        `,
        userExternalId,
      );

      rows.push({
        count: row?.count ?? 0,
        errorCount: 0,
        newestCachedAt: row?.newestCachedAt ?? null,
        oldestCachedAt: row?.oldestCachedAt ?? null,
        pendingCount: 0,
        table,
      });
      continue;
    }

    const row = await db.getFirstAsync<{
      count: number;
      errorCount: number;
      newestCachedAt: string | null;
      oldestCachedAt: string | null;
      pendingCount: number;
    }>(
      `
      SELECT
        COUNT(*) AS count,
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN sync_status = 'error' THEN 1 ELSE 0 END) AS errorCount,
        MIN(cached_at) AS oldestCachedAt,
        MAX(cached_at) AS newestCachedAt
      FROM ${table}
      WHERE user_external_id = ?
      `,
      userExternalId,
    );

    rows.push({
      count: row?.count ?? 0,
      errorCount: row?.errorCount ?? 0,
      newestCachedAt: row?.newestCachedAt ?? null,
      oldestCachedAt: row?.oldestCachedAt ?? null,
      pendingCount: row?.pendingCount ?? 0,
      table,
    });
  }

  return rows;
};
