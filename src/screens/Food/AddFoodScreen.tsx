import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Pressable,
  ScrollView,
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
  CalendarIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  LightningIcon,
  MagnifyingGlassIcon,
} from "phosphor-react-native";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { API } from "../../API/apiCaller";
import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBUser,
  SaveFoodItemInput,
} from "../../store/DB_TYPES";
import {
  getFoodSearchSectionState,
  saveFoodSearchSectionState,
  type FoodSearchSectionState,
} from "../../storage/localStore";
import FoodBarcodeScannerModal from "./FoodBarcodeScannerModal";
import type { ScannedFoodLookupResult } from "./FoodBarcodeScannerShared";
import {
  buildFoodLoggedAt,
  formatFoodItemServing,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodNumber,
  formatFoodShortDate,
  formatFoodSourceLabel,
} from "./foodUtils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appColors } from "../../theme/colors";

type AddFoodRoute = RouteProp<FoodStackParamList, "AddFood">;
type AddFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "AddFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

type SearchFoodResult = SaveFoodItemInput & {
  key: string;
  localId: number | null;
};

type FoodSearchSectionKey = "favorites" | "recent";
type FoodSearchMode = "all" | "recipes";

const DEFAULT_SECTION_STATE: FoodSearchSectionState = {
  favoritesExpanded: true,
  recentExpanded: true,
};

const SEARCH_DEBOUNCE_MS = 350;
const REMOTE_SEARCH_MIN_QUERY_LENGTH = 3;
const REMOTE_BARCODE_QUERY_PATTERN = /^\d{8,}$/;
const MAX_SEARCH_RESULTS = 30;

const getSearchCacheKey = (mode: FoodSearchMode, query: string) =>
  `${mode}:${query}`;

const getFoodIdentityKey = ({
  barcode,
  name,
  source,
  sourceId,
}: Pick<SearchFoodResult, "barcode" | "name" | "source" | "sourceId">) => {
  const fallback = name.trim().toLowerCase();
  return `${source}:${sourceId?.trim() ?? barcode?.trim() ?? fallback}`;
};

const toSearchFoodResult = (
  food: SaveFoodItemInput,
  localId: number | null,
): SearchFoodResult => ({
  ...food,
  key: `${getFoodIdentityKey({
    source: food.source,
    sourceId: food.sourceId,
    barcode: food.barcode,
    name: food.name,
  })}:${localId ?? "remote"}`,
  localId,
});

const fromDbFoodItem = (food: DBFoodItem): SearchFoodResult => {
  const {
    id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...saveInput
  } = food;
  return toSearchFoodResult(saveInput, id);
};

const normalizeSearchText = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compactSearchText = (value?: string | null) =>
  normalizeSearchText(value).replace(/\s+/g, "");

const singularizeSearchWord = (value: string) => {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }

  return null;
};

const getSearchVariants = (query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const variants = new Set<string>([normalizedQuery]);

  if (!normalizedQuery.includes(" ")) {
    const singular = singularizeSearchWord(normalizedQuery);
    if (singular) {
      variants.add(singular);
    }
  }

  return [...variants];
};

const shouldSearchRemotely = (query: string) =>
  query.length >= REMOTE_SEARCH_MIN_QUERY_LENGTH ||
  REMOTE_BARCODE_QUERY_PATTERN.test(query);

const getSearchResultDedupeKeys = (food: SearchFoodResult) => {
  const dedupeKeys = new Set<string>([`identity:${getFoodIdentityKey(food)}`]);
  const barcode = food.barcode?.trim();

  if (barcode) {
    dedupeKeys.add(`barcode:${barcode}`);
  }

  if (food.source !== "custom" && food.source !== "manual") {
    const displayKey = compactSearchText(`${food.brand ?? ""} ${food.name}`);
    if (displayKey) {
      dedupeKeys.add(`display:${displayKey}`);
    }
  }

  return [...dedupeKeys];
};

