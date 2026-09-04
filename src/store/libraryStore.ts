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
// Recipes and custom meals come back as normalized Food objects carrying the
// synthetic negative ids the app already uses, so callers keep treating them as
// foods. The encoding is shared with the backend and pinned by the conformance
// corpus; see src/domain/syntheticFoodIds.ts.
import {
  fromSyntheticMealFoodId as fromSyntheticMealId,
  fromSyntheticRecipeFoodId as fromSyntheticRecipeId,
  isSyntheticMealFoodId as isSyntheticMealId,
} from "../domain/syntheticFoodIds";
import {
  measureDiaryRequest,
  recordDiaryRows,
  type DiaryPerfTrace,
} from "../performance/diaryPerformance";
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

// The user's food library — catalogue, favourites, recents, recipes and custom
// meals — served by the Nouri API.
//
// Nothing here is stored on the device. Favourites and recents in particular
// used to be written locally and reconciled later; they are now simply whatever
// the server says, which is the only way the two can agree by construction.

const mapFoods = (foods: ApiFood[]): DBFoodItem[] => foods.map(toDbFoodItem);

// --- Catalogue -------------------------------------------------------------

export const saveFoodItem = async (input: SaveFoodItemInput): Promise<number> => {
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
  return food.id ?? 0;
};

export const addFoodItem = saveFoodItem;

export const getFoodItemById = async (id: number): Promise<DBFoodItem | null> =>
  getFoodByRefRemote(id);

export const getFoodItemsByIds = async (ids: number[]): Promise<DBFoodItem[]> => {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (unique.length === 0) return [];
  const { foods } = await getFoodsByIds(unique);
  return mapFoods(foods);
};

export const deleteFoodItem = async (_foodId: number): Promise<void> => {
  // Unchanged behaviour: the shared catalogue is insert-only. This is now also
  // enforced by GRANT, not just by the absence of an RLS policy.
  throw new Error("Shared catalogue items are read-only in the app.");
};

export const listFoodItems = async ({
  limit = 120,
  source = null,
}: ListFoodItemsInput = {}): Promise<DBFoodItem[]> => {
  // The two "list" sources the app uses are the user's own recipes and meals;
  // both have dedicated endpoints.
  if (source === "recipe") return mapFoods((await listRecipes(limit)).foods);
  if (source === "custom_meal") return mapFoods((await listMeals(limit)).foods);
  return mapFoods((await listRecents(limit)).foods);
};

// --- Favourites ------------------------------------------------------------

export const setFoodItemFavorite = async (
  _userExternalId: string,
  foodId: number,
  isFavorite: boolean,
): Promise<void> => {
  if (foodId < 0) {
    // Recipes and custom meals are not favouritable; the table references
    // food_items only.
    return;
  }
  await setFavorite(foodId, isFavorite);
};

export const getFavoriteFoodIds = async (
  _userExternalId: string,
  perfTrace?: DiaryPerfTrace,
): Promise<number[]> => {
  const { foodIds } = await measureDiaryRequest(perfTrace, "favorite-ids", "node-api", () =>
    listFavoriteIds(),
  );
  return foodIds;
};

export const getFavoriteFoodItems = async (
  _userExternalId: string,
  limit = 30,
  perfTrace?: DiaryPerfTrace,
): Promise<DBFoodItem[]> => {
  // Two requests: the ids, then a single batch hydrate — not one per favourite.
  const { foodIds } = await measureDiaryRequest(perfTrace, "favorite-ids", "node-api", () =>
    listFavoriteIds(),
  );
  const limited = foodIds.slice(0, limit);
  if (limited.length === 0) return [];

  const { foods } = await measureDiaryRequest(perfTrace, "favorite-foods", "node-api", () =>
    getFoodsByIds(limited),
  );
  const byId = new Map(mapFoods(foods).map((food) => [food.id, food]));
  const ordered = limited
    .map((id) => byId.get(id) ?? null)
    .filter((food): food is DBFoodItem => food != null);
  recordDiaryRows(perfTrace, "favorite-foods", ordered.length);
  return ordered;
};

// --- Recents ---------------------------------------------------------------

