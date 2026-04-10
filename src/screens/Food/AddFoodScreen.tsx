import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
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
  ForkKnifeIcon,
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
import FoodScreenHeader from "./FoodScreenHeader";
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

const DEFAULT_SECTION_STATE: FoodSearchSectionState = {
  favoritesExpanded: true,
  recentExpanded: true,
};

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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sectionState, setSectionState] =
    useState<FoodSearchSectionState>(DEFAULT_SECTION_STATE);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const loadStaticLists = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setRecent([]);
      setFavorites([]);
      return;
    }

    const [recentFoods, favoriteFoods] = await Promise.all([
      DB.getRecentFoodItems(currentUser.externalId, 10),
      DB.getFavoriteFoodItems(currentUser.externalId, 10),
    ]);

    setRecent(recentFoods);
    setFavorites(favoriteFoods);
  }, []);

  const searchFoods = useCallback(async (normalizedQuery: string) => {
    const [localRows, remoteRows] = await Promise.all([
      DB.searchFoodItems(normalizedQuery, 40),
      API.usdaAPI.getFood(normalizedQuery),
    ]);

    const localResults = localRows.map(fromDbFoodItem);
    const localKeys = new Set(localResults.map(getFoodIdentityKey));
    const remoteResults = remoteRows
      .filter(
        (food) =>
          !localKeys.has(
            getFoodIdentityKey({
              source: food.source,
              sourceId: food.sourceId,
              barcode: food.barcode,
              name: food.name,
            }),
          ),
      )
      .map((food) => toSearchFoodResult(food, null));

    return [...localResults, ...remoteResults];
  }, []);

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

    return savedId;
  }, []);

  useEffect(() => {
    void loadStaticLists();
  }, [loadStaticLists]);

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

      setIsSearching(true);
      const rows = await searchFoods(normalized);
      if (!cancelled) {
        setResults(rows);
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(() => {
      void run();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, searchFoods]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((food) => food.id)),
    [favorites],
  );

  const favoriteResults = useMemo(
    () => favorites.map(fromDbFoodItem),
    [favorites],
  );

  const recentResults = useMemo(() => recent.map(fromDbFoodItem), [recent]);

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
    await Promise.all([
      loadStaticLists(),
      query.trim()
        ? searchFoods(query.trim()).then(setResults)
        : Promise.resolve(),
    ]);
  };

  const activeResults = useMemo(
    () => (query.trim() ? results : []),
    [query, results],
  );

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

  const renderFoodCard = (food: SearchFoodResult, isFavorite: boolean) => (
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
            {isFavorite ? "Saved" : "Save"}
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
              style={[
                styles.togglePill,
                expanded && styles.togglePillExpanded,
              ]}
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
              <Text style={styles.emptyText}>{emptyText}</Text>
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
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroHeaderCopy}>
              <Text style={styles.heroText}>
                Search your library, scan a barcode, or open a custom food.
              </Text>
            </View>
            <Pressable
              onPress={openCreateCustomFood}
              style={({ pressed }) => [
                styles.heroAction,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.heroActionText}>Custom</Text>
            </Pressable>
          </View>
          <View style={styles.contextRow}>
            <View style={styles.contextPill}>
              <ForkKnifeIcon size={14} color={appColors.foodPrimary} weight="fill" />
              <Text style={styles.contextPillText}>{resolvedContextLabel}</Text>
            </View>
            <View style={styles.contextPill}>
              <CalendarIcon size={14} color={appColors.foodPrimary} weight="bold" />
              <Text style={styles.contextPillText}>
                {formatFoodShortDate(date)}
              </Text>
            </View>
            {mealType ? (
              <View style={styles.contextPill}>
                <Text style={styles.contextPillText}>{mealType}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <MagnifyingGlassIcon size={18} color={appColors.foodPlaceholder} weight="bold" />
              <TextInput
                placeholder="Search foods"
                placeholderTextColor={appColors.foodPlaceholder}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>
            <Pressable
              onPress={() => setScannerVisible(true)}
              style={({ pressed }) => [
                styles.scanButton,
                pressed && styles.cardPressed,
              ]}
            >
              <BarcodeIcon size={20} color={appColors.white} weight="bold" />
            </Pressable>
          </View>
          <Text style={styles.searchHint}>
            {query.trim()
              ? isSearching
                ? "Searching your foods and USDA..."
                : `${activeResults.length} matches across local foods and USDA.`
              : "Search above or pick from favorites and recent below."}
          </Text>
        </View>

        {query.trim() ? (
          renderSection(
            "Results",
            "Pick a match and confirm the amount.",
            activeResults,
            "No foods matched that search yet.",
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
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  heroHeaderCopy: {
    flex: 1,
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
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  heroText: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroAction: {
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryDark,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroActionText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
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
  scanButton: {
    minWidth: 50,
    flexDirection: "row",
    gap: 6,
    borderRadius: 8,
    backgroundColor: appColors.foodPrimaryDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    backgroundColor: appColors.white,
    borderRadius: 8,
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
    borderRadius: 8,
    backgroundColor: appColors.foodSurfaceAlt,
    borderWidth: 1,
    borderColor: appColors.foodSoftBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    backgroundColor: appColors.white,
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
    backgroundColor: appColors.white,
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
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryDark,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
