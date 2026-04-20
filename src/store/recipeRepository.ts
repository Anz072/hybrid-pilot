import { getDb, initDb } from "../storage/sqlite";
import {
  FOOD_NUTRIENT_COLUMNS,
  getFoodItemById,
  saveFoodItem,
} from "./foodRepository";
import type {
  CreateUserRecipeInput,
  DBFoodItem,
  DBFoodNutrientDetails,
  DBRecipe,
  DBRecipeDetails,
  DBRecipeIngredient,
  DBRecipeIngredientDetail,
  NutritionBasis,
  RecipeBuildMethod,
  UpdateUserRecipeInput,
} from "./DB_TYPES";

const roundTo = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeOptionalText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === "1";

const getResolvedServing = (
  food: Pick<DBFoodItem, "nutritionBasis" | "servingSizeValue" | "servingSizeUnit">,
) => {
  if (food.servingSizeValue != null && food.servingSizeValue > 0) {
    return {
      value: food.servingSizeValue,
      unit: food.servingSizeUnit?.trim() || "g",
    };
  }

  if (food.nutritionBasis === "100ml") {
    return { value: 100, unit: "ml" };
  }

  if (food.nutritionBasis === "100g") {
    return { value: 100, unit: "g" };
  }

  return { value: 1, unit: "serving" };
};

const parseRecipeBuildMethod = (value: unknown): RecipeBuildMethod => {
  if (value === "link" || value === "ai") {
    return value;
  }

  return "scratch";
};

