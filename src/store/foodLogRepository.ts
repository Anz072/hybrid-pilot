import { getDb, initDb } from "../storage/sqlite";
import {
  assertValidFoodLogQuantity,
  getFoodResolvedServing,
} from "../engine/nutrition";
import type {
  AddQuickAddFoodLogInput,
  AddUserFoodLogInput,
  DBUserFoodLogEntry,
  NutritionBasis,
  UpdateQuickAddFoodLogInput,
  UpdateUserFoodLogInput,
} from "./DB_TYPES";
import {
  buildFoodLogDuplicateKey,
  countFoodLogsByDuplicateKey,
  type FoodLogCopyResult,
  type FoodLogDuplicateShape,
  toFoodLogDuplicateShape,
} from "./foodLogCopyUtils";

const combineDateKeyWithTime = (dateKey: string, timeSource: string) => {
  const source = new Date(timeSource);
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(
    year,
    (month || 1) - 1,
    day || 1,
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  ).toISOString();
};

const toQuickAddEntryId = (id: number) => -Math.abs(id);
const fromQuickAddEntryId = (id: number) => Math.abs(id);
const isQuickAddEntryId = (id: number) => id < 0;

type RawFoodLogEntryRow = Omit<
  DBUserFoodLogEntry,
  "isEnergyManuallySet" | "servingSize"
> & {
  isEnergyManuallySet: boolean | number;
  servingSize: number | null;
  nutritionBasis: NutritionBasis | null;
};

const mapFoodLogEntryRow = (
  row: RawFoodLogEntryRow | null,
): DBUserFoodLogEntry | null => {
  if (!row) {
    return null;
  }

  // Foods can be stored without a serving size; resolve the basis fallback here
  // so every consumer scales against the same positive base the previews used.
  const { nutritionBasis, ...entry } = row;
  const serving = getFoodResolvedServing({
    nutritionBasis: nutritionBasis ?? "serving",
    servingSizeValue: row.servingSize,
    servingSizeUnit: row.servingUnit,
  });

  return {
    ...entry,
    servingSize: serving.value,
    servingUnit: serving.unit,
    isEnergyManuallySet: Boolean(row.isEnergyManuallySet),
  };
};

const NORMAL_FOOD_LOG_SELECT = `
  SELECT
    l.id,
    l.user_external_id AS userExternalId,
    l.food_id AS foodId,
    l.date,
    l.logged_at AS loggedAt,
    l.quantity_g AS quantityG,
    l.meal_type AS mealType,
    l.created_at AS createdAt,
    'food_item' AS entrySource,
    f.name AS foodName,
    f.serving_size_value AS servingSize,
    f.serving_size_unit AS servingUnit,
    f.nutrition_basis AS nutritionBasis,
    COALESCE(f.calories, 0) AS calories,
    COALESCE(f.protein_g, 0) AS proteinG,
    COALESCE(f.carbs_g, 0) AS carbsG,
    COALESCE(f.fat_g, 0) AS fatG,
    NULL AS alcoholG,
    NULL AS systemCalculatedCalories,
    0 AS isEnergyManuallySet,
    NULL AS quickAddName
  FROM user_food_log l
  JOIN food_items f ON f.id = l.food_id
`;

const QUICK_ADD_FOOD_LOG_SELECT = `
  SELECT
    -q.id AS id,
    q.user_external_id AS userExternalId,
    NULL AS foodId,
    q.date,
    q.logged_at AS loggedAt,
    1 AS quantityG,
    q.meal_type AS mealType,
    q.created_at AS createdAt,
    'quick_add' AS entrySource,
    COALESCE(NULLIF(TRIM(q.name), ''), 'Quick Add') AS foodName,
    1 AS servingSize,
    'entry' AS servingUnit,
    'serving' AS nutritionBasis,
    q.calories AS calories,
    q.protein_g AS proteinG,
    q.carbs_g AS carbsG,
    q.fat_g AS fatG,
    q.alcohol_g AS alcoholG,
    q.system_calculated_calories AS systemCalculatedCalories,
    q.is_energy_manually_set AS isEnergyManuallySet,
    q.name AS quickAddName
  FROM user_quick_food_log q
`;

