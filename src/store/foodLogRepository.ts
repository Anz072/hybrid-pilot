import { getDb, initDb } from "../storage/sqlite";
import type {
  AddCustomMealInput,
  AddUserFoodLogInput,
  DBCustomMeal,
  DBUserFoodLogEntry,
  UpdateUserFoodLogInput,
} from "./DB_TYPES";

export const addUserFoodLog = async (
  input: AddUserFoodLogInput,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO user_food_log (user_external_id, food_id, date, quantity_g, meal_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    input.userExternalId,
    input.foodId,
    input.date,
    input.quantityG,
    input.mealType ?? null,
    now,
  );
};

export const updateUserFoodLog = async (
  input: UpdateUserFoodLogInput,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE user_food_log
    SET quantity_g = ?, meal_type = ?
    WHERE id = ?
    `,
    input.quantityG,
    input.mealType ?? null,
    input.id,
  );
};

export const deleteUserFoodLog = async (id: number): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(`DELETE FROM user_food_log WHERE id = ?`, id);
};

export const getUserFoodLogEntryById = async (
  id: number,
): Promise<DBUserFoodLogEntry | null> => {
  await initDb();
  const db = await getDb();

  return db.getFirstAsync<DBUserFoodLogEntry>(
    `
    SELECT
      l.id,
      l.user_external_id AS userExternalId,
      l.food_id AS foodId,
      l.date,
      l.quantity_g AS quantityG,
      l.meal_type AS mealType,
      l.created_at AS createdAt,
      f.name AS foodName,
      COALESCE(f.serving_size_value, f.serving_size) AS servingSize,
      COALESCE(f.serving_size_unit, f.serving_unit) AS servingUnit,
      COALESCE(f.calories, 0) AS calories,
      COALESCE(f.protein_g, 0) AS proteinG,
      COALESCE(f.carbs_g, 0) AS carbsG,
      COALESCE(f.fat_g, 0) AS fatG
    FROM user_food_log l
    JOIN food_items f ON f.id = l.food_id
    WHERE l.id = ?
    LIMIT 1
    `,
    id,
  );
};

export const getUserFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  await initDb();
  const db = await getDb();

  return db.getAllAsync<DBUserFoodLogEntry>(
    `
    SELECT
      l.id,
      l.user_external_id AS userExternalId,
      l.food_id AS foodId,
      l.date,
      l.quantity_g AS quantityG,
      l.meal_type AS mealType,
      l.created_at AS createdAt,
      f.name AS foodName,
      COALESCE(f.serving_size_value, f.serving_size) AS servingSize,
      COALESCE(f.serving_size_unit, f.serving_unit) AS servingUnit,
      COALESCE(f.calories, 0) AS calories,
      COALESCE(f.protein_g, 0) AS proteinG,
      COALESCE(f.carbs_g, 0) AS carbsG,
      COALESCE(f.fat_g, 0) AS fatG
    FROM user_food_log l
    JOIN food_items f ON f.id = l.food_id
    WHERE l.user_external_id = ? AND l.date = ?
    ORDER BY datetime(l.created_at) ASC
    `,
    userExternalId,
    date,
  );
};

export const copyFoodLogsFromDate = async (
  userExternalId: string,
  fromDate: string,
  toDate: string,
): Promise<void> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO user_food_log (user_external_id, food_id, date, quantity_g, meal_type, created_at)
    SELECT user_external_id, food_id, ?, quantity_g, meal_type, ?
    FROM user_food_log
    WHERE user_external_id = ? AND date = ?
    `,
    toDate,
    now,
    userExternalId,
    fromDate,
  );
};

export const getCustomMeals = async (
  userExternalId: string,
): Promise<DBCustomMeal[]> => {
  await initDb();
  const db = await getDb();

  return db.getAllAsync<DBCustomMeal>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      name,
      created_at AS createdAt
    FROM custom_meals
    WHERE user_external_id = ?
    ORDER BY lower(name) ASC
    `,
    userExternalId,
  );
};

export const addCustomMeal = async (input: AddCustomMealInput): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    INSERT OR IGNORE INTO custom_meals (user_external_id, name, created_at)
    VALUES (?, ?, ?)
    `,
    input.userExternalId,
    input.name.trim(),
    new Date().toISOString(),
  );
};

export const deleteCustomMeal = async (
  userExternalId: string,
  name: string,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    DELETE FROM custom_meals
    WHERE user_external_id = ? AND name = ?
    `,
    userExternalId,
    name,
  );
};
