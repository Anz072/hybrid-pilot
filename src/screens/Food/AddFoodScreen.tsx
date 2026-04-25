import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
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
  BarcodeIcon,
  CaretDownIcon,
  CaretUpIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  LightningIcon,
  MagnifyingGlassIcon,
} from "phosphor-react-native";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import {
  getFoodSearchSectionState,
  getFoodTrackingPreferences,
  saveFoodSearchSectionState,
  saveFoodTrackingPreferences,
  type FoodSearchSectionState,
} from "../../storage/localStore";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import FoodBarcodeScannerModal from "./FoodBarcodeScannerModal";
import type { ScannedFoodLookupResult } from "./FoodBarcodeScannerShared";
import {
  buildFoodLoggedAt,
  formatFoodItemServing,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodNumber,
  formatFoodSourceLabel,
  getFoodDefaultLogAmount,
} from "./foodUtils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appColors } from "../../theme/colors";
import {
  fromDbFoodItem,
  searchFoodResults,
  type FoodSearchResult,
} from "./foodSearch";

type AddFoodRoute = RouteProp<FoodStackParamList, "AddFood">;
type AddFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "AddFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

type SearchFoodResult = FoodSearchResult;

type FoodSearchSectionKey = "favorites" | "recent";
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
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  emptyCta?: {
    onPress: () => void;
    pillText: string;
    text: string;
    title: string;
  };
};

