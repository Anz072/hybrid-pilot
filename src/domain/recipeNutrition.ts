import {
  getFoodResolvedServing,
  getQuantityScaleFactor,
  roundNutrient,
  type FoodMacroFields,
} from "../engine/nutrition";

/**
 * A recipe's weight and per-serving nutrition, derived from its ingredients.
 *
 * The app computes this to show a live preview while the recipe is being
 * edited — grams per serving, calories per serving, the macro split — before
 * anything is saved.
 *
 * It is NOT what gets stored, and it is not sent. `nouri-api` derives the same
 * values from the ingredients it holds and persists its own answer.
 *
 * The reason is that the value is copied, not referenced: logging a recipe
 * reads `calories_per_serving` once and writes it into the diary entry, which
 * keeps it. A wrong value is not a display glitch a later edit repairs — it is
 * already in every entry logged while it was wrong. The two implementations are held equal by the `computeRecipeNutrition`
 * suite in the shared conformance corpus — see
 * docs/architecture/domain-conformance.md.
 */

export type RecipeIngredientFood = FoodMacroFields;

export type RecipeIngredientForNutrition = {
  amountValue: number;
  food: RecipeIngredientFood;
};

export type RecipeNutrition = {
  /** Sum of the ingredient amounts, in grams. Null when there are none. */
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
};

const positiveOrNull = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null;

export const computeRecipeNutrition = (input: {
  ingredients: readonly RecipeIngredientForNutrition[];
  servings: number;
  preparedFoodWeightG?: number | null;
}): RecipeNutrition => {
  // Servings divides everything below. A recipe claiming zero or a fraction of
  // a serving is a data-entry mistake, not an instruction to divide by zero.
  const servings =
    Number.isFinite(input.servings) && input.servings > 0 ? input.servings : 1;

  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, weightG: 0 };

  for (const ingredient of input.ingredients) {
    const amount = Number.isFinite(ingredient.amountValue) ? ingredient.amountValue : 0;
    if (amount <= 0) continue;

    // The same two primitives the diary uses to scale a logged food, so a
    // recipe's serving and a directly logged portion of the same food agree.
    const serving = getFoodResolvedServing(ingredient.food);
    const factor = getQuantityScaleFactor(amount, serving.value);

    totals.calories += (ingredient.food.calories ?? 0) * factor;
    totals.proteinG += (ingredient.food.proteinG ?? 0) * factor;
    totals.carbsG += (ingredient.food.carbsG ?? 0) * factor;
    totals.fatG += (ingredient.food.fatG ?? 0) * factor;
    totals.weightG += amount;
  }

  const ingredientTotalWeightG = positiveOrNull(totals.weightG);
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
};
