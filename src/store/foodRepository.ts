import { getDb, initDb } from "../storage/sqlite";
import type { AddFoodItemInput, DBFoodItem } from "./DB_TYPES";

type DBFoodItemRow = {
  id: number;
  name: string;
  servingSize: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  isFavorite: number;
  createdAt: string;
};

const rowToFoodItem = (row: DBFoodItemRow): DBFoodItem => {
  return {
    id: row.id,
    name: row.name,
    servingSize: row.servingSize,
    calories: row.calories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    isFavorite: row.isFavorite === 1,
    createdAt: row.createdAt,
  };
};

export const addFoodItem = async (input: AddFoodItemInput): Promise<number> => {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `
    INSERT INTO food_items (name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, is_favorite, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.name,
    input.servingSize,
    input.calories,
    input.proteinG,
    input.carbsG,
    input.fatG,
    input.fiberG ?? null,
    input.isFavorite === true ? 1 : 0,
    now,
  );

  return result.lastInsertRowId;
};

export const setFoodItemFavorite = async (
  foodId: number,
  isFavorite: boolean,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE food_items
    SET is_favorite = ?
    WHERE id = ?
    `,
    isFavorite ? 1 : 0,
    foodId,
  );
};

export const searchFoodItems = async (
  query: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();

  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const rows = await db.getAllAsync<DBFoodItemRow>(
    `
    SELECT
      id,
      name,
      serving_size AS servingSize,
      calories,
      protein_g AS proteinG,
      carbs_g AS carbsG,
      fat_g AS fatG,
      fiber_g AS fiberG,
      is_favorite AS isFavorite,
      created_at AS createdAt
    FROM food_items
    WHERE lower(name) LIKE lower(?)
    ORDER BY name ASC
    LIMIT ?
    `,
    `%${normalized}%`,
    limit,
  );

  return rows.map(rowToFoodItem);
};

export const getFavoriteFoodItems = async (limit = 30): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<DBFoodItemRow>(
    `
    SELECT
      id,
      name,
      serving_size AS servingSize,
      calories,
      protein_g AS proteinG,
      carbs_g AS carbsG,
      fat_g AS fatG,
      fiber_g AS fiberG,
      is_favorite AS isFavorite,
      created_at AS createdAt
    FROM food_items
    WHERE is_favorite = 1
    ORDER BY name ASC
    LIMIT ?
    `,
    limit,
  );

  return rows.map(rowToFoodItem);
};

export const getRecentFoodItems = async (
  userExternalId: string,
  limit = 20,
): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<DBFoodItemRow>(
    `
    SELECT
      f.id,
      f.name,
      f.serving_size AS servingSize,
      f.calories,
      f.protein_g AS proteinG,
      f.carbs_g AS carbsG,
      f.fat_g AS fatG,
      f.fiber_g AS fiberG,
      f.is_favorite AS isFavorite,
      f.created_at AS createdAt
    FROM user_food_log l
    JOIN food_items f ON f.id = l.food_id
    WHERE l.user_external_id = ?
    GROUP BY f.id
    ORDER BY MAX(datetime(l.created_at)) DESC
    LIMIT ?
    `,
    userExternalId,
    limit,
  );

  return rows.map(rowToFoodItem);
};