const parseSteps = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((step) => (typeof step === "string" ? step.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const toRecipe = (row: Record<string, unknown>): DBRecipe => ({
  id: Number(row.id),
  userExternalId: String(row.userExternalId ?? ""),
  createdByUserExternalId: String(row.createdByUserExternalId ?? ""),
  linkedFoodId: Number(row.linkedFoodId),
  isPublic: parseBoolean(row.isPublic),
  buildMethod: parseRecipeBuildMethod(row.buildMethod),
  name: String(row.name ?? ""),
  description:
    typeof row.description === "string" ? row.description : null,
  linkUrl: typeof row.linkUrl === "string" ? row.linkUrl : null,
  prepTimeMin:
    row.prepTimeMin == null ? null : Number(row.prepTimeMin),
  cookTimeMin:
    row.cookTimeMin == null ? null : Number(row.cookTimeMin),
  servings: Number(row.servings ?? 1),
  steps: parseSteps(typeof row.stepsJson === "string" ? row.stepsJson : null),
  createdAt: String(row.createdAt ?? ""),
  updatedAt: String(row.updatedAt ?? ""),
});

const toRecipeIngredient = (
  row: Record<string, unknown>,
): DBRecipeIngredient => ({
  id: Number(row.id),
  recipeId: Number(row.recipeId),
  foodId: Number(row.foodId),
  amount: Number(row.amount ?? 0),
  amountUnit:
    typeof row.amountUnit === "string" ? row.amountUnit : null,
  sortOrder: Number(row.sortOrder ?? 0),
  createdAt: String(row.createdAt ?? ""),
});

const parseRecipeFoodPayload = (
  rawPayload: string | null | undefined,
): Pick<
  DBRecipeDetails,
  | "ingredientTotalWeightG"
  | "preparedFoodWeightG"
  | "effectiveRecipeWeightG"
  | "gramsPerServing"
> => {
  if (!rawPayload) {
    return {
      ingredientTotalWeightG: null,
      preparedFoodWeightG: null,
      effectiveRecipeWeightG: null,
      gramsPerServing: null,
    };
  }

  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
    return {
      ingredientTotalWeightG: parseNullableNumber(parsed.ingredientTotalWeightG),
      preparedFoodWeightG: parseNullableNumber(parsed.preparedFoodWeightG),
      effectiveRecipeWeightG: parseNullableNumber(parsed.effectiveRecipeWeightG),
      gramsPerServing: parseNullableNumber(parsed.gramsPerServing),
    };
  } catch {
    return {
      ingredientTotalWeightG: null,
      preparedFoodWeightG: null,
      effectiveRecipeWeightG: null,
      gramsPerServing: null,
    };
  }
};

const getRecipeIngredientRowsByRecipeId = async (
  recipeId: number,
): Promise<DBRecipeIngredient[]> => {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT
      id,
      recipe_id AS recipeId,
      food_id AS foodId,
      amount,
      amount_unit AS amountUnit,
      sort_order AS sortOrder,
      created_at AS createdAt
    FROM user_recipe_ingredients
    WHERE recipe_id = ?
    ORDER BY sort_order ASC, id ASC
    `,
    recipeId,
  );

  return rows.map(toRecipeIngredient);
};

const updateLinkedRecipeFoodWithDb = async (
  db: Awaited<ReturnType<typeof getDb>>,
  recipeId: number,
  linkedFoodId: number,
  input: CreateUserRecipeInput,
  nutrition: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    nutrients: Partial<DBFoodNutrientDetails>;
  },
  weightMetrics: ReturnType<typeof getRecipeWeightMetrics>,
  steps: string[],
  updatedAt: string,
) => {
  const ingredientNames = input.ingredients.map((ingredient) =>
    ingredient.food.name.trim(),
  );
  const baseRawPayload = {
    buildMethod: input.buildMethod ?? "scratch",
    createdByUserExternalId: input.createdByUserExternalId,
    ingredientCount: input.ingredients.length,
    isPublic: input.isPublic ?? false,
    servings: input.servings,
    ingredientTotalWeightG: weightMetrics.ingredientTotalWeightG,
    preparedFoodWeightG: weightMetrics.preparedFoodWeightG,
    effectiveRecipeWeightG: weightMetrics.effectiveRecipeWeightG,
    gramsPerServing: weightMetrics.gramsPerServing,
    steps,
    recipeId,
  };

  const nutrientAssignments = FOOD_NUTRIENT_COLUMNS.map(
    ([, column]) => `${column} = ?`,
  ).join(",\n        ");

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
      ${nutrientAssignments},
      ingredients_text = ?,
      raw_payload = ?,
      verified = ?,
      is_complete = ?,
      is_public = ?,
      updated_at = ?
    WHERE id = ?
    `,
    "recipe",
    String(recipeId),
    null,
    input.name.trim(),
    null,
    null,
    weightMetrics.effectiveRecipeWeightG,
    weightMetrics.effectiveRecipeWeightG != null ? "g" : null,
    1,
    "serving",
    "serving" satisfies NutritionBasis,
    nutrition.calories,
    nutrition.proteinG,
    nutrition.carbsG,
    nutrition.fatG,
    ...FOOD_NUTRIENT_COLUMNS.map(
      ([property]) => nutrition.nutrients[property] ?? null,
    ),
    ingredientNames.join(", "),
    JSON.stringify(baseRawPayload),
    0,
    1,
    input.isPublic ? 1 : 0,
    updatedAt,
    linkedFoodId,
  );
};

