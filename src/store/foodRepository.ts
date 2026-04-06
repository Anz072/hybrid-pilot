import { getDb, initDb } from "../storage/sqlite";
import type {
  AddFoodItemInput,
  DBFoodItem,
  FoodSource,
  ListFoodItemsInput,
  NutritionBasis,
  SaveFoodItemInput,
} from "./DB_TYPES";

const FOOD_SOURCES: FoodSource[] = [
  "custom",
  "manual",
  "open_food_facts",
  "import",
  "usda",
];

const NUTRITION_BASES: NutritionBasis[] = ["100g", "100ml", "serving"];

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeFoodSource = (value: unknown): FoodSource => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return FOOD_SOURCES.includes(normalized as FoodSource)
    ? (normalized as FoodSource)
    : "manual";
};

const normalizeNutritionBasis = (value: unknown): NutritionBasis => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return NUTRITION_BASES.includes(normalized as NutritionBasis)
    ? (normalized as NutritionBasis)
    : "serving";
};

const getResolvedServing = (
  input: Pick<
    SaveFoodItemInput,
    "nutritionBasis" | "servingSizeValue" | "servingSizeUnit"
  >,
) => {
  if (input.servingSizeValue != null && input.servingSizeValue > 0) {
    return {
      value: input.servingSizeValue,
      unit: normalizeOptionalText(input.servingSizeUnit) ?? "g",
    };
  }

  if (input.nutritionBasis === "100ml") {
    return { value: 100, unit: "ml" };
  }

  if (input.nutritionBasis === "100g") {
    return { value: 100, unit: "g" };
  }

  return { value: 1, unit: "serving" };
};

const getFoodItemSelect = (alias?: string) => {
  const prefix = alias ? `${alias}.` : "";

  return `
    ${prefix}id AS id,
    ${prefix}source AS source,
    ${prefix}source_id AS sourceId,
    ${prefix}barcode AS barcode,
    ${prefix}name AS name,
    ${prefix}brand_name AS brand,
    ${prefix}image_url AS imageUrl,
    ${prefix}quantity_value AS quantityValue,
    ${prefix}quantity_unit AS quantityUnit,
    ${prefix}serving_size_value AS servingSizeValue,
    ${prefix}serving_size_unit AS servingSizeUnit,
    ${prefix}nutrition_basis AS nutritionBasis,
    ${prefix}calories AS calories,
    ${prefix}protein_g AS proteinG,
    ${prefix}carbs_g AS carbsG,
    ${prefix}fat_g AS fatG,
    ${prefix}fiber_g AS fiberG,
    ${prefix}sugar_g AS sugarG,
    ${prefix}salt_g AS saltG,
    ${prefix}saturated_fat_g AS saturatedFatG,
    ${prefix}ingredients_text AS ingredientsText,
    ${prefix}verified AS verified,
    ${prefix}is_complete AS isComplete,
    ${prefix}created_at AS createdAt,
    COALESCE(${prefix}updated_at, ${prefix}created_at) AS updatedAt
  `;
};

const toFoodItem = (row: Record<string, unknown>): DBFoodItem => ({
  id: Number(row.id),
  source: normalizeFoodSource(row.source),
  sourceId: normalizeOptionalText(
    typeof row.sourceId === "string" ? row.sourceId : null,
  ),
  barcode: normalizeOptionalText(
    typeof row.barcode === "string" ? row.barcode : null,
  ),
  name: String(row.name ?? ""),
  brand: normalizeOptionalText(
    typeof row.brand === "string" ? row.brand : null,
  ),
  imageUrl: normalizeOptionalText(
    typeof row.imageUrl === "string" ? row.imageUrl : null,
  ),
  quantityValue: parseNullableNumber(row.quantityValue),
  quantityUnit: normalizeOptionalText(
    typeof row.quantityUnit === "string" ? row.quantityUnit : null,
  ),
  servingSizeValue: parseNullableNumber(row.servingSizeValue),
  servingSizeUnit: normalizeOptionalText(
    typeof row.servingSizeUnit === "string" ? row.servingSizeUnit : null,
  ),
  nutritionBasis: normalizeNutritionBasis(row.nutritionBasis),
  calories: parseNullableNumber(row.calories),
  proteinG: parseNullableNumber(row.proteinG),
  carbsG: parseNullableNumber(row.carbsG),
  fatG: parseNullableNumber(row.fatG),
  fiberG: parseNullableNumber(row.fiberG),
  sugarG: parseNullableNumber(row.sugarG),
  saltG: parseNullableNumber(row.saltG),
  saturatedFatG: parseNullableNumber(row.saturatedFatG),
  ingredientsText: normalizeOptionalText(
    typeof row.ingredientsText === "string" ? row.ingredientsText : null,
  ),
  verified: row.verified === true || row.verified === 1 || row.verified === "1",
  isComplete:
    row.isComplete === true || row.isComplete === 1 || row.isComplete === "1",
  createdAt: String(row.createdAt ?? ""),
  updatedAt: String(row.updatedAt ?? row.createdAt ?? ""),
});

