import { coalesce } from "../../API/nouri/coalesce";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";

// The add-food screen's four lists — recents, favourites, recipes, custom meals
// — plus the current profile.
//
// `cachedSnapshot` is what this process last loaded, kept so reopening the
// screen paints immediately while the fresh load runs. It is dropped on
// sign-out and never survives a restart. The lists themselves always come from
// the API; this holds the last answer, not a copy of the data.

export type AddFoodStaticListsSnapshot = {
  user: DBUser | null;
  recent: DBFoodItem[];
  favorites: DBFoodItem[];
  recipes: DBFoodItem[];
  customMeals: DBFoodItem[];
  loadedAt: number;
};

let cachedSnapshot: AddFoodStaticListsSnapshot | null = null;

const COALESCE_KEY = "add-food:static-lists";

const fetchAddFoodStaticLists = async (): Promise<AddFoodStaticListsSnapshot> => {
  const currentUser = await DB.getUser();
  const userListsPromise = currentUser
    ? Promise.all([
        DB.getRecentFoodItems(currentUser.externalId, 10),
        DB.getFavoriteFoodItems(currentUser.externalId, 10),
      ])
    : Promise.resolve<[DBFoodItem[], DBFoodItem[]]>([[], []]);

  const [[recent, favorites], recipes, customMeals] = await Promise.all([
    userListsPromise,
    DB.listFoodItems({ source: "recipe", limit: 60 }),
    DB.listFoodItems({ source: "custom_meal", limit: 60 }),
  ]);

  return {
    user: currentUser,
    recent,
    favorites,
    recipes,
    customMeals,
    loadedAt: Date.now(),
  };
};

export const getCachedAddFoodStaticLists = () => cachedSnapshot;

export const clearAddFoodStaticListsCache = () => {
  cachedSnapshot = null;
};

/**
 * Loads the lists, or joins a load already in flight.
 *
 * There is no `force`. It used to exist to bypass the in-flight join, which is
 * the one thing that should never be bypassed: two identical requests racing to
 * set the same state is not a fresher answer, it is a coin toss between two
 * answers. A caller that has just written something wants the *next* load to
 * see it, and by the time it calls, the write has already returned.
 */
export const refreshAddFoodStaticLists = (): Promise<AddFoodStaticListsSnapshot> =>
  coalesce(COALESCE_KEY, fetchAddFoodStaticLists).then((snapshot) => {
    cachedSnapshot = snapshot;
    return snapshot;
  });

export const prefetchAddFoodStaticLists = () => {
  // Fire-and-forget: a failed prefetch is not an error the user asked about.
  // The API client has already reported the cause.
  void refreshAddFoodStaticLists().catch(() => undefined);
};
