import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowLeftIcon,
  BarcodeIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  StarIcon,
  XIcon,
} from "phosphor-react-native";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import FoodBarcodeScannerModal from "./FoodBarcodeScannerModal";
import FoodLogContextBar from "./FoodLogContextBar";
import type { ScannedFoodLookupResult } from "./FoodBarcodeScannerShared";
import {
  formatFoodItemServing,
  formatFoodMacro,
  formatFoodNumber,
  formatFoodSourceLabel,
  getFoodDefaultLogAmount,
} from "./foodUtils";
import {
  resolveFoodLogContext,
  toFoodLogRouteParams,
} from "./foodLogContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getFoodRecentSearches,
  saveFoodRecentSearches,
} from "../../storage/localStore";
import { appColors } from "../../theme/colors";
import {
  fromDbFoodItem,
  searchFoodResults,
  type FoodSearchResult,
} from "./foodSearch";
import {
  getCachedAddFoodStaticLists,
  refreshAddFoodStaticLists,
  type AddFoodStaticListsSnapshot,
} from "./addFoodStaticListsCache";

type AddFoodRoute = RouteProp<FoodStackParamList, "AddFood">;
type AddFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "AddFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

type SearchFoodResult = FoodSearchResult;

type FoodSearchMode = "all" | "recipes" | "custom_meals";
type SearchResultCategory =
  | "custom_foods"
  | "common_foods"
  | "branded_foods";
type SearchResultSection = {
  key: SearchResultCategory;
  title: string;
  subtitle: string;
  items: SearchFoodResult[];
};
type LibrarySectionKey = "yours" | "public";
type LibraryResultSection = {
  key: LibrarySectionKey;
  title: string;
  subtitle: string;
  emptyText: string;
  items: SearchFoodResult[];
};
type RenderSectionOptions = {
  emptyCta?: {
    onPress: () => void;
    pillText: string;
    text: string;
    title: string;
  };
  loading?: boolean;
};

const SEARCH_DEBOUNCE_MS = 240;
const MAX_SEARCH_RESULTS = 30;
const SEARCH_RESULT_CATEGORY_ORDER: SearchResultCategory[] = [
  "custom_foods",
  "common_foods",
  "branded_foods",
];
const SEARCH_RESULT_CATEGORY_PRIORITY: Record<SearchResultCategory, number> = {
  custom_foods: 0,
  common_foods: 1,
  branded_foods: 2,
};
const SEARCH_RESULT_CATEGORY_META: Record<
  SearchResultCategory,
  Omit<SearchResultSection, "items" | "key">
> = {
  custom_foods: {
    title: "Custom Foods",
    subtitle: "Saved by you.",
  },
  common_foods: {
    title: "Common Foods",
    subtitle: "Generic matches.",
  },
  branded_foods: {
    title: "Branded Foods",
    subtitle: "Packaged matches.",
  },
};

const getSearchCacheKey = (mode: FoodSearchMode, query: string) =>
  `${mode}:${query}`;

const getSearchResultCategory = (
  food: SearchFoodResult,
): SearchResultCategory => {
  if (food.source === "custom" || food.source === "manual") {
    return "custom_foods";
  }

  if ((food.brand ?? "").trim().length > 0) {
    return "branded_foods";
  }

  return "common_foods";
};

const ADD_FOOD_SEARCH_RANK_OPTIONS = {
  brandScoreBonus: 8,
  categoryPriority: (food: SearchFoodResult) =>
    SEARCH_RESULT_CATEGORY_PRIORITY[getSearchResultCategory(food)],
  dedupe: {
    includeDisplayKey: (food: SearchFoodResult) =>
      food.source !== "custom" && food.source !== "manual",
  },
  incompleteScorePenalty: 25,
  localScoreBonus: 130,
  maxResults: MAX_SEARCH_RESULTS,
  usdaScoreBonus: 30,
  verifiedScoreBonus: 20,
};

