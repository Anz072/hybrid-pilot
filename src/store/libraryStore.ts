import { NouriApiError } from "../API/nouri/client";
import { toDbFoodItem, type ApiFood } from "../API/nouri/foodsApi";
import {
  createCatalogueFood,
  createMeal,
  createRecipe,
  deleteMeal,
  deleteRecipe,
  getFoodsByIds,
  getRecipeDetail,
  listFavoriteIds,
  listMeals,
  listRecents,
  listRecipes,
  setFavorite,
  updateMeal,
  updateRecipe,
} from "../API/nouri/libraryApi";
import { getFoodByRefRemote } from "./foodSearchStore";
import { getSupabaseSessionUser } from "../API/supabase/client";
import { shouldUseExpoGoDevLocalStore } from "../dev/expoGoDevAuth";
import {
  measureDiaryRequest,
  measureDiaryStep,
  recordDiaryCachePath,
  recordDiaryRows,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
import {
  getRecentCachedFoodItems,
  replaceCachedFavoriteFoodIds,
  touchCachedFoodItems,
  upsertCachedFoodItems,
} from "./cacheRepository";
import type {
  CreateUserCustomMealInput,
  CreateUserRecipeInput,
  DBFoodItem,
  DBRecipe,
  DBRecipeDetails,
  ListFoodItemsInput,
  SaveFoodItemInput,
  UpdateUserCustomMealInput,
  UpdateUserRecipeInput,
} from "./DB_TYPES";
import {
  addFoodItem as addFoodItemLocal,
  deleteFoodItem as deleteFoodItemLocal,
  getFavoriteFoodIds as getFavoriteFoodIdsLocal,
  getFavoriteFoodItems as getFavoriteFoodItemsLocal,
  getFoodItemById as getFoodItemByIdLocal,
  getFoodItemsByIds as getFoodItemsByIdsLocal,
  getRecentFoodItems as getRecentFoodItemsLocal,
  listFoodItems as listFoodItemsLocal,
  saveFoodItem as saveFoodItemLocal,
  setFoodItemFavorite as setFoodItemFavoriteLocal,
} from "./foodRepository";
import {
  createUserRecipe as createUserRecipeLocal,
  deleteUserRecipe as deleteUserRecipeLocal,
  getUserRecipeDetailsById as getUserRecipeDetailsByIdLocal,
  updateUserRecipe as updateUserRecipeLocal,
} from "./recipeRepository";

// Food library — favourites, recents, catalogue, recipes and custom meals —
// served by the Nouri API. Replaces supabaseFoodStore.ts.
//
// Recipes and custom meals come back as normalized Food objects carrying the
// synthetic negative ids the app already uses, so callers keep treating them as
// foods.

const SYNTHETIC_MEAL_OFFSET = 1_000_000_000;

const fromSyntheticRecipeId = (foodId: number) => Math.abs(foodId);
const fromSyntheticMealId = (foodId: number) => Math.abs(foodId) - SYNTHETIC_MEAL_OFFSET;
const isSyntheticMealId = (foodId: number) =>
  Number.isInteger(foodId) && Math.abs(foodId) >= SYNTHETIC_MEAL_OFFSET;

const resolveUserId = async (
  userExternalId?: string | null,
): Promise<string | null> => {
  if (await shouldUseExpoGoDevLocalStore(userExternalId)) {
    return null;
  }
  const sessionUser = await getSupabaseSessionUser();
  return sessionUser?.id ?? null;
};

const cacheFoods = async (foods: DBFoodItem[]): Promise<DBFoodItem[]> => {
  const persistable = foods.filter((food) => food.id !== 0);
  if (persistable.length > 0) {
    await upsertCachedFoodItems(persistable);
    await touchCachedFoodItems(persistable.map((food) => food.id));
  }
  return foods;
};

const mapFoods = (foods: ApiFood[]): DBFoodItem[] => foods.map(toDbFoodItem);

// --- Catalogue -------------------------------------------------------------

export const saveFoodItem = async (input: SaveFoodItemInput): Promise<number> => {
  const userId = await resolveUserId();
  if (!userId) {
    return saveFoodItemLocal(input);
  }

  const food = await createCatalogueFood({
    name: input.name,
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    // The catalogue's `source` CHECK does not include "recipe"; user recipes
    // live in their own table, so map that case to "custom" as before.
    source: input.source === "recipe" ? "custom" : input.source,
    nutritionBasis: input.nutritionBasis,
    servingSizeValue: input.servingSizeValue ?? null,
    servingSizeUnit: input.servingSizeUnit ?? null,
    quantityValue: input.quantityValue ?? null,
    quantityUnit: input.quantityUnit ?? null,
    calories: input.calories ?? null,
    proteinG: input.proteinG ?? null,
    carbsG: input.carbsG ?? null,
    fatG: input.fatG ?? null,
    alcoholG: input.alcoholG ?? null,
    isComplete: Boolean(input.isComplete),
  });

  await cacheFoods([toDbFoodItem(food)]);
  return food.id ?? 0;
};

export const addFoodItem = saveFoodItem;

export const getFoodItemById = async (id: number): Promise<DBFoodItem | null> => {
  const userId = await resolveUserId();
  if (!userId) {
    return getFoodItemByIdLocal(id);
  }

  const cached = await getFoodItemByIdLocal(id);
  if (cached) {
    void getFoodByRefRemote(id)
      .then((food) => (food ? cacheFoods([food]) : undefined))
      .catch(() => undefined);
    return cached;
  }

  const food = await getFoodByRefRemote(id);
  if (!food) return null;
  await cacheFoods([food]);
  return food;
};

export const getFoodItemsByIds = async (ids: number[]): Promise<DBFoodItem[]> => {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (unique.length === 0) return [];

  const userId = await resolveUserId();
  if (!userId) {
    return getFoodItemsByIdsLocal(unique);
  }

  const cached = await getFoodItemsByIdsLocal(unique);
  if (cached.length === unique.length) {
    // One batch request in the background rather than one per food.
    void getFoodsByIds(unique)
      .then(({ foods }) => cacheFoods(mapFoods(foods)))
      .catch(() => undefined);
    return cached;
  }

  const { foods } = await getFoodsByIds(unique);
  const mapped = mapFoods(foods);
  await cacheFoods(mapped);

  const byId = new Map([...cached, ...mapped].map((food) => [food.id, food]));
  return unique
    .map((id) => byId.get(id) ?? null)
    .filter((food): food is DBFoodItem => food != null);
};

export const deleteFoodItem = async (foodId: number): Promise<void> => {
  const userId = await resolveUserId();
  if (!userId) {
    return deleteFoodItemLocal(foodId);
  }
  // Unchanged behaviour: the shared catalogue is insert-only. This is now also
  // enforced by GRANT, not just by the absence of an RLS policy.
  throw new Error("Shared catalogue items are read-only in the app.");
};

export const listFoodItems = async ({
  query,
  limit = 120,
  source = null,
}: ListFoodItemsInput = {}): Promise<DBFoodItem[]> => {
  const userId = await resolveUserId();
  if (!userId) {
    return listFoodItemsLocal({ query, limit, source });
  }

  // The two "list" sources the app uses are the user's own recipes and meals;
  // both have dedicated endpoints now.
  if (source === "recipe") {
    const { foods } = await listRecipes(limit);
    return cacheFoods(mapFoods(foods));
  }
  if (source === "custom_meal") {
    const { foods } = await listMeals(limit);
    return cacheFoods(mapFoods(foods));
  }

  const { foods } = await listRecents(limit);
  return cacheFoods(mapFoods(foods));
};

// --- Favourites ------------------------------------------------------------

export const setFoodItemFavorite = async (
  userExternalId: string,
  foodId: number,
  isFavorite: boolean,
): Promise<void> => {
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return setFoodItemFavoriteLocal(userExternalId, foodId, isFavorite);
  }
  if (foodId < 0) {
    // Recipes and custom meals are not favouritable; the table references
    // food_items only.
    return;
  }

  await setFoodItemFavoriteLocal(userExternalId, foodId, isFavorite);
  await setFavorite(foodId, isFavorite);
};

