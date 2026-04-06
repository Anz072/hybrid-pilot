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
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CalendarIcon, ForkKnifeIcon } from "phosphor-react-native";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import FoodScreenHeader from "./FoodScreenHeader";
import FoodBarcodeScannerModal from "./FoodBarcodeScannerModal";
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
type AddFoodNav = NativeStackNavigationProp<FoodStackParamList, "AddFood">;

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
        <Text style={styles.foodName}>{food.name}</Text>
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
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
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
              <ForkKnifeIcon size={14} color="#9A3412" weight="fill" />
              <Text style={styles.contextPillText}>{resolvedContextLabel}</Text>
            </View>
            <View style={styles.contextPill}>
              <CalendarIcon size={14} color="#9A3412" weight="bold" />
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
            away, save it for faster logging later, browse your full saved
            library, or scan a barcode for a quick debug read.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Search foods"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            <Pressable
              onPress={() => setScannerVisible(true)}
              style={({ pressed }) => [
                styles.scanButton,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.scanButtonEyebrow}>Barcode</Text>
              <Text style={styles.scanButtonText}>SCAN</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              navigation.navigate("FoodLibrary", {
                date,
                mealType: mealType ?? undefined,
              })
            }
            style={({ pressed }) => [
              styles.libraryButton,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.libraryButtonCopy}>
              <Text style={styles.libraryButtonEyebrow}>Local library</Text>
              <Text style={styles.libraryButtonTitle}>Browse saved foods</Text>
              <Text style={styles.libraryButtonText}>
                Open every item already saved in your local database.
              </Text>
            </View>
            <View style={styles.libraryButtonPill}>
              <Text style={styles.libraryButtonPillText}>Open</Text>
            </View>
          </Pressable>
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  bgOrbTop: {
    position: "absolute",
    top: -72,
    right: -56,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#FFEDD5",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: "#FDE68A",
    opacity: 0.28,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 18,
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
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  contextPillText: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  scanButton: {
    minWidth: 96,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scanButtonEyebrow: {
    color: "#FDBA74",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  libraryButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  libraryButtonCopy: {
    flex: 1,
  },
  libraryButtonEyebrow: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  libraryButtonTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  libraryButtonText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  libraryButtonPill: {
    borderRadius: 999,
    backgroundColor: "#EA580C",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  libraryButtonPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  sectionStack: {
    gap: 10,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  foodCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
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
    borderColor: "#FDBA74",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  foodBadgeText: {
    color: "#9A3412",
    fontSize: 11,
    fontWeight: "800",
  },
  foodName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  foodMeta: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  foodMacroText: {
    color: "#9A3412",
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
    borderColor: "#FDBA74",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  secondaryActionActive: {
    backgroundColor: "#FED7AA",
  },
  secondaryActionText: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionTextActive: {
    color: "#7C2D12",
  },
  primaryAction: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#111827",
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
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 18,
  },
  createTextWrap: {
    flex: 1,
  },
  createTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  createSubtitle: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    borderRadius: 999,
    backgroundColor: "#EA580C",
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
