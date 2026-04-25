import { getDb, initDb } from "../storage/sqlite";
import type {
  AddFoodItemInput,
  DBFoodItem,
  DBFoodNutrientDetails,
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
  "recipe",
];

const NUTRITION_BASES: NutritionBasis[] = ["100g", "100ml", "serving"];

export const FOOD_NUTRIENT_COLUMNS = [
  ["fiberG", "fiber_g"],
  ["sugarG", "sugar_g"],
  ["addedSugarsG", "added_sugars_g"],
  ["waterG", "water_g"],
  ["alcoholG", "alcohol_g"],
  ["saltG", "salt_g"],
  ["fatSaturatedG", "fat_saturated_g"],
  ["fatMonounsaturatedG", "fat_monounsaturated_g"],
  ["fatPolyunsaturatedG", "fat_polyunsaturated_g"],
  ["fatTransG", "fat_trans_g"],
  ["omega3G", "omega3_g"],
  ["omega6G", "omega6_g"],
  ["epaG", "epa_g"],
  ["dhaG", "dha_g"],
  ["alaG", "ala_g"],
  ["linoleicAcidG", "linoleic_acid_g"],
  ["alphaLinolenicAcidG", "alpha_linolenic_acid_g"],
  ["cholesterolMg", "cholesterol_mg"],
  ["vitaminAUg", "vitamin_a_ug"],
  ["vitaminCMg", "vitamin_c_mg"],
  ["vitaminDUg", "vitamin_d_ug"],
  ["vitaminEMg", "vitamin_e_mg"],
  ["vitaminKUg", "vitamin_k_ug"],
  ["vitaminK1Ug", "vitamin_k1_ug"],
  ["vitaminK2Ug", "vitamin_k2_ug"],
  ["thiaminB1Mg", "thiamin_b1_mg"],
  ["riboflavinB2Mg", "riboflavin_b2_mg"],
  ["niacinB3Mg", "niacin_b3_mg"],
  ["pantothenicAcidB5Mg", "pantothenic_acid_b5_mg"],
  ["vitaminB6Mg", "vitamin_b6_mg"],
  ["biotinB7Ug", "biotin_b7_ug"],
  ["folateB9Ug", "folate_b9_ug"],
  ["vitaminB12Ug", "vitamin_b12_ug"],
  ["cholineMg", "choline_mg"],
  ["calciumMg", "calcium_mg"],
  ["ironMg", "iron_mg"],
  ["magnesiumMg", "magnesium_mg"],
  ["phosphorusMg", "phosphorus_mg"],
  ["potassiumMg", "potassium_mg"],
  ["sodiumMg", "sodium_mg"],
  ["zincMg", "zinc_mg"],
  ["copperMg", "copper_mg"],
  ["manganeseMg", "manganese_mg"],
  ["seleniumUg", "selenium_ug"],
  ["iodineUg", "iodine_ug"],
  ["chromiumUg", "chromium_ug"],
  ["molybdenumUg", "molybdenum_ug"],
  ["histidineG", "histidine_g"],
  ["isoleucineG", "isoleucine_g"],
  ["leucineG", "leucine_g"],
  ["lysineG", "lysine_g"],
  ["methionineG", "methionine_g"],
  ["phenylalanineG", "phenylalanine_g"],
  ["threonineG", "threonine_g"],
  ["tryptophanG", "tryptophan_g"],
  ["valineG", "valine_g"],
  ["alanineG", "alanine_g"],
  ["arginineG", "arginine_g"],
  ["asparticAcidG", "aspartic_acid_g"],
  ["cysteineG", "cysteine_g"],
  ["glutamicAcidG", "glutamic_acid_g"],
  ["glycineG", "glycine_g"],
  ["prolineG", "proline_g"],
  ["serineG", "serine_g"],
  ["tyrosineG", "tyrosine_g"],
  ["caffeineMg", "caffeine_mg"],
  ["betaineMg", "betaine_mg"],
  ["luteinZeaxanthinUg", "lutein_zeaxanthin_ug"],
] as const satisfies ReadonlyArray<readonly [keyof DBFoodNutrientDetails, string]>;

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