export const getFavoriteFoodIds = async (
  userExternalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<number[]> => {
  const userId = await measureDiaryStep(perfTrace, "favorites.resolve-session", () =>
    resolveUserId(userExternalId),
  );
  if (!userId) {
    return getFavoriteFoodIdsLocal(userExternalId);
  }

  const cached = await measureDiaryRequest(perfTrace, "favorite-ids", "sqlite", () =>
    getFavoriteFoodIdsLocal(userExternalId),
  );

  const refresh = async () => {
    const { foodIds } = await listFavoriteIds();
    await replaceCachedFavoriteFoodIds(userExternalId, foodIds);
    return foodIds;
  };

  if (cached.length > 0) {
    recordDiaryCachePath(perfTrace, "favorites", "sqlite-nonempty-hit");
    void refresh().catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "favorites", "empty-or-unknown");
  return refresh();
};

export const getFavoriteFoodItems = async (
  userExternalId: string,
  limit = 30,
  perfTrace?: DiaryPerfTrace,
): Promise<DBFoodItem[]> => {
  const userId = await measureDiaryStep(perfTrace, "favorites.resolve-session", () =>
    resolveUserId(userExternalId),
  );
  if (!userId) {
    return getFavoriteFoodItemsLocal(userExternalId, limit);
  }

  const cached = await measureDiaryRequest(perfTrace, "favorite-foods", "sqlite", () =>
    getFavoriteFoodItemsLocal(userExternalId, limit),
  );

  // Two requests total (ids, then a single batch hydrate) rather than one per
  // favourite.
  const refresh = async () => {
    const { foodIds } = await listFavoriteIds();
    await replaceCachedFavoriteFoodIds(userExternalId, foodIds);
    const limited = foodIds.slice(0, limit);
    if (limited.length === 0) return [];
    const { foods } = await getFoodsByIds(limited);
    const mapped = mapFoods(foods);
    await cacheFoods(mapped);
    const byId = new Map(mapped.map((food) => [food.id, food]));
    return limited
      .map((id) => byId.get(id) ?? null)
      .filter((food): food is DBFoodItem => food != null);
  };

  if (cached.length > 0) {
    recordDiaryCachePath(perfTrace, "favorite-foods", "sqlite-nonempty-hit");
    recordDiaryRows(perfTrace, "favorite-foods", cached.length);
    void refresh().catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "favorite-foods", "empty-or-unknown");
  const foods = await refresh();
  recordDiaryRows(perfTrace, "favorite-foods", foods.length);
  return foods;
};

// --- Recents ---------------------------------------------------------------

export const getRecentFoodItems = async (
  userExternalId: string,
  limit = 20,
  perfTrace?: DiaryPerfTrace,
): Promise<DBFoodItem[]> => {
  const userId = await measureDiaryStep(perfTrace, "recents.resolve-session", () =>
    resolveUserId(userExternalId),
  );
  if (!userId) {
    return getRecentFoodItemsLocal(userExternalId, limit);
  }

  const cached = await measureDiaryRequest(perfTrace, "recent-foods", "sqlite", () =>
    getRecentCachedFoodItems(userExternalId, limit),
  );

  // ONE request. This path used to be up to ~36 sequential Supabase queries.
  const refresh = async (source: "supabase" | "background-supabase") => {
    const { foods } = await measureDiaryRequest(perfTrace, "recent-foods", source, () =>
      listRecents(limit),
    );
    return cacheFoods(mapFoods(foods));
  };

  if (cached.length > 0) {
    recordDiaryCachePath(perfTrace, "recent-foods", "sqlite-nonempty-hit");
    recordDiaryRows(perfTrace, "recent-foods", cached.length);
    void refresh("background-supabase").catch(() => undefined);
    return cached;
  }

  recordDiaryCachePath(perfTrace, "recent-foods", "empty-or-unknown");
  const foods = await refresh("supabase");
  recordDiaryRows(perfTrace, "recent-foods", foods.length);
  return foods;
};

// --- Recipes ---------------------------------------------------------------

export const listUserCreatedRecipeFoods = async (
  userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => {
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return listFoodItemsLocal({ source: "recipe", limit });
  }
  const { foods } = await listRecipes(limit);
  return cacheFoods(mapFoods(foods));
};

const toRecipeBody = (
  input: CreateUserRecipeInput | UpdateUserRecipeInput,
): Record<string, unknown> => ({
  name: input.name,
  description: input.description ?? null,
  linkUrl: input.linkUrl ?? null,
  prepTimeMin: input.prepTimeMin ?? null,
  cookTimeMin: input.cookTimeMin ?? null,
  servings: input.servings,
  steps: input.steps ?? [],
  isPublic: input.isPublic ?? true,
  ingredients: input.ingredients.map((ingredient) => ({
    foodItemId: ingredient.foodId,
    amountValue: ingredient.amount,
    amountUnit: ingredient.food.servingSizeUnit ?? "g",
  })),
});

export const createUserRecipe = async (
  input: CreateUserRecipeInput,
): Promise<DBRecipe> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return createUserRecipeLocal(input);
  }

  const food = await createRecipe(toRecipeBody(input));
  await cacheFoods([toDbFoodItem(food)]);

  return {
    id: fromSyntheticRecipeId(food.id ?? 0),
    createdByUserExternalId: input.userExternalId,
    name: food.name,
    description: input.description ?? null,
    linkUrl: input.linkUrl ?? null,
    prepTimeMin: input.prepTimeMin ?? null,
    cookTimeMin: input.cookTimeMin ?? null,
    servings: input.servings,
    steps: input.steps ?? [],
    isPublic: input.isPublic ?? true,
    linkedFoodId: food.id ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as DBRecipe;
};

