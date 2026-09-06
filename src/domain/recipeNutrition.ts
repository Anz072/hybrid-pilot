import {
  getFoodResolvedServing,
  getQuantityScaleFactor,
  roundNutrient,
  type FoodMacroFields,
} from "../engine/nutrition";

/**
 * Recipe nutrition for the mobile preview. The API derives the stored values
 * independently; the shared corpus keeps both calculations in agreement.
 * Gram weights require mass information, while volume and servings can still
 * contribute macros. A measured prepared weight can establish effective mass.
 */
export type RecipeIngredientFood = FoodMacroFields;

export interface RecipeIngredientForNutrition {
  amountValue: number;
  amountUnit?: string | null | undefined;
  food: FoodMacroFields;
}

export interface RecipeNutrition {
  /** Sum of known gram weights. Null when any positive ingredient has unknown mass. */
  ingredientTotalWeightG: number | null;
  /** Cooked/plated weight when the user supplied one, else null. */
  preparedFoodWeightG: number | null;
  /** The weight a serving is cut from: prepared weight if given, else the ingredient total. */
  effectiveRecipeWeightG: number | null;
  gramsPerServing: number | null;
  caloriesPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
}

const positiveOrNull = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null;

/** Quantities must match the food's nutrition units; volume/count never implies mass. */
export function resolveRecipeIngredientAmount(ingredient: RecipeIngredientForNutrition): { amount: number; grams: number | null } | null {
  const serving = getFoodResolvedServing(ingredient.food);
  const normalize = (unit: string): { unit: string; factor: number } => {
    const value = unit.trim().toLowerCase();
    if (value === "kg") return { unit: "g", factor: 1000 };
    if (value === "l") return { unit: "ml", factor: 1000 };
    return { unit: value, factor: 1 };
  };
  const target = normalize(serving.unit);
  const supplied = normalize(ingredient.amountUnit?.trim() || serving.unit);
  if (target.unit !== supplied.unit) return null;
  const quantity = ingredient.amountValue * supplied.factor;
  return { amount: quantity / target.factor, grams: supplied.unit === "g" ? quantity : null };
}

export function computeRecipeNutrition(input: {
  ingredients: readonly RecipeIngredientForNutrition[];
  servings: number;
  preparedFoodWeightG?: number | null;
}): RecipeNutrition {
  // Servings divides everything below. A recipe claiming zero or a fraction of
  // a serving is a data-entry mistake, not an instruction to divide by zero.
  const servings =
    Number.isFinite(input.servings) && input.servings > 0 ? input.servings : 1;

  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, weightG: 0 };

  let knownWeight = true;
  for (const ingredient of input.ingredients) {
    if (!Number.isFinite(ingredient.amountValue) || ingredient.amountValue <= 0) continue;
    const resolved = resolveRecipeIngredientAmount(ingredient);
    if (!resolved) throw new RangeError("Ingredient quantity unit must match the food nutrition unit.");
    const amount = resolved.amount;

    // The same two primitives the diary uses to scale a logged food, so a
    // recipe's serving and a directly logged portion of the same food agree.
    // Both are pinned by the shared conformance corpus.
    const serving = getFoodResolvedServing(ingredient.food);
    const factor = getQuantityScaleFactor(amount, serving.value);

    totals.calories += (ingredient.food.calories ?? 0) * factor;
    totals.proteinG += (ingredient.food.proteinG ?? 0) * factor;
    totals.carbsG += (ingredient.food.carbsG ?? 0) * factor;
    totals.fatG += (ingredient.food.fatG ?? 0) * factor;
    if (resolved.grams === null) knownWeight = false;
    else totals.weightG += resolved.grams;
  }

  const ingredientTotalWeightG = knownWeight ? positiveOrNull(totals.weightG) : null;
  const preparedFoodWeightG = positiveOrNull(input.preparedFoodWeightG);
  // A prepared weight wins when given: a stew loses water, so its plated weight
  // is the one a serving is actually cut from. The macros do not change — only
  // how many grams a serving is.
  const effectiveRecipeWeightG = preparedFoodWeightG ?? ingredientTotalWeightG;

  const hasIngredients = input.ingredients.some(
    (i) => Number.isFinite(i.amountValue) && i.amountValue > 0,
  );

  return {
    ingredientTotalWeightG,
    preparedFoodWeightG,
    effectiveRecipeWeightG,
    gramsPerServing:
      effectiveRecipeWeightG == null
        ? null
        : roundNutrient(effectiveRecipeWeightG / servings),
    // A recipe with no ingredients has no nutrition — not zero. Zero is a
    // claim; null says the recipe does not carry the information yet, which is
    // what a shell of a recipe actually is.
    caloriesPerServing: hasIngredients ? roundNutrient(totals.calories / servings, 0) : null,
    proteinGPerServing: hasIngredients ? roundNutrient(totals.proteinG / servings) : null,
    carbsGPerServing: hasIngredients ? roundNutrient(totals.carbsG / servings) : null,
    fatGPerServing: hasIngredients ? roundNutrient(totals.fatG / servings) : null,
  };
}
