import type { DBFoodItem, FoodSource, NutritionBasis } from "../../store/DB_TYPES";
import { apiRequest } from "./client";

// Food search transport.
//
// The backend merges the shared catalogue, the user's own and public
// recipes/meals, and USDA into one normalized shape. The app no longer knows or
// cares which upstream answered, and no external API key ships in the bundle.

export type ApiFood = {
  id: number | null;
  ref: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string | null;
  source: FoodSource;
  providerLabel: string;
  nutritionBasis: NutritionBasis;
  servingSizeValue: number | null;
  servingSizeUnit: string | null;
  quantityValue: number | null;
  quantityUnit: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  alcoholG: number | null;
  verified: boolean;
  isComplete: boolean;
  isOwn: boolean;
};

export type ApiFoodSearchResponse = {
  query: string;
  results: ApiFood[];
  // Upstreams that failed. Results are still usable; the UI may note that
  // external results are temporarily missing.
  degradedProviders: string[];
};

// Maps the API shape onto the app's DBFoodItem. Nutrient detail columns are not
// carried by search results, so they stay null — the same as before, where
// search results were SaveFoodItemInput rather than full rows.
export const toDbFoodItem = (food: ApiFood): DBFoodItem =>
  ({
    id: food.id ?? 0,
    source: food.source,
    sourceId: food.ref.includes(":") ? food.ref.split(":")[1] ?? null : null,
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    imageUrl: food.imageUrl,
    quantityValue: food.quantityValue,
    quantityUnit: food.quantityUnit,
    servingSizeValue: food.servingSizeValue,
    servingSizeUnit: food.servingSizeUnit,
    nutritionBasis: food.nutritionBasis,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    alcoholG: food.alcoholG,
    ingredientsText: null,
    rawPayload: null,
    verified: food.verified,
    isComplete: food.isComplete,
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as DBFoodItem;

export const searchFoods = (
  query: string,
  limit = 30,
): Promise<ApiFoodSearchResponse> =>
  apiRequest<ApiFoodSearchResponse>("/v1/foods/search", {
    query: { q: query, limit },
  });

export const getFoodByRef = (ref: string | number): Promise<ApiFood> =>
  apiRequest<ApiFood>(`/v1/foods/${ref}`);

export const getFoodByBarcode = (
  barcode: string,
): Promise<{ food: ApiFood; source: "catalogue" | "open_food_facts" }> =>
  apiRequest(`/v1/foods/barcode/${barcode}`);