const getFoodItemByIdWithDb = async (
  db: Awaited<ReturnType<typeof getDb>>,
  id: number,
): Promise<DBFoodItem | null> => {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    SELECT ${getFoodItemSelect()}
    FROM food_items
    WHERE id = ?
    LIMIT 1
    `,
    id,
  );

  return row ? toFoodItem(row) : null;
};

const getFoodItemByBarcodeWithDb = async (
  db: Awaited<ReturnType<typeof getDb>>,
  barcode: string,
): Promise<DBFoodItem | null> => {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    SELECT ${getFoodItemSelect()}
    FROM food_items
    WHERE barcode = ?
    LIMIT 1
    `,
    barcode,
  );

  return row ? toFoodItem(row) : null;
};

const findExistingFoodItemId = async (
  db: Awaited<ReturnType<typeof getDb>>,
  input: SaveFoodItemInput,
): Promise<number | null> => {
  if (typeof input.id === "number") {
    const row = await db.getFirstAsync<{ id: number }>(
      `
      SELECT id
      FROM food_items
      WHERE id = ?
      LIMIT 1
      `,
      input.id,
    );
    return row?.id ?? null;
  }

  const normalizedSourceId = normalizeOptionalText(input.sourceId);
  if (normalizedSourceId) {
    const row = await db.getFirstAsync<{ id: number }>(
      `
      SELECT id
      FROM food_items
      WHERE source = ? AND source_id = ?
      LIMIT 1
      `,
      input.source,
      normalizedSourceId,
    );
    if (row) {
      return row.id;
    }
  }

  const normalizedBarcode = normalizeOptionalText(input.barcode);
  if (normalizedBarcode) {
    const row = await db.getFirstAsync<{ id: number }>(
      `
      SELECT id
      FROM food_items
      WHERE source = ? AND barcode = ?
      LIMIT 1
      `,
      input.source,
      normalizedBarcode,
    );
    if (row) {
      return row.id;
    }
  }

  return null;
};

const validateFoodItemInput = (input: SaveFoodItemInput) => {
  if (!input.name.trim()) {
    throw new Error("Food item name is required.");
  }

  const nonNegativeNumbers = [
    input.quantityValue,
    input.servingSizeValue,
    input.calories,
    input.proteinG,
    input.carbsG,
    input.fatG,
    input.fiberG,
    input.sugarG,
    input.saltG,
    input.saturatedFatG,
  ];

  if (
    nonNegativeNumbers.some(
      (value) => value != null && (!Number.isFinite(value) || value < 0),
    )
  ) {
    throw new Error(
      "Food item nutrition values must be valid non-negative numbers.",
    );
  }
};