const parseLibraryPayload = (food: Pick<SearchFoodResult, "rawPayload">) => {
  if (!food.rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(food.rawPayload) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const isCustomMealResult = (
  food: Pick<SearchFoodResult, "source" | "sourceId" | "rawPayload">,
) => {
  if (food.source !== "recipe") {
    return false;
  }

  if (food.sourceId?.startsWith("meal:")) {
    return true;
  }

  return parseLibraryPayload(food)?.entityType === "custom_meal";
};

const isRecipeResult = (
  food: Pick<SearchFoodResult, "source" | "sourceId" | "rawPayload">,
) => food.source === "recipe" && !isCustomMealResult(food);

const getLibraryOwnerUserId = (
  food: Pick<SearchFoodResult, "rawPayload">,
) => {
  const value = parseLibraryPayload(food)?.createdByUserExternalId;
  return typeof value === "string" && value.trim() ? value : null;
};

const isOwnedLibraryResult = (
  food: Pick<SearchFoodResult, "rawPayload">,
  userExternalId?: string | null,
) => {
  if (!userExternalId) {
    return false;
  }

  return getLibraryOwnerUserId(food) === userExternalId;
};

const getRecipeIdFromResult = (
  food: Pick<SearchFoodResult, "sourceId" | "source" | "rawPayload">,
) => {
  if (!isRecipeResult(food)) {
    return null;
  }

  const recipeId = Number(food.sourceId);
  return Number.isFinite(recipeId) ? recipeId : null;
};

const getMealIdFromResult = (
  food: Pick<SearchFoodResult, "sourceId" | "source" | "rawPayload">,
) => {
  if (!isCustomMealResult(food)) {
    return null;
  }

  if (food.sourceId?.startsWith("meal:")) {
    const mealId = Number(food.sourceId.slice("meal:".length));
    return Number.isFinite(mealId) ? mealId : null;
  }

  const payloadMealId = Number(parseLibraryPayload(food)?.mealId);
  return Number.isFinite(payloadMealId) ? payloadMealId : null;
};

const getLibraryBadgeLabel = (
  food: Pick<SearchFoodResult, "source" | "sourceId" | "rawPayload">,
) => {
  if (isCustomMealResult(food)) {
    return "Custom Meal";
  }

  if (isRecipeResult(food)) {
    return "Recipe";
  }

  return formatFoodSourceLabel(food.source);
};

const buildLibrarySections = ({
  items,
  userExternalId,
  type,
  hasQuery,
}: {
  items: SearchFoodResult[];
  userExternalId?: string | null;
  type: "recipes" | "custom_meals";
  hasQuery: boolean;
}): LibraryResultSection[] => {
  const ownedItems = userExternalId
    ? items.filter((item) => isOwnedLibraryResult(item, userExternalId))
    : [];
  const publicItems = items.filter(
    (item) => !isOwnedLibraryResult(item, userExternalId),
  );
  const label = type === "recipes" ? "recipes" : "custom meals";

  const sections: LibraryResultSection[] = [];

  if (!hasQuery && userExternalId) {
    sections.push({
      key: "yours",
      title: "Yours",
      subtitle:
        type === "recipes"
          ? "Recipes you created and can edit."
          : "Custom meals you created and can edit.",
      emptyText: `No ${label} from you yet.`,
      items: ownedItems,
    });
  } else if (hasQuery && ownedItems.length > 0) {
    sections.push({
      key: "yours",
      title: "Yours",
      subtitle:
        type === "recipes"
          ? "Matching recipes you created."
          : "Matching custom meals you created.",
      emptyText: `No ${label} from you matched this search.`,
      items: ownedItems,
    });
  }

  if (!hasQuery || publicItems.length > 0) {
    sections.push({
      key: "public",
      title: "Public",
      subtitle:
        type === "recipes"
          ? "Public recipes from other users. Add-only."
          : "Public custom meals from other users. Add-only.",
      emptyText: `No public ${label} ${hasQuery ? "matched this search" : "yet"}.`,
      items: publicItems,
    });
  }

  return sections;
};

const buildCategorizedSearchSections = (
  items: SearchFoodResult[],
): SearchResultSection[] =>
  SEARCH_RESULT_CATEGORY_ORDER.map((category) => ({
    key: category,
    ...SEARCH_RESULT_CATEGORY_META[category],
    items: items.filter((item) => getSearchResultCategory(item) === category),
  })).filter((section) => section.items.length > 0);

const SKELETON_ROWS = [0, 1, 2];

const AddFoodScreen = () => {
  const route = useRoute<AddFoodRoute>();
  const navigation = useNavigation<AddFoodNav>();
  const insets = useSafeAreaInsets();
  const initialStaticListsRef = React.useRef(getCachedAddFoodStaticLists());

  const { contextLabel, date, loggedAt, mealType } = route.params;

  const [user, setUser] = useState<DBUser | null>(
    () => initialStaticListsRef.current?.user ?? null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFoodResult[]>([]);
  const [recent, setRecent] = useState<DBFoodItem[]>(
    () => initialStaticListsRef.current?.recent ?? [],
  );
  const [favorites, setFavorites] = useState<DBFoodItem[]>(
    () => initialStaticListsRef.current?.favorites ?? [],
  );
  const [recipes, setRecipes] = useState<DBFoodItem[]>(
    () => initialStaticListsRef.current?.recipes ?? [],
  );
  const [customMeals, setCustomMeals] = useState<DBFoodItem[]>(
    () => initialStaticListsRef.current?.customMeals ?? [],
  );
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isStaticListsLoading, setIsStaticListsLoading] = useState(
    () => !initialStaticListsRef.current,
  );
  const [isUsingLocalSearchOnly, setIsUsingLocalSearchOnly] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<FoodSearchMode>("all");
  const [quickLoggingKeys, setQuickLoggingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const quickLoggingKeysRef = React.useRef(new Set<string>());
  const searchCacheRef = React.useRef(new Map<string, SearchFoodResult[]>());
  const localOnlySearchCacheRef = React.useRef(new Set<string>());
  const lastSavedSearchRef = React.useRef<string | null>(null);
  const activeSearchCacheKeyRef = React.useRef<string | null>(null);

  const applyStaticListsSnapshot = useCallback(
    (snapshot: AddFoodStaticListsSnapshot) => {
      setUser(snapshot.user);
      setRecent(snapshot.recent);
      setFavorites(snapshot.favorites);
      setRecipes(snapshot.recipes);
      setCustomMeals(snapshot.customMeals);
    },
    [],
  );

  const loadStaticLists = useCallback(async ({
    force = false,
    silent = false,
  }: {
    force?: boolean;
    silent?: boolean;
  } = {}) => {
    const cachedSnapshot = getCachedAddFoodStaticLists();

    if (cachedSnapshot) {
      applyStaticListsSnapshot(cachedSnapshot);
      setIsStaticListsLoading(false);
    } else if (!silent) {
      setIsStaticListsLoading(true);
    }

    try {
      const nextSnapshot = await refreshAddFoodStaticLists({ force });
      applyStaticListsSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      setIsStaticListsLoading(false);
    }
  }, [applyStaticListsSnapshot]);

  const searchFoods = useCallback(
    async (normalizedQuery: string, mode: FoodSearchMode) => {
      const cacheKey = getSearchCacheKey(mode, normalizedQuery);
      activeSearchCacheKeyRef.current = cacheKey;
      const cachedResults = searchCacheRef.current.get(cacheKey);
      if (cachedResults) {
        setIsUsingLocalSearchOnly(localOnlySearchCacheRef.current.has(cacheKey));
        return cachedResults;
      }

      let remoteSearchFailed = false;
      setIsUsingLocalSearchOnly(false);
      const rankedResults = await searchFoodResults({
        query: normalizedQuery,
        getLocalRows: (queryText) =>
          mode === "recipes"
            ? DB.listFoodItems({
                source: "recipe",
                query: queryText,
                limit: 40,
              })
            : mode === "custom_meals"
              ? DB.listFoodItems({
                  source: "custom_meal",
                  query: queryText,
                  limit: 40,
                })
              : DB.searchFoodItems(queryText, 40),
        filterLocalRow: (food) =>
          mode === "recipes"
            ? isRecipeResult(food)
            : mode === "custom_meals"
              ? isCustomMealResult(food)
              : !isRecipeResult(food) && !isCustomMealResult(food),
        includeRemote: mode === "all",
        onLocalResults: (localResults) => {
          if (
            mode === "all" &&
            activeSearchCacheKeyRef.current === cacheKey &&
            localResults.length > 0
          ) {
            setResults(localResults);
          }
        },
        onRemoteSearchError: () => {
          remoteSearchFailed = true;
        },
        rankOptions: ADD_FOOD_SEARCH_RANK_OPTIONS,
      });
      if (remoteSearchFailed) {
        localOnlySearchCacheRef.current.add(cacheKey);
      } else {
        localOnlySearchCacheRef.current.delete(cacheKey);
      }
      setIsUsingLocalSearchOnly(remoteSearchFailed);
      searchCacheRef.current.set(cacheKey, rankedResults);

      return rankedResults;
    },
    [],
  );

  const persistFoodIfNeeded = useCallback(async (food: SearchFoodResult) => {
    if (food.localId != null) {
      return food.localId;
    }

    const {
      key: _key,
      localId: _localId,
      localFood: _localFood,
      ...saveInput
    } = food;
    const savedId = await DB.saveFoodItem(saveInput);

    setResults((current) =>
      current.map((item) =>
        item.key === food.key ? { ...item, localId: savedId } : item,
      ),
    );
    searchCacheRef.current.clear();
    localOnlySearchCacheRef.current.clear();

    return savedId;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRecentSearches = async () => {
      const stored = await getFoodRecentSearches();
      if (!cancelled) {
        setRecentSearches(stored);
      }
    };

    void loadRecentSearches();

    return () => {
      cancelled = true;
    };
  }, []);

  const rememberSearch = useCallback((value: string) => {
    const normalized = value.trim();

    if (normalized.length < 3 || normalized === lastSavedSearchRef.current) {
      return;
    }

    lastSavedSearchRef.current = normalized;
    setRecentSearches((current) => {
      const next = [
        normalized,
        ...current.filter(
          (item) => item.toLowerCase() !== normalized.toLowerCase(),
        ),
      ].slice(0, 6);

      void saveFoodRecentSearches(next);
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = async () => {
        const hasCachedLists = Boolean(getCachedAddFoodStaticLists());
        searchCacheRef.current.clear();
        localOnlySearchCacheRef.current.clear();
        const normalized = query.trim();
        const staticListsPromise = loadStaticLists({
          force: true,
          silent: hasCachedLists,
        });
        const searchPromise = normalized
          ? searchFoods(normalized, searchMode)
          : Promise.resolve<SearchFoodResult[] | null>(null);

        if (normalized) {
          setIsSearching(true);
        }

        try {
          const [, refreshedResults] = await Promise.all([
            staticListsPromise,
            searchPromise,
          ]);

          if (!active) {
            return;
          }

          if (refreshedResults) {
            setResults(refreshedResults);
          }
        } catch {
          // Keep cached rows visible if a background refresh fails.
        } finally {
          if (active && normalized) {
            setIsSearching(false);
          }
        }

      };

      void refresh();

      return () => {
        active = false;
      };
    }, [loadStaticLists, query, searchFoods, searchMode]),
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const normalized = query.trim();
      if (!normalized) {
        activeSearchCacheKeyRef.current = null;
        setResults([]);
        setIsSearching(false);
        setIsUsingLocalSearchOnly(false);
        return;
      }

      const cachedResults = searchCacheRef.current.get(
        getSearchCacheKey(searchMode, normalized),
      );
      if (cachedResults) {
        setResults(cachedResults);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const rows = await searchFoods(normalized, searchMode);
      if (!cancelled) {
        setResults(rows);
        if (rows.length > 0 && searchMode === "all") {
          rememberSearch(normalized);
        }
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(() => {
      void run();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, rememberSearch, searchFoods, searchMode]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((food) => food.id)),
    [favorites],
  );

  const favoriteResults = useMemo(
    () => favorites.map((food) => fromDbFoodItem(food)),
    [favorites],
  );

  const recentResults = useMemo(
    () => recent.map((food) => fromDbFoodItem(food)),
    [recent],
  );
  const frequentResults = useMemo(() => {
    const seen = new Set<string>();

    return [...favoriteResults, ...recentResults].filter((food) => {
      const key =
        food.localId != null ? `local:${food.localId}` : `remote:${food.key}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [favoriteResults, recentResults]);
  const recipeResults = useMemo(
    () => recipes.map((food) => fromDbFoodItem(food)),
    [recipes],
  );
  const customMealResults = useMemo(
    () => customMeals.map((food) => fromDbFoodItem(food)),
    [customMeals],
  );

  const foodLogContext = useMemo(
    () =>
      resolveFoodLogContext({
        contextLabel,
        date,
        loggedAt,
        mealType,
      }),
    [contextLabel, date, loggedAt, mealType],
  );
  const foodLogRouteParams = useMemo(
    () => toFoodLogRouteParams(foodLogContext),
    [foodLogContext],
  );
  const resolvedContextLabel = foodLogContext.contextLabel;

  const handleScannedFoodResolved = useCallback(
    (result: ScannedFoodLookupResult) => {
      setScannerVisible(false);
      navigation.navigate("ScannedFood", {
        ...foodLogRouteParams,
        foodId: result.foodId,
        barcode: result.barcode,
        scanStatus: result.status,
      });
    },
    [foodLogRouteParams, navigation],
  );

  const openCreateCustomMeal = useCallback(() => {
    navigation.navigate("CreateCustomFood", {
      ...foodLogRouteParams,
    });
  }, [foodLogRouteParams, navigation]);

  const openQuickAddFood = useCallback(() => {
    navigation.navigate("QuickAddFood", {
      ...foodLogRouteParams,
    });
  }, [foodLogRouteParams, navigation]);

  const openCreateRecipe = useCallback(() => {
    navigation.navigate("CreateRecipe", {
      ...foodLogRouteParams,
    });
  }, [foodLogRouteParams, navigation]);

  const openRecipeEditor = useCallback(
    (food: SearchFoodResult) => {
      const recipeId = getRecipeIdFromResult(food);

      if (recipeId == null) {
        Alert.alert(
          "Recipe unavailable",
          "That saved recipe could not be opened for editing.",
        );
        return;
      }

      navigation.navigate("CreateRecipe", {
        ...foodLogRouteParams,
        recipeId,
      });
    },
    [foodLogRouteParams, navigation],
  );

  const openCustomMealEditor = useCallback(
    (food: SearchFoodResult) => {
      const mealId = getMealIdFromResult(food);

      if (mealId == null) {
        Alert.alert(
          "Custom meal unavailable",
          "That saved custom meal could not be opened for editing.",
        );
        return;
      }

      navigation.navigate("CreateCustomFood", {
        ...foodLogRouteParams,
        mealId,
      });
    },
    [foodLogRouteParams, navigation],
  );

  const openFoodEditor = async (food: SearchFoodResult) => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

    const foodId = await persistFoodIfNeeded(food);
    navigation.navigate("ScannedFood", {
      ...foodLogRouteParams,
      foodId,
    });
  };

  const toggleFavorite = async (
    food: SearchFoodResult,
    isFavorite: boolean,
  ) => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before saving foods.",
      );
      return;
    }

    const foodId = await persistFoodIfNeeded(food);
    await DB.setFoodItemFavorite(user.externalId, foodId, !isFavorite);
    searchCacheRef.current.clear();
    localOnlySearchCacheRef.current.clear();
    await Promise.all([
      loadStaticLists({ force: true }),
      query.trim()
        ? searchFoods(query.trim(), searchMode).then(setResults)
        : Promise.resolve(),
    ]);
  };

  const quickLogFood = async (food: SearchFoodResult) => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

    if (quickLoggingKeysRef.current.has(food.key)) {
      return;
    }

    try {
      quickLoggingKeysRef.current.add(food.key);
      setQuickLoggingKeys((current) => {
        const next = new Set(current);
        next.add(food.key);
        return next;
      });
      const foodId = await persistFoodIfNeeded(food);
      await DB.addUserFoodLog({
        userExternalId: user.externalId,
        foodId,
        date: foodLogContext.date,
        loggedAt: foodLogContext.loggedAt,
        quantityG: getFoodDefaultLogAmount(food),
        mealType: foodLogContext.mealType,
      });
      navigation.goBack();
    } catch {
      Alert.alert("Could not log food", "Please review the food and try again.");
    } finally {
      quickLoggingKeysRef.current.delete(food.key);
      setQuickLoggingKeys((current) => {
        const next = new Set(current);
        next.delete(food.key);
        return next;
      });
    }
  };

  const activeResults = useMemo(() => {
    if (query.trim()) {
      return results;
    }

    if (searchMode === "recipes") {
      return recipeResults;
    }

    if (searchMode === "custom_meals") {
      return customMealResults;
    }

    return frequentResults;
  }, [customMealResults, frequentResults, query, recipeResults, results, searchMode]);
  const categorizedQueryResults = useMemo(
    () =>
      query.trim() && searchMode === "all"
        ? buildCategorizedSearchSections(activeResults)
        : [],
    [activeResults, query, searchMode],
  );
  const librarySections = useMemo(
    () =>
      searchMode === "recipes" || searchMode === "custom_meals"
        ? buildLibrarySections({
            items: activeResults,
            userExternalId: user?.externalId,
            type: searchMode,
            hasQuery: Boolean(query.trim()),
          })
        : [],
    [activeResults, query, searchMode, user?.externalId],
  );
  const searchPlaceholder =
    searchMode === "recipes"
      ? "Search recipes"
      : searchMode === "custom_meals"
        ? "Search custom meals"
        : "Search foods";
  const shouldShowScanner = searchMode === "all";

  const renderFoodCard = (food: SearchFoodResult, isFavorite: boolean) => {
    const isRecipe = isRecipeResult(food);
    const isCustomMeal = isCustomMealResult(food);
    const isLibraryItem = isRecipe || isCustomMeal;
    const isOwnedLibraryItem =
      isLibraryItem && isOwnedLibraryResult(food, user?.externalId);
    const isQuickLogging = quickLoggingKeys.has(food.key);
    const defaultAmount = formatFoodItemServing(food);
    const sourceLabel = getLibraryBadgeLabel(food);

    return (
      <View key={food.key} style={styles.foodCard}>
        <Pressable
          style={styles.foodBody}
          onPress={() => void openFoodEditor(food)}
        >
          <View style={styles.foodTopRow}>
            <Text style={styles.foodName} numberOfLines={2}>
              {food.name}
            </Text>
            <Text style={styles.foodCalories}>
              {formatFoodNumber(food.calories, " kcal")}
            </Text>
          </View>
          <View style={styles.foodMetaRow}>
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>{sourceLabel}</Text>
            </View>
            {isLibraryItem ? (
              <View
                style={[
                  styles.ownershipChip,
                  isOwnedLibraryItem
                    ? styles.ownershipChipOwned
                    : styles.ownershipChipPublic,
                ]}
              >
                <Text
                  style={[
                    styles.ownershipChipText,
                    isOwnedLibraryItem
                      ? styles.ownershipChipTextOwned
                      : styles.ownershipChipTextPublic,
                  ]}
                >
                  {isOwnedLibraryItem ? "Yours" : "Public"}
                </Text>
              </View>
            ) : null}
            <Text style={styles.supportingMeta} numberOfLines={1}>
              {food.brand ? `${food.brand} | ` : ""}
              {defaultAmount}
            </Text>
          </View>
          <Text style={styles.foodMacroText}>
            {formatFoodMacro(food.proteinG, "P")} |{" "}
            {formatFoodMacro(food.carbsG, "C")} |{" "}
            {formatFoodMacro(food.fatG, "F")}
          </Text>
        </Pressable>
        <View style={styles.foodActionColumn}>
          {isOwnedLibraryItem ? (
            <Pressable
              onPress={() =>
                isRecipe ? openRecipeEditor(food) : openCustomMealEditor(food)
              }
              accessibilityLabel={`Edit ${food.name}`}
              style={({ pressed }) => [
                styles.iconAction,
                pressed && styles.cardPressed,
              ]}
            >
              <PencilSimpleIcon
                size={18}
                color={appColors.brand500}
                weight="bold"
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void toggleFavorite(food, isFavorite)}
              accessibilityLabel={
                isFavorite ? `Remove ${food.name} bookmark` : `Save ${food.name}`
              }
              style={({ pressed }) => [
                styles.iconAction,
                isFavorite && styles.secondaryActionActive,
                pressed && styles.cardPressed,
              ]}
            >
              <StarIcon
                size={18}
                color={isFavorite ? appColors.white : appColors.brand500}
                weight={isFavorite ? "fill" : "bold"}
              />
            </Pressable>
          )}
          <Pressable
            disabled={isQuickLogging}
            onPress={() => void quickLogFood(food)}
            accessibilityLabel={`Quick log ${food.name}`}
            style={({ pressed }) => [
              styles.quickLogAction,
              isQuickLogging && styles.primaryActionLoading,
              pressed && styles.cardPressed,
            ]}
          >
            {isQuickLogging ? (
              <ActivityIndicator color={appColors.white} size="small" />
            ) : (
              <>
                <LightningIcon size={16} color={appColors.white} weight="fill" />
                <Text style={styles.quickLogText}>Log</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSkeletonRows = () => (
    <View style={styles.skeletonStack}>
      {SKELETON_ROWS.map((row) => (
        <View key={row} style={styles.skeletonCard}>
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            <View style={[styles.skeletonLine, styles.skeletonLineLong]} />
            <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          </View>
          <View style={styles.skeletonAction} />
        </View>
      ))}
    </View>
  );

  const renderSection = (
    title: string,
    subtitle: string,
    items: SearchFoodResult[],
    emptyText: string,
    options?: RenderSectionOptions,
  ) => {
    const shouldShowEmptyCta = Boolean(options?.emptyCta) && items.length === 0;

    const headerContent = (
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.sectionHeaderMeta}>
          {items.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{items.length}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );

    return (
      <View style={styles.sectionCard}>
        {headerContent}
        <View style={styles.sectionStack}>
          {options?.loading ? (
            renderSkeletonRows()
          ) : items.length === 0 ? (
            <>
              <Text style={styles.emptyText}>{emptyText}</Text>
              {shouldShowEmptyCta ? (
                <View>
                  <Pressable
                    onPress={options?.emptyCta?.onPress}
                    style={({ pressed }) => [
                      styles.moreRow,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.moreCopy}>
                      <Text style={styles.moreTitle}>
                        {options?.emptyCta?.title}
                      </Text>
                      <Text style={styles.moreText}>
                        {options?.emptyCta?.text}
                      </Text>
                    </View>
                    <View style={styles.morePill}>
                      <Text style={styles.morePillText}>
                        {options?.emptyCta?.pillText}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            items.map((item) =>
              renderFoodCard(
                item,
                item.localId != null && favoriteIds.has(item.localId),
              ),
            )
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.cardPressed,
              ]}
            >
              <ArrowLeftIcon
                size={18}
                color={appColors.textPrimary}
                weight="bold"
              />
            </Pressable>
          </View>
          <View style={styles.searchModeRow}>
            <Pressable
              onPress={() => setSearchMode("all")}
              accessibilityLabel="Search all foods"
              style={({ pressed }) => [
                styles.searchModePill,
                searchMode === "all" && styles.searchModePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <MagnifyingGlassIcon
                size={15}
                color={searchMode === "all" ? appColors.white : appColors.brand500}
                weight="bold"
              />
              <Text
                style={[
                  styles.searchModeText,
                  searchMode === "all" && styles.searchModeTextActive,
                ]}
              >
                Foods
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSearchMode("recipes")}
              accessibilityLabel="Search recipes"
              style={({ pressed }) => [
                styles.searchModePill,
                searchMode === "recipes" && styles.searchModePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <CookingPotIcon
                size={14}
                color={
                  searchMode === "recipes"
                    ? appColors.white
                    : appColors.brand500
                }
                weight="fill"
              />
              <Text
                style={[
                styles.searchModeText,
                  searchMode === "recipes" && styles.searchModeTextActive,
                ]}
              >
                Recipes
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSearchMode("custom_meals")}
              accessibilityLabel="Search custom meals"
              style={({ pressed }) => [
                styles.searchModePill,
                searchMode === "custom_meals" && styles.searchModePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <ForkKnifeIcon
                size={14}
                color={
                  searchMode === "custom_meals"
                    ? appColors.white
                    : appColors.brand500
                }
                weight="fill"
              />
              <Text
                style={[
                  styles.searchModeText,
                  searchMode === "custom_meals" && styles.searchModeTextActive,
                ]}
              >
                Meals
              </Text>
            </Pressable>
          </View>
          <FoodLogContextBar context={foodLogContext} />
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <MagnifyingGlassIcon
                size={18}
                color={appColors.textMuted}
                weight="bold"
              />
              <TextInput
                placeholder={searchPlaceholder}
                placeholderTextColor={appColors.textMuted}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query.trim().length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.clearSearchButton,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <XIcon size={17} color={appColors.textMuted} weight="bold" />
                </Pressable>
              ) : null}
            </View>
            {shouldShowScanner ? (
              <Pressable
                onPress={() => setScannerVisible(true)}
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.cardPressed,
                ]}
              >
                <BarcodeIcon size={20} color={appColors.white} weight="bold" />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.searchHint}>
            {searchMode === "recipes"
              ? query.trim()
                ? isSearching
                  ? "Searching recipes..."
                  : `${activeResults.length} recipes`
                : "Saved and public recipes."
              : searchMode === "custom_meals"
                ? query.trim()
                  ? isSearching
                    ? "Searching meals..."
                    : `${activeResults.length} meals`
                  : "Saved and public meals."
              : query.trim()
                ? isSearching
                  ? "Searching foods..."
                  : activeResults.length > 0
                    ? `${activeResults.length} results`
                    : "No matches yet."
                : "Frequent foods ready to log."}
          </Text>
          {query.trim() && isUsingLocalSearchOnly && searchMode === "all" ? (
            <View style={styles.searchNotice}>
              <Text style={styles.searchNoticeText}>
                Showing saved foods only. Remote search is unavailable.
              </Text>
            </View>
          ) : null}
          {!query.trim() &&
          searchMode === "all" &&
          recentSearches.length > 0 ? (
            <View style={styles.recentSearchRow}>
              <Text style={styles.recentSearchLabel}>Recent</Text>
              {recentSearches.map((search) => (
                <Pressable
                  key={search}
                  onPress={() => setQuery(search)}
                  style={({ pressed }) => [
                    styles.recentSearchChip,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <Text style={styles.recentSearchChipText}>{search}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {query.trim() ? (
          searchMode === "recipes" || searchMode === "custom_meals" ? (
            isSearching && activeResults.length === 0 ? (
              renderSection(
                searchMode === "recipes" ? "Recipes" : "Custom Meals",
                "Searching saved and public items.",
                activeResults,
                "",
                { loading: true },
              )
            ) : activeResults.length === 0 ? (
              renderSection(
                searchMode === "recipes" ? "Recipes" : "Custom Meals",
                searchMode === "recipes"
                  ? "Search across your recipes and public recipes."
                  : "Search across your custom meals and public custom meals.",
                activeResults,
                searchMode === "recipes"
                  ? "No recipes matched that search yet."
                  : "No custom meals matched that search yet.",
                searchMode === "custom_meals"
                  ? {
                      emptyCta: {
                        onPress: openCreateCustomMeal,
                        pillText: "New",
                        title: "Create custom meal",
                        text: `Build a reusable meal for ${resolvedContextLabel}.`,
                      },
                    }
                  : undefined,
              )
            ) : (
              <>
                {librarySections.map((section) => (
                  <React.Fragment key={section.key}>
                    {renderSection(
                      section.title,
                      section.subtitle,
                      section.items,
                      section.emptyText,
                    )}
                  </React.Fragment>
                ))}
              </>
            )
          ) : isSearching && activeResults.length === 0 ? (
            renderSection(
              "Results",
              "Searching foods and nutrition databases.",
              activeResults,
              "",
              { loading: true },
            )
          ) : activeResults.length === 0 ? (
            renderSection(
              "Results",
              "Try another search or create your own custom meal.",
              activeResults,
              "No foods matched that search yet.",
              {
                emptyCta: {
                  onPress: openCreateCustomMeal,
                  pillText: "New",
                  title: "Create custom meal",
                  text: `Build a reusable meal for ${resolvedContextLabel}.`,
                },
              },
            )
          ) : (
            <>
              {categorizedQueryResults.map((section) => (
                <React.Fragment key={section.key}>
                  {renderSection(
                    section.title,
                    section.subtitle,
                    section.items,
                    "No foods matched that search yet.",
                  )}
                </React.Fragment>
              ))}
            </>
          )
        ) : searchMode === "recipes" || searchMode === "custom_meals" ? (
          isStaticListsLoading && activeResults.length === 0 ? (
            renderSection(
              searchMode === "recipes" ? "Recipes" : "Custom Meals",
              "Loading saved and public items.",
              activeResults,
              "",
              { loading: true },
            )
          ) : (
          <>
            {librarySections.map((section) => (
              <React.Fragment key={section.key}>
                {renderSection(
                  section.title,
                  section.subtitle,
                  section.items,
                  section.emptyText,
                  section.key === "yours"
                    ? {
                        emptyCta:
                          searchMode === "recipes"
                            ? {
                                onPress: openCreateRecipe,
                                pillText: "Recipe",
                                title: "Create recipe",
                                text: `Save a recipe for ${resolvedContextLabel}.`,
                              }
                            : {
                                onPress: openCreateCustomMeal,
                                pillText: "New",
                                title: "Create custom meal",
                                text: `Build a reusable meal for ${resolvedContextLabel}.`,
                              },
                      }
                    : undefined,
                )}
              </React.Fragment>
            ))}
          </>
          )
        ) : (
          renderSection(
            "Frequent",
            "Favorites and recent foods, ready to log.",
            frequentResults,
            "No frequent foods yet. Search or scan once and your repeat picks will appear here.",
            {
              emptyCta: {
                onPress: openQuickAddFood,
                pillText: "Quick",
                title: "Quick add",
                text: `Log calories and macros for ${resolvedContextLabel}.`,
              },
              loading: isStaticListsLoading && frequentResults.length === 0,
            },
          )
        )}
      </KeyboardAwareScrollView>

      <FoodBarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onFoodResolved={handleScannedFoodResolved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    paddingTop: 2,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderColor: appColors.surfaceGhostStrong,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  heroHeaderCopy: {
    flex: 1,
  },
    moreTitle: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  moreText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  morePill: {
    borderRadius: 9999,
    backgroundColor: appColors.slate50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
   moreCopy: {
    flex: 1,
  },
  morePillText: {
    color: appColors.slate900,
    fontSize: 12,
    fontWeight: "600",
  },
  searchModeRow: {
    width: "100%",
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  searchModePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 999,
    minHeight: 44,
    paddingVertical: 9,
  },
  searchModePillActive: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  searchModeText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "600",
  },
  searchModeTextActive: {
    color: appColors.white,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  contextPillText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "600",
  },
  heroTitle: {
    color: appColors.textPrimary,
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 4,
  },
  heroText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 9999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 2,
    borderColor: appColors.surfaceGhostStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  heroActionPrimary: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  heroActionText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  heroActionTextPrimary: {
    color: appColors.white,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingLeft: 12,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  clearSearchButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  moreRowAccent: {
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  selectedSlotRow: {
    backgroundColor: appColors.surfaceCardAlt,
    borderColor: appColors.borderStrong,
  },
  scanButton: {
    minWidth: 50,
    flexDirection: "row",
    gap: 6,
    borderRadius: 9999,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scanButtonText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  searchHint: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  searchNotice: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: appColors.warningSurface,
    borderWidth: 1,
    borderColor: appColors.warning600,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  searchNoticeText: {
    color: appColors.warning700,
    fontSize: 11,
    fontWeight: "600",
  },
  recentSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  recentSearchLabel: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  recentSearchChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  recentSearchChipText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderButton: {
    borderRadius: 8,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  countPill: {
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  countPillText: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "600",
  },
  sectionStack: {
    marginTop: 10,
    gap: 8,
  },
  emptyText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  togglePillExpanded: {
    backgroundColor: appColors.surfaceGhost,
  },
  togglePillText: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "600",
  },
  togglePillTextExpanded: {
    color: appColors.brand300,
  },
  foodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  foodBody: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  foodTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 7,
  },
  foodMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 5,
  },
  foodBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  foodBadge: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  foodBadgeText: {
    color: appColors.brand500,
    fontSize: 10,
    fontWeight: "600",
  },
  ownershipChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ownershipChipOwned: {
    backgroundColor: appColors.brand800,
    borderColor: appColors.brand500,
  },
  ownershipChipPublic: {
    backgroundColor: appColors.surfaceGhost,
    borderColor: appColors.borderStrong,
  },
  ownershipChipText: {
    fontSize: 10,
    fontWeight: "600",
  },
  ownershipChipTextOwned: {
    color: appColors.brand700,
  },
  ownershipChipTextPublic: {
    color: appColors.textSecondary,
  },
  foodCalories: {
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 76,
    textAlign: "right",
  },
  foodName: {
    flex: 1,
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  supportingMeta: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 3,
  },
  foodMacroText: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  foodActionColumn: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  iconAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceCard,
  },
  secondaryAction: {
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryActionActive: {
    backgroundColor: appColors.success700,
  },
  secondaryActionMuted: {
    backgroundColor: appColors.surfaceField,
    borderColor: appColors.borderSoft,
  },
  publicPill: {
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  publicPillText: {
    color: appColors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  secondaryActionText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryActionTextActive: {
    color: appColors.white,
  },
  secondaryActionTextMuted: {
    color: appColors.textSecondary,
  },
  primaryAction: {
    minWidth: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: appColors.brand700,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickLogAction: {
    minWidth: 70,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: appColors.actionPrimary,
    gap: 5,
    paddingHorizontal: 12,
  },
  quickLogText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "500",
  },
  primaryActionLoading: {
    opacity: 0.56,
  },
  primaryActionText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  cardPressed: {
    opacity: 0.9,
  },
  skeletonStack: {
    gap: 8,
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhostStrong,
  },
  skeletonLineShort: {
    width: "28%",
  },
  skeletonLineMedium: {
    width: "54%",
  },
  skeletonLineLong: {
    width: "82%",
  },
  skeletonAction: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhostStrong,
  },
});

export default AddFoodScreen;