export const getRecentFoodItems = async (
  _userExternalId: string,
  limit = 20,
  perfTrace?: DiaryPerfTrace,
): Promise<DBFoodItem[]> => {
  // ONE request. This path used to be up to ~36 sequential Supabase queries.
  const { foods } = await measureDiaryRequest(perfTrace, "recent-foods", "node-api", () =>
    listRecents(limit),
  );
  const mapped = mapFoods(foods);
  recordDiaryRows(perfTrace, "recent-foods", mapped.length);
  return mapped;
};

// --- Recipes ---------------------------------------------------------------

export const listUserCreatedRecipeFoods = async (
  _userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => mapFoods((await listRecipes(limit)).foods);

const toRecipeBody = (
  input: CreateUserRecipeInput | UpdateUserRecipeInput,
): Record<string, unknown> => ({
  name: input.name,
  description: input.description ?? null,
  linkUrl: input.linkUrl ?? null,
  prepTimeMin: input.prepTimeMin ?? null,
  cookTimeMin: input.cookTimeMin ?? null,
  servings: input.servings,
  // The user's measurement of the finished dish. It was accepted by the editor
  // and held in the input type, but never put in the request body — so a stew
  // weighed after cooking was portioned by its raw ingredient weight instead.
  // Nothing on the server can derive this, so it has to be sent.
  preparedFoodWeightG: input.preparedFoodWeightG ?? null,
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
  const food = await createRecipe(toRecipeBody(input));
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
  userExternalId = "",
): Promise<DBRecipeDetails | null> => {
  try {
    // Recipe, ingredients and each ingredient's food arrive together.
    const { recipe, ingredients } = await getRecipeDetail(
      fromSyntheticRecipeId(recipeId),
    );

    // Mapped field by field. This was `detail as unknown as DBRecipeDetails`,
    // which compiled and was wrong: every name differed from what the API
    // actually sent, so the editor loaded a recipe with its prepared weight,
    // times, link, description and visibility all blank.
    return {
      id: recipe.id,
      userExternalId,
      createdByUserExternalId: recipe.createdByUserExternalId,
      linkedFoodId: recipe.linkedFoodId,
      isPublic: recipe.isPublic,
      // The server has no column for this: it is a client-side entry mode, and
      // always was. Derived from what the recipe actually holds rather than
      // invented, so reopening a linked recipe reopens it in link mode.
      buildMethod: recipe.linkUrl ? "link" : "scratch",
      name: recipe.name,
      description: recipe.description,
      linkUrl: recipe.linkUrl,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      servings: recipe.servings,
      steps: recipe.steps,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredientTotalWeightG: recipe.ingredientTotalWeightG,
      preparedFoodWeightG: recipe.preparedFoodWeightG,
      effectiveRecipeWeightG: recipe.effectiveRecipeWeightG,
      gramsPerServing: recipe.gramsPerServing,
      ingredients: ingredients.flatMap((ingredient) =>
        ingredient.food
          ? [
              {
                id: ingredient.id,
                recipeId: ingredient.recipeId,
                foodId: ingredient.foodId,
                amount: ingredient.amount,
                amountUnit: ingredient.amountUnit,
                sortOrder: ingredient.sortOrder,
                createdAt: recipe.createdAt,
                food: toDbFoodItem(ingredient.food),
              },
            ]
          : [],
      ),
    };
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};

export const updateUserRecipe = async (
  input: UpdateUserRecipeInput,
): Promise<DBRecipe> => {
  const food = await updateRecipe(
    fromSyntheticRecipeId(input.recipeId),
    toRecipeBody(input),
  );
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
  _userExternalId: string,
  limit = 200,
): Promise<DBFoodItem[]> => mapFoods((await listMeals(limit)).foods);

export const getUserCustomMealFoodById = async (
  mealId: number,
): Promise<DBFoodItem | null> => getFoodByRefRemote(mealId);

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
): Promise<DBFoodItem> => toDbFoodItem(await createMeal(toMealBody(input)));

export const updateUserCustomMeal = async (
  input: UpdateUserCustomMealInput,
): Promise<DBFoodItem> =>
  toDbFoodItem(await updateMeal(fromSyntheticMealId(input.mealId), toMealBody(input)));

export const deleteUserCustomMeal = async (mealId: number): Promise<void> => {
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
