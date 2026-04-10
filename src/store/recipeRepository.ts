import { getDb, initDb } from "../storage/sqlite";
import { FOOD_NUTRIENT_COLUMNS, saveFoodItem } from "./foodRepository";
import type {
  CreateUserRecipeInput,
  DBFoodItem,
  DBFoodNutrientDetails,
  DBRecipe,
  NutritionBasis,
  RecipeBuildMethod,
} from "./DB_TYPES";

const roundTo = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const normalizeOptionalText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

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

const getUserRecipeById = async (
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

export const createUserRecipe = async (
  input: CreateUserRecipeInput,
): Promise<DBRecipe> => {
  const trimmedName = input.name.trim();
  const servings = roundTo(input.servings, 2);
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);

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
  const ingredientNames = input.ingredients.map((ingredient) => ingredient.food.name.trim());

  const linkedFoodId = await saveFoodItem({
    source: "recipe",
    sourceId: null,
    barcode: null,
    name: trimmedName,
    brand: null,
    imageUrl: null,
    quantityValue: servings,
    quantityUnit: "servings",
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    nutritionBasis: "serving" satisfies NutritionBasis,
    calories: nutrition.calories,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    ...nutrition.nutrients,
    ingredientsText: ingredientNames.join(", "),
    rawPayload: JSON.stringify({
      buildMethod: input.buildMethod ?? "scratch",
      createdByUserExternalId: input.createdByUserExternalId,
      ingredientCount: input.ingredients.length,
      servings,
      steps,
    }),
    verified: false,
    isComplete: true,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        input.userExternalId,
        input.createdByUserExternalId,
        linkedFoodId,
        input.buildMethod ?? "scratch",
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
          recipeId,
          buildMethod: input.buildMethod ?? "scratch",
          createdByUserExternalId: input.createdByUserExternalId,
          ingredientCount: input.ingredients.length,
          servings,
          steps,
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
