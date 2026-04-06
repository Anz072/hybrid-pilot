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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarIcon,
  CaretDownIcon,
  CaretUpIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "phosphor-react-native";
import { DB } from "../../store/DB";
import type {
  DBCustomMeal,
  DBFoodItem,
  DBUser,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import {
  DEFAULT_MEALS,
  clampFoodRatio,
  formatFoodDateKey,
  formatFoodLongDate,
  formatFoodServing,
  formatMacroLine,
  getFoodDefaultLogAmount,
  getFoodResolvedServing,
  shiftFoodDate,
  sumLoggedNutrition,
  type FoodNutritionTotals,
  calculateLoggedNutrition,
} from "./foodUtils";

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;
type FavoriteFoodCardItem = DBFoodItem & {
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const MacroMeter = ({
  label,
  consumed,
  target,
  accent,
}: {
  label: string;
  consumed: number;
  target: number | null;
  accent: string;
}) => {
  const ratio = target && target > 0 ? clampFoodRatio(consumed / target) : 0;

  return (
    <View style={styles.macroMeter}>
      <View style={styles.macroMeterHeader}>
        <Text style={styles.macroMeterLabel}>{label}</Text>
        <Text style={styles.macroMeterValue}>
          {consumed.toFixed(0)}
          {target && target > 0 ? ` / ${target.toFixed(0)}` : ""}
        </Text>
      </View>
      <View style={styles.macroMeterTrack}>
        <View
          style={[
            styles.macroMeterFill,
            { width: `${ratio * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
    </View>
  );
};

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [user, setUser] = useState<DBUser | null>(null);
  const [entries, setEntries] = useState<DBUserFoodLogEntry[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<FavoriteFoodCardItem[]>([]);
  const [customMeals, setCustomMeals] = useState<DBCustomMeal[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customMealDraft, setCustomMealDraft] = useState("");
  const [favoriteTargetMeal, setFavoriteTargetMeal] = useState("Snacks");

  const dateKey = useMemo(() => formatFoodDateKey(selectedDate), [selectedDate]);

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
      DB.getFavoriteFoodItems(currentUser.externalId),
      DB.getCustomMeals(currentUser.externalId),
    ]);

    setEntries(dayEntries);
    setFavoriteFoods(
      favorites.slice(0, 8).map((food) => {
        const serving = getFoodResolvedServing(food);

        return {
          ...food,
          servingSize: serving.value,
          servingUnit: serving.unit,
          calories: food.calories ?? 0,
          proteinG: food.proteinG ?? 0,
          carbsG: food.carbsG ?? 0,
          fatG: food.fatG ?? 0,
        };
      }),
    );
    setCustomMeals(customMealRows);
  }, [dateKey]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const totals = useMemo<FoodNutritionTotals>(() => sumLoggedNutrition(entries), [entries]);

  const mealNames = useMemo(() => {
    const base = [...DEFAULT_MEALS];

    for (const custom of customMeals) {
      if (!base.includes(custom.name as (typeof DEFAULT_MEALS)[number])) {
        base.push(custom.name);
      }
    }

    for (const entry of entries) {
      const meal = entry.mealType?.trim();
      if (meal && !base.includes(meal as (typeof DEFAULT_MEALS)[number])) {
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

  const mealSummaries = useMemo(() => {
    const summary: Record<string, FoodNutritionTotals> = {};

    for (const meal of mealNames) {
      summary[meal] = sumLoggedNutrition(groupedEntries[meal] ?? []);
    }

    return summary;
  }, [groupedEntries, mealNames]);

  const toggleMeal = (mealName: string) => {
    setCollapsed((current) => ({ ...current, [mealName]: !current[mealName] }));
  };

  const addFavoriteToMeal = async (food: DBFoodItem, mealType: string) => {
    if (!user) {
      return;
    }

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId: food.id,
      date: dateKey,
      quantityG: getFoodDefaultLogAmount(food),
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

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
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

  const todayKey = formatFoodDateKey(new Date());
  const isToday = dateKey === todayKey;
  const filledMealCount = mealNames.filter((meal) => (groupedEntries[meal] ?? []).length > 0).length;
  const remainingCalories =
    user?.calorieAllowance != null ? Math.round(user.calorieAllowance - totals.calories) : null;

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 34 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <ForkKnifeIcon size={15} color="#9A3412" weight="fill" />
              <Text style={styles.heroBadgeText}>Diary</Text>
            </View>
            <View style={styles.heroDatePill}>
              <CalendarIcon size={15} color="#9A3412" weight="bold" />
              <Text style={styles.heroDatePillText}>
                {isToday ? "Today" : formatFoodLongDate(selectedDate)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Food diary</Text>
          <Text style={styles.heroSubtitle}>
            {entries.length} entries across {filledMealCount} active meal sections. Built to keep the day readable at a glance.
          </Text>

          <View style={styles.dateNavRow}>
            <Pressable
              onPress={() => setSelectedDate((current) => shiftFoodDate(current, -1))}
              style={({ pressed }) => [styles.dateNavButton, pressed && styles.cardPressed]}
            >
              <Text style={styles.dateNavButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDate(new Date())}
              style={({ pressed }) => [styles.dateNavButton, pressed && styles.cardPressed]}
            >
              <Text style={styles.dateNavButtonText}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDate((current) => shiftFoodDate(current, 1))}
              style={({ pressed }) => [styles.dateNavButton, pressed && styles.cardPressed]}
            >
              <Text style={styles.dateNavButtonText}>Next</Text>
            </Pressable>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={[styles.heroStatCard, styles.heroStatCardDark]}>
              <Text style={styles.heroStatLabelDark}>Consumed</Text>
              <Text style={styles.heroStatValueDark}>{Math.round(totals.calories)}</Text>
              <Text style={styles.heroStatHintDark}>kcal today</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Target status</Text>
              <Text style={styles.heroStatValue}>
                {remainingCalories == null
                  ? "--"
                  : remainingCalories >= 0
                    ? `${remainingCalories}`
                    : `${Math.abs(remainingCalories)}`}
              </Text>
              <Text style={styles.heroStatHint}>
                {remainingCalories == null
                  ? "Set calorie goal in onboarding"
                  : remainingCalories >= 0
                    ? "kcal left"
                    : "kcal over target"}
              </Text>
            </View>
          </View>

          <View style={styles.macroStack}>
            <MacroMeter
              label="Protein"
              consumed={totals.proteinG}
              target={user?.proteinG ?? null}
              accent="#2563EB"
            />
            <MacroMeter
              label="Carbs"
              consumed={totals.carbsG}
              target={user?.carbsG ?? null}
              accent="#0F766E"
            />
            <MacroMeter
              label="Fat"
              consumed={totals.fatG}
              target={user?.fatG ?? null}
              accent="#D97706"
            />
          </View>
        </View>

        <View style={styles.quickActionRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryActionCard, pressed && styles.cardPressed]}
            onPress={() =>
              navigation.navigate("AddFood", {
                date: dateKey,
                mealType: favoriteTargetMeal,
              })
            }
          >
            <Text style={styles.primaryActionEyebrow}>Quick add</Text>
            <Text style={styles.primaryActionTitle}>Add food</Text>
            <Text style={styles.primaryActionSubtitle}>
              Log into {favoriteTargetMeal}.
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryActionCard, pressed && styles.cardPressed]}
            onPress={() => void copyYesterday()}
          >
            <Text style={styles.secondaryActionEyebrow}>Shortcut</Text>
            <Text style={styles.secondaryActionTitle}>Copy yesterday</Text>
            <Text style={styles.secondaryActionSubtitle}>
              Reuse the previous day when meals repeat.
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.libraryShortcutCard, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate("FoodLibrary")}
        >
          <View style={styles.libraryShortcutCopy}>
            <Text style={styles.libraryShortcutEyebrow}>Library</Text>
            <Text style={styles.libraryShortcutTitle}>Saved foods</Text>
            <Text style={styles.libraryShortcutSubtitle}>
              Browse every local food item your diary can reuse.
            </Text>
          </View>
          <View style={styles.libraryShortcutButton}>
            <Text style={styles.libraryShortcutButtonText}>Open</Text>
          </View>
        </Pressable>

        {favoriteFoods.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Favorite foods</Text>
            <Text style={styles.sectionSubtitle}>
              Keep repeat foods one tap away, then aim them at the meal you want.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoriteMealRow}
            >
              {mealNames.map((meal) => {
                const selected = favoriteTargetMeal === meal;
                return (
                  <Pressable
                    key={meal}
                    onPress={() => setFavoriteTargetMeal(meal)}
                    style={({ pressed }) => [
                      styles.favoriteMealChip,
                      selected && styles.favoriteMealChipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.favoriteMealChipText,
                        selected && styles.favoriteMealChipTextActive,
                      ]}
                    >
                      {meal}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoriteCardRow}
            >
              {favoriteFoods.map((food) => (
                <View key={food.id} style={styles.favoriteCard}>
                  <Text style={styles.favoriteName} numberOfLines={2}>
                    {food.name}
                  </Text>
                  <Text style={styles.favoriteMeta}>
                    {food.calories.toFixed(0)} kcal •{" "}
                    {formatFoodServing(food.servingSize, food.servingUnit)}
                  </Text>
                  <Text style={styles.favoriteMacros}>
                    {food.proteinG.toFixed(0)}P • {food.carbsG.toFixed(0)}C • {food.fatG.toFixed(0)}F
                  </Text>
                  <Pressable
                    onPress={() => void addFavoriteToMeal(food, favoriteTargetMeal)}
                    style={({ pressed }) => [
                      styles.favoriteAddButton,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text style={styles.favoriteAddButtonText}>Add to {favoriteTargetMeal}</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Custom meals</Text>
          <Text style={styles.sectionSubtitle}>
            Create extra sections when the default day structure is not enough.
          </Text>

          <View style={styles.customMealInputRow}>
            <TextInput
              value={customMealDraft}
              onChangeText={setCustomMealDraft}
              placeholder="Create a meal section"
              placeholderTextColor="#9CA3AF"
              style={styles.customMealInput}
            />
            <Pressable
              onPress={() => void createCustomMeal()}
              style={({ pressed }) => [styles.customMealCreateButton, pressed && styles.cardPressed]}
            >
              <Text style={styles.customMealCreateButtonText}>Create</Text>
            </Pressable>
          </View>

          {customMeals.length > 0 ? (
            <View style={styles.customMealChipWrap}>
              {customMeals.map((meal) => (
                <View key={meal.id} style={styles.customMealChip}>
                  <Text style={styles.customMealChipText}>{meal.name}</Text>
                  <Pressable onPress={() => removeCustomMeal(meal.name)}>
                    <Text style={styles.customMealDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No custom meal sections yet.</Text>
          )}
        </View>

        {mealNames.map((meal) => {
          const mealEntries = groupedEntries[meal] ?? [];
          const isCollapsed = collapsed[meal] === true;
          const mealTotals = mealSummaries[meal];

          return (
            <View key={meal} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Pressable
                  style={styles.mealHeaderMain}
                  onPress={() => toggleMeal(meal)}
                >
                  <View style={styles.mealHeaderTop}>
                    <Text style={styles.mealTitle}>{meal}</Text>
                    {isCollapsed ? (
                      <CaretDownIcon size={18} color="#374151" weight="bold" />
                    ) : (
                      <CaretUpIcon size={18} color="#374151" weight="bold" />
                    )}
                  </View>
                  <Text style={styles.mealSummary}>
                    {mealEntries.length} items • {mealTotals.calories.toFixed(0)} kcal
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.mealAddButton, pressed && styles.cardPressed]}
                  onPress={() =>
                    navigation.navigate("AddFood", {
                      date: dateKey,
                      mealType: meal,
                    })
                  }
                >
                  <Text style={styles.mealAddButtonText}>Add food</Text>
                </Pressable>
              </View>

              {!isCollapsed ? (
                mealEntries.length === 0 ? (
                  <View style={styles.emptyMealCard}>
                    <Text style={styles.emptyMealTitle}>Nothing logged yet</Text>
                    <Text style={styles.emptyMealText}>
                      Add a food to start building this meal.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.entryStack}>
                    {mealEntries.map((entry) => {
                      const nutrition = calculateLoggedNutrition(entry);
                      return (
                        <View key={entry.id} style={styles.entryCard}>
                          <Pressable
                            style={styles.entryMain}
                            onPress={() =>
                              navigation.navigate("EditFoodEntry", {
                                entryId: entry.id,
                              })
                            }
                          >
                            <View style={styles.entryTop}>
                              <Text style={styles.entryTitle}>{entry.foodName}</Text>
                              <Text style={styles.entryCalories}>
                                {nutrition.calories.toFixed(0)} kcal
                              </Text>
                            </View>
                            <Text style={styles.entryMeta}>
                              {formatFoodServing(entry.quantityG, entry.servingUnit)} •{" "}
                              {formatMacroLine(nutrition)}
                            </Text>
                          </Pressable>
                          <View style={styles.entryActions}>
                            <Pressable
                              onPress={() =>
                                navigation.navigate("EditFoodEntry", {
                                  entryId: entry.id,
                                })
                              }
                              style={({ pressed }) => [styles.entryIconButton, pressed && styles.cardPressed]}
                            >
                              <PencilSimpleIcon size={16} color="#2563EB" weight="bold" />
                            </Pressable>
                            <Pressable
                              onPress={() => deleteEntry(entry.id)}
                              style={({ pressed }) => [styles.entryIconButton, pressed && styles.cardPressed]}
                            >
                              <TrashIcon size={16} color="#DC2626" weight="bold" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              ) : null}
            </View>
          );
        })}
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
  },
  bgOrbTop: {
    position: "absolute",
    top: -96,
    right: -64,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: "#FED7AA",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#FDE68A",
    opacity: 0.24,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
  },
  heroDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroDatePillText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#111827",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  dateNavRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  dateNavButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
  },
  dateNavButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
  },
  heroStatCardDark: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  heroStatLabel: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroStatLabelDark: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroStatValue: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 2,
  },
  heroStatValueDark: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 2,
  },
  heroStatHint: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "700",
  },
  heroStatHintDark: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
  },
  macroStack: {
    gap: 10,
  },
  macroMeter: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
  },
  macroMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  macroMeterLabel: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
  },
  macroMeterValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  macroMeterTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  macroMeterFill: {
    height: "100%",
    borderRadius: 999,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  primaryActionCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
  },
  primaryActionEyebrow: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  primaryActionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryActionCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  secondaryActionEyebrow: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  secondaryActionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  secondaryActionSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  libraryShortcutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  libraryShortcutCopy: {
    flex: 1,
  },
  libraryShortcutEyebrow: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  libraryShortcutTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  libraryShortcutSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  libraryShortcutButton: {
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  libraryShortcutButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  favoriteMealRow: {
    gap: 8,
    paddingRight: 10,
    marginBottom: 14,
  },
  favoriteMealChip: {
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  favoriteMealChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  favoriteMealChipText: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "800",
  },
  favoriteMealChipTextActive: {
    color: "#FFFFFF",
  },
  favoriteCardRow: {
    gap: 12,
    paddingRight: 10,
  },
  favoriteCard: {
    width: 210,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
  },
  favoriteName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  favoriteMeta: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  favoriteMacros: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 14,
  },
  favoriteAddButton: {
    borderRadius: 14,
    backgroundColor: "#111827",
    paddingVertical: 11,
    alignItems: "center",
  },
  favoriteAddButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  customMealInputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  customMealInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
  },
  customMealCreateButton: {
    borderRadius: 16,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  customMealCreateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  customMealChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customMealChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  customMealChipText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  customMealDeleteText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
  },
  mealCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealHeaderMain: {
    flex: 1,
  },
  mealHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  mealTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  mealSummary: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  mealAddButton: {
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealAddButtonText: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyMealCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
  },
  emptyMealTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyMealText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  entryStack: {
    gap: 10,
    marginTop: 14,
  },
  entryCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
  },
  entryMain: {
    flex: 1,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  entryTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  entryCalories: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  entryMeta: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
  },
  entryActions: {
    justifyContent: "space-between",
    gap: 8,
  },
  entryIconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryScreen;