export const saveFoodItem = async (
  input: SaveFoodItemInput,
): Promise<number> => {
  validateFoodItemInput(input);

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const existingId = await findExistingFoodItemId(db, input);
  const resolvedServing = getResolvedServing(input);

  const values = [
    input.source,
    normalizeOptionalText(input.sourceId),
    normalizeOptionalText(input.barcode),
    input.name.trim(),
    normalizeOptionalText(input.brand),
    normalizeOptionalText(input.imageUrl),
    input.quantityValue ?? null,
    normalizeOptionalText(input.quantityUnit),
    input.servingSizeValue ?? null,
    normalizeOptionalText(input.servingSizeUnit),
    input.nutritionBasis,
    input.calories ?? null,
    input.proteinG ?? null,
    input.carbsG ?? null,
    input.fatG ?? null,
    input.fiberG ?? null,
    input.sugarG ?? null,
    input.saltG ?? null,
    input.saturatedFatG ?? null,
    normalizeOptionalText(input.ingredientsText),
    input.verified ? 1 : 0,
    input.isComplete ? 1 : 0,
    resolvedServing.value,
    resolvedServing.unit,
  ] as const;

  if (existingId != null) {
    await db.runAsync(
      `
      UPDATE food_items
      SET
        source = ?,
        source_id = ?,
        barcode = ?,
        name = ?,
        brand_name = ?,
        image_url = ?,
        quantity_value = ?,
        quantity_unit = ?,
        serving_size_value = ?,
        serving_size_unit = ?,
        nutrition_basis = ?,
        calories = ?,
        protein_g = ?,
        carbs_g = ?,
        fat_g = ?,
        fiber_g = ?,
        sugar_g = ?,
        salt_g = ?,
        saturated_fat_g = ?,
        ingredients_text = ?,
        verified = ?,
        is_complete = ?,
        serving_size = ?,
        serving_unit = ?,
        updated_at = ?
      WHERE id = ?
      `,
      ...values,
      now,
      existingId,
    );

    return existingId;
  }

  const result = await db.runAsync(
    `
    INSERT INTO food_items (
      source,
      source_id,
      barcode,
      name,
      brand_name,
      image_url,
      quantity_value,
      quantity_unit,
      serving_size_value,
      serving_size_unit,
      nutrition_basis,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      salt_g,
      saturated_fat_g,
      ingredients_text,
      verified,
      is_complete,
      serving_size,
      serving_unit,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ...values,
    now,
    now,
  );

  return result.lastInsertRowId;
};

export const addFoodItem = async (input: AddFoodItemInput): Promise<number> =>
  saveFoodItem(input);

export const getFoodItemById = async (
  id: number,
): Promise<DBFoodItem | null> => {
  await initDb();
  const db = await getDb();
  return getFoodItemByIdWithDb(db, id);
};

export const getFoodItemByBarcode = async (
  barcode: string,
): Promise<DBFoodItem | null> => {
  await initDb();
  const db = await getDb();
  return getFoodItemByBarcodeWithDb(db, barcode);
};

export const deleteFoodItem = async (foodId: number): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      DELETE FROM user_food_favorites
      WHERE food_id = ?
      `,
      foodId,
    );

    await db.runAsync(
      `
      DELETE FROM user_food_log
      WHERE food_id = ?
      `,
      foodId,
    );

    await db.runAsync(
      `
      DELETE FROM food_items
      WHERE id = ?
      `,
      foodId,
    );
  });
};

export const setFoodItemFavorite = async (
  userExternalId: string,
  foodId: number,
  isFavorite: boolean,
): Promise<void> => {
  await initDb();
  const db = await getDb();

  if (isFavorite) {
    await db.runAsync(
      `
      INSERT OR IGNORE INTO user_food_favorites (user_external_id, food_id, created_at)
      VALUES (?, ?, ?)
      `,
      userExternalId,
      foodId,
      new Date().toISOString(),
    );
    return;
  }

  await db.runAsync(
    `
    DELETE FROM user_food_favorites
    WHERE user_external_id = ? AND food_id = ?
    `,
    userExternalId,
    foodId,
  );
};

export const getFavoriteFoodIds = async (
  userExternalId: string,
): Promise<number[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<{ foodId: number }>(
    `
    SELECT food_id AS foodId
    FROM user_food_favorites
    WHERE user_external_id = ?
    ORDER BY datetime(created_at) DESC
    `,
    userExternalId,
  );

  return rows.map((row) => row.foodId);
};

export const listFoodItems = async ({
  query,
  limit = 120,
  source = null,
}: ListFoodItemsInput = {}): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();
  const clauses: string[] = [];
  const params: Array<number | string> = [];
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    clauses.push(`
      (
        lower(name) LIKE lower(?)
        OR lower(COALESCE(brand_name, '')) LIKE lower(?)
        OR COALESCE(barcode, '') LIKE ?
      )
    `);
    params.push(
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
    );
  }

  if (source) {
    clauses.push("source = ?");
    params.push(source);
  }

  const whereClause =
    clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT ${getFoodItemSelect()}
    FROM food_items
    ${whereClause}
    ORDER BY
      datetime(COALESCE(updated_at, created_at)) DESC,
      lower(name) ASC
    LIMIT ?
    `,
    ...params,
    limit,
  );

  return rows.map(toFoodItem);
};

export const searchFoodItems = async (
  query: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  return listFoodItems({ query: normalized, limit });
};

export const getFavoriteFoodItems = async (
  userExternalId: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT ${getFoodItemSelect("f")}
    FROM user_food_favorites fav
    JOIN food_items f ON f.id = fav.food_id
    WHERE fav.user_external_id = ?
    ORDER BY datetime(fav.created_at) DESC
    LIMIT ?
    `,
    userExternalId,
    limit,
  );

  return rows.map(toFoodItem);
};

export const getRecentFoodItems = async (
  userExternalId: string,
  limit = 20,
): Promise<DBFoodItem[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT ${getFoodItemSelect("f")}
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

  return rows.map(toFoodItem);
};