const scoreSearchFoodResult = (food: SearchFoodResult, query: string) => {
  const queryVariants = getSearchVariants(query);
  const compactQueryVariants = queryVariants.map(compactSearchText);
  const tokenSet = new Set<string>();

  for (const variant of queryVariants) {
    variant
      .split(" ")
      .filter(Boolean)
      .forEach((token) => tokenSet.add(token));
  }

  const tokens = [...tokenSet];
  const normalizedName = normalizeSearchText(food.name);
  const normalizedBrand = normalizeSearchText(food.brand);
  const normalizedCombined = normalizeSearchText(
    `${food.brand ?? ""} ${food.name}`,
  );
  const compactName = compactSearchText(food.name);
  const compactCombined = compactSearchText(`${food.brand ?? ""} ${food.name}`);
  const exactBarcodeMatch =
    food.barcode?.trim() != null && food.barcode?.trim() === query.trim();

  let score = 0;

  if (exactBarcodeMatch) {
    score += 1400;
  }

  if (queryVariants.some((variant) => normalizedName === variant)) {
    score += 950;
  }

  if (queryVariants.some((variant) => normalizedCombined === variant)) {
    score += 900;
  }

  if (queryVariants.some((variant) => normalizedBrand === variant)) {
    score += 480;
  }

  if (
    compactQueryVariants.some(
      (variant) =>
        variant.length > 0 &&
        (compactName === variant || compactCombined.includes(variant)),
    )
  ) {
    score += 760;
  }

  if (queryVariants.some((variant) => normalizedName.startsWith(variant))) {
    score += 620;
  }

  if (queryVariants.some((variant) => normalizedCombined.startsWith(variant))) {
    score += 540;
  }

  if (queryVariants.some((variant) => normalizedBrand.startsWith(variant))) {
    score += 320;
  }

  if (queryVariants.some((variant) => normalizedName.includes(variant))) {
    score += 300;
  }

  if (queryVariants.some((variant) => normalizedCombined.includes(variant))) {
    score += 240;
  }

  if (queryVariants.some((variant) => normalizedBrand.includes(variant))) {
    score += 140;
  }

  const matchedTokenCount = tokens.filter((token) =>
    normalizedCombined.includes(token),
  ).length;

  score += matchedTokenCount * 70;

  if (tokens.length > 0 && matchedTokenCount === tokens.length) {
    score += 220;
  }

  if (food.localId != null) {
    score += 130;
  }

  if (food.source === "usda") {
    score += 30;
  }

  if (food.verified) {
    score += 20;
  }

  if (food.brand) {
    score += 8;
  }

  if (!food.isComplete) {
    score -= 25;
  }

  return score;
};

