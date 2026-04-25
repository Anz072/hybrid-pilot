import {
  getSupabaseClient,
  requireSupabaseSessionUser,
} from "../API/supabase/client";
import type {
  AddFoodItemInput,
  AddQuickAddFoodLogInput,
  AddUserFoodLogInput,
  CreateUserCustomMealInput,
  CreateUserRecipeInput,
  DBDiaryDayStatus,
  DBCustomMeal,
  DBFoodItem,
  DBFoodNutrientDetails,
  DBQuickAddFoodLog,
  DBRecipe,
  DBRecipeDetails,
  DBRecipeIngredient,
  DBRecipeIngredientDetail,
  DBUserFoodLogEntry,
  FoodSource,
  ListFoodItemsInput,
  NutritionBasis,
  SaveDiaryDayStatusInput,
  SaveFoodItemInput,
  UpdateQuickAddFoodLogInput,
  UpdateUserCustomMealInput,
  UpdateUserFoodLogInput,
  UpdateUserRecipeInput,
  UserFoodLogSource,
} from "./DB_TYPES";
import {
  addFoodItem as addFoodItemLocal,
  deleteFoodItem as deleteFoodItemLocal,
  FOOD_NUTRIENT_COLUMNS,
  getFavoriteFoodIds as getFavoriteFoodIdsLocal,
  getFavoriteFoodItems as getFavoriteFoodItemsLocal,
  getFoodItemByBarcode as getFoodItemByBarcodeLocal,
  getFoodItemById as getFoodItemByIdLocal,
  getRecentFoodItems as getRecentFoodItemsLocal,
  listFoodItems as listFoodItemsLocal,
  saveFoodItem as saveFoodItemLocal,
  searchFoodItems as searchFoodItemsLocal,
  setFoodItemFavorite as setFoodItemFavoriteLocal,
} from "./foodRepository";
import {
  addQuickAddFoodLog as addQuickAddFoodLogLocal,
  addUserFoodLog as addUserFoodLogLocal,
  copyFoodLogsFromDate as copyFoodLogsFromDateLocal,
  deleteUserFoodLog as deleteUserFoodLogLocal,
  getUserFoodLogEntriesByDate as getUserFoodLogEntriesByDateLocal,
  getUserFoodLogEntryById as getUserFoodLogEntryByIdLocal,
  updateQuickAddFoodLog as updateQuickAddFoodLogLocal,
  updateUserFoodLog as updateUserFoodLogLocal,
} from "./foodLogRepository";
import {
  buildFoodLogDuplicateKey,
  countFoodLogsByDuplicateKey,
  type FoodLogCopyResult,
  type FoodLogDuplicateShape,
  toFoodLogDuplicateShape,
} from "./foodLogCopyUtils";
import {
  createUserRecipe as createUserRecipeLocal,
  deleteUserRecipe as deleteUserRecipeLocal,
  getUserRecipeDetailsById as getUserRecipeDetailsByIdLocal,
  updateUserRecipe as updateUserRecipeLocal,
} from "./recipeRepository";

const SUPABASE_FOOD_ITEMS_TABLE = "food_items";
const SUPABASE_FAVORITES_TABLE = "user_food_favorites";
const SUPABASE_RECIPES_TABLE = "custom_recipes";
const SUPABASE_RECIPE_INGREDIENTS_TABLE = "custom_recipe_ingredients";
const SUPABASE_FOOD_ENTRIES_TABLE = "user_food_entries";
const SUPABASE_MEALS_TABLE = "custom_meals";
const SUPABASE_DIARY_DAYS_TABLE = "user_diary_days";
const SUPABASE_USER_SETTINGS_TABLE = "user_settings";
const SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE =
  "adaptive_calorie_recommendations";

const SYNTHETIC_MEAL_FOOD_ID_OFFSET = 1_000_000_000;
const DEFAULT_LOG_AMOUNT = 1;

type SupabaseFoodItemRow = {
  id: number | string;
  submitted_by_user_id: string | null;
  source: string;
  source_id: string | null;
  barcode: string | null;
  name: string;
  brand_name: string | null;
  image_url: string | null;
  quantity_value: number | string | null;
  quantity_unit: string | null;
  serving_size_value: number | string | null;
  serving_size_unit: string | null;
  nutrition_basis: string | null;
  calories: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  ingredients_text: string | null;
  raw_payload: unknown;
  verified: boolean | null;
  is_complete: boolean | null;
  created_at: string | null;
  updated_at: string | null;
} & Partial<Record<(typeof FOOD_NUTRIENT_COLUMNS)[number][1], number | string | null>>;

