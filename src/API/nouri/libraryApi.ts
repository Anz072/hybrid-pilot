import { apiRequest } from "./client";
import type { ApiFood } from "./foodsApi";

// Favourites, recents, recipes and custom meals.
//
// Recipes and custom meals come back as normalized Food objects (with the
// synthetic negative ids the app already uses), so they are directly loggable
// through the diary endpoints without special-casing.

export const listFavoriteIds = (): Promise<{ foodIds: number[] }> =>
  apiRequest("/v1/library/favorites");

export const setFavorite = (
  foodId: number,
  isFavorite: boolean,
): Promise<{ foodId: number; isFavorite: boolean }> =>
  apiRequest(`/v1/library/favorites/${foodId}`, {
    method: "PUT",
    body: { isFavorite },
  });

export const listRecents = (limit = 20): Promise<{ foods: ApiFood[] }> =>
  apiRequest("/v1/library/recents", { query: { limit } });

export const listRecipes = (limit = 200): Promise<{ foods: ApiFood[] }> =>
  apiRequest("/v1/library/recipes", { query: { limit } });

/**
 * Recipe, ingredients and each ingredient's food, in one round trip.
 *
 * Typed, not `Record<string, unknown>`. The loose type let the screen cast the
 * payload to `DBRecipeDetails` and read camelCase fields off an object the API
 * was sending in snake_case — so opening a recipe to edit it silently emptied
 * its prepared weight, prep and cook times, link, description and visibility,
 * and saving wrote the emptiness back. The API now returns this shape and
 * validates it on the way out.
 */
export type ApiRecipeDetail = {
  recipe: {
    id: number;
    createdByUserExternalId: string;
    linkedFoodId: number;
    isPublic: boolean;
    name: string;
    description: string | null;
    linkUrl: string | null;
    prepTimeMin: number | null;
    cookTimeMin: number | null;
    servings: number;
    steps: string[];
    ingredientTotalWeightG: number | null;
    preparedFoodWeightG: number | null;
    effectiveRecipeWeightG: number | null;
    gramsPerServing: number | null;
    caloriesPerServing: number | null;
    proteinGPerServing: number | null;
    carbsGPerServing: number | null;
    fatGPerServing: number | null;
    createdAt: string;
    updatedAt: string;
  };
  ingredients: Array<{
    id: number;
    recipeId: number;
    foodId: number;
    amount: number;
    amountUnit: string | null;
    sortOrder: number;
    food: ApiFood | null;
  }>;
};

export const getRecipeDetail = (recipeId: number): Promise<ApiRecipeDetail> =>
  apiRequest<ApiRecipeDetail>(`/v1/library/recipes/${recipeId}`);

export const createRecipe = (body: Record<string, unknown>): Promise<ApiFood> =>
  apiRequest<ApiFood>("/v1/library/recipes", { method: "POST", body });

export const updateRecipe = (
  recipeId: number,
  body: Record<string, unknown>,
): Promise<ApiFood> =>
  apiRequest<ApiFood>(`/v1/library/recipes/${recipeId}`, { method: "PUT", body });

export const deleteRecipe = (recipeId: number): Promise<{ deleted: true }> =>
  apiRequest(`/v1/library/recipes/${recipeId}`, { method: "DELETE" });

export const listMeals = (limit = 200): Promise<{ foods: ApiFood[] }> =>
  apiRequest("/v1/library/meals", { query: { limit } });

export const createMeal = (body: Record<string, unknown>): Promise<ApiFood> =>
  apiRequest<ApiFood>("/v1/library/meals", { method: "POST", body });

export const updateMeal = (
  mealId: number,
  body: Record<string, unknown>,
): Promise<ApiFood> =>
  apiRequest<ApiFood>(`/v1/library/meals/${mealId}`, { method: "PUT", body });

export const deleteMeal = (mealId: number): Promise<{ deleted: true }> =>
  apiRequest(`/v1/library/meals/${mealId}`, { method: "DELETE" });

export const getFoodsByIds = (ids: number[]): Promise<{ foods: ApiFood[] }> =>
  apiRequest("/v1/foods", { query: { ids: ids.join(",") } });

export const createCatalogueFood = (
  body: Record<string, unknown>,
): Promise<ApiFood> => apiRequest<ApiFood>("/v1/foods", { method: "POST", body });
