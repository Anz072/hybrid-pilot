import type { NutritionBasis, SaveFoodItemInput } from "../../store/DB_TYPES";

export const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

export const toSafeNumber = (value: string): number => {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Empty optional fields stay null; anything typed must parse to a
// non-negative number, signalled by NaN otherwise.
export const parseOptionalNutrient = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
};

export type CustomFoodItemDraft = {
  name: string;
  brand: string;
  barcode: string | null;
  basis: NutritionBasis;
  servingValue: string;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiber: string;
  sugar: string;
  saturatedFat: string;
  salt: string;
};

export type CustomFoodItemBuildResult =
  | { input: SaveFoodItemInput; error?: undefined }
  | { input?: undefined; error: string };

export const buildCustomFoodItemInput = (
  draft: CustomFoodItemDraft,
): CustomFoodItemBuildResult => {
  const trimmedName = draft.name.trim();
  if (!trimmedName) {
    return { error: "Enter a food name first." };
  }

  if (
    !Number.isFinite(draft.calories) ||
    draft.calories <= 0 ||
    [draft.proteinG, draft.carbsG, draft.fatG].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    return {
      error:
        "Use a positive calories value. Macros can be zero, but they cannot be negative.",
    };
  }

  const isServingBasis = draft.basis === "serving";
  const parsedServingValue = parseLocalizedNumber(draft.servingValue);
  if (
    isServingBasis &&
    (!Number.isFinite(parsedServingValue) || parsedServingValue <= 0)
  ) {
    return { error: "Use a positive serving size." };
  }

  const fiberG = parseOptionalNutrient(draft.fiber);
  const sugarG = parseOptionalNutrient(draft.sugar);
  const fatSaturatedG = parseOptionalNutrient(draft.saturatedFat);
  const saltG = parseOptionalNutrient(draft.salt);
  if (
    [fiberG, sugarG, fatSaturatedG, saltG].some(
      (value) => value != null && Number.isNaN(value),
    )
  ) {
    return { error: "Optional nutrients must be zero or positive numbers." };
  }

  return {
    input: {
      source: "custom",
      sourceId: null,
      barcode: draft.barcode?.trim() || null,
      name: trimmedName,
      brand: draft.brand.trim() || null,
      imageUrl: null,
      quantityValue: null,
      quantityUnit: null,
      servingSizeValue: isServingBasis ? parsedServingValue : 100,
      servingSizeUnit: isServingBasis
        ? draft.servingUnit.trim() || "serving"
        : draft.basis === "100ml"
          ? "ml"
          : "g",
      nutritionBasis: draft.basis,
      calories: draft.calories,
      proteinG: draft.proteinG,
      carbsG: draft.carbsG,
      fatG: draft.fatG,
      fiberG,
      sugarG,
      fatSaturatedG,
      saltG,
      ingredientsText: null,
      verified: false,
      isComplete: true,
    },
  };
};