type SupabaseCustomRecipeRow = {
  id: number | string;
  created_by_user_id: string;
  name: string;
  description: string | null;
  link_url: string | null;
  prep_time_min: number | string | null;
  cook_time_min: number | string | null;
  servings: number | string;
  steps: unknown;
  ingredient_total_weight_g: number | string | null;
  prepared_food_weight_g: number | string | null;
  effective_recipe_weight_g: number | string | null;
  grams_per_serving: number | string | null;
  calories_per_serving: number | string | null;
  protein_g_per_serving: number | string | null;
  carbs_g_per_serving: number | string | null;
  fat_g_per_serving: number | string | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseRecipeIngredientRow = {
  id: number | string;
  recipe_id: number | string;
  food_item_id: number | string;
  amount_value: number | string;
  amount_unit: string | null;
  sort_order: number | string | null;
  created_at: string | null;
};

type SupabaseCustomMealRow = {
  id: number | string;
  created_by_user_id: string;
  name: string;
  description: string | null;
  servings: number | string;
  total_weight_g: number | string | null;
  grams_per_serving: number | string | null;
  calories_per_serving: number | string | null;
  protein_g_per_serving: number | string | null;
  carbs_g_per_serving: number | string | null;
  fat_g_per_serving: number | string | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseUserFoodEntryRow = {
  id: number | string;
  user_id: string;
  entry_type: string;
  food_item_id: number | string | null;
  custom_recipe_id: number | string | null;
  custom_meal_id: number | string | null;
  date: string;
  logged_at: string | null;
  meal_type: string | null;
  amount_value: number | string | null;
  amount_unit: string | null;
  resolved_quantity_g: number | string | null;
  display_name: string;
  calories: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  alcohol_g: number | string | null;
  system_calculated_calories: number | string | null;
  is_energy_manually_set: boolean | null;
  metadata: unknown;
  created_at: string | null;
};

type SupabaseDiaryDayRow = {
  user_id: string;
  date: string;
  is_complete: boolean | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EntrySnapshotMetadata = {
  quickAddName?: string | null;
  servingSize?: number | null;
  servingUnit?: string | null;
  source?: string | null;
  sourceId?: string | null;
  syntheticFoodId?: number | null;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRequiredNumber = (value: unknown, fallback = 0): number => {
  const parsed = parseNullableNumber(value);
  return parsed ?? fallback;
};

const parseBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === "1";

const normalizeFoodSource = (value: unknown): FoodSource => {
  if (
    value === "custom" ||
    value === "manual" ||
    value === "open_food_facts" ||
    value === "import" ||
    value === "usda" ||
    value === "recipe"
  ) {
    return value;
  }

  return "manual";
};

const normalizeNutritionBasis = (value: unknown): NutritionBasis => {
  if (value === "100g" || value === "100ml" || value === "serving") {
    return value;
  }

  return "serving";
};

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      return parseStringArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }

  return [];
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

const roundTo = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

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

const listDateKeysBetween = (startDate: string, endDate: string): string[] => {
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const sanitizeSupabaseSearch = (value: string) =>
  value.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();

const buildSupabaseSearchTokens = (value: string) =>
  sanitizeSupabaseSearch(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);

const toSyntheticRecipeFoodId = (recipeId: number) => -Math.abs(recipeId);
const fromSyntheticRecipeFoodId = (foodId: number) => Math.abs(foodId);
const isSyntheticRecipeFoodId = (foodId: number) =>
  Number.isInteger(foodId) && foodId < 0 && Math.abs(foodId) < SYNTHETIC_MEAL_FOOD_ID_OFFSET;

const toSyntheticMealFoodId = (mealId: number) =>
  -(SYNTHETIC_MEAL_FOOD_ID_OFFSET + Math.abs(mealId));
const fromSyntheticMealFoodId = (foodId: number) =>
  Math.abs(foodId) - SYNTHETIC_MEAL_FOOD_ID_OFFSET;
const isSyntheticMealFoodId = (foodId: number) =>
  Number.isInteger(foodId) && Math.abs(foodId) >= SYNTHETIC_MEAL_FOOD_ID_OFFSET;

const isSupportedEntrySource = (value: unknown): value is UserFoodLogSource =>
  value === "food_item" ||
  value === "custom_recipe" ||
  value === "custom_meal" ||
  value === "quick_add";

const serializeRawPayload = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const toFoodNutrientDetailsFromRow = (
  row: Partial<Record<(typeof FOOD_NUTRIENT_COLUMNS)[number][1], unknown>>,
): DBFoodNutrientDetails =>
  Object.fromEntries(
    FOOD_NUTRIENT_COLUMNS.map(([property, column]) => [
      property,
      parseNullableNumber(row[column]),
    ]),
  ) as DBFoodNutrientDetails;

const toDbFoodItemFromSupabaseRow = (row: SupabaseFoodItemRow): DBFoodItem => ({
  id: parseRequiredNumber(row.id),
  source: normalizeFoodSource(row.source),
  sourceId: normalizeOptionalText(row.source_id),
  barcode: normalizeOptionalText(row.barcode),
  name: String(row.name ?? ""),
  brand: normalizeOptionalText(row.brand_name),
  imageUrl: normalizeOptionalText(row.image_url),
  quantityValue: parseNullableNumber(row.quantity_value),
  quantityUnit: normalizeOptionalText(row.quantity_unit),
  servingSizeValue: parseNullableNumber(row.serving_size_value),
  servingSizeUnit: normalizeOptionalText(row.serving_size_unit),
  nutritionBasis: normalizeNutritionBasis(row.nutrition_basis),
  calories: parseNullableNumber(row.calories),
  proteinG: parseNullableNumber(row.protein_g),
  carbsG: parseNullableNumber(row.carbs_g),
  fatG: parseNullableNumber(row.fat_g),
  ...toFoodNutrientDetailsFromRow(row),
  ingredientsText: normalizeOptionalText(row.ingredients_text),
  rawPayload: serializeRawPayload(row.raw_payload),
  verified: parseBoolean(row.verified),
  isComplete: parseBoolean(row.is_complete),
  isPublic: true,
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const toDbRecipeFromSupabaseRow = (row: SupabaseCustomRecipeRow): DBRecipe => ({
  id: parseRequiredNumber(row.id),
  userExternalId: String(row.created_by_user_id),
  createdByUserExternalId: String(row.created_by_user_id),
  linkedFoodId: toSyntheticRecipeFoodId(parseRequiredNumber(row.id)),
  isPublic: parseBoolean(row.is_public),
  buildMethod: "scratch",
  name: String(row.name ?? ""),
  description: normalizeOptionalText(row.description),
  linkUrl: normalizeOptionalText(row.link_url),
  prepTimeMin: parseNullableNumber(row.prep_time_min),
  cookTimeMin: parseNullableNumber(row.cook_time_min),
  servings: parseRequiredNumber(row.servings, 1),
  steps: parseStringArray(row.steps),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const toDbCustomMealFromSupabaseRow = (
  row: SupabaseCustomMealRow,
): DBCustomMeal => ({
  id: parseRequiredNumber(row.id),
  userExternalId: String(row.created_by_user_id),
  createdByUserExternalId: String(row.created_by_user_id),
  linkedFoodId: toSyntheticMealFoodId(parseRequiredNumber(row.id)),
  isPublic: parseBoolean(row.is_public),
  name: String(row.name ?? ""),
  description: normalizeOptionalText(row.description),
  servings: parseRequiredNumber(row.servings, 1),
  totalWeightG: parseNullableNumber(row.total_weight_g),
  gramsPerServing: parseNullableNumber(row.grams_per_serving),
  caloriesPerServing: parseNullableNumber(row.calories_per_serving),
  proteinGPerServing: parseNullableNumber(row.protein_g_per_serving),
  carbsGPerServing: parseNullableNumber(row.carbs_g_per_serving),
  fatGPerServing: parseNullableNumber(row.fat_g_per_serving),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const toDbRecipeIngredient = (
  row: SupabaseRecipeIngredientRow,
): DBRecipeIngredient => ({
  id: parseRequiredNumber(row.id),
  recipeId: parseRequiredNumber(row.recipe_id),
  foodId: parseRequiredNumber(row.food_item_id),
  amount: parseRequiredNumber(row.amount_value),
  amountUnit: normalizeOptionalText(row.amount_unit),
  sortOrder: parseRequiredNumber(row.sort_order),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
});

const buildRecipeRawPayload = (row: SupabaseCustomRecipeRow, recipeId?: number) =>
  JSON.stringify({
    entityType: "custom_recipe",
    buildMethod: "scratch",
    createdByUserExternalId: String(row.created_by_user_id),
    recipeId: recipeId ?? parseRequiredNumber(row.id),
    isPublic: parseBoolean(row.is_public),
    servings: parseRequiredNumber(row.servings, 1),
    steps: parseStringArray(row.steps),
    ingredientTotalWeightG: parseNullableNumber(row.ingredient_total_weight_g),
    preparedFoodWeightG: parseNullableNumber(row.prepared_food_weight_g),
    effectiveRecipeWeightG: parseNullableNumber(row.effective_recipe_weight_g),
    gramsPerServing: parseNullableNumber(row.grams_per_serving),
  });

const buildSyntheticRecipeFood = (
  row: SupabaseCustomRecipeRow,
  options: {
    nutrients?: Partial<DBFoodNutrientDetails>;
    ingredientsText?: string | null;
  } = {},
): DBFoodItem => {
  const recipeId = parseRequiredNumber(row.id);

  return {
    id: toSyntheticRecipeFoodId(recipeId),
    source: "recipe",
    sourceId: String(recipeId),
    barcode: null,
    name: String(row.name ?? ""),
    brand: null,
    imageUrl: null,
    quantityValue: parseNullableNumber(row.effective_recipe_weight_g),
    quantityUnit: parseNullableNumber(row.effective_recipe_weight_g) != null ? "g" : null,
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    nutritionBasis: "serving",
    calories: parseNullableNumber(row.calories_per_serving),
    proteinG: parseNullableNumber(row.protein_g_per_serving),
    carbsG: parseNullableNumber(row.carbs_g_per_serving),
    fatG: parseNullableNumber(row.fat_g_per_serving),
    ...Object.fromEntries(
      FOOD_NUTRIENT_COLUMNS.map(([property]) => [
        property,
        options.nutrients?.[property] ?? null,
      ]),
    ) as DBFoodNutrientDetails,
    ingredientsText: normalizeOptionalText(options.ingredientsText),
    rawPayload: buildRecipeRawPayload(row, recipeId),
    verified: false,
    isComplete: true,
    isPublic: parseBoolean(row.is_public),
    createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
    updatedAt:
      normalizeOptionalText(row.updated_at) ??
      normalizeOptionalText(row.created_at) ??
      new Date().toISOString(),
  };
};

const buildSyntheticMealFood = (row: SupabaseCustomMealRow): DBFoodItem => {
  const mealId = parseRequiredNumber(row.id);

  return {
    id: toSyntheticMealFoodId(mealId),
    source: "recipe",
    sourceId: `meal:${mealId}`,
    barcode: null,
    name: String(row.name ?? ""),
    brand: null,
    imageUrl: null,
    quantityValue: parseNullableNumber(row.total_weight_g),
    quantityUnit: parseNullableNumber(row.total_weight_g) != null ? "g" : null,
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    nutritionBasis: "serving",
    calories: parseNullableNumber(row.calories_per_serving),
    proteinG: parseNullableNumber(row.protein_g_per_serving),
    carbsG: parseNullableNumber(row.carbs_g_per_serving),
    fatG: parseNullableNumber(row.fat_g_per_serving),
    ...Object.fromEntries(
      FOOD_NUTRIENT_COLUMNS.map(([property]) => [property, null]),
    ) as DBFoodNutrientDetails,
    ingredientsText: normalizeOptionalText(row.description),
    rawPayload: serializeRawPayload({
      entityType: "custom_meal",
      createdByUserExternalId: String(row.created_by_user_id),
      mealId,
      isPublic: parseBoolean(row.is_public),
      servings: parseRequiredNumber(row.servings, 1),
      gramsPerServing: parseNullableNumber(row.grams_per_serving),
      totalWeightG: parseNullableNumber(row.total_weight_g),
      caloriesPerServing: parseNullableNumber(row.calories_per_serving),
      proteinGPerServing: parseNullableNumber(row.protein_g_per_serving),
      carbsGPerServing: parseNullableNumber(row.carbs_g_per_serving),
      fatGPerServing: parseNullableNumber(row.fat_g_per_serving),
      description: normalizeOptionalText(row.description),
    }),
    verified: false,
    isComplete: true,
    isPublic: parseBoolean(row.is_public),
    createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
    updatedAt:
      normalizeOptionalText(row.updated_at) ??
      normalizeOptionalText(row.created_at) ??
      new Date().toISOString(),
  };
};

const buildRecipeNutrition = (
  input: Pick<CreateUserRecipeInput, "ingredients" | "servings">,
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

  return {
    calories: roundTo(totalCalories / servings, 0),
    proteinG: roundTo(totalProtein / servings),
    carbsG: roundTo(totalCarbs / servings),
    fatG: roundTo(totalFat / servings),
    nutrients: Object.fromEntries(
      FOOD_NUTRIENT_COLUMNS.map(([property]) => [
        property,
        nutrientHasData[property]
          ? roundTo((nutrientTotals[property] ?? 0) / servings)
          : null,
      ]),
    ) as Partial<DBFoodNutrientDetails>,
  };
};

const buildRecipeWeightMetrics = (
  input: Pick<CreateUserRecipeInput, "ingredients" | "preparedFoodWeightG" | "servings">,
) => {
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

const resolveSupabaseUserId = async (
  userExternalId?: string | null,
) => {
  const authUser = await requireSupabaseSessionUser(userExternalId);
  return authUser.id;
};

const fetchFoodItemsByIds = async (ids: number[]): Promise<DBFoodItem[]> => {
  if (ids.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ITEMS_TABLE)
    .select("*")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return (data as SupabaseFoodItemRow[]).map(toDbFoodItemFromSupabaseRow);
};

const fetchFoodItemByIdSupabase = async (id: number): Promise<DBFoodItem | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ITEMS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toDbFoodItemFromSupabaseRow(data as SupabaseFoodItemRow) : null;
};

const fetchFoodItemByBarcodeSupabase = async (
  barcode: string,
): Promise<DBFoodItem | null> => {
  const normalized = barcode.trim();
  if (!normalized) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ITEMS_TABLE)
    .select("*")
    .eq("barcode", normalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toDbFoodItemFromSupabaseRow(data as SupabaseFoodItemRow) : null;
};

const fetchCustomRecipeRowById = async (
  recipeId: number,
): Promise<SupabaseCustomRecipeRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_RECIPES_TABLE)
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseCustomRecipeRow | null) ?? null;
};

const fetchRecipeIngredientsByRecipeId = async (
  recipeId: number,
): Promise<SupabaseRecipeIngredientRow[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_RECIPE_INGREDIENTS_TABLE)
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as SupabaseRecipeIngredientRow[]) ?? [];
};

const fetchCustomMealRowById = async (
  mealId: number,
): Promise<SupabaseCustomMealRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_MEALS_TABLE)
    .select("*")
    .eq("id", mealId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseCustomMealRow | null) ?? null;
};

const canAccessOwnedOrPublicRow = (
  createdByUserId: string,
  isPublic: boolean,
  authUserId: string,
) => createdByUserId === authUserId || isPublic;

const applyNameDescriptionSearch = <
  T extends {
    or: (filters: string) => T;
  },
>(
  builder: T,
  query: string,
) => {
  const normalizedQuery = sanitizeSupabaseSearch(query);
  if (!normalizedQuery) {
    return builder;
  }

  const tokens = buildSupabaseSearchTokens(normalizedQuery);

  if (tokens.length === 0) {
    return builder.or(
      `name.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%`,
    );
  }

  return tokens.reduce(
    (queryBuilder, token) =>
      queryBuilder.or(`name.ilike.%${token}%,description.ilike.%${token}%`),
    builder,
  );
};

const fetchVisibleRecipeRows = async ({
  authUserId,
  limit,
  query,
}: {
  authUserId: string;
  limit: number;
  query: string;
}): Promise<SupabaseCustomRecipeRow[]> => {
  const supabase = getSupabaseClient();
  const scopedLimit = Math.max(limit, 1);
  const ownBuilder = applyNameDescriptionSearch(
    supabase
      .from(SUPABASE_RECIPES_TABLE)
      .select("*")
      .eq("created_by_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(scopedLimit),
    query,
  );
  const publicBuilder = applyNameDescriptionSearch(
    supabase
      .from(SUPABASE_RECIPES_TABLE)
      .select("*")
      .eq("is_public", true)
      .neq("created_by_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(scopedLimit),
    query,
  );
  const [{ data: ownData, error: ownError }, { data: publicData, error: publicError }] =
    await Promise.all([ownBuilder, publicBuilder]);

  if (ownError) {
    throw ownError;
  }

  if (publicError) {
    throw publicError;
  }

  return [
    ...((ownData as SupabaseCustomRecipeRow[]) ?? []),
    ...((publicData as SupabaseCustomRecipeRow[]) ?? []),
  ].slice(0, scopedLimit);
};

const fetchVisibleMealRows = async ({
  authUserId,
  limit,
  query,
}: {
  authUserId: string;
  limit: number;
  query: string;
}): Promise<SupabaseCustomMealRow[]> => {
  const supabase = getSupabaseClient();
  const scopedLimit = Math.max(limit, 1);
  const ownBuilder = applyNameDescriptionSearch(
    supabase
      .from(SUPABASE_MEALS_TABLE)
      .select("*")
      .eq("created_by_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(scopedLimit),
    query,
  );
  const publicBuilder = applyNameDescriptionSearch(
    supabase
      .from(SUPABASE_MEALS_TABLE)
      .select("*")
      .eq("is_public", true)
      .neq("created_by_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(scopedLimit),
    query,
  );
  const [{ data: ownData, error: ownError }, { data: publicData, error: publicError }] =
    await Promise.all([ownBuilder, publicBuilder]);

  if (ownError) {
    throw ownError;
  }

  if (publicError) {
    throw publicError;
  }

  return [
    ...((ownData as SupabaseCustomMealRow[]) ?? []),
    ...((publicData as SupabaseCustomMealRow[]) ?? []),
  ].slice(0, scopedLimit);
};

const listOwnedLocalRecipeFoods = async (
  userExternalId: string,
  limit: number,
): Promise<DBFoodItem[]> => {
  const rows = await listFoodItemsLocal({
    source: "recipe",
    limit: Math.max(limit * 4, 200),
  });

  return rows
    .filter((food) => {
      const payload = parseJsonObject(food.rawPayload);
      return (
        payload?.createdByUserExternalId === userExternalId &&
        payload?.entityType !== "custom_meal"
      );
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(limit, 1));
};

const listOwnedLocalCustomMealFoods = async (
  userExternalId: string,
  limit: number,
): Promise<DBFoodItem[]> => {
  const rows = await listFoodItemsLocal({
    source: "recipe",
    limit: Math.max(limit * 4, 200),
  });

  return rows
    .filter((food) => {
      const payload = parseJsonObject(food.rawPayload);
      return (
        payload?.createdByUserExternalId === userExternalId &&
        payload?.entityType === "custom_meal"
      );
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(limit, 1));
};

const fetchSyntheticRecipeFoodById = async (
  recipeId: number,
  authUserId?: string,
): Promise<DBFoodItem | null> => {
  const recipeRow = await fetchCustomRecipeRowById(recipeId);

  if (!recipeRow) {
    return null;
  }

  if (
    authUserId &&
    !canAccessOwnedOrPublicRow(
      String(recipeRow.created_by_user_id),
      parseBoolean(recipeRow.is_public),
      authUserId,
    )
  ) {
    return null;
  }

  const ingredientRows = await fetchRecipeIngredientsByRecipeId(recipeId);
  const ingredientFoodIds = ingredientRows.map((row) =>
    parseRequiredNumber(row.food_item_id),
  );
  const foods = await fetchFoodItemsByIds(ingredientFoodIds);
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const servings = parseRequiredNumber(recipeRow.servings, 1);
  const nutrientTotals = {} as Partial<Record<keyof DBFoodNutrientDetails, number>>;
  const nutrientHasData = {} as Partial<Record<keyof DBFoodNutrientDetails, boolean>>;
  const ingredientNames: string[] = [];

  for (const ingredientRow of ingredientRows) {
    const food = foodById.get(parseRequiredNumber(ingredientRow.food_item_id));

    if (!food) {
      continue;
    }

    ingredientNames.push(food.name);
    const serving = getResolvedServing(food);
    const amount = parseRequiredNumber(ingredientRow.amount_value);
    const factor = serving.value > 0 ? amount / serving.value : 1;

    for (const [property] of FOOD_NUTRIENT_COLUMNS) {
      const nutrientValue = food[property];

      if (nutrientValue == null) {
        continue;
      }

      nutrientHasData[property] = true;
      nutrientTotals[property] = (nutrientTotals[property] ?? 0) + nutrientValue * factor;
    }
  }

  const nutrients = Object.fromEntries(
    FOOD_NUTRIENT_COLUMNS.map(([property]) => [
      property,
      nutrientHasData[property]
        ? roundTo((nutrientTotals[property] ?? 0) / servings)
        : null,
    ]),
  ) as Partial<DBFoodNutrientDetails>;

  return buildSyntheticRecipeFood(recipeRow, {
    nutrients,
    ingredientsText: ingredientNames.join(", "),
  });
};

const fetchSyntheticMealFoodById = async (
  mealId: number,
  authUserId?: string,
): Promise<DBFoodItem | null> => {
  const mealRow = await fetchCustomMealRowById(mealId);
  if (
    !mealRow ||
    (authUserId &&
      !canAccessOwnedOrPublicRow(
        String(mealRow.created_by_user_id),
        parseBoolean(mealRow.is_public),
        authUserId,
      ))
  ) {
    return null;
  }

  return buildSyntheticMealFood(mealRow);
};

const fetchFoodRowsForList = async ({
  limit,
  query,
  source,
}: Required<Pick<ListFoodItemsInput, "limit">> &
  Pick<ListFoodItemsInput, "query" | "source">): Promise<SupabaseFoodItemRow[]> => {
  const supabase = getSupabaseClient();
  const normalizedQuery = sanitizeSupabaseSearch(query?.trim() ?? "");
  let builder = supabase
    .from(SUPABASE_FOOD_ITEMS_TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit);

  if (source && source !== "recipe") {
    builder = builder.eq("source", source);
  }

  if (normalizedQuery) {
    const tokenFilters = buildSupabaseSearchTokens(normalizedQuery);
    const phraseFilter = `name.ilike.%${normalizedQuery}%,brand_name.ilike.%${normalizedQuery}%,barcode.ilike.%${normalizedQuery}%`;

    builder = tokenFilters.length
      ? tokenFilters.reduce(
          (queryBuilder, token) =>
            queryBuilder.or(
              `name.ilike.%${token}%,brand_name.ilike.%${token}%,barcode.ilike.%${token}%`,
            ),
          builder,
        )
      : builder.or(phraseFilter);
  }

  const { data, error } = await builder;

  if (error) {
    throw error;
  }

  return (data as SupabaseFoodItemRow[]) ?? [];
};

const findExistingSupabaseFoodItemId = async (
  input: SaveFoodItemInput,
): Promise<number | null> => {
  const supabase = getSupabaseClient();

  if (typeof input.id === "number") {
    const { data, error } = await supabase
      .from(SUPABASE_FOOD_ITEMS_TABLE)
      .select("id")
      .eq("id", input.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.id ? parseRequiredNumber(data.id) : null;
  }

  const normalizedSourceId = normalizeOptionalText(input.sourceId);
  if (normalizedSourceId) {
    const { data, error } = await supabase
      .from(SUPABASE_FOOD_ITEMS_TABLE)
      .select("id")
      .eq("source", input.source)
      .eq("source_id", normalizedSourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return parseRequiredNumber(data.id);
    }
  }

  const normalizedBarcode = normalizeOptionalText(input.barcode);
  if (normalizedBarcode) {
    const { data, error } = await supabase
      .from(SUPABASE_FOOD_ITEMS_TABLE)
      .select("id")
      .eq("source", input.source)
      .eq("barcode", normalizedBarcode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return parseRequiredNumber(data.id);
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

const buildFoodItemInsertPayload = (
  input: SaveFoodItemInput,
  submittedByUserId: string,
) => ({
  submitted_by_user_id: submittedByUserId,
  source: input.source === "recipe" ? "custom" : input.source,
  source_id: normalizeOptionalText(input.sourceId),
  barcode: normalizeOptionalText(input.barcode),
  name: input.name.trim(),
  brand_name: normalizeOptionalText(input.brand),
  image_url: normalizeOptionalText(input.imageUrl),
  quantity_value: input.quantityValue ?? null,
  quantity_unit: normalizeOptionalText(input.quantityUnit),
  serving_size_value: input.servingSizeValue ?? null,
  serving_size_unit: normalizeOptionalText(input.servingSizeUnit),
  nutrition_basis: input.nutritionBasis,
  calories: input.calories ?? null,
  protein_g: input.proteinG ?? null,
  carbs_g: input.carbsG ?? null,
  fat_g: input.fatG ?? null,
  ...Object.fromEntries(
    FOOD_NUTRIENT_COLUMNS.map(([property, column]) => [column, input[property] ?? null]),
  ),
  ingredients_text: normalizeOptionalText(input.ingredientsText),
  raw_payload: parseJsonObject(input.rawPayload) ?? input.rawPayload ?? null,
  verified: Boolean(input.verified),
  is_complete: Boolean(input.isComplete),
});

const buildEntrySnapshotMetadata = (food: DBFoodItem): EntrySnapshotMetadata => {
  const serving = getResolvedServing(food);

  return {
    servingSize: serving.value,
    servingUnit: serving.unit,
    source: food.source,
    sourceId: food.sourceId,
    syntheticFoodId:
      food.source === "recipe" || isSyntheticMealFoodId(food.id) ? food.id : null,
  };
};

const toDbFoodLogEntry = (row: SupabaseUserFoodEntryRow): DBUserFoodLogEntry => {
  const metadata = parseJsonObject(row.metadata) as EntrySnapshotMetadata | null;
  const entryType = isSupportedEntrySource(row.entry_type)
    ? row.entry_type
    : "food_item";
  const servingSize = parseRequiredNumber(metadata?.servingSize, DEFAULT_LOG_AMOUNT);
  const servingUnit = normalizeOptionalText(metadata?.servingUnit) ?? row.amount_unit ?? "g";
  const foodId =
    entryType === "food_item"
      ? parseNullableNumber(row.food_item_id)
      : entryType === "custom_recipe"
        ? parseNullableNumber(metadata?.syntheticFoodId) ??
          toSyntheticRecipeFoodId(parseRequiredNumber(row.custom_recipe_id))
        : entryType === "custom_meal"
          ? parseNullableNumber(metadata?.syntheticFoodId) ??
            toSyntheticMealFoodId(parseRequiredNumber(row.custom_meal_id))
          : null;

  return {
    id: parseRequiredNumber(row.id),
    userExternalId: row.user_id,
    foodId,
    date: row.date,
    loggedAt: normalizeOptionalText(row.logged_at) ?? normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
    quantityG: parseRequiredNumber(row.amount_value, DEFAULT_LOG_AMOUNT),
    mealType: normalizeOptionalText(row.meal_type),
    createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
    entrySource: entryType,
    foodName: String(row.display_name ?? ""),
    servingSize,
    servingUnit,
    calories: parseRequiredNumber(row.calories),
    proteinG: parseRequiredNumber(row.protein_g),
    carbsG: parseRequiredNumber(row.carbs_g),
    fatG: parseRequiredNumber(row.fat_g),
    alcoholG: parseNullableNumber(row.alcohol_g),
    systemCalculatedCalories: parseNullableNumber(row.system_calculated_calories),
    isEnergyManuallySet: parseBoolean(row.is_energy_manually_set),
    quickAddName:
      entryType === "quick_add"
        ? normalizeOptionalText(metadata?.quickAddName) ?? normalizeOptionalText(row.display_name)
        : null,
  };
};

const toDbDiaryDayStatus = (row: SupabaseDiaryDayRow): DBDiaryDayStatus => ({
  userExternalId: row.user_id,
  date: row.date,
  isComplete: parseBoolean(row.is_complete),
  completedAt: normalizeOptionalText(row.completed_at),
  createdAt: normalizeOptionalText(row.created_at) ?? new Date().toISOString(),
  updatedAt:
    normalizeOptionalText(row.updated_at) ??
    normalizeOptionalText(row.created_at) ??
    new Date().toISOString(),
});

const fetchDiaryDayRow = async (
  userId: string,
  date: string,
): Promise<SupabaseDiaryDayRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_DIARY_DAYS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseDiaryDayRow | null) ?? null;
};

const listDiaryDayRowsBetween = async (
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SupabaseDiaryDayRow[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_DIARY_DAYS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as SupabaseDiaryDayRow[]) ?? [];
};

const invalidateAdaptiveCalculationForUser = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_USER_SETTINGS_TABLE)
    .update({ adaptive_last_calculated_at: null })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};

const supersedeOpenAdaptiveRecommendations = async (userId: string) => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(SUPABASE_ADAPTIVE_RECOMMENDATIONS_TABLE)
    .update({
      status: "superseded",
      responded_at: now,
    })
    .eq("user_id", userId)
    .eq("status", "proposed");

  if (error) {
    throw error;
  }
};

const clearCompletedDiaryDayIfNeeded = async (userId: string, date: string) => {
  const existingStatus = await fetchDiaryDayRow(userId, date);

  if (!existingStatus || !parseBoolean(existingStatus.is_complete)) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_DIARY_DAYS_TABLE)
    .update({
      is_complete: false,
      completed_at: null,
    })
    .eq("user_id", userId)
    .eq("date", date);

  if (error) {
    throw error;
  }

  await invalidateAdaptiveCalculationForUser(userId);
  await supersedeOpenAdaptiveRecommendations(userId);
};

const fetchFoodLogEntryRowByIdSupabase = async (
  id: number,
): Promise<SupabaseUserFoodEntryRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SupabaseUserFoodEntryRow | null) ?? null;
};

const getRecentSupabaseItems = async (
  userExternalId: string,
  limit: number,
): Promise<DBFoodItem[]> => {
  const authUserId = userExternalId;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .select("entry_type, food_item_id, custom_recipe_id, custom_meal_id, logged_at, created_at")
    .eq("user_id", userExternalId)
    .order("logged_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 6, 40));

  if (error) {
    throw error;
  }

  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const recentFoods: DBFoodItem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const entryType = String(row.entry_type ?? "");

    if (entryType === "food_item") {
      const foodId = parseRequiredNumber(row.food_item_id);
      const dedupeKey = `food:${foodId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      const food = await fetchFoodItemByIdSupabase(foodId);
      if (food) {
        seen.add(dedupeKey);
        recentFoods.push(food);
      }
    } else if (entryType === "custom_recipe") {
      const recipeId = parseRequiredNumber(row.custom_recipe_id);
      const dedupeKey = `recipe:${recipeId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      const food = await fetchSyntheticRecipeFoodById(recipeId, authUserId);
      if (food) {
        seen.add(dedupeKey);
        recentFoods.push(food);
      }
    } else if (entryType === "custom_meal") {
      const mealId = parseRequiredNumber(row.custom_meal_id);
      const dedupeKey = `meal:${mealId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      const food = await fetchSyntheticMealFoodById(mealId, authUserId);
      if (food) {
        seen.add(dedupeKey);
        recentFoods.push(food);
      }
    }

    if (recentFoods.length >= limit) {
      break;
    }
  }

  return recentFoods;
};

export const saveFoodItem = async (input: SaveFoodItemInput): Promise<number> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return saveFoodItemLocal(input);
  }

  validateFoodItemInput(input);

  const existingId = await findExistingSupabaseFoodItemId(input);
  if (existingId != null) {
    return existingId;
  }

  const supabase = getSupabaseClient();
  const payload = buildFoodItemInsertPayload(input, authUserId);
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ITEMS_TABLE)
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    const recoveredId = await findExistingSupabaseFoodItemId(input);
    if (recoveredId != null) {
      return recoveredId;
    }

    throw error;
  }

  return parseRequiredNumber(data.id);
};

export const addFoodItem = async (input: AddFoodItemInput): Promise<number> =>
  saveFoodItem(input);

export const getFoodItemById = async (
  id: number,
): Promise<DBFoodItem | null> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return getFoodItemByIdLocal(id);
  }

  if (isSyntheticRecipeFoodId(id)) {
    return fetchSyntheticRecipeFoodById(fromSyntheticRecipeFoodId(id), authUserId);
  }

  if (isSyntheticMealFoodId(id)) {
    return fetchSyntheticMealFoodById(fromSyntheticMealFoodId(id), authUserId);
  }

  return fetchFoodItemByIdSupabase(id);
};

export const getFoodItemByBarcode = async (
  barcode: string,
): Promise<DBFoodItem | null> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return getFoodItemByBarcodeLocal(barcode);
  }

  return fetchFoodItemByBarcodeSupabase(barcode);
};

export const deleteFoodItem = async (foodId: number): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return deleteFoodItemLocal(foodId);
  }

  if (foodId < 0) {
    throw new Error("Recipes and meals are not deleted through the food catalog.");
  }

  throw new Error("Shared Supabase catalog items are read-only in the app.");
};

export const setFoodItemFavorite = async (
  userExternalId: string,
  foodId: number,
  isFavorite: boolean,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return setFoodItemFavoriteLocal(userExternalId, foodId, isFavorite);
  }

  if (foodId < 0) {
    return;
  }

  const supabase = getSupabaseClient();

  if (isFavorite) {
    const { error } = await supabase.from(SUPABASE_FAVORITES_TABLE).upsert(
      {
        user_id: authUserId,
        food_item_id: foodId,
      },
      { onConflict: "user_id,food_item_id", ignoreDuplicates: true },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from(SUPABASE_FAVORITES_TABLE)
    .delete()
    .eq("user_id", authUserId)
    .eq("food_item_id", foodId);

  if (error) {
    throw error;
  }
};

export const getFavoriteFoodIds = async (
  userExternalId: string,
): Promise<number[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getFavoriteFoodIdsLocal(userExternalId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FAVORITES_TABLE)
    .select("food_item_id")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as Array<{ food_item_id: number | string }>) ?? []).map((row) =>
    parseRequiredNumber(row.food_item_id),
  );
};

export const getFavoriteFoodItems = async (
  userExternalId: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getFavoriteFoodItemsLocal(userExternalId, limit);
  }

  const ids = await getFavoriteFoodIds(userExternalId);
  const limitedIds = ids.slice(0, limit);
  const foods = await fetchFoodItemsByIds(limitedIds);
  const byId = new Map(foods.map((food) => [food.id, food]));

  return limitedIds
    .map((id) => byId.get(id) ?? null)
    .filter((food): food is DBFoodItem => food != null);
};

export const listFoodItems = async ({
  query,
  limit = 120,
  source = null,
}: ListFoodItemsInput = {}): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return listFoodItemsLocal({ query, limit, source });
  }

  if (source === "recipe") {
    const recipes = await fetchVisibleRecipeRows({
      authUserId,
      query: query?.trim() ?? "",
      limit,
    });
    return recipes.map((recipe) => buildSyntheticRecipeFood(recipe));
  }

  if (source === "custom_meal") {
    const meals = await fetchVisibleMealRows({
      authUserId,
      query: query?.trim() ?? "",
      limit,
    });
    return meals.map((meal) => buildSyntheticMealFood(meal));
  }

  const rows = await fetchFoodRowsForList({
    query,
    limit,
    source,
  });

  return rows.map(toDbFoodItemFromSupabaseRow);
};

export const listUserCreatedRecipeFoods = async (
  userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return listOwnedLocalRecipeFoods(userExternalId, limit);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_RECIPES_TABLE)
    .select("*")
    .eq("created_by_user_id", authUserId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit, 1));

  if (error) {
    throw error;
  }

  return ((data as SupabaseCustomRecipeRow[]) ?? []).map((recipe) =>
    buildSyntheticRecipeFood(recipe),
  );
};

export const listUserCreatedCustomMealFoods = async (
  userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return listOwnedLocalCustomMealFoods(userExternalId, limit);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_MEALS_TABLE)
    .select("*")
    .eq("created_by_user_id", authUserId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit, 1));

  if (error) {
    throw error;
  }

  return ((data as SupabaseCustomMealRow[]) ?? []).map((meal) =>
    buildSyntheticMealFood(meal),
  );
};

export const searchFoodItems = async (
  query: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId();
  const normalized = query.trim();

  if (!authUserId) {
    return searchFoodItemsLocal(query, limit);
  }

  if (!normalized) {
    return [];
  }

  const [foodRows, recipeRows, mealRows] = await Promise.all([
    fetchFoodRowsForList({ query: normalized, limit, source: null }),
    fetchVisibleRecipeRows({
      authUserId,
      query: normalized,
      limit: Math.max(8, Math.ceil(limit / 2)),
    }),
    fetchVisibleMealRows({
      authUserId,
      query: normalized,
      limit: Math.max(8, Math.ceil(limit / 2)),
    }),
  ]);

  return [
    ...foodRows.map(toDbFoodItemFromSupabaseRow),
    ...recipeRows.map((recipe) => buildSyntheticRecipeFood(recipe)),
    ...mealRows.map((meal) => buildSyntheticMealFood(meal)),
  ];
};

export const getRecentFoodItems = async (
  userExternalId: string,
  limit = 20,
): Promise<DBFoodItem[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getRecentFoodItemsLocal(userExternalId, limit);
  }

  return getRecentSupabaseItems(authUserId, limit);
};

export const createUserRecipe = async (
  input: CreateUserRecipeInput,
): Promise<DBRecipe> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return createUserRecipeLocal(input);
  }

  const trimmedName = input.name.trim();
  const servings = roundTo(input.servings, 2);
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);
  const isPublic = input.isPublic ?? true;

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

  const supabase = getSupabaseClient();
  const nutrition = buildRecipeNutrition({ ...input, servings });
  const weightMetrics = buildRecipeWeightMetrics({ ...input, servings });

  const { data, error } = await supabase
    .from(SUPABASE_RECIPES_TABLE)
    .insert({
      created_by_user_id: authUserId,
      name: trimmedName,
      description: normalizeOptionalText(input.description),
      link_url: normalizeOptionalText(input.linkUrl),
      prep_time_min: input.prepTimeMin ?? null,
      cook_time_min: input.cookTimeMin ?? null,
      servings,
      steps,
      ingredient_total_weight_g: weightMetrics.ingredientTotalWeightG,
      prepared_food_weight_g: weightMetrics.preparedFoodWeightG,
      effective_recipe_weight_g: weightMetrics.effectiveRecipeWeightG,
      grams_per_serving: weightMetrics.gramsPerServing,
      calories_per_serving: nutrition.calories,
      protein_g_per_serving: nutrition.proteinG,
      carbs_g_per_serving: nutrition.carbsG,
      fat_g_per_serving: nutrition.fatG,
      is_public: isPublic,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const recipeRow = data as SupabaseCustomRecipeRow;
  const recipeId = parseRequiredNumber(recipeRow.id);
  const ingredientsPayload = input.ingredients.map((ingredient, index) => ({
    recipe_id: recipeId,
    food_item_id: ingredient.foodId,
    amount_value: ingredient.amount,
    amount_unit: getResolvedServing(ingredient.food).unit,
    sort_order: index,
  }));

  if (ingredientsPayload.length > 0) {
    const ingredientInsert = await supabase
      .from(SUPABASE_RECIPE_INGREDIENTS_TABLE)
      .insert(ingredientsPayload);

    if (ingredientInsert.error) {
      await supabase.from(SUPABASE_RECIPES_TABLE).delete().eq("id", recipeId);
      throw ingredientInsert.error;
    }
  }

  return toDbRecipeFromSupabaseRow(recipeRow);
};

export const getUserRecipeDetailsById = async (
  recipeId: number,
): Promise<DBRecipeDetails | null> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return getUserRecipeDetailsByIdLocal(recipeId);
  }

  const recipeRow = await fetchCustomRecipeRowById(recipeId);
  if (!recipeRow) {
    return null;
  }

  if (
    !canAccessOwnedOrPublicRow(
      String(recipeRow.created_by_user_id),
      parseBoolean(recipeRow.is_public),
      authUserId,
    )
  ) {
    return null;
  }

  const ingredientRows = await fetchRecipeIngredientsByRecipeId(recipeId);
  const ingredientFoodIds = ingredientRows.map((row) =>
    parseRequiredNumber(row.food_item_id),
  );
  const foods = await fetchFoodItemsByIds(ingredientFoodIds);
  const foodById = new Map(foods.map((food) => [food.id, food]));

  const ingredients = ingredientRows
    .map((row) => {
      const ingredient = toDbRecipeIngredient(row);
      const food = foodById.get(ingredient.foodId);

      return food
        ? ({
            ...ingredient,
            food,
          } satisfies DBRecipeIngredientDetail)
        : null;
    })
    .filter((ingredient): ingredient is DBRecipeIngredientDetail => ingredient != null);

  const recipe = toDbRecipeFromSupabaseRow(recipeRow);

  return {
    ...recipe,
    ingredients,
    ingredientTotalWeightG: parseNullableNumber(recipeRow.ingredient_total_weight_g),
    preparedFoodWeightG: parseNullableNumber(recipeRow.prepared_food_weight_g),
    effectiveRecipeWeightG: parseNullableNumber(recipeRow.effective_recipe_weight_g),
    gramsPerServing: parseNullableNumber(recipeRow.grams_per_serving),
  };
};

export const updateUserRecipe = async (
  input: UpdateUserRecipeInput,
): Promise<DBRecipe> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return updateUserRecipeLocal(input);
  }

  const existing = await getUserRecipeDetailsById(input.recipeId);
  if (!existing) {
    throw new Error("Recipe could not be found.");
  }

  if (existing.createdByUserExternalId !== authUserId) {
    throw new Error("Only your own recipes can be edited.");
  }

  const trimmedName = input.name.trim();
  const servings = roundTo(input.servings, 2);
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);
  const isPublic = input.isPublic ?? existing.isPublic;

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

  const nutrition = buildRecipeNutrition({ ...input, servings });
  const weightMetrics = buildRecipeWeightMetrics({ ...input, servings });
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_RECIPES_TABLE)
    .update({
      name: trimmedName,
      description: normalizeOptionalText(input.description),
      link_url: normalizeOptionalText(input.linkUrl),
      prep_time_min: input.prepTimeMin ?? null,
      cook_time_min: input.cookTimeMin ?? null,
      servings,
      steps,
      ingredient_total_weight_g: weightMetrics.ingredientTotalWeightG,
      prepared_food_weight_g: weightMetrics.preparedFoodWeightG,
      effective_recipe_weight_g: weightMetrics.effectiveRecipeWeightG,
      grams_per_serving: weightMetrics.gramsPerServing,
      calories_per_serving: nutrition.calories,
      protein_g_per_serving: nutrition.proteinG,
      carbs_g_per_serving: nutrition.carbsG,
      fat_g_per_serving: nutrition.fatG,
      is_public: isPublic,
    })
    .eq("id", input.recipeId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const deleteExistingIngredients = await supabase
    .from(SUPABASE_RECIPE_INGREDIENTS_TABLE)
    .delete()
    .eq("recipe_id", input.recipeId);

  if (deleteExistingIngredients.error) {
    throw deleteExistingIngredients.error;
  }

  const nextIngredients = input.ingredients.map((ingredient, index) => ({
    recipe_id: input.recipeId,
    food_item_id: ingredient.foodId,
    amount_value: ingredient.amount,
    amount_unit: getResolvedServing(ingredient.food).unit,
    sort_order: index,
  }));

  if (nextIngredients.length > 0) {
    const ingredientInsert = await supabase
      .from(SUPABASE_RECIPE_INGREDIENTS_TABLE)
      .insert(nextIngredients);

    if (ingredientInsert.error) {
      throw ingredientInsert.error;
    }
  }

  return toDbRecipeFromSupabaseRow(data as SupabaseCustomRecipeRow);
};

export const deleteUserRecipe = async (recipeId: number): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return deleteUserRecipeLocal(recipeId);
  }

  const existing = await getUserRecipeDetailsById(recipeId);
  if (!existing) {
    throw new Error("Recipe could not be found.");
  }

  if (existing.createdByUserExternalId !== authUserId) {
    throw new Error("Only your own recipes can be deleted.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_RECIPES_TABLE)
    .delete()
    .eq("id", recipeId);

  if (error) {
    throw new Error(
      "This recipe could not be deleted. Remove diary entries that still use it and try again.",
    );
  }
};

export const getUserCustomMealFoodById = async (
  mealId: number,
): Promise<DBFoodItem | null> => {
  const authUserId = await resolveSupabaseUserId();
  return fetchSyntheticMealFoodById(mealId, authUserId);
};

export const createUserCustomMeal = async (
  input: CreateUserCustomMealInput,
): Promise<DBFoodItem> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const trimmedName = input.name.trim();
  const servingSizeG = roundTo(input.servingSizeG, 2);
  const calories = roundTo(input.calories, 2);
  const proteinG = roundTo(input.proteinG ?? 0, 3);
  const carbsG = roundTo(input.carbsG ?? 0, 3);
  const fatG = roundTo(input.fatG ?? 0, 3);
  const isPublic = input.isPublic ?? true;

  if (!trimmedName) {
    throw new Error("Custom meal name is required.");
  }

  if (!Number.isFinite(servingSizeG) || servingSizeG <= 0) {
    throw new Error("Serving size must be a positive number.");
  }

  if (
    !Number.isFinite(calories) ||
    calories <= 0 ||
    [proteinG, carbsG, fatG].some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error("Calories must be positive and macros cannot be negative.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_MEALS_TABLE)
    .insert({
      created_by_user_id: authUserId,
      name: trimmedName,
      description: normalizeOptionalText(input.description),
      servings: 1,
      total_weight_g: servingSizeG,
      grams_per_serving: servingSizeG,
      calories_per_serving: calories,
      protein_g_per_serving: proteinG,
      carbs_g_per_serving: carbsG,
      fat_g_per_serving: fatG,
      is_public: isPublic,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return buildSyntheticMealFood(data as SupabaseCustomMealRow);
};

export const updateUserCustomMeal = async (
  input: UpdateUserCustomMealInput,
): Promise<DBFoodItem> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);
  const existingRow = await fetchCustomMealRowById(input.mealId);

  if (!existingRow) {
    throw new Error("Custom meal could not be found.");
  }

  const existing = toDbCustomMealFromSupabaseRow(existingRow);
  if (existing.createdByUserExternalId !== authUserId) {
    throw new Error("Only your own custom meals can be edited.");
  }

  const trimmedName = input.name.trim();
  const servingSizeG = roundTo(input.servingSizeG, 2);
  const calories = roundTo(input.calories, 2);
  const proteinG = roundTo(input.proteinG ?? 0, 3);
  const carbsG = roundTo(input.carbsG ?? 0, 3);
  const fatG = roundTo(input.fatG ?? 0, 3);
  const isPublic = input.isPublic ?? existing.isPublic;

  if (!trimmedName) {
    throw new Error("Custom meal name is required.");
  }

  if (!Number.isFinite(servingSizeG) || servingSizeG <= 0) {
    throw new Error("Serving size must be a positive number.");
  }

  if (
    !Number.isFinite(calories) ||
    calories <= 0 ||
    [proteinG, carbsG, fatG].some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error("Calories must be positive and macros cannot be negative.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_MEALS_TABLE)
    .update({
      name: trimmedName,
      description: normalizeOptionalText(input.description),
      servings: 1,
      total_weight_g: servingSizeG,
      grams_per_serving: servingSizeG,
      calories_per_serving: calories,
      protein_g_per_serving: proteinG,
      carbs_g_per_serving: carbsG,
      fat_g_per_serving: fatG,
      is_public: isPublic,
    })
    .eq("id", input.mealId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return buildSyntheticMealFood(data as SupabaseCustomMealRow);
};

export const deleteUserCustomMeal = async (mealId: number): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();
  const existingRow = await fetchCustomMealRowById(mealId);

  if (!existingRow) {
    throw new Error("Custom meal could not be found.");
  }

  const existing = toDbCustomMealFromSupabaseRow(existingRow);
  if (existing.createdByUserExternalId !== authUserId) {
    throw new Error("Only your own custom meals can be deleted.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_MEALS_TABLE)
    .delete()
    .eq("id", mealId);

  if (error) {
    throw new Error(
      "This custom meal could not be deleted. Remove diary entries that still use it and try again.",
    );
  }
};

export const addUserFoodLog = async (
  input: AddUserFoodLogInput,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return addUserFoodLogLocal(input);
  }

  const food = await getFoodItemById(input.foodId);
  if (!food) {
    throw new Error("Food item could not be found.");
  }

  const serving = getResolvedServing(food);
  const entryType: UserFoodLogSource = isSyntheticRecipeFoodId(food.id)
    ? "custom_recipe"
    : isSyntheticMealFoodId(food.id)
      ? "custom_meal"
      : "food_item";

  const payload = {
    user_id: authUserId,
    entry_type: entryType,
    food_item_id: entryType === "food_item" ? food.id : null,
    custom_recipe_id:
      entryType === "custom_recipe" ? fromSyntheticRecipeFoodId(food.id) : null,
    custom_meal_id:
      entryType === "custom_meal" ? fromSyntheticMealFoodId(food.id) : null,
    date: input.date,
    logged_at: input.loggedAt ?? new Date().toISOString(),
    meal_type: normalizeOptionalText(input.mealType),
    amount_value: input.quantityG,
    amount_unit: serving.unit,
    resolved_quantity_g:
      serving.unit === "g" ? input.quantityG : parseNullableNumber(food.quantityValue),
    display_name: food.name,
    calories: food.calories ?? 0,
    protein_g: food.proteinG ?? 0,
    carbs_g: food.carbsG ?? 0,
    fat_g: food.fatG ?? 0,
    alcohol_g: food.alcoholG ?? 0,
    system_calculated_calories: null,
    is_energy_manually_set: false,
    metadata: buildEntrySnapshotMetadata(food),
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(SUPABASE_FOOD_ENTRIES_TABLE).insert(payload);

  if (error) {
    throw error;
  }

  await clearCompletedDiaryDayIfNeeded(authUserId, input.date);
};

export const addQuickAddFoodLog = async (
  input: AddQuickAddFoodLogInput,
): Promise<number> => {
  const authUserId = await resolveSupabaseUserId(input.userExternalId);

  if (!authUserId) {
    return addQuickAddFoodLogLocal(input);
  }

  const supabase = getSupabaseClient();
  const displayName = normalizeOptionalText(input.name) ?? "Quick Add";
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .insert({
      user_id: authUserId,
      entry_type: "quick_add",
      date: input.date,
      logged_at: input.loggedAt ?? new Date().toISOString(),
      meal_type: normalizeOptionalText(input.mealType),
      amount_value: 1,
      amount_unit: "entry",
      resolved_quantity_g: null,
      display_name: displayName,
      calories: input.calories,
      protein_g: input.proteinG ?? 0,
      carbs_g: input.carbsG ?? 0,
      fat_g: input.fatG ?? 0,
      alcohol_g: input.alcoholG ?? 0,
      system_calculated_calories: input.systemCalculatedCalories ?? null,
      is_energy_manually_set: Boolean(input.isEnergyManuallySet),
      metadata: {
        quickAddName: normalizeOptionalText(input.name),
        servingSize: 1,
        servingUnit: "entry",
      },
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await clearCompletedDiaryDayIfNeeded(authUserId, input.date);

  return parseRequiredNumber(data.id);
};

export const updateUserFoodLog = async (
  input: UpdateUserFoodLogInput,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return updateUserFoodLogLocal(input);
  }

  const existingRow = await fetchFoodLogEntryRowByIdSupabase(input.id);
  if (!existingRow) {
    return;
  }

  const entry = toDbFoodLogEntry(existingRow);
  const food =
    entry.foodId != null ? await getFoodItemById(entry.foodId) : null;
  const serving = food ? getResolvedServing(food) : null;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .update({
      amount_value: input.quantityG,
      amount_unit: serving?.unit ?? entry.servingUnit ?? "g",
      meal_type: normalizeOptionalText(input.mealType),
      logged_at: input.loggedAt ?? existingRow.logged_at,
      resolved_quantity_g:
        serving?.unit === "g" ? input.quantityG : existingRow.resolved_quantity_g,
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }

  await clearCompletedDiaryDayIfNeeded(authUserId, entry.date);
};

export const updateQuickAddFoodLog = async (
  input: UpdateQuickAddFoodLogInput,
): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return updateQuickAddFoodLogLocal(input);
  }

  const existingRow = await fetchFoodLogEntryRowByIdSupabase(input.id);
  if (!existingRow) {
    return;
  }

  const supabase = getSupabaseClient();
  const displayName = normalizeOptionalText(input.name) ?? "Quick Add";
  const updatePayload = {
    ...(input.loggedAt ? { logged_at: input.loggedAt } : {}),
    meal_type: normalizeOptionalText(input.mealType),
    display_name: displayName,
    calories: input.calories,
    protein_g: input.proteinG ?? 0,
    carbs_g: input.carbsG ?? 0,
    fat_g: input.fatG ?? 0,
    alcohol_g: input.alcoholG ?? 0,
    system_calculated_calories: input.systemCalculatedCalories ?? null,
    is_energy_manually_set: Boolean(input.isEnergyManuallySet),
    metadata: {
      quickAddName: normalizeOptionalText(input.name),
      servingSize: 1,
      servingUnit: "entry",
    },
  };
  const { error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .update(updatePayload)
    .eq("id", input.id)
    .eq("entry_type", "quick_add");

  if (error) {
    throw error;
  }

  await clearCompletedDiaryDayIfNeeded(authUserId, existingRow.date);
};

export const deleteUserFoodLog = async (id: number): Promise<void> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return deleteUserFoodLogLocal(id);
  }

  const existingRow = await fetchFoodLogEntryRowByIdSupabase(id);
  if (!existingRow) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  await clearCompletedDiaryDayIfNeeded(authUserId, existingRow.date);
};

export const getUserFoodLogEntryById = async (
  id: number,
): Promise<DBUserFoodLogEntry | null> => {
  const authUserId = await resolveSupabaseUserId();

  if (!authUserId) {
    return getUserFoodLogEntryByIdLocal(id);
  }

  const row = await fetchFoodLogEntryRowByIdSupabase(id);
  return row ? toDbFoodLogEntry(row) : null;
};

export const getUserFoodLogEntriesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBUserFoodLogEntry[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    const localEntries = await Promise.all(
      listDateKeysBetween(startDate, endDate).map((date) =>
        getUserFoodLogEntriesByDateLocal(userExternalId, date),
      ),
    );

    return localEntries.flat().sort((left, right) => {
      const leftTime = new Date(left.loggedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.loggedAt ?? right.createdAt).getTime();
      return leftTime - rightTime;
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", authUserId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("logged_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data as SupabaseUserFoodEntryRow[]) ?? []).map(toDbFoodLogEntry);
};

export const getDiaryDayStatus = async (
  userExternalId: string,
  date: string,
): Promise<DBDiaryDayStatus | null> => {
  let authUserId: string;

  try {
    authUserId = await resolveSupabaseUserId(userExternalId);
  } catch {
    return null;
  }

  const row = await fetchDiaryDayRow(authUserId, date);
  return row ? toDbDiaryDayStatus(row) : null;
};

export const listDiaryDayStatusesBetween = async (
  userExternalId: string,
  startDate: string,
  endDate: string,
): Promise<DBDiaryDayStatus[]> => {
  let authUserId: string;

  try {
    authUserId = await resolveSupabaseUserId(userExternalId);
  } catch {
    return [];
  }

  const rows = await listDiaryDayRowsBetween(authUserId, startDate, endDate);
  return rows.map(toDbDiaryDayStatus);
};

export const saveDiaryDayStatus = async (
  input: SaveDiaryDayStatusInput,
): Promise<DBDiaryDayStatus> => {
  let authUserId: string;

  try {
    authUserId = await resolveSupabaseUserId(input.userExternalId);
  } catch {
    const now = new Date().toISOString();
    return {
      userExternalId: input.userExternalId,
      date: input.date,
      isComplete: input.isComplete,
      completedAt: input.isComplete ? now : null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const existing = await fetchDiaryDayRow(authUserId, input.date);
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_DIARY_DAYS_TABLE)
    .upsert(
      {
        user_id: authUserId,
        date: input.date,
        is_complete: input.isComplete,
        completed_at: input.isComplete ? now : null,
        created_at:
          normalizeOptionalText(existing?.created_at) ??
          normalizeOptionalText(existing?.updated_at) ??
          now,
        updated_at: now,
      },
      { onConflict: "user_id,date" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toDbDiaryDayStatus(data as SupabaseDiaryDayRow);
};

export const getUserFoodLogEntriesByDate = async (
  userExternalId: string,
  date: string,
): Promise<DBUserFoodLogEntry[]> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return getUserFoodLogEntriesByDateLocal(userExternalId, date);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", authUserId)
    .eq("date", date)
    .order("logged_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data as SupabaseUserFoodEntryRow[]) ?? []).map(toDbFoodLogEntry);
};

export const copyFoodLogsFromDate = async (
  userExternalId: string,
  fromDate: string,
  toDate: string,
): Promise<FoodLogCopyResult> => {
  const authUserId = await resolveSupabaseUserId(userExternalId);

  if (!authUserId) {
    return copyFoodLogsFromDateLocal(userExternalId, fromDate, toDate);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_FOOD_ENTRIES_TABLE)
    .select("*")
    .eq("user_id", authUserId)
    .eq("date", fromDate)
    .order("logged_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const sourceRows = (data as SupabaseUserFoodEntryRow[]) ?? [];
  if (sourceRows.length === 0) {
    return {
      sourceCount: 0,
      destinationCount: 0,
      copiedCount: 0,
      skippedDuplicates: 0,
    };
  }

  const destinationEntries = await getUserFoodLogEntriesByDate(userExternalId, toDate);
  const remainingDestinationMatches = countFoodLogsByDuplicateKey(
    destinationEntries.map(toFoodLogDuplicateShape),
  );
  let copiedCount = 0;
  let skippedDuplicates = 0;

  const buildDuplicateShape = (
    row: SupabaseUserFoodEntryRow,
  ): FoodLogDuplicateShape => {
    let foodId: number | null = null;

    if (row.entry_type === "food_item") {
      foodId = parseNullableNumber(row.food_item_id);
    } else if (row.entry_type === "custom_recipe") {
      const recipeId = parseNullableNumber(row.custom_recipe_id);
      foodId = recipeId != null ? toSyntheticRecipeFoodId(recipeId) : null;
    } else if (row.entry_type === "custom_meal") {
      const mealId = parseNullableNumber(row.custom_meal_id);
      foodId = mealId != null ? toSyntheticMealFoodId(mealId) : null;
    }

    return {
      entrySource: isSupportedEntrySource(row.entry_type)
        ? row.entry_type
        : "food_item",
      foodId,
      loggedAt: normalizeOptionalText(row.logged_at),
      createdAt: normalizeOptionalText(row.created_at),
      quantityValue: parseNullableNumber(row.amount_value),
      mealType: normalizeOptionalText(row.meal_type),
      displayName: normalizeOptionalText(row.display_name),
      calories: parseNullableNumber(row.calories),
      proteinG: parseNullableNumber(row.protein_g),
      carbsG: parseNullableNumber(row.carbs_g),
      fatG: parseNullableNumber(row.fat_g),
      alcoholG: parseNullableNumber(row.alcohol_g),
      systemCalculatedCalories: parseNullableNumber(row.system_calculated_calories),
      isEnergyManuallySet: parseBoolean(row.is_energy_manually_set),
      quickAddName:
        row.entry_type === "quick_add"
          ? normalizeOptionalText(
              parseJsonObject(row.metadata)?.quickAddName as string | null,
            ) ?? normalizeOptionalText(row.display_name)
          : null,
    };
  };

  const shouldSkipDuplicate = (row: SupabaseUserFoodEntryRow) => {
    const key = buildFoodLogDuplicateKey(buildDuplicateShape(row));
    const availableMatches = remainingDestinationMatches.get(key) ?? 0;

    if (availableMatches <= 0) {
      return false;
    }

    remainingDestinationMatches.set(key, availableMatches - 1);
    skippedDuplicates += 1;
    return true;
  };

  const payload = sourceRows.map((row) => {
    const sourceTime =
      normalizeOptionalText(row.logged_at) ??
      normalizeOptionalText(row.created_at) ??
      new Date().toISOString();

    return {
      user_id: authUserId,
      entry_type: row.entry_type,
      food_item_id: row.food_item_id,
      custom_recipe_id: row.custom_recipe_id,
      custom_meal_id: row.custom_meal_id,
      date: toDate,
      logged_at: combineDateKeyWithTime(toDate, sourceTime),
      meal_type: row.meal_type,
      amount_value: row.amount_value ?? DEFAULT_LOG_AMOUNT,
      amount_unit: row.amount_unit ?? "g",
      resolved_quantity_g: row.resolved_quantity_g,
      display_name: row.display_name,
      calories: row.calories ?? 0,
      protein_g: row.protein_g ?? 0,
      carbs_g: row.carbs_g ?? 0,
      fat_g: row.fat_g ?? 0,
      alcohol_g: row.alcohol_g ?? 0,
      system_calculated_calories: row.system_calculated_calories,
      is_energy_manually_set: row.is_energy_manually_set ?? false,
      metadata: row.metadata ?? null,
    };
  });

  const rowsToInsert = payload.filter((_, index) => !shouldSkipDuplicate(sourceRows[index]));

  if (rowsToInsert.length > 0) {
    const insertResult = await supabase
      .from(SUPABASE_FOOD_ENTRIES_TABLE)
      .insert(rowsToInsert);
    if (insertResult.error) {
      throw insertResult.error;
    }

    copiedCount = rowsToInsert.length;
    await clearCompletedDiaryDayIfNeeded(authUserId, toDate);
  }

  return {
    sourceCount: sourceRows.length,
    destinationCount: destinationEntries.length,
    copiedCount,
    skippedDuplicates,
  };
};