const DEFAULT_SECTION_STATE: FoodSearchSectionState = {
  favoritesExpanded: true,
  recentExpanded: true,
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
    subtitle: "Saved custom foods and manual entries first.",
  },
  common_foods: {
    title: "Common Foods",
    subtitle: "Generic foods without a brand.",
  },
  branded_foods: {
    title: "Branded Foods",
    subtitle: "Packaged and brand-specific matches.",
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

const AddFoodScreen = () => {
  const route = useRoute<AddFoodRoute>();
  const navigation = useNavigation<AddFoodNav>();
  const insets = useSafeAreaInsets();

  const { contextLabel, date, loggedAt, mealType } = route.params;

  const [user, setUser] = useState<DBUser | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFoodResult[]>([]);
  const [recent, setRecent] = useState<DBFoodItem[]>([]);
  const [favorites, setFavorites] = useState<DBFoodItem[]>([]);
  const [recipes, setRecipes] = useState<DBFoodItem[]>([]);
  const [customMeals, setCustomMeals] = useState<DBFoodItem[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<FoodSearchMode>("all");
  const [sectionState, setSectionState] = useState<FoodSearchSectionState>(
    DEFAULT_SECTION_STATE,
  );
  const [fastLogEnabled, setFastLogEnabled] = useState(false);
  const [quickLoggingKey, setQuickLoggingKey] = useState<string | null>(null);
  const searchCacheRef = React.useRef(new Map<string, SearchFoodResult[]>());

  const loadStaticLists = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    const recipeFoodsPromise = DB.listFoodItems({
      source: "recipe",
      limit: 60,
    });
    const customMealFoodsPromise = DB.listFoodItems({
      source: "custom_meal",
      limit: 60,
    });

    if (!currentUser) {
      const [recipeFoods, customMealFoods] = await Promise.all([
        recipeFoodsPromise,
        customMealFoodsPromise,
      ]);
      setRecipes(recipeFoods);
      setCustomMeals(customMealFoods);
      setRecent([]);
      setFavorites([]);
      return;
    }

    const [recentFoods, favoriteFoods, recipeFoods, customMealFoods] =
      await Promise.all([
      DB.getRecentFoodItems(currentUser.externalId, 10),
      DB.getFavoriteFoodItems(currentUser.externalId, 10),
      recipeFoodsPromise,
      customMealFoodsPromise,
    ]);

    setRecent(recentFoods);
    setFavorites(favoriteFoods);
    setRecipes(recipeFoods);
    setCustomMeals(customMealFoods);
  }, []);

  const searchFoods = useCallback(
    async (normalizedQuery: string, mode: FoodSearchMode) => {
      const cacheKey = getSearchCacheKey(mode, normalizedQuery);
      const cachedResults = searchCacheRef.current.get(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

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
        rankOptions: ADD_FOOD_SEARCH_RANK_OPTIONS,
      });
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

    return savedId;
  }, []);

  useEffect(() => {
    void loadStaticLists();
  }, [loadStaticLists]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = async () => {
        searchCacheRef.current.clear();
        await loadStaticLists();

        const normalized = query.trim();
        if (!normalized) {
          return;
        }

        setIsSearching(true);
        const refreshedResults = await searchFoods(normalized, searchMode);

        if (!active) {
          return;
        }

        setResults(refreshedResults);
        setIsSearching(false);
      };

      void refresh();

      return () => {
        active = false;
      };
    }, [loadStaticLists, query, searchFoods, searchMode]),
  );

  useEffect(() => {
    let cancelled = false;

    const loadSectionState = async () => {
      const nextState = await getFoodSearchSectionState();
      if (!cancelled) {
        setSectionState(nextState);
      }
    };

    void loadSectionState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTrackingPreferences = async () => {
      const preferences = await getFoodTrackingPreferences();
      if (!cancelled) {
        setFastLogEnabled(preferences.fastLogEnabled);
      }
    };

    void loadTrackingPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const normalized = query.trim();
      if (!normalized) {
        setResults([]);
        setIsSearching(false);
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
  }, [query, searchFoods, searchMode]);

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
  const recipeResults = useMemo(
    () => recipes.map((food) => fromDbFoodItem(food)),
    [recipes],
  );
  const customMealResults = useMemo(
    () => customMeals.map((food) => fromDbFoodItem(food)),
    [customMeals],
  );

  const resolvedLoggedAt = useMemo(() => {
    if (loggedAt) {
      return loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(date, now.getHours(), now.getMinutes());
  }, [date, loggedAt]);

  const resolvedContextLabel = useMemo(() => {
    const trimmed = contextLabel?.trim();
    if (trimmed) {
      return trimmed;
    }

    return formatFoodLoggedTime(resolvedLoggedAt);
  }, [contextLabel, resolvedLoggedAt]);

  const handleScannedFoodResolved = useCallback(
    (result: ScannedFoodLookupResult) => {
      setScannerVisible(false);
      navigation.navigate("ScannedFood", {
        foodId: result.foodId,
        barcode: result.barcode,
        scanStatus: result.status,
        contextLabel: resolvedContextLabel,
        date,
        loggedAt: resolvedLoggedAt,
        mealType,
      });
    },
    [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt],
  );

  const openCreateCustomMeal = useCallback(() => {
    navigation.navigate("CreateCustomFood", {
      contextLabel: resolvedContextLabel,
      date,
      loggedAt: resolvedLoggedAt,
      mealType,
    });
  }, [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt]);

  const openQuickAddFood = useCallback(() => {
    navigation.navigate("QuickAddFood", {
      contextLabel: resolvedContextLabel,
      date,
      loggedAt: resolvedLoggedAt,
      mealType,
    });
  }, [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt]);

  const openCreateRecipe = useCallback(() => {
    navigation.navigate("CreateRecipe", {
      contextLabel: resolvedContextLabel,
      date,
      loggedAt: resolvedLoggedAt,
      mealType,
    });
  }, [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt]);

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
        contextLabel: resolvedContextLabel,
        date,
        loggedAt: resolvedLoggedAt,
        mealType,
        recipeId,
      });
    },
    [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt],
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
        contextLabel: resolvedContextLabel,
        date,
        loggedAt: resolvedLoggedAt,
        mealType,
        mealId,
      });
    },
    [date, mealType, navigation, resolvedContextLabel, resolvedLoggedAt],
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
      foodId,
      date,
      loggedAt: resolvedLoggedAt,
      mealType,
      contextLabel: resolvedContextLabel,
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
    await Promise.all([
      loadStaticLists(),
      query.trim()
        ? searchFoods(query.trim(), searchMode).then(setResults)
        : Promise.resolve(),
    ]);
  };

  const toggleFastLog = useCallback(() => {
    setFastLogEnabled((current) => {
      const nextValue = !current;
      void saveFoodTrackingPreferences({ fastLogEnabled: nextValue });
      return nextValue;
    });
  }, []);

  const quickLogFood = async (food: SearchFoodResult) => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

    if (quickLoggingKey) {
      return;
    }

    try {
      setQuickLoggingKey(food.key);
      const foodId = await persistFoodIfNeeded(food);
      await DB.addUserFoodLog({
        userExternalId: user.externalId,
        foodId,
        date,
        loggedAt: resolvedLoggedAt,
        quantityG: getFoodDefaultLogAmount(food),
        mealType,
      });
      navigation.goBack();
    } catch {
      Alert.alert("Could not log food", "Please review the food and try again.");
    } finally {
      setQuickLoggingKey(null);
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

    return [];
  }, [customMealResults, query, recipeResults, results, searchMode]);
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

  const toggleSection = useCallback((section: FoodSearchSectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSectionState((current) => {
      const nextState =
        section === "favorites"
          ? {
              ...current,
              favoritesExpanded: !current.favoritesExpanded,
            }
          : {
              ...current,
              recentExpanded: !current.recentExpanded,
            };

      void saveFoodSearchSectionState(nextState);
      return nextState;
    });
  }, []);

  const renderFoodCard = (food: SearchFoodResult, isFavorite: boolean) => {
    const isRecipe = isRecipeResult(food);
    const isCustomMeal = isCustomMealResult(food);
    const isLibraryItem = isRecipe || isCustomMeal;
    const isOwnedLibraryItem =
      isLibraryItem && isOwnedLibraryResult(food, user?.externalId);
    const isQuickLogging = quickLoggingKey === food.key;
    const primaryLabel = fastLogEnabled
      ? isQuickLogging
        ? "Logging"
        : "Log"
      : isLibraryItem
        ? "Add"
        : "Open";
    const secondaryLabel = isRecipe
      ? "Edit"
      : isCustomMeal
        ? "Edit"
        : isFavorite
          ? "Saved"
          : "Save";

    return (
      <View key={food.key} style={styles.foodCard}>
        <Pressable
          style={styles.foodBody}
          onPress={() => void openFoodEditor(food)}
        >
          <View style={styles.foodTopRow}>
            <View style={styles.foodBadgeRow}>
              <View style={styles.foodBadge}>
                <Text style={styles.foodBadgeText}>
                  {getLibraryBadgeLabel(food)}
                </Text>
              </View>
            </View>
            <Text style={styles.foodCalories}>
              {formatFoodNumber(food.calories, " kcal")}
            </Text>
          </View>
          <Text style={styles.foodName} numberOfLines={2}>
            {food.name}
          </Text>
          <Text style={styles.slate300} numberOfLines={1}>
            {food.brand ? `${food.brand} | ` : ""}
            {formatFoodItemServing(food)} serving
          </Text>
          <Text style={styles.foodMacroText}>
            {formatFoodMacro(food.proteinG, "P")} |{" "}
            {formatFoodMacro(food.carbsG, "C")} |{" "}
            {formatFoodMacro(food.fatG, "F")}
          </Text>
        </Pressable>
        <View style={styles.foodActionColumn}>
          {isLibraryItem ? (
            isOwnedLibraryItem ? (
              <Pressable
                onPress={() =>
                  isRecipe
                    ? openRecipeEditor(food)
                    : openCustomMealEditor(food)
                }
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.secondaryActionText}>{secondaryLabel}</Text>
              </Pressable>
            ) : (
              <View style={[styles.secondaryAction, styles.secondaryActionMuted]}>
                <Text
                  style={[styles.secondaryActionText, styles.secondaryActionTextMuted]}
                >
                  Public
                </Text>
              </View>
            )
          ) : (
            <Pressable
              onPress={() => void toggleFavorite(food, isFavorite)}
              style={({ pressed }) => [
                styles.secondaryAction,
                isFavorite && styles.secondaryActionActive,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[
                  styles.secondaryActionText,
                  isFavorite && styles.secondaryActionTextActive,
                ]}
              >
                {secondaryLabel}
              </Text>
            </Pressable>
          )}
          <Pressable
            disabled={isQuickLogging}
            onPress={() =>
              fastLogEnabled ? void quickLogFood(food) : void openFoodEditor(food)
            }
            style={({ pressed }) => [
              styles.primaryAction,
              isQuickLogging && styles.primaryActionLoading,
              pressed && styles.cardPressed,
            ]}
          >
            {isQuickLogging ? (
              <ActivityIndicator color={appColors.white} size="small" />
            ) : null}
            <Text style={styles.primaryActionText}>{primaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSection = (
    title: string,
    subtitle: string,
    items: SearchFoodResult[],
    emptyText: string,
    options?: RenderSectionOptions,
  ) => {
    const collapsible = options?.collapsible ?? false;
    const expanded = options?.expanded ?? true;
    const toggleLabel = expanded ? "Hide" : "Open";
    const toggleColor = expanded
      ? appColors.brand300
      : appColors.brand500;
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
          {collapsible ? (
            <View
              style={[styles.togglePill, expanded && styles.togglePillExpanded]}
            >
              <Text
                style={[
                  styles.togglePillText,
                  expanded && styles.togglePillTextExpanded,
                ]}
              >
                {toggleLabel}
              </Text>
              {expanded ? (
                <CaretUpIcon size={14} color={toggleColor} weight="bold" />
              ) : (
                <CaretDownIcon size={14} color={toggleColor} weight="bold" />
              )}
            </View>
          ) : null}
        </View>
      </View>
    );

    return (
      <View style={styles.sectionCard}>
        {collapsible ? (
          <Pressable
            onPress={options?.onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={({ pressed }) => [
              styles.sectionHeaderButton,
              pressed && styles.cardPressed,
            ]}
          >
            {headerContent}
          </Pressable>
        ) : (
          headerContent
        )}
        {expanded ? (
          <View style={styles.sectionStack}>
            {items.length === 0 ? (
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
        ) : null}
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
          <View style={styles.searchModeRow}>
            <Pressable
              onPress={() => setSearchMode("all")}
              style={({ pressed }) => [
                styles.searchModePill,
                searchMode === "all" && styles.searchModePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[
                  styles.searchModeText,
                  searchMode === "all" && styles.searchModeTextActive,
                ]}
              >
                All foods
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSearchMode("recipes")}
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
                Custom Meals
              </Text>
            </Pressable>
          </View>
          <View style={styles.contextRow}>
            <View style={styles.contextPill}>
              <Text style={styles.contextPillText}>
                For {resolvedContextLabel}
              </Text>
            </View>
            {mealType ? (
              <View style={styles.contextPill}>
                <Text style={styles.contextPillText}>{mealType}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={toggleFastLog}
              accessibilityRole="switch"
              accessibilityState={{ checked: fastLogEnabled }}
              style={({ pressed }) => [
                styles.fastLogToggle,
                fastLogEnabled && styles.fastLogToggleActive,
                pressed && styles.cardPressed,
              ]}
            >
              <LightningIcon
                size={14}
                color={fastLogEnabled ? appColors.white : appColors.brand500}
                weight="fill"
              />
              <Text
                style={[
                  styles.fastLogText,
                  fastLogEnabled && styles.fastLogTextActive,
                ]}
              >
                Fast log
              </Text>
              <Text
                style={[
                  styles.fastLogState,
                  fastLogEnabled && styles.fastLogStateActive,
                ]}
              >
                {fastLogEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>
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
                  ? "Searching your recipes and public recipes..."
                  : `${activeResults.length} recipes match this search.`
                : ""
              : searchMode === "custom_meals"
                ? query.trim()
                  ? isSearching
                    ? "Searching your custom meals and public custom meals..."
                    : `${activeResults.length} custom meals match this search.`
                  : ""
              : query.trim()
                ? isSearching
                  ? "Searching your foods and USDA branded + generic foods..."
                  : activeResults.length > 0
                    ? `${activeResults.length} matches grouped into custom foods, common foods, and branded foods.`
                    : "No foods matched yet. Try a broader name or create a custom meal."
                : ""}
          </Text>
        </View>

        {query.trim() ? (
          searchMode === "recipes" || searchMode === "custom_meals" ? (
            activeResults.length === 0 ? (
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
        ) : (
          <>
            {renderSection(
              "Favorites",
              "Fast repeat picks for this diary slot.",
              favoriteResults,
              "No favorite foods yet.",
              {
                collapsible: true,
                expanded: sectionState.favoritesExpanded,
                onToggle: () => toggleSection("favorites"),
              },
            )}
            {renderSection(
              "Recent",
              "Foods you logged recently.",
              recentResults,
              "No recent foods yet.",
              {
                collapsible: true,
                expanded: sectionState.recentExpanded,
                onToggle: () => toggleSection("recent"),
              },
            )}
          </>
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
    fontWeight: "900",
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
    fontWeight: "800",
  },
  searchModeRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
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
    borderRadius: 8,
    paddingVertical: 12,
  },
  searchModePillActive: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  searchModeText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  searchModeTextActive: {
    color: appColors.white,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
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
    fontWeight: "800",
  },
  fastLogToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fastLogToggleActive: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  fastLogText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  fastLogTextActive: {
    color: appColors.white,
  },
  fastLogState: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },
  fastLogStateActive: {
    color: appColors.brand300,
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
    fontWeight: "800",
  },
  searchHint: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
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
    fontWeight: "900",
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
    fontWeight: "800",
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
    fontWeight: "800",
  },
  togglePillTextExpanded: {
    color: appColors.brand300,
  },
  foodCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  foodBody: {
    flex: 1,
  },
  foodTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
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
    fontWeight: "800",
  },
  foodCalories: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  foodName: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  slate300: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 3,
  },
  foodMacroText: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "700",
  },
  foodActionColumn: {
    justifyContent: "center",
    alignItems: "stretch",
    gap: 6,
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
  secondaryActionText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
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
  primaryActionLoading: {
    opacity: 0.8,
  },
  primaryActionText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default AddFoodScreen;

