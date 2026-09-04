/**
 * Synthetic food ids.
 *
 * The app presents user-created recipes and custom meals in the same lists as
 * catalogue foods, so it maps them into the food-id space using NEGATIVE ids:
 *
 *   recipe  id R  ->  -R
 *   meal    id M  ->  -(1_000_000_000 + M)
 *
 * The sign is what distinguishes a synthetic id from a real `food_items.id`.
 * The magnitude only says which of the two kinds it is.
 *
 * This mirrors `nouri-api/src/domain/syntheticFoodIds.ts` exactly, and the two
 * are held together by the `decodeFoodId` suite in the shared conformance
 * corpus — see docs/architecture/domain-conformance.md.
 *
 * The encoding is persisted inside `user_food_entries.metadata.syntheticFoodId`,
 * so it is load-bearing for existing rows and cannot be changed.
 */

export const SYNTHETIC_MEAL_FOOD_ID_OFFSET = 1_000_000_000;

export const toSyntheticRecipeFoodId = (recipeId: number): number => -Math.abs(recipeId);
export const fromSyntheticRecipeFoodId = (foodId: number): number => Math.abs(foodId);
export const isSyntheticRecipeFoodId = (foodId: number): boolean =>
  Number.isInteger(foodId) && foodId < 0 && Math.abs(foodId) < SYNTHETIC_MEAL_FOOD_ID_OFFSET;

export const toSyntheticMealFoodId = (mealId: number): number =>
  -(SYNTHETIC_MEAL_FOOD_ID_OFFSET + Math.abs(mealId));
export const fromSyntheticMealFoodId = (foodId: number): number =>
  Math.abs(foodId) - SYNTHETIC_MEAL_FOOD_ID_OFFSET;
export const isSyntheticMealFoodId = (foodId: number): boolean =>
  Number.isInteger(foodId) && foodId < 0 && Math.abs(foodId) >= SYNTHETIC_MEAL_FOOD_ID_OFFSET;

export type FoodRefKind = "food_item" | "custom_recipe" | "custom_meal";

export interface FoodRef {
  kind: FoodRefKind;
  /** The underlying table id (always positive). */
  id: number;
  /** The id as the app addresses it, including synthetic encoding. */
  foodId: number;
}

export function decodeFoodId(foodId: number): FoodRef {
  if (isSyntheticMealFoodId(foodId)) {
    return { kind: "custom_meal", id: fromSyntheticMealFoodId(foodId), foodId };
  }
  if (isSyntheticRecipeFoodId(foodId)) {
    return { kind: "custom_recipe", id: fromSyntheticRecipeFoodId(foodId), foodId };
  }
  return { kind: "food_item", id: foodId, foodId };
}