export const addUserFoodLog = async (
  input: AddUserFoodLogInput,
): Promise<void> => {
  assertValidFoodLogQuantity(input.quantityG);
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const loggedAt = input.loggedAt ?? now;

  await db.runAsync(
    `
    INSERT INTO user_food_log (user_external_id, food_id, date, logged_at, quantity_g, meal_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    input.userExternalId,
    input.foodId,
    input.date,
    loggedAt,
    input.quantityG,
    input.mealType ?? null,
    now,
  );
};

export const addQuickAddFoodLog = async (
  input: AddQuickAddFoodLogInput,
): Promise<number> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const loggedAt = input.loggedAt ?? now;

  const result = await db.runAsync(
    `
    INSERT INTO user_quick_food_log (
      user_external_id,
      date,
      logged_at,
      meal_type,
      name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      alcohol_g,
      system_calculated_calories,
      is_energy_manually_set,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userExternalId,
    input.date,
    loggedAt,
    input.mealType ?? null,
    input.name?.trim() || null,
    input.calories,
    input.proteinG ?? 0,
    input.carbsG ?? 0,
    input.fatG ?? 0,
    input.alcoholG ?? 0,
    input.systemCalculatedCalories ?? null,
    input.isEnergyManuallySet ? 1 : 0,
    now,
  );

  return toQuickAddEntryId(result.lastInsertRowId);
};

export const updateUserFoodLog = async (
  input: UpdateUserFoodLogInput,
): Promise<void> => {
  assertValidFoodLogQuantity(input.quantityG);
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE user_food_log
    SET quantity_g = ?, meal_type = ?, logged_at = COALESCE(?, logged_at)
    WHERE id = ?
    `,
    input.quantityG,
    input.mealType ?? null,
    input.loggedAt ?? null,
    input.id,
  );
};

export const updateQuickAddFoodLog = async (
  input: UpdateQuickAddFoodLogInput,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE user_quick_food_log
    SET
      logged_at = COALESCE(?, logged_at),
      meal_type = ?,
      name = ?,
      calories = ?,
      protein_g = ?,
      carbs_g = ?,
      fat_g = ?,
      alcohol_g = ?,
      system_calculated_calories = ?,
      is_energy_manually_set = ?
    WHERE id = ?
    `,
    input.loggedAt ?? null,
    input.mealType ?? null,
    input.name?.trim() || null,
    input.calories,
    input.proteinG ?? 0,
    input.carbsG ?? 0,
    input.fatG ?? 0,
    input.alcoholG ?? 0,
    input.systemCalculatedCalories ?? null,
    input.isEnergyManuallySet ? 1 : 0,
    fromQuickAddEntryId(input.id),
  );
};

export const deleteUserFoodLog = async (id: number): Promise<void> => {
  await initDb();
  const db = await getDb();

  if (isQuickAddEntryId(id)) {
    await db.runAsync(
      `DELETE FROM user_quick_food_log WHERE id = ?`,
      fromQuickAddEntryId(id),
    );
    return;
  }

  await db.runAsync(`DELETE FROM user_food_log WHERE id = ?`, id);
};

export const getUserFoodLogEntryById = async (
  id: number,
): Promise<DBUserFoodLogEntry | null> => {
  await initDb();
  const db = await getDb();

  if (isQuickAddEntryId(id)) {
    const row = await db.getFirstAsync<RawFoodLogEntryRow>(
      `
      ${QUICK_ADD_FOOD_LOG_SELECT}
      WHERE q.id = ?
      LIMIT 1
      `,
      fromQuickAddEntryId(id),
    );

    return mapFoodLogEntryRow(row);
  }

  const row = await db.getFirstAsync<RawFoodLogEntryRow>(
    `
    ${NORMAL_FOOD_LOG_SELECT}
    WHERE l.id = ?
    LIMIT 1
    `,
    id,
  );

  return mapFoodLogEntryRow(row);
};

export const getUserFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<RawFoodLogEntryRow>(
    `
    SELECT *
    FROM (
      ${NORMAL_FOOD_LOG_SELECT}
      WHERE l.user_external_id = ? AND l.date = ?

      UNION ALL

      ${QUICK_ADD_FOOD_LOG_SELECT}
      WHERE q.user_external_id = ? AND q.date = ?
    )
    ORDER BY datetime(COALESCE(loggedAt, createdAt)) ASC
    `,
    userExternalId,
    date,
    userExternalId,
    date,
  );

  return rows
    .map(mapFoodLogEntryRow)
    .filter((entry): entry is DBUserFoodLogEntry => entry != null);
};

export const getUserFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBUserFoodLogEntry[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<RawFoodLogEntryRow>(
    `
    SELECT *
    FROM (
      ${NORMAL_FOOD_LOG_SELECT}
      WHERE l.user_external_id = ? AND l.date >= ? AND l.date <= ?

      UNION ALL

      ${QUICK_ADD_FOOD_LOG_SELECT}
      WHERE q.user_external_id = ? AND q.date >= ? AND q.date <= ?
    )
    ORDER BY date ASC, datetime(COALESCE(loggedAt, createdAt)) ASC
    `,
    userExternalId,
    startDate,
    endDate,
    userExternalId,
    startDate,
    endDate,
  );

  return rows
    .map(mapFoodLogEntryRow)
    .filter((entry): entry is DBUserFoodLogEntry => entry != null);
};