const rankSearchResults = (query: string, results: SearchFoodResult[]) => {
  const scoredResults = [...results].sort((left, right) => {
    const scoreDifference =
      scoreSearchFoodResult(right, query) - scoreSearchFoodResult(left, query);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if ((right.localId != null) !== (left.localId != null)) {
      return Number(right.localId != null) - Number(left.localId != null);
    }

    return left.name.localeCompare(right.name);
  });

  const seen = new Set<string>();
  const uniqueResults: SearchFoodResult[] = [];

  for (const result of scoredResults) {
    const dedupeKeys = getSearchResultDedupeKeys(result);

    if (dedupeKeys.some((key) => seen.has(key))) {
      continue;
    }

    uniqueResults.push(result);
    dedupeKeys.forEach((key) => seen.add(key));

    if (uniqueResults.length >= MAX_SEARCH_RESULTS) {
      break;
    }
  }

  return uniqueResults;
};

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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<FoodSearchMode>("all");
  const [sectionState, setSectionState] = useState<FoodSearchSectionState>(
    DEFAULT_SECTION_STATE,
  );
  const searchCacheRef = React.useRef(new Map<string, SearchFoodResult[]>());

  const loadStaticLists = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    const recipeFoodsPromise = DB.listFoodItems({
      source: "recipe",
      limit: 60,
    });

    if (!currentUser) {
      setRecipes(await recipeFoodsPromise);
      setRecent([]);
      setFavorites([]);
      return;
    }

    const [recentFoods, favoriteFoods, recipeFoods] = await Promise.all([
      DB.getRecentFoodItems(currentUser.externalId, 10),
      DB.getFavoriteFoodItems(currentUser.externalId, 10),
      recipeFoodsPromise,
    ]);

    setRecent(recentFoods);
    setFavorites(favoriteFoods);
    setRecipes(recipeFoods);
  }, []);

  const searchFoods = useCallback(
    async (normalizedQuery: string, mode: FoodSearchMode) => {
      const cacheKey = getSearchCacheKey(mode, normalizedQuery);
      const cachedResults = searchCacheRef.current.get(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const [localRows, remoteRows] = await Promise.all([
        DB.searchFoodItems(normalizedQuery, 40),
        mode === "all" && shouldSearchRemotely(normalizedQuery)
          ? API.usdaAPI.getFood(normalizedQuery, { pageSize: 12 })
          : Promise.resolve([]),
      ]);

      const localResults = localRows
        .filter((food) =>
          mode === "recipes" ? food.source === "recipe" : true,
        )
        .map(fromDbFoodItem);
      const localKeys = new Set(
        localResults.flatMap(getSearchResultDedupeKeys),
      );
      const remoteResults = remoteRows
        .filter((food) =>
          getSearchResultDedupeKeys(toSearchFoodResult(food, null)).every(
            (key) => !localKeys.has(key),
          ),
        )
        .map((food) => toSearchFoodResult(food, null));

      const rankedResults = rankSearchResults(normalizedQuery, [
        ...localResults,
        ...remoteResults,
      ]);
      searchCacheRef.current.set(cacheKey, rankedResults);

      return rankedResults;
    },
    [],
  );

  const persistFoodIfNeeded = useCallback(async (food: SearchFoodResult) => {
    if (food.localId != null) {
      return food.localId;
    }

    const { key: _key, localId: _localId, ...saveInput } = food;
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
    () => favorites.map(fromDbFoodItem),
    [favorites],
  );

  const recentResults = useMemo(() => recent.map(fromDbFoodItem), [recent]);
  const recipeResults = useMemo(() => recipes.map(fromDbFoodItem), [recipes]);

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

  const openCreateCustomFood = useCallback(() => {
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
      const recipeId = Number(food.sourceId);

      if (food.source !== "recipe" || !Number.isFinite(recipeId)) {
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

  const activeResults = useMemo(() => {
    if (query.trim()) {
      return results;
    }

    if (searchMode === "recipes") {
      return recipeResults;
    }

    return [];
  }, [query, recipeResults, results, searchMode]);
  const searchPlaceholder =
    searchMode === "recipes" ? "Search recipes" : "Search foods";
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
    const isRecipe = food.source === "recipe";

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
                  {formatFoodSourceLabel(food.source)}
                </Text>
              </View>
              {food.verified ? (
                <View style={styles.foodBadge}>
                  <Text style={styles.foodBadgeText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.foodCalories}>
              {formatFoodNumber(food.calories, " kcal")}
            </Text>
          </View>
          <Text style={styles.foodName} numberOfLines={2}>
            {food.name}
          </Text>
          <Text style={styles.foodMeta} numberOfLines={1}>
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
          <Pressable
            onPress={() =>
              isRecipe
                ? openRecipeEditor(food)
                : void toggleFavorite(food, isFavorite)
            }
            style={({ pressed }) => [
              styles.secondaryAction,
              !isRecipe && isFavorite && styles.secondaryActionActive,
              pressed && styles.cardPressed,
            ]}
          >
            <Text
              style={[
                styles.secondaryActionText,
                !isRecipe && isFavorite && styles.secondaryActionTextActive,
              ]}
            >
              {isRecipe ? "Edit" : isFavorite ? "Saved" : "Save"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void openFoodEditor(food)}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.primaryActionText}>Open</Text>
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
    options?: {
      collapsible?: boolean;
      expanded?: boolean;
      onToggle?: () => void;
    },
  ) => {
    const collapsible = options?.collapsible ?? false;
    const expanded = options?.expanded ?? true;
    const toggleLabel = expanded ? "Hide" : "Open";
    const toggleColor = expanded
      ? appColors.foodAccentText
      : appColors.foodPrimary;
    const shouldShowNoResultsExtra =
      subtitle === "Pick a match and confirm the amount." && items.length === 0;

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
                {shouldShowNoResultsExtra ? (
                  <View>
                    <Pressable
                      onPress={openCreateCustomFood}
                      style={({ pressed }) => [
                        styles.moreRow,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={styles.moreCopy}>
                        <Text style={styles.moreTitle}>Create custom food</Text>
                        <Text style={styles.moreText}>
                          Add a new item for {resolvedContextLabel}.
                        </Text>
                      </View>
                      <View style={styles.morePill}>
                        <Text style={styles.morePillText}>New</Text>
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
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
                    : appColors.foodPrimary
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
          </View>
          <View style={styles.contextRow}>
            {mealType ? (
              <View style={styles.contextPill}>
                <Text style={styles.contextPillText}>{mealType}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <MagnifyingGlassIcon
                size={18}
                color={appColors.foodPlaceholder}
                weight="bold"
              />
              <TextInput
                placeholder={searchPlaceholder}
                placeholderTextColor={appColors.foodPlaceholder}
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
                  ? "Searching your saved recipes..."
                  : `${activeResults.length} saved recipes match this search.`
                : ""
              : query.trim()
                ? isSearching
                  ? "Searching your foods and USDA branded + generic foods..."
                  : `${activeResults.length} matches across local foods and USDA results.`
                : ""}
          </Text>
        </View>

        {query.trim() ? (
          renderSection(
            searchMode === "recipes" ? "Recipes" : "Results",
            searchMode === "recipes"
              ? "Saved recipes matching your search."
              : "Pick a match and confirm the amount.",
            activeResults,
            searchMode === "recipes"
              ? "No recipes matched that search yet."
              : "No foods matched that search yet.",
          )
        ) : searchMode === "recipes" ? (
          renderSection(
            "Recipes",
            "Saved recipes you can add like any other food item.",
            activeResults,
            "No recipes yet. Create one above and it will show up here.",
          )
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
      </ScrollView>

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
    backgroundColor: appColors.foodScreenBg,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 24,
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
    color: appColors.foodText,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  moreText: {
    color: appColors.foodMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  morePill: {
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
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
    color: appColors.revolutDark,
    fontSize: 12,
    fontWeight: "800",
  },
  searchModeRow: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 12,
  },
  searchModePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: appColors.foodFieldBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingVertical: 12,
  },
  searchModePillActive: {
    backgroundColor: appColors.foodPrimaryDark,
    borderColor: appColors.foodPrimaryDark,
  },
  searchModeText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  searchModeTextActive: {
    color: appColors.white,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  contextRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: appColors.foodPillBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  contextPillText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 4,
  },
  heroText: {
    color: appColors.foodMuted,
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
    borderColor: appColors.whiteOverlay18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  heroActionPrimary: {
    backgroundColor: appColors.foodPrimaryDark,
    borderColor: appColors.foodPrimaryDark,
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
    borderColor: appColors.foodBorder,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingLeft: 12,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "700",
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  moreRowAccent: {
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  selectedSlotRow: {
    backgroundColor: appColors.raw_hex_F4F0FF,
    borderColor: appColors.raw_hex_DCD2F8,
  },
  scanButton: {
    minWidth: 50,
    flexDirection: "row",
    gap: 6,
    borderRadius: 9999,
    backgroundColor: appColors.foodPrimaryDark,
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
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 24,
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
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  countPill: {
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  countPillText: {
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  sectionStack: {
    marginTop: 10,
    gap: 8,
  },
  emptyText: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: appColors.foodFieldBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  togglePillExpanded: {
    backgroundColor: appColors.foodPillBg,
  },
  togglePillText: {
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  togglePillTextExpanded: {
    color: appColors.foodAccentText,
  },
  foodCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 20,
    backgroundColor: appColors.foodSurfaceAlt,
    borderWidth: 1,
    borderColor: appColors.foodSoftBorder,
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
    borderColor: appColors.foodBorder,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  foodBadgeText: {
    color: appColors.foodPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
  foodCalories: {
    color: appColors.foodInk,
    fontSize: 12,
    fontWeight: "800",
  },
  foodName: {
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  foodMeta: {
    color: appColors.foodMeta,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 3,
  },
  foodMacroText: {
    color: appColors.foodPrimary,
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
    borderColor: appColors.foodBorder,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryActionActive: {
    backgroundColor: appColors.foodOrbBottom,
  },
  secondaryActionText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryActionTextActive: {
    color: appColors.foodAccentText,
  },
  primaryAction: {
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryActionText: {
    color: appColors.revolutDark,
    fontSize: 12,
    fontWeight: "600",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default AddFoodScreen;