const getFoodItemSelect = (alias?: string) => {
  const prefix = alias ? `${alias}.` : "";
  const nutrientSelect = FOOD_NUTRIENT_COLUMNS.map(
    ([property, column]) => `${prefix}${column} AS ${property}`,
  ).join(",\n    ");

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
    ${nutrientSelect},
    ${prefix}ingredients_text AS ingredientsText,
    ${prefix}raw_payload AS rawPayload,
    ${prefix}verified AS verified,
    ${prefix}is_complete AS isComplete,
    ${prefix}is_public AS isPublic,
    ${prefix}created_at AS createdAt,
    COALESCE(${prefix}updated_at, ${prefix}created_at) AS updatedAt
  `;
};

const toFoodNutrientDetails = (
  row: Record<string, unknown>,
): DBFoodNutrientDetails =>
  Object.fromEntries(
    FOOD_NUTRIENT_COLUMNS.map(([property]) => [
      property,
      parseNullableNumber(row[property]),
    ]),
  ) as DBFoodNutrientDetails;

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
  ...toFoodNutrientDetails(row),
  ingredientsText: normalizeOptionalText(
    typeof row.ingredientsText === "string" ? row.ingredientsText : null,
  ),
  rawPayload: normalizeOptionalText(
    typeof row.rawPayload === "string" ? row.rawPayload : null,
  ),
  verified: row.verified === true || row.verified === 1 || row.verified === "1",
  isComplete:
    row.isComplete === true || row.isComplete === 1 || row.isComplete === "1",
  isPublic:
    row.isPublic === true || row.isPublic === 1 || row.isPublic === "1",
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
    ...FOOD_NUTRIENT_COLUMNS.map(([property]) => input[property]),
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
  const saveColumns = [
    "source",
    "source_id",
    "barcode",
    "name",
    "brand_name",
    "image_url",
    "quantity_value",
    "quantity_unit",
    "serving_size_value",
    "serving_size_unit",
    "nutrition_basis",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    ...FOOD_NUTRIENT_COLUMNS.map(([, column]) => column),
    "ingredients_text",
    "raw_payload",
    "verified",
    "is_complete",
    "is_public",
  ];

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
    ...FOOD_NUTRIENT_COLUMNS.map(([property]) => input[property] ?? null),
    normalizeOptionalText(input.ingredientsText),
    normalizeOptionalText(input.rawPayload),
    input.verified ? 1 : 0,
    input.isComplete ? 1 : 0,
    input.isPublic ? 1 : 0,
  ] as const;

  if (existingId != null) {
    const assignments = saveColumns
      .map((column) => `${column} = ?`)
      .join(",\n        ");

    await db.runAsync(
      `
      UPDATE food_items
      SET
        ${assignments},
        updated_at = ?
      WHERE id = ?
      `,
      ...values,
      now,
      existingId,
    );

    return existingId;
  }

  const insertColumns = saveColumns.join(",\n      ");
  const placeholders = saveColumns.map(() => "?").join(", ");

  const result = await db.runAsync(
    `
    INSERT INTO food_items (
      ${insertColumns},
      created_at,
      updated_at
    )
    VALUES (${placeholders}, ?, ?)
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

const buildFoodSearchTokens = (query?: string | null) =>
  (query ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);

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
    const tokenClauses = buildFoodSearchTokens(normalizedQuery).map(() => `
      (
        lower(name) LIKE lower(?)
        OR lower(COALESCE(brand_name, '')) LIKE lower(?)
        OR COALESCE(barcode, '') LIKE ?
      )
    `);

    clauses.push(`
      (
        lower(name) LIKE lower(?)
        OR lower(COALESCE(brand_name, '')) LIKE lower(?)
        OR COALESCE(barcode, '') LIKE ?
        ${tokenClauses.length ? `OR (${tokenClauses.join(" AND ")})` : ""}
      )
    `);
    params.push(
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
    );
    for (const token of buildFoodSearchTokens(normalizedQuery)) {
      params.push(`%${token}%`, `%${token}%`, `%${token}%`);
    }
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
