import {
  getFoodByBarcode,
  getFoodByRef,
  searchFoods,
  toDbFoodItem,
  type ApiFood,
} from "../API/nouri/foodsApi";
import { NouriApiError } from "../API/nouri/client";
import { getSupabaseSessionUser } from "../API/supabase/client";
import { shouldUseExpoGoDevLocalStore } from "../dev/expoGoDevAuth";
import {
  getCachedBarcodeLookup,
  getCachedSearchResults,
  saveCachedBarcodeHit,
  saveCachedBarcodeMiss,
  saveCachedSearchResults,
  upsertCachedFoodItems,
} from "./cacheRepository";
import type { DBFoodItem } from "./DB_TYPES";
import {
  getFoodItemByBarcode as getFoodItemByBarcodeLocal,
  searchFoodItems as searchFoodItemsLocal,
} from "./foodRepository";

// Food search and barcode lookup, served by the Nouri API.
//
// The app no longer talks to USDA or Open Food Facts, and no longer holds their
// keys. It asks the backend one question and receives one normalized list; which
// upstream answered is not the client's concern.
//
// Search semantics are unchanged: the backend applies the same ranking,
// de-duplication and minimum-query-length rules the app used to apply locally.

const resolveUserId = async (): Promise<string | null> => {
  if (await shouldUseExpoGoDevLocalStore()) {
    return null;
  }
  const sessionUser = await getSupabaseSessionUser();
  return sessionUser?.id ?? null;
};

// Results that already exist in the catalogue have a real id and can be cached
// and logged directly. External results carry id 0 until the backend
// materialises them, so they are shown but not persisted locally.
const isPersistable = (food: ApiFood): boolean => food.id != null && food.id !== 0;

export const searchFoodItems = async (
  query: string,
  limit = 30,
): Promise<DBFoodItem[]> => {
  const userId = await resolveUserId();
  const normalized = query.trim();

  if (!userId) {
    return searchFoodItemsLocal(query, limit);
  }

  if (!normalized) {
    return [];
  }

  const cached = await getCachedSearchResults(normalized, {
    limit,
    source: "all",
  });
  if (cached && cached.length > 0) {
    void refreshSearchCache(normalized, limit).catch(() => undefined);
    return cached;
  }

  return runSearch(normalized, limit);
};

const runSearch = async (query: string, limit: number): Promise<DBFoodItem[]> => {
  const response = await searchFoods(query, limit);
  const foods = response.results.map(toDbFoodItem);
  const persistable = response.results.filter(isPersistable).map(toDbFoodItem);

  if (persistable.length > 0) {
    await upsertCachedFoodItems(persistable);
    await saveCachedSearchResults(query, persistable, { source: "all" });
  }

  return foods;
};

const refreshSearchCache = async (query: string, limit: number): Promise<void> => {
  await runSearch(query, limit);
};

export const getFoodItemByBarcode = async (
  barcode: string,
): Promise<DBFoodItem | null> => {
  const userId = await resolveUserId();
  const normalized = barcode.trim();

  if (!userId) {
    return getFoodItemByBarcodeLocal(normalized);
  }

  if (!normalized) {
    return null;
  }

  const cachedLookup = await getCachedBarcodeLookup(normalized);
  if (cachedLookup?.status === "hit") {
    return cachedLookup.food;
  }
  if (cachedLookup?.status === "miss") {
    return null;
  }

  try {
    // The backend checks its catalogue first and only then queries Open Food
    // Facts, promoting any hit so it becomes permanently loggable.
    const { food } = await getFoodByBarcode(normalized);
    const dbFood = toDbFoodItem(food);
    await upsertCachedFoodItems([dbFood]);
    await saveCachedBarcodeHit(normalized, dbFood);
    return dbFood;
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      await saveCachedBarcodeMiss(normalized);
      return null;
    }
    throw error;
  }
};

// Resolve a single food by the ref returned in search results.
/**
 * Fetches a food from the backend **unconditionally**.
 *
 * Deliberately has no Expo Go dev-mode guard: it is the remote half of a
 * cache-then-refresh pair, and every caller resolves the session first, so
 * reaching it already means "not in offline dev mode". Calling it directly from
 * a screen would make an HTTP request in a mode that is supposed to be
 * offline — `scripts/expo-go-bypass.test.cjs` fails if any unguarded caller
 * appears.
 */
export const getFoodByRefRemote = async (
  ref: string | number,
): Promise<DBFoodItem | null> => {
  try {
    return toDbFoodItem(await getFoodByRef(ref));
  } catch (error) {
    if (error instanceof NouriApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
};