export const getUserRecipeDetailsById = async (
  recipeId: number,
): Promise<DBRecipeDetails | null> => {
  const userId = await resolveUserId();
  if (!userId) {
    return getUserRecipeDetailsByIdLocal(recipeId);
  }

  try {
    // Recipe, ingredients and each ingredient's food arrive together.
    const detail = await getRecipeDetail(fromSyntheticRecipeId(recipeId));
    return detail as unknown as DBRecipeDetails;
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
};

export const updateUserRecipe = async (
  input: UpdateUserRecipeInput,
): Promise<DBRecipe> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    return updateUserRecipeLocal(input);
  }

  const food = await updateRecipe(
    fromSyntheticRecipeId(input.recipeId),
    toRecipeBody(input),
  );
  await cacheFoods([toDbFoodItem(food)]);

  return {
    id: fromSyntheticRecipeId(food.id ?? 0),
    createdByUserExternalId: input.userExternalId,
    name: food.name,
    servings: input.servings,
    steps: input.steps ?? [],
    isPublic: input.isPublic ?? true,
    linkedFoodId: food.id ?? 0,
  } as DBRecipe;
};

export const deleteUserRecipe = async (recipeId: number): Promise<void> => {
  const userId = await resolveUserId();
  if (!userId) {
    return deleteUserRecipeLocal(recipeId);
  }

  try {
    await deleteRecipe(fromSyntheticRecipeId(recipeId));
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      throw new Error("Recipe could not be found.");
    }
    throw error;
  }
};

