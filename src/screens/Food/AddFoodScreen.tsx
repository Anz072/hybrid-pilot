import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CaretDownIcon, CaretUpIcon } from "phosphor-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";

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
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }

      const rows = await DB.searchFoodItems(q, 40);
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

  const listData = useMemo(() => {
    return query.trim() ? results : [];
  }, [query, results]);

  const renderFoodRow = ({ item }: { item: DBFoodItem }) => (
    <View style={styles.foodRow}>
      <Pressable style={styles.foodInfo} onPress={() => addLogForFood(item)}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodMeta}>
          {item.calories.toFixed(0)} kcal per {item.servingSize.toFixed(0)}g
        </Text>
      </Pressable>
      <Pressable onPress={() => toggleFavorite(item)}>
        <Text style={styles.favoriteText}>
          {item.isFavorite ? "Unfavorite" : "Favorite"}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add Food</Text>
      <Text style={styles.subtitle}>Meal: {mealType}</Text>

      <TextInput
        placeholder="Search foods"
        value={query}
        onChangeText={setQuery}
        style={styles.searchInput}
      />

      {query.trim() ? (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderFoodRow}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.quickListsContainer}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          {favorites.length === 0 ? (
            <Text style={styles.emptyText}>No favorite foods yet.</Text>
          ) : (
            favorites.map((item) => (
              <View key={`fav-${item.id}`} style={styles.foodRow}>
                <Pressable
                  style={styles.foodInfo}
                  onPress={() => addLogForFood(item)}
                >
                  <Text style={styles.foodName}>{item.name}</Text>
                  <Text style={styles.foodMeta}>
                    {item.calories.toFixed(0)} kcal
                  </Text>
                </Pressable>
                <Pressable onPress={() => toggleFavorite(item)}>
                  <Text style={styles.favoriteText}>Unfavorite</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Recent</Text>
          {recent.length === 0 ? (
            <Text style={styles.emptyText}>No recent foods yet.</Text>
          ) : (
            recent.map((item) => (
              <View key={`recent-${item.id}`} style={styles.foodRow}>
                <Pressable
                  style={styles.foodInfo}
                  onPress={() => addLogForFood(item)}
                >
                  <Text style={styles.foodName}>{item.name}</Text>
                  <Text style={styles.foodMeta}>
                    {item.calories.toFixed(0)} kcal
                  </Text>
                </Pressable>
                <Pressable onPress={() => toggleFavorite(item)}>
                  <Text style={styles.favoriteText}>
                    {item.isFavorite ? "Unfavorite" : "Favorite"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate("CreateCustomFood", { date, mealType })}
      >
        <Text style={styles.primaryButtonText}>Add Food</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  primaryButton: {
    backgroundColor: "#EA580C",
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginTop: 30,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 4,
    color: "#475569",
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  quickListsContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
  },
  emptyText: {
    color: "#64748B",
    marginTop: 6,
  },
  foodRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  foodInfo: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    color: "#0F172A",
    fontWeight: "600",
  },
  foodMeta: {
    color: "#64748B",
    marginTop: 2,
    fontSize: 12,
  },
  favoriteText: {
    color: "#EA580C",
    fontWeight: "700",
  },
  createCard: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 20,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  microsToggle: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f6f6f7",
    padding: 10,
    borderRadius: 8,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 12,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
  },
  createButton: {
    marginTop: 12,
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default AddFoodScreen;




