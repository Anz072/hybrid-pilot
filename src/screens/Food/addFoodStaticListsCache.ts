import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";

export type AddFoodStaticListsSnapshot = {
  user: DBUser | null;
  recent: DBFoodItem[];
  favorites: DBFoodItem[];
  recipes: DBFoodItem[];
  customMeals: DBFoodItem[];
  loadedAt: number;
};

let cachedSnapshot: AddFoodStaticListsSnapshot | null = null;
let inflightSnapshot: Promise<AddFoodStaticListsSnapshot> | null = null;
let fetchSequence = 0;

const fetchAddFoodStaticLists =
  async (sequence: number): Promise<AddFoodStaticListsSnapshot> => {
    const currentUser = await DB.getUser();
    const recipeFoodsPromise = DB.listFoodItems({
      source: "recipe",
      limit: 60,
    });
    const customMealFoodsPromise = DB.listFoodItems({
      source: "custom_meal",
      limit: 60,
    });
    const userListsPromise = currentUser
      ? Promise.all([
          DB.getRecentFoodItems(currentUser.externalId, 10),
          DB.getFavoriteFoodItems(currentUser.externalId, 10),
        ])
      : Promise.resolve<[DBFoodItem[], DBFoodItem[]]>([[], []]);

    const [[recent, favorites], recipes, customMeals] = await Promise.all([
      userListsPromise,
      recipeFoodsPromise,
      customMealFoodsPromise,
    ]);
    const snapshot = {
      user: currentUser,
      recent,
      favorites,
      recipes,
      customMeals,
      loadedAt: Date.now(),
    };

    if (sequence === fetchSequence) {
      cachedSnapshot = snapshot;
      return snapshot;
    }

    return cachedSnapshot ?? snapshot;
  };

export const getCachedAddFoodStaticLists = () => cachedSnapshot;

export const clearAddFoodStaticListsCache = () => {
  cachedSnapshot = null;
  inflightSnapshot = null;
  fetchSequence += 1;
};

export const refreshAddFoodStaticLists = ({
  force = false,
}: {
  force?: boolean;
} = {}): Promise<AddFoodStaticListsSnapshot> => {
  if (inflightSnapshot && (!force || !cachedSnapshot)) {
    return inflightSnapshot;
  }

  const sequence = fetchSequence + 1;
  fetchSequence = sequence;
  const nextInflightSnapshot = fetchAddFoodStaticLists(sequence).finally(() => {
    if (inflightSnapshot === nextInflightSnapshot) {
      inflightSnapshot = null;
    }
  });
  inflightSnapshot = nextInflightSnapshot;

  return inflightSnapshot;
};

export const prefetchAddFoodStaticLists = () => {
  void refreshAddFoodStaticLists().catch(() => undefined);
};