// --- Custom meals ----------------------------------------------------------

export const listUserCreatedCustomMealFoods = async (
  userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => {
  const userId = await resolveUserId(userExternalId);
  if (!userId) {
    return listFoodItemsLocal({ source: "recipe", limit });
  }
  const { foods } = await listMeals(limit);
  return cacheFoods(mapFoods(foods));
};

export const getUserCustomMealFoodById = async (
  mealId: number,
): Promise<DBFoodItem | null> => {
  const userId = await resolveUserId();
  if (!userId) {
    return getFoodItemByIdLocal(mealId);
  }
  return getFoodByRefRemote(mealId);
};

const toMealBody = (
  input: CreateUserCustomMealInput | UpdateUserCustomMealInput,
): Record<string, unknown> => ({
  name: input.name,
  description: input.description ?? null,
  servingSizeG: input.servingSizeG,
  calories: input.calories,
  proteinG: input.proteinG ?? 0,
  carbsG: input.carbsG ?? 0,
  fatG: input.fatG ?? 0,
  isPublic: input.isPublic ?? true,
});

export const createUserCustomMeal = async (
  input: CreateUserCustomMealInput,
): Promise<DBFoodItem> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    const foodId = await saveFoodItemLocal({
      source: "recipe", sourceId: null, barcode: null, name: input.name,
      brand: null, imageUrl: null, quantityValue: input.servingSizeG,
      quantityUnit: "g", servingSizeValue: input.servingSizeG,
      servingSizeUnit: "g", nutritionBasis: "serving", calories: input.calories,
      proteinG: input.proteinG ?? 0, carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0, ingredientsText: input.description ?? null,
      rawPayload: JSON.stringify({ entityType: "custom_meal" }),
      verified: false, isComplete: true, isPublic: input.isPublic ?? true,
    });
    const food = await getFoodItemByIdLocal(foodId);
    if (!food) throw new Error("Custom meal could not be saved.");
    return food;
  }

  const food = await createMeal(toMealBody(input));
  const mapped = toDbFoodItem(food);
  await cacheFoods([mapped]);
  return mapped;
};

export const updateUserCustomMeal = async (
  input: UpdateUserCustomMealInput,
): Promise<DBFoodItem> => {
  const userId = await resolveUserId(input.userExternalId);
  if (!userId) {
    const food = await getFoodItemByIdLocal(input.mealId);
    if (!food) throw new Error("Custom meal could not be found.");
    return food;
  }

  const food = await updateMeal(fromSyntheticMealId(input.mealId), toMealBody(input));
  const mapped = toDbFoodItem(food);
  await cacheFoods([mapped]);
  return mapped;
};

export const deleteUserCustomMeal = async (mealId: number): Promise<void> => {
  const userId = await resolveUserId();
  if (!userId) {
    return deleteFoodItemLocal(mealId);
  }

  const rawId = isSyntheticMealId(mealId) ? fromSyntheticMealId(mealId) : mealId;
  try {
    await deleteMeal(rawId);
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      throw new Error("Custom meal could not be found.");
    }
    throw error;
  }
};

// Kept for the Expo Go local path only.
export { addFoodItemLocal };
