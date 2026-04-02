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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DB } from "../../store/DB";
import type {
  DBCustomMeal,
  DBFoodItem,
  DBUser,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;

type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const clampRatio = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const formatDateKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const shiftDate = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const MacroProgressBar = ({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number | null;
  color: string;
}) => {
  const ratio = target && target > 0 ? clampRatio(consumed / target) : 0;

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressRowHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValues}>
          {consumed.toFixed(0)}
          {target && target > 0 ? ` / ${target.toFixed(0)}` : ""}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${ratio * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
};

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [user, setUser] = useState<DBUser | null>(null);
  const [entries, setEntries] = useState<DBUserFoodLogEntry[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<DBFoodItem[]>([]);
  const [customMeals, setCustomMeals] = useState<DBCustomMeal[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customMealDraft, setCustomMealDraft] = useState("");
  const [favoriteTargetMeal, setFavoriteTargetMeal] = useState("Snacks");

  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const loadData = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setEntries([]);
      setFavoriteFoods([]);
      setCustomMeals([]);
      return;
    }

    const [dayEntries, favorites, customMealRows] = await Promise.all([
      DB.getUserFoodLogEntriesByDate(currentUser.externalId, dateKey),
      DB.getFavoriteFoodItems(),
      DB.getCustomMeals(currentUser.externalId),
    ]);

    setEntries(dayEntries);
    setFavoriteFoods(favorites.slice(0, 8));
    setCustomMeals(customMealRows);
  }, [dateKey]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const totals = useMemo<MacroTotals>(() => {
    return entries.reduce(
      (acc, entry) => {
        const factor =
          entry.servingSize > 0 ? entry.quantityG / entry.servingSize : 1;
        acc.calories += entry.calories * factor;
        acc.proteinG += entry.proteinG * factor;
        acc.carbsG += entry.carbsG * factor;
        acc.fatG += entry.fatG * factor;
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  }, [entries]);

  const mealNames = useMemo(() => {
    const base = [...DEFAULT_MEALS];
    for (const custom of customMeals) {
      if (!base.includes(custom.name)) {
        base.push(custom.name);
      }
    }
    for (const entry of entries) {
      const meal = entry.mealType?.trim();
      if (meal && !base.includes(meal)) {
        base.push(meal);
      }
    }
    return base;
  }, [customMeals, entries]);

  useEffect(() => {
    if (mealNames.length === 0) {
      return;
    }

    if (!mealNames.includes(favoriteTargetMeal)) {
      setFavoriteTargetMeal(mealNames[0]);
    }
  }, [favoriteTargetMeal, mealNames]);

  const groupedEntries = useMemo(() => {
    const grouped: Record<string, DBUserFoodLogEntry[]> = {};
    for (const meal of mealNames) {
      grouped[meal] = [];
    }

    for (const entry of entries) {
      const meal = entry.mealType?.trim() || "Snacks";
      if (!grouped[meal]) {
        grouped[meal] = [];
      }
      grouped[meal].push(entry);
    }

    return grouped;
  }, [entries, mealNames]);

  const toggleMeal = (mealName: string) => {
    setCollapsed((prev) => ({ ...prev, [mealName]: !prev[mealName] }));
  };

  const addFavoriteToMeal = async (food: DBFoodItem, mealType: string) => {
    if (!user) {
      return;
    }

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId: food.id,
      date: dateKey,
      quantityG: food.servingSize,
      mealType,
    });

    await loadData();
  };

  const deleteEntry = (entryId: number) => {
    Alert.alert("Remove food", "Delete this entry from your diary?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await DB.deleteUserFoodLog(entryId);
          await loadData();
        },
      },
    ]);
  };

  const copyYesterday = async () => {
    if (!user) {
      return;
    }

    const sourceDate = formatDateKey(shiftDate(selectedDate, -1));
    await DB.copyFoodLogsFromDate(user.externalId, sourceDate, dateKey);
    await loadData();
  };

  const createCustomMeal = async () => {
    if (!user) {
      return;
    }

    const name = customMealDraft.trim();
    if (!name) {
      return;
    }

    await DB.addCustomMeal({ userExternalId: user.externalId, name });
    setCustomMealDraft("");
    await loadData();
  };

  const removeCustomMeal = (name: string) => {
    if (!user) {
      return;
    }

    Alert.alert("Delete custom meal", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await DB.deleteCustomMeal(user.externalId, name);
          await loadData();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} stickyHeaderIndices={[1]}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Diary</Text>
        <Text style={styles.subtitle}>{dateKey}</Text>
        <View style={styles.dateRow}>
          <Pressable
            style={styles.dateButton}
            onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          >
            <Text style={styles.dateButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            style={styles.dateButton}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={styles.dateButtonText}>Today</Text>
          </Pressable>
          <Pressable
            style={styles.dateButton}
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
          >
            <Text style={styles.dateButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stickySummary}>
        <Text style={styles.summaryTitle}>Macro Progress</Text>
        <MacroProgressBar
          label="Calories"
          consumed={totals.calories}
          target={user?.calorieAllowance ?? null}
          color="#EA580C"
        />
        <MacroProgressBar
          label="Protein (g)"
          consumed={totals.proteinG}
          target={user?.proteinG ?? null}
          color="#2563EB"
        />
        <MacroProgressBar
          label="Carbs (g)"
          consumed={totals.carbsG}
          target={user?.carbsG ?? null}
          color="#0D9488"
        />
        <MacroProgressBar
          label="Fat (g)"
          consumed={totals.fatG}
          target={user?.fatG ?? null}
          color="#D97706"
        />
      </View>

      <View style={styles.quickActionsCard}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <Pressable style={styles.secondaryButton} onPress={copyYesterday}>
            <Text style={styles.secondaryButtonText}>Copy Yesterday</Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              navigation.navigate("AddFood", {
                date: dateKey,
                mealType: favoriteTargetMeal,
              })
            }
          >
            <Text style={styles.primaryButtonText}>Add Food</Text>
          </Pressable>
        </View>
      </View>

      {favoriteFoods.length > 0 ? (
        <View style={styles.favoritesCard}>
          <Text style={styles.sectionTitle}>Favorite Foods</Text>
          <Text style={styles.favoriteTargetLabel}>Quick-add to:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoriteMealChipRow}
          >
            {mealNames.map((meal) => {
              const selected = favoriteTargetMeal === meal;
              return (
                <Pressable
                  key={meal}
                  style={[
                    styles.favoriteMealChip,
                    selected && styles.favoriteMealChipSelected,
                  ]}
                  onPress={() => setFavoriteTargetMeal(meal)}
                >
                  <Text
                    style={[
                      styles.favoriteMealChipText,
                      selected && styles.favoriteMealChipTextSelected,
                    ]}
                  >
                    {meal}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.favoriteList}>
            {favoriteFoods.map((food) => (
              <View key={food.id} style={styles.favoriteItem}>
                <Text style={styles.favoriteName} numberOfLines={1}>
                  {food.name}
                </Text>
                <Pressable
                  style={styles.favoriteAddButton}
                  onPress={() => addFavoriteToMeal(food, favoriteTargetMeal)}
                >
                  <Text style={styles.favoriteAddButtonText}>+ Add</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.customMealsCard}>
        <Text style={styles.sectionTitle}>Custom Meals</Text>
        <View style={styles.customMealInputRow}>
          <TextInput
            value={customMealDraft}
            onChangeText={setCustomMealDraft}
            placeholder="Create a meal section"
            style={styles.customMealInput}
          />
          <Pressable style={styles.primaryButton} onPress={createCustomMeal}>
            <Text style={styles.primaryButtonText}>Create</Text>
          </Pressable>
        </View>
        {customMeals.map((meal) => (
          <View key={meal.id} style={styles.customMealRow}>
            <Text style={styles.customMealName}>{meal.name}</Text>
            <Pressable onPress={() => removeCustomMeal(meal.name)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {mealNames.map((meal) => {
        const mealEntries = groupedEntries[meal] ?? [];
        const isCollapsed = collapsed[meal] === true;

        return (
          <View key={meal} style={styles.mealCard}>
            <Pressable
              style={styles.mealHeader}
              onPress={() => toggleMeal(meal)}
            >
              <Text style={styles.mealTitle}>
                {isCollapsed ? "+" : "-"} {meal}
              </Text>
              <Pressable
                style={styles.mealAddButton}
                onPress={() =>
                  navigation.navigate("AddFood", {
                    date: dateKey,
                    mealType: meal,
                  })
                }
              >
                <Text style={styles.mealAddButtonText}>Add</Text>
              </Pressable>
            </Pressable>

            {!isCollapsed ? (
              mealEntries.length === 0 ? (
                <Text style={styles.emptyMealText}>No foods logged</Text>
              ) : (
                mealEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryTextWrap}>
                      <Text style={styles.entryTitle}>{entry.foodName}</Text>
                      <Text style={styles.entrySubtitle}>
                        {entry.quantityG.toFixed(0)}g
                      </Text>
                    </View>
                    <View style={styles.entryActions}>
                      <Pressable
                        onPress={() =>
                          navigation.navigate("EditFoodEntry", {
                            entryId: entry.id,
                          })
                        }
                      >
                        <Text style={styles.editText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteEntry(entry.id)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )
            ) : null}
          </View>
        );
      })}

      <View style={{ height: 28 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 16, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: "800", color: "#0F172A" },
  subtitle: { marginTop: 4, color: "#475569", fontWeight: "600" },
  dateRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  dateButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateButtonText: { color: "#0F172A", fontWeight: "700" },
  stickySummary: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryTitle: { fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  progressRow: { marginTop: 8 },
  progressRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: { color: "#334155", fontWeight: "700" },
  progressValues: { color: "#334155", fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  quickActionsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  primaryButton: {
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800" },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: { color: "#0F172A", fontWeight: "700" },
  favoritesCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  favoriteTargetLabel: {
    marginTop: 8,
    color: "#475569",
    fontWeight: "600",
  },
  favoriteMealChipRow: {
    marginTop: 8,
    paddingRight: 10,
    gap: 8,
  },
  favoriteMealChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  favoriteMealChipSelected: {
    borderColor: "#EA580C",
    backgroundColor: "#FFEDD5",
  },
  favoriteMealChipText: {
    color: "#334155",
    fontWeight: "700",
  },
  favoriteMealChipTextSelected: {
    color: "#9A3412",
  },
  favoriteList: { marginTop: 8, gap: 8 },
  favoriteItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  favoriteName: {
    flex: 1,
    marginRight: 8,
    color: "#1E293B",
    fontWeight: "700",
  },
  favoriteAddButton: {
    backgroundColor: "#FFEDD5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favoriteAddButtonText: { color: "#9A3412", fontWeight: "800" },
  customMealsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  customMealInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  customMealInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customMealRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customMealName: { color: "#1E293B", fontWeight: "700" },
  mealCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  mealHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  mealTitle: { fontWeight: "800", color: "#0F172A" },
  mealAddButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mealAddButtonText: { color: "#0F172A", fontWeight: "700" },
  emptyMealText: { padding: 12, color: "#64748B" },
  entryRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  entryTextWrap: { flex: 1, marginRight: 10 },
  entryTitle: { color: "#0F172A", fontWeight: "700" },
  entrySubtitle: { color: "#64748B", marginTop: 2 },
  entryActions: { flexDirection: "row", gap: 12 },
  editText: { color: "#2563EB", fontWeight: "700" },
  deleteText: { color: "#DC2626", fontWeight: "700" },
});

export default FoodDiaryScreen;
