import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  CalendarIcon,
  ForkKnifeIcon,
  MagnifyingGlassIcon,
} from "phosphor-react-native";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";
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
  getFoodDefaultLogAmount,
} from "./foodUtils";

type AddFoodRoute = RouteProp<FoodStackParamList, "AddFood">;
type AddFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "AddFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

const AddFoodScreen = () => {
  const route = useRoute<AddFoodRoute>();
  const navigation = useNavigation<AddFoodNav>();

  const { contextLabel, date, loggedAt, mealType } = route.params;

  const [user, setUser] = useState<DBUser | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DBFoodItem[]>([]);
  const [recent, setRecent] = useState<DBFoodItem[]>([]);
  const [favorites, setFavorites] = useState<DBFoodItem[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);

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

  useEffect(() => {
    void loadStaticLists();
  }, [loadStaticLists]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const normalized = query.trim();
      if (!normalized) {
        setResults([]);
        return;
      }

      const rows = await DB.searchFoodItems(normalized, 40);
      if (!cancelled) {
        setResults(rows);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((food) => food.id)),
    [favorites],
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

  const addLogForFood = async (food: DBFoodItem) => {
    if (!user) {
      Alert.alert("No account found", "Create or restore a user before adding food.");
      return;
    }

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId: food.id,
      date,
      loggedAt: resolvedLoggedAt,
      quantityG: getFoodDefaultLogAmount(food),
      mealType: mealType ?? null,
    });

    navigation.goBack();
  };

  const toggleFavorite = async (foodId: number, isFavorite: boolean) => {
    if (!user) {
      Alert.alert("No account found", "Create or restore a user before saving foods.");
      return;
    }

    await DB.setFoodItemFavorite(user.externalId, foodId, !isFavorite);
    await Promise.all([
      loadStaticLists(),
      query.trim()
        ? DB.searchFoodItems(query.trim(), 40).then(setResults)
        : Promise.resolve(),
    ]);
  };

  const activeResults = useMemo(
    () => (query.trim() ? results : []),
    [query, results],
  );

  const renderFoodCard = (food: DBFoodItem, isFavorite: boolean) => (
    <View key={food.id} style={styles.foodCard}>
      <Pressable style={styles.foodBody} onPress={() => void addLogForFood(food)}>
        <View style={styles.foodBadgeRow}>
          {food.brand ? (
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>{food.brand}</Text>
            </View>
          ) : null}
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
        <Text style={styles.foodName} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={styles.foodMeta}>
          {formatFoodItemServing(food)} serving •{" "}
          {formatFoodNumber(food.calories, " kcal")}
        </Text>
        <Text style={styles.foodMacroText}>
          {formatFoodMacro(food.proteinG, "P")} • {formatFoodMacro(food.carbsG, "C")} •{" "}
          {formatFoodMacro(food.fatG, "F")}
        </Text>
      </Pressable>
      <View style={styles.foodActionColumn}>
        <Pressable
          onPress={() => void toggleFavorite(food.id, isFavorite)}
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
          onPress={() => void addLogForFood(food)}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.cardPressed]}
        >
          <Text style={styles.primaryActionText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSection = (
    title: string,
    subtitle: string,
    items: DBFoodItem[],
    emptyText: string,
  ) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        {items.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{items.length}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.sectionStack}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          items.map((item) => renderFoodCard(item, favoriteIds.has(item.id)))
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FoodScreenHeader
          eyebrow="Food Search"
          title="Add food"
          subtitle={`${formatFoodShortDate(date)} • ${resolvedContextLabel} • Search your library or quick-add familiar foods.`}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.heroCard}>
          <View style={styles.contextRow}>
            <View style={styles.contextPill}>
              <ForkKnifeIcon size={14} color="#6D52EA" weight="fill" />
              <Text style={styles.contextPillText}>{resolvedContextLabel}</Text>
            </View>
            <View style={styles.contextPill}>
              <CalendarIcon size={14} color="#6D52EA" weight="bold" />
              <Text style={styles.contextPillText}>{formatFoodShortDate(date)}</Text>
            </View>
            {mealType ? (
              <View style={styles.contextPill}>
                <Text style={styles.contextPillText}>{mealType}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>Search or quick-add</Text>
          <Text style={styles.heroText}>
            Tap a food card to log its default serving into this time slot right
            away, save it for faster logging later, or scan a barcode for a
            quick match.
          </Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <MagnifyingGlassIcon size={18} color="#8A809F" weight="bold" />
              <TextInput
                placeholder="Search foods"
                placeholderTextColor="#8A809F"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
            <Pressable
              onPress={() => setScannerVisible(true)}
              style={({ pressed }) => [
                styles.scanButton,
                pressed && styles.cardPressed,
              ]}
            >
              <BarcodeIcon size={20} color="#FFFFFF" weight="bold" />
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          </View>
        </View>

        {query.trim() ? (
          renderSection(
            `Results${activeResults.length > 0 ? ` (${activeResults.length})` : ""}`,
            "Matching items in your local food library.",
            activeResults,
            "No foods matched that search yet.",
          )
        ) : (
          <>
            {renderSection(
              "Favorites",
              "Your fastest repeat adds for this time slot.",
              favorites,
              "No favorite foods yet.",
            )}
            {renderSection(
              "Recent",
              "Foods you logged recently.",
              recent,
              "No recent foods yet.",
            )}
          </>
        )}

        <Pressable
          onPress={() =>
            navigation.navigate("CreateCustomFood", {
              contextLabel: resolvedContextLabel,
              date,
              loggedAt: resolvedLoggedAt,
              mealType,
            })
          }
          style={({ pressed }) => [styles.createCard, pressed && styles.cardPressed]}
        >
          <View style={styles.createTextWrap}>
            <Text style={styles.createTitle}>Create custom food</Text>
            <Text style={styles.createSubtitle}>
              Add a brand-new item when it is missing from your library.
            </Text>
          </View>
          <View style={styles.createButton}>
            <Text style={styles.createButtonText}>Open</Text>
          </View>
        </Pressable>
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
    backgroundColor: "#F7F4FB",
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
    backgroundColor: "#E4D9FF",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#EEE7FF",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
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
    backgroundColor: "#F3EEFC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#E6DEF1",
  },
  contextPillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#1B1529",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroText: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E6DEF1",
    borderRadius: 16,
    backgroundColor: "#FBF9FF",
    paddingLeft: 14,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#1B1529",
    fontSize: 16,
    fontWeight: "700",
  },
  scanButton: {
    minWidth: 88,
    flexDirection: "row",
    gap: 6,
    borderRadius: 16,
    backgroundColor: "#1F1831",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  sectionCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: "#1B1529",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
  },
  countPill: {
    minWidth: 34,
    borderRadius: 999,
    backgroundColor: "#F3EEFC",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  countPillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "900",
  },
  sectionStack: {
    gap: 10,
  },
  emptyText: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
  },
  foodCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#ECE5F9",
    padding: 14,
  },
  foodBody: {
    flex: 1,
  },
  foodBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  foodBadge: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  foodBadgeText: {
    color: "#6D52EA",
    fontSize: 11,
    fontWeight: "800",
  },
  foodName: {
    color: "#1B1529",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  foodMeta: {
    color: "#6E6582",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  foodMacroText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  foodActionColumn: {
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
  },
  secondaryAction: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6DEF1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  secondaryActionActive: {
    backgroundColor: "#EEE7FF",
  },
  secondaryActionText: {
    color: "#6D52EA",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionTextActive: {
    color: "#4F3D83",
  },
  primaryAction: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#1F1831",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  createCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  createTextWrap: {
    flex: 1,
  },
  createTitle: {
    color: "#1B1529",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  createSubtitle: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    borderRadius: 999,
    backgroundColor: "#1F1831",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default AddFoodScreen;