export const getUserRecipeById = async (
  id: number,
): Promise<DBRecipe | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
    SELECT
      id,
      user_external_id AS userExternalId,
      created_by_user_external_id AS createdByUserExternalId,
      linked_food_id AS linkedFoodId,
      is_public AS isPublic,
      build_method AS buildMethod,
      name,
      description,
      link_url AS linkUrl,
      prep_time_min AS prepTimeMin,
      cook_time_min AS cookTimeMin,
      servings,
      steps_json AS stepsJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_recipes
    WHERE id = ?
    LIMIT 1
    `,
    id,
  );

  return row ? toRecipe(row) : null;
};

export const getUserRecipeDetailsById = async (
  recipeId: number,
): Promise<DBRecipeDetails | null> => {
  const recipe = await getUserRecipeById(recipeId);

  if (!recipe) {
    return null;
  }

  const [linkedFood, ingredientRows] = await Promise.all([
    getFoodItemById(recipe.linkedFoodId),
    getRecipeIngredientRowsByRecipeId(recipeId),
  ]);

  const ingredients = (
    await Promise.all(
      ingredientRows.map(async (ingredientRow) => {
        const food = await getFoodItemById(ingredientRow.foodId);
        return food
          ? ({
              ...ingredientRow,
              food,
            } satisfies DBRecipeIngredientDetail)
          : null;
      }),
    )
  ).filter(Boolean) as DBRecipeIngredientDetail[];

  const weightMetrics = parseRecipeFoodPayload(linkedFood?.rawPayload);

  return {
    ...recipe,
    ingredients,
    ingredientTotalWeightG: weightMetrics.ingredientTotalWeightG,
    preparedFoodWeightG: weightMetrics.preparedFoodWeightG,
    effectiveRecipeWeightG: weightMetrics.effectiveRecipeWeightG,
    gramsPerServing: weightMetrics.gramsPerServing,
  };
};

const buildRecipeFoodNutrition = (
  input: CreateUserRecipeInput,
): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  nutrients: Partial<DBFoodNutrientDetails>;
} => {
  const totalCalories = input.ingredients.reduce((sum, ingredient) => {
    const serving = getResolvedServing(ingredient.food);
    const factor = serving.value > 0 ? ingredient.amount / serving.value : 1;
    return sum + (ingredient.food.calories ?? 0) * factor;
  }, 0);
  const totalProtein = input.ingredients.reduce((sum, ingredient) => {
    const serving = getResolvedServing(ingredient.food);
    const factor = serving.value > 0 ? ingredient.amount / serving.value : 1;
    return sum + (ingredient.food.proteinG ?? 0) * factor;
  }, 0);
  const totalCarbs = input.ingredients.reduce((sum, ingredient) => {
    const serving = getResolvedServing(ingredient.food);
    const factor = serving.value > 0 ? ingredient.amount / serving.value : 1;
    return sum + (ingredient.food.carbsG ?? 0) * factor;
  }, 0);
  const totalFat = input.ingredients.reduce((sum, ingredient) => {
    const serving = getResolvedServing(ingredient.food);
    const factor = serving.value > 0 ? ingredient.amount / serving.value : 1;
    return sum + (ingredient.food.fatG ?? 0) * factor;
  }, 0);

  const nutrientTotals = {} as Partial<Record<keyof DBFoodNutrientDetails, number>>;
  const nutrientHasData = {} as Partial<Record<keyof DBFoodNutrientDetails, boolean>>;

  for (const ingredient of input.ingredients) {
    const serving = getResolvedServing(ingredient.food);
    const factor = serving.value > 0 ? ingredient.amount / serving.value : 1;

    for (const [property] of FOOD_NUTRIENT_COLUMNS) {
      const nutrientValue = ingredient.food[property];

      if (nutrientValue == null) {
        continue;
      }

      nutrientHasData[property] = true;
      nutrientTotals[property] = (nutrientTotals[property] ?? 0) + nutrientValue * factor;
    }
  }

  const servings = input.servings > 0 ? input.servings : 1;
  const nutrients = Object.fromEntries(
    FOOD_NUTRIENT_COLUMNS.map(([property]) => [
      property,
      nutrientHasData[property]
        ? roundTo((nutrientTotals[property] ?? 0) / servings)
        : null,
    ]),
  ) as Partial<DBFoodNutrientDetails>;

  return {
    calories: roundTo(totalCalories / servings, 0),
    proteinG: roundTo(totalProtein / servings),
    carbsG: roundTo(totalCarbs / servings),
    fatG: roundTo(totalFat / servings),
    nutrients,
  };
};

const getRecipeWeightMetrics = (input: CreateUserRecipeInput) => {
  const ingredientTotalWeightG = roundTo(
    input.ingredients.reduce((sum, ingredient) => sum + ingredient.amount, 0),
  );
  const preparedFoodWeightG =
    input.preparedFoodWeightG != null && input.preparedFoodWeightG > 0
      ? roundTo(input.preparedFoodWeightG)
      : null;
  const effectiveRecipeWeightG =
    preparedFoodWeightG ??
    (ingredientTotalWeightG > 0 ? ingredientTotalWeightG : null);
  const servings = input.servings > 0 ? input.servings : 1;
  const gramsPerServing =
    effectiveRecipeWeightG != null && effectiveRecipeWeightG > 0
      ? roundTo(effectiveRecipeWeightG / servings)
      : null;

  return {
    ingredientTotalWeightG,
    preparedFoodWeightG,
    effectiveRecipeWeightG,
    gramsPerServing,
  };
};

export const createUserRecipe = async (
  input: CreateUserRecipeInput,
): Promise<DBRecipe> => {
  const trimmedName = input.name.trim();
  const servings = roundTo(input.servings, 2);
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);
  const isPublic = input.isPublic ?? false;

  if (!trimmedName) {
    throw new Error("Recipe name is required.");
  }

  if (!Number.isFinite(servings) || servings <= 0) {
    throw new Error("Recipe servings must be a positive number.");
  }

  if (input.ingredients.length === 0) {
    throw new Error("Add at least one ingredient to save a recipe.");
  }

  if (
    input.ingredients.some(
      (ingredient) =>
        !Number.isFinite(ingredient.amount) || ingredient.amount <= 0,
    )
  ) {
    throw new Error("Ingredient amounts must be positive.");
  }

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const nutrition = buildRecipeFoodNutrition({
    ...input,
    servings,
  });
  const weightMetrics = getRecipeWeightMetrics({
    ...input,
    servings,
  });
  const ingredientNames = input.ingredients.map((ingredient) => ingredient.food.name.trim());
  const buildMethod = input.buildMethod ?? "scratch";
  const baseRawPayload = {
    buildMethod,
    createdByUserExternalId: input.createdByUserExternalId,
    ingredientCount: input.ingredients.length,
    isPublic,
    servings,
    ingredientTotalWeightG: weightMetrics.ingredientTotalWeightG,
    preparedFoodWeightG: weightMetrics.preparedFoodWeightG,
    effectiveRecipeWeightG: weightMetrics.effectiveRecipeWeightG,
    gramsPerServing: weightMetrics.gramsPerServing,
    steps,
  };

  const linkedFoodId = await saveFoodItem({
    source: "recipe",
    sourceId: null,
    barcode: null,
    name: trimmedName,
    brand: null,
    imageUrl: null,
    quantityValue: weightMetrics.effectiveRecipeWeightG,
    quantityUnit: weightMetrics.effectiveRecipeWeightG != null ? "g" : null,
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    nutritionBasis: "serving" satisfies NutritionBasis,
    calories: nutrition.calories,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    ...nutrition.nutrients,
    ingredientsText: ingredientNames.join(", "),
    rawPayload: JSON.stringify(baseRawPayload),
    verified: false,
    isComplete: true,
    isPublic,
  });

  let recipeId: number | null = null;

  try {
    await db.withTransactionAsync(async () => {
      const recipeInsert = await db.runAsync(
        `
        INSERT INTO user_recipes (
          user_external_id,
          created_by_user_external_id,
          linked_food_id,
          is_public,
          build_method,
          name,
          description,
          link_url,
          prep_time_min,
          cook_time_min,
          servings,
          steps_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        input.userExternalId,
        input.createdByUserExternalId,
        linkedFoodId,
        isPublic ? 1 : 0,
        buildMethod,
        trimmedName,
        normalizeOptionalText(input.description),
        normalizeOptionalText(input.linkUrl),
        input.prepTimeMin ?? null,
        input.cookTimeMin ?? null,
        servings,
        JSON.stringify(steps),
        now,
        now,
      );

      recipeId = recipeInsert.lastInsertRowId;

      for (const [index, ingredient] of input.ingredients.entries()) {
        const serving = getResolvedServing(ingredient.food);

        await db.runAsync(
          `
          INSERT INTO user_recipe_ingredients (
            recipe_id,
            food_id,
            amount,
            amount_unit,
            sort_order,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          recipeId,
          ingredient.foodId,
          ingredient.amount,
          serving.unit,
          index,
          now,
        );
      }

      await db.runAsync(
        `
        UPDATE food_items
        SET
          source_id = ?,
          raw_payload = ?,
          updated_at = ?
        WHERE id = ?
        `,
        String(recipeId),
        JSON.stringify({
          ...baseRawPayload,
          recipeId,
        }),
        now,
        linkedFoodId,
      );
    });
  } catch (error) {
    await db.runAsync(`DELETE FROM food_items WHERE id = ?`, linkedFoodId);
    throw error;
  }

  if (recipeId == null) {
    throw new Error("Failed to save recipe.");
  }

  const savedRecipe = await getUserRecipeById(recipeId);

  if (!savedRecipe) {
    throw new Error("Recipe saved, but could not be reloaded.");
  }

  return savedRecipe;
};

export const updateUserRecipe = async (
  input: UpdateUserRecipeInput,
): Promise<DBRecipe> => {
  const existingRecipe = await getUserRecipeById(input.recipeId);

  if (!existingRecipe) {
    throw new Error("Recipe could not be found.");
  }

  const trimmedName = input.name.trim();
  const servings = roundTo(input.servings, 2);
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);
  const isPublic = input.isPublic ?? existingRecipe.isPublic;

  if (!trimmedName) {
    throw new Error("Recipe name is required.");
  }

  if (!Number.isFinite(servings) || servings <= 0) {
    throw new Error("Recipe servings must be a positive number.");
  }

  if (input.ingredients.length === 0) {
    throw new Error("Add at least one ingredient to save a recipe.");
  }

  if (
    input.ingredients.some(
      (ingredient) =>
        !Number.isFinite(ingredient.amount) || ingredient.amount <= 0,
    )
  ) {
    throw new Error("Ingredient amounts must be positive.");
  }

  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const normalizedInput = {
    ...input,
    name: trimmedName,
    servings,
    isPublic,
    createdByUserExternalId:
      existingRecipe.createdByUserExternalId || input.createdByUserExternalId,
  };
  const nutrition = buildRecipeFoodNutrition(normalizedInput);
  const weightMetrics = getRecipeWeightMetrics(normalizedInput);
  const buildMethod = normalizedInput.buildMethod ?? "scratch";

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      UPDATE user_recipes
      SET
        user_external_id = ?,
        linked_food_id = ?,
        is_public = ?,
        build_method = ?,
        name = ?,
        description = ?,
        link_url = ?,
        prep_time_min = ?,
        cook_time_min = ?,
        servings = ?,
        steps_json = ?,
        updated_at = ?
      WHERE id = ?
      `,
      normalizedInput.userExternalId,
      existingRecipe.linkedFoodId,
      normalizedInput.isPublic ? 1 : 0,
      buildMethod,
      trimmedName,
      normalizeOptionalText(normalizedInput.description),
      normalizeOptionalText(normalizedInput.linkUrl),
      normalizedInput.prepTimeMin ?? null,
      normalizedInput.cookTimeMin ?? null,
      servings,
      JSON.stringify(steps),
      now,
      input.recipeId,
    );

    await db.runAsync(
      `
      DELETE FROM user_recipe_ingredients
      WHERE recipe_id = ?
      `,
      input.recipeId,
    );

    for (const [index, ingredient] of normalizedInput.ingredients.entries()) {
      const serving = getResolvedServing(ingredient.food);

      await db.runAsync(
        `
        INSERT INTO user_recipe_ingredients (
          recipe_id,
          food_id,
          amount,
          amount_unit,
          sort_order,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        input.recipeId,
        ingredient.foodId,
        ingredient.amount,
        serving.unit,
        index,
        now,
      );
    }

    await updateLinkedRecipeFoodWithDb(
      db,
      input.recipeId,
      existingRecipe.linkedFoodId,
      normalizedInput,
      nutrition,
      weightMetrics,
      steps,
      now,
    );
  });

  const updatedRecipe = await getUserRecipeById(input.recipeId);

  if (!updatedRecipe) {
    throw new Error("Recipe saved, but could not be reloaded.");
  }

  return updatedRecipe;
};

export const deleteUserRecipe = async (recipeId: number): Promise<void> => {
  const existingRecipe = await getUserRecipeById(recipeId);

  if (!existingRecipe) {
    return;
  }

  await initDb();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      DELETE FROM user_recipe_ingredients
      WHERE recipe_id = ?
      `,
      recipeId,
    );

    await db.runAsync(
      `
      DELETE FROM user_recipes
      WHERE id = ?
      `,
      recipeId,
    );

    await db.runAsync(
      `
      DELETE FROM user_food_favorites
      WHERE food_id = ?
      `,
      existingRecipe.linkedFoodId,
    );

    await db.runAsync(
      `
      DELETE FROM user_food_log
      WHERE food_id = ?
      `,
      existingRecipe.linkedFoodId,
    );

    await db.runAsync(
      `
      DELETE FROM food_items
      WHERE id = ?
      `,
      existingRecipe.linkedFoodId,
    );
  });
};