export const copyFoodLogsFromDate = async (
  userExternalId: string,
  fromDate: string,
  toDate: string,
): Promise<FoodLogCopyResult> => {
  await initDb();
  const db = await getDb();
  const destinationEntries = await getUserFoodLogEntriesByDate(userExternalId, toDate);
  const remainingDestinationMatches = countFoodLogsByDuplicateKey(
    destinationEntries.map(toFoodLogDuplicateShape),
  );
  const sourceEntries = await db.getAllAsync<{
    foodId: number;
    quantityG: number;
    mealType: string | null;
    loggedAt: string | null;
    createdAt: string;
  }>(
    `
    SELECT
      food_id AS foodId,
      quantity_g AS quantityG,
      meal_type AS mealType,
      logged_at AS loggedAt,
      created_at AS createdAt
    FROM user_food_log
    WHERE user_external_id = ? AND date = ?
    ORDER BY datetime(COALESCE(logged_at, created_at)) ASC
    `,
    userExternalId,
    fromDate,
  );
  const sourceQuickEntries = await db.getAllAsync<{
    alcoholG: number;
    calories: number;
    carbsG: number;
    createdAt: string;
    fatG: number;
    isEnergyManuallySet: number;
    loggedAt: string | null;
    mealType: string | null;
    name: string | null;
    proteinG: number;
    systemCalculatedCalories: number | null;
  }>(
    `
    SELECT
      meal_type AS mealType,
      name,
      calories,
      protein_g AS proteinG,
      carbs_g AS carbsG,
      fat_g AS fatG,
      alcohol_g AS alcoholG,
      system_calculated_calories AS systemCalculatedCalories,
      is_energy_manually_set AS isEnergyManuallySet,
      logged_at AS loggedAt,
      created_at AS createdAt
    FROM user_quick_food_log
    WHERE user_external_id = ? AND date = ?
    ORDER BY datetime(COALESCE(logged_at, created_at)) ASC
    `,
    userExternalId,
    fromDate,
  );

  const sourceCount = sourceEntries.length + sourceQuickEntries.length;
  let copiedCount = 0;
  let skippedDuplicates = 0;

  const shouldSkipDuplicate = (entry: FoodLogDuplicateShape) => {
    const key = buildFoodLogDuplicateKey(entry);
    const availableMatches = remainingDestinationMatches.get(key) ?? 0;

    if (availableMatches <= 0) {
      return false;
    }

    remainingDestinationMatches.set(key, availableMatches - 1);
    skippedDuplicates += 1;
    return true;
  };

  for (const entry of sourceEntries) {
    const now = new Date().toISOString();
    const sourceTime = entry.loggedAt ?? entry.createdAt;

    if (
      shouldSkipDuplicate({
        entrySource: "food_item",
        foodId: entry.foodId,
        loggedAt: entry.loggedAt,
        createdAt: entry.createdAt,
        quantityValue: entry.quantityG,
        mealType: entry.mealType,
        displayName: null,
        calories: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        alcoholG: null,
        systemCalculatedCalories: null,
        isEnergyManuallySet: false,
        quickAddName: null,
      })
    ) {
      continue;
    }

    await db.runAsync(
      `
      INSERT INTO user_food_log (user_external_id, food_id, date, logged_at, quantity_g, meal_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      userExternalId,
      entry.foodId,
      toDate,
      combineDateKeyWithTime(toDate, sourceTime),
      entry.quantityG,
      entry.mealType,
      now,
    );
    copiedCount += 1;
  }

  for (const entry of sourceQuickEntries) {
    const now = new Date().toISOString();
    const sourceTime = entry.loggedAt ?? entry.createdAt;

    if (
      shouldSkipDuplicate({
        entrySource: "quick_add",
        foodId: null,
        loggedAt: entry.loggedAt,
        createdAt: entry.createdAt,
        quantityValue: 1,
        mealType: entry.mealType,
        displayName: entry.name ?? "Quick Add",
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        alcoholG: entry.alcoholG,
        systemCalculatedCalories: entry.systemCalculatedCalories,
        isEnergyManuallySet: Boolean(entry.isEnergyManuallySet),
        quickAddName: entry.name,
      })
    ) {
      continue;
    }

    await db.runAsync(
      `
      INSERT INTO user_quick_food_log (
        user_external_id,
        date,
        logged_at,
        meal_type,
        name,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        alcohol_g,
        system_calculated_calories,
        is_energy_manually_set,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      userExternalId,
      toDate,
      combineDateKeyWithTime(toDate, sourceTime),
      entry.mealType,
      entry.name,
      entry.calories,
      entry.proteinG,
      entry.carbsG,
      entry.fatG,
      entry.alcoholG,
      entry.systemCalculatedCalories,
      entry.isEnergyManuallySet,
      now,
    );
    copiedCount += 1;
  }

  return {
    sourceCount,
    destinationCount: destinationEntries.length,
    copiedCount,
    skippedDuplicates,
  };
};
