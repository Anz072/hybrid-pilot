import {
  getFoodByBarcode,
  getFoodByRef,
  searchFoods,
  toDbFoodItem,
} from "../API/nouri/foodsApi";
import { NouriApiError } from "../API/nouri/client";
import type { DBFoodItem } from "./DB_TYPES";

// Food search and barcode lookup, served by the Nouri API.
//
// The app no longer talks to USDA or Open Food Facts, and no longer holds their
// keys. It asks the backend one question and receives one normalized list; which
// upstream answered is not the client's concern.
//
// Nothing here persists. The backend keeps the durable caches — `food_items`
// for anything loggable and `external_food_cache` for provider responses — so a
// second copy on the device would only be a way for the two to disagree.
// Results live in component state for as long as the screen shows them.
//
// There is no session check before each call: `apiRequest` fails with
// AUTH_REQUIRED when there is no session, which is the same answer one round
// trip earlier.

export const searchFoodItems = async (
  query: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  const normalized = query.trim();
  if (!normalized) return [];

  const response = await searchFoods(normalized, limit);
  return response.results.map(toDbFoodItem);
};

export const getFoodItemByBarcode = async (
  barcode: string,
): Promise<DBFoodItem | null> => {
  const normalized = barcode.trim();
  if (!normalized) return null;

  try {
    // The backend checks its catalogue first and only then queries Open Food
    // Facts, promoting any hit so it becomes permanently loggable.
    const { food } = await getFoodByBarcode(normalized);
    return toDbFoodItem(food);
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};

/** Resolves a single food by the ref returned in search results. */
export const getFoodByRefRemote = async (
  ref: string | number,
): Promise<DBFoodItem | null> => {
  try {
    return toDbFoodItem(await getFoodByRef(ref));
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) return null;
    throw error;
  }
};
