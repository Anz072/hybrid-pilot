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
import { formatFoodShortDate } from "./foodUtils";

type AddFoodRoute = RouteProp<FoodStackParamList, "AddFood">;
type AddFoodNav = NativeStackNavigationProp<FoodStackParamList, "AddFood">;

const AddFoodScreen = () => {
  const route = useRoute<AddFoodRoute>();
  const navigation = useNavigation<AddFoodNav>();

  const { date, mealType } = route.params;

  const [user, setUser] = useState<DBUser | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DBFoodItem[]>([]);
  const [recent, setRecent] = useState<DBFoodItem[]>([]);
  const [favorites, setFavorites] = useState<DBFoodItem[]>([]);

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
      DB.getFavoriteFoodItems(10),
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

  const addLogForFood = async (food: DBFoodItem) => {
    if (!user) {
      Alert.alert("No account found", "Create or restore a user before adding food.");
      return;
    }

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId: food.id,
      date,
      quantityG: food.servingSize,
      mealType,
    });

    navigation.goBack();
  };

  const toggleFavorite = async (food: DBFoodItem) => {
    await DB.setFoodItemFavorite(food.id, !food.isFavorite);
    await Promise.all([
      loadStaticLists(),
      query.trim()
        ? DB.searchFoodItems(query.trim(), 40).then(setResults)
        : Promise.resolve(),
    ]);
  };

  const activeResults = useMemo(() => (query.trim() ? results : []), [query, results]);

  const renderFoodCard = (food: DBFoodItem) => (
    <View key={food.id} style={styles.foodCard}>
      <Pressable style={styles.foodBody} onPress={() => void addLogForFood(food)}>
        <Text style={styles.foodName}>{food.name}</Text>
        <Text style={styles.foodMeta}>
          {food.servingSize.toFixed(0)} g serving • {food.calories.toFixed(0)} kcal
        </Text>
        <Text style={styles.foodMacroText}>
          {food.proteinG.toFixed(0)}P • {food.carbsG.toFixed(0)}C • {food.fatG.toFixed(0)}F
        </Text>
      </Pressable>
      <View style={styles.foodActionColumn}>
        <Pressable
          onPress={() => void toggleFavorite(food)}
          style={({ pressed }) => [
            styles.secondaryAction,
            food.isFavorite && styles.secondaryActionActive,
            pressed && styles.cardPressed,
          ]}
        >
          <Text
            style={[
              styles.secondaryActionText,
              food.isFavorite && styles.secondaryActionTextActive,
            ]}
          >
            {food.isFavorite ? "Saved" : "Save"}
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
          items.map((item) => renderFoodCard(item))
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
          title={`Add to ${mealType}`}
          subtitle={`${formatFoodShortDate(date)} • Search your library or quick-add familiar foods.`}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.heroCard}>
          <View style={styles.contextRow}>
            <View style={styles.contextPill}>
              <ForkKnifeIcon size={14} color="#9A3412" weight="fill" />
              <Text style={styles.contextPillText}>{mealType}</Text>
            </View>
            <View style={styles.contextPill}>
              <CalendarIcon size={14} color="#9A3412" weight="bold" />
              <Text style={styles.contextPillText}>{formatFoodShortDate(date)}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Search or quick-add</Text>
          <Text style={styles.heroText}>
            Tap a food card to add its default serving right away, or save it for faster logging later.
          </Text>
          <TextInput
            placeholder="Search foods"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
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
              "Your fastest repeat adds for this meal.",
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
          onPress={() => navigation.navigate("CreateCustomFood", { date, mealType })}
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
  searchInput: {
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
