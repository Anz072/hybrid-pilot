import { decodeFoodId, toSyntheticMealFoodId } from "./syntheticFoodIds";

type LibraryFood = {
  id?: number;
  localId?: number | null;
  source: string;
  sourceId?: string | null;
  rawPayload?: string | null;
};

/** Resolve the table identity before selecting an editor or a display label. */
export const getLibraryFoodIdentity = (
  food: LibraryFood,
): {
  kind: "custom_recipe" | "custom_meal";
  id: number;
} | null => {
  const foodId = food.localId ?? food.id;
  if (foodId != null) {
    const decoded = decodeFoodId(foodId);
    if (decoded.kind !== "food_item" && decoded.id > 0)
      return { kind: decoded.kind, id: decoded.id };
  }
  if (food.source !== "recipe") return null;
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(food.rawPayload ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      payload = parsed;
  } catch {
    /* Legacy rows can have no structured payload. */
  }
  const isMeal =
    food.sourceId?.startsWith("meal:") || payload.entityType === "custom_meal";
  const rawId = isMeal
    ? food.sourceId?.startsWith("meal:")
      ? food.sourceId.slice(5)
      : payload.mealId
    : (food.sourceId ?? payload.recipeId);
  if (rawId == null || rawId === "") return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0
    ? { kind: isMeal ? "custom_meal" : "custom_recipe", id }
    : null;
};

/** The custom-meal editor's store API uses a synthetic food id for reads and writes. */
export const getCustomMealEditorId = (food: LibraryFood): number | null => {
  const identity = getLibraryFoodIdentity(food);
  return identity?.kind === "custom_meal"
    ? toSyntheticMealFoodId(identity.id)
    : null;
};
