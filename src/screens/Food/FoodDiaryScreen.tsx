import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBUser,
  DBUserSettings,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import {
  buildEffectiveCalorieTargetsForDates,
  getEffectiveCalorieTargetForDate,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import FoodDiaryMainStrip, {
  buildFoodDiaryWeekDays,
  type FoodDiaryMainStripDay,
} from "./FoodDiaryMainStrip";
import FoodDiaryMoreSection from "./FoodDiaryMoreSection";
// import FoodDiaryQuickAdds from "./FoodDiaryQuickAdds";
import type {
  FoodDiaryFavoriteFood,
  FoodDiaryHourBucket,
} from "./foodDiaryTypes";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  getFoodLoggedHour,
  getFoodResolvedServing,
  shiftFoodDate,
  sumLoggedNutrition,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;

const INITIAL_START = 7;
const INITIAL_END = 22;

const normalizeVisibleHours = (startHour: number, endHour: number) => {
  const boundedEnd = Math.max(1, Math.min(23, Math.round(endHour)));
  const boundedStart = Math.max(
    0,
    Math.min(Math.round(startHour), boundedEnd - 1),
  );

  return {
    startHour: boundedStart,
    endHour: boundedEnd,
  };
};

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [user, setUser] = useState<DBUser | null>(null);
  const [entries, setEntries] = useState<DBUserFoodLogEntry[]>([]);
  const [mainStripDays, setMainStripDays] = useState<FoodDiaryMainStripDay[]>(
    () =>
      buildFoodDiaryWeekDays(new Date()).map((date) => ({
        date,
        dateKey: formatFoodDateKey(date),
        calories: 0,
      })),
  );
  const [favoriteFoods, setFavoriteFoods] = useState<FoodDiaryFavoriteFood[]>(
    [],
  );
  const [settings, setSettings] = useState<DBUserSettings | null>(null);
  const [visibleStartHour, setVisibleStartHour] = useState(INITIAL_START);
  const [visibleEndHour, setVisibleEndHour] = useState(INITIAL_END);
  const [selectedHour, setSelectedHour] = useState(() =>
    Math.min(INITIAL_END, Math.max(INITIAL_START, new Date().getHours())),
  );

  const dateKey = useMemo(
    () => formatFoodDateKey(selectedDate),
    [selectedDate],
  );

  const loadData = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setEntries([]);
      setSettings(null);
      setMainStripDays(
        buildFoodDiaryWeekDays(selectedDate).map((date) => ({
          date,
          dateKey: formatFoodDateKey(date),
          calories: 0,
        })),
      );
      setFavoriteFoods([]);
      setVisibleStartHour(INITIAL_START);
      setVisibleEndHour(INITIAL_END);
      return;
    }

    const weekDays = buildFoodDiaryWeekDays(selectedDate);
    const weekDateKeys = weekDays.map(formatFoodDateKey);
    const [favorites, settings, weekEntriesByDate] = await Promise.all([
      DB.getFavoriteFoodItems(currentUser.externalId, 10),
      DB.getUserSettings(currentUser.externalId),
      Promise.all(
        weekDateKeys.map((weekDateKey) =>
          DB.getUserFoodLogEntriesByDate(currentUser.externalId, weekDateKey),
        ),
      ),
    ]);

    const selectedDateIndex = weekDateKeys.indexOf(dateKey);
    setEntries(weekEntriesByDate[selectedDateIndex] ?? []);
    setSettings(settings);
    setMainStripDays(
      weekDays.map((date, index) => ({
        date,
        dateKey: weekDateKeys[index],
        calories: sumLoggedNutrition(weekEntriesByDate[index] ?? []).calories,
      })),
    );

    if (settings) {
      const normalized = normalizeVisibleHours(
        settings.foodDiaryStartHour,
        settings.foodDiaryEndHour,
      );

      setVisibleStartHour(normalized.startHour);
      setVisibleEndHour(normalized.endHour);
    } else {
      setVisibleStartHour(INITIAL_START);
      setVisibleEndHour(INITIAL_END);
    }

    setFavoriteFoods(
      favorites.map((food) => {
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
  }, [dateKey, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  React.useEffect(() => {
    setSelectedHour((current) =>
      Math.min(visibleEndHour, Math.max(visibleStartHour, current)),
    );
  }, [visibleEndHour, visibleStartHour]);

  const totals = useMemo(() => sumLoggedNutrition(entries), [entries]);
  const weeklyConsumedCalories = useMemo(
    () => mainStripDays.reduce((sum, day) => sum + day.calories, 0),
    [mainStripDays],
  );
  const weekTargetCalories = useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: mainStripDays.map((day) => day.date),
        baseCalories: user?.calorieAllowance,
        settings,
      }),
    [mainStripDays, settings, user?.calorieAllowance],
  );
  const selectedTargetCalories = useMemo(
    () =>
      getEffectiveCalorieTargetForDate({
        date: selectedDate,
        baseCalories: user?.calorieAllowance,
        settings,
      }),
    [selectedDate, settings, user?.calorieAllowance],
  );
  const targetCaloriesByDate = useMemo(
    () =>
      Object.fromEntries(
        mainStripDays.map((day, index) => [day.dateKey, weekTargetCalories[index] ?? null]),
      ) as Record<string, number | null>,
    [mainStripDays, weekTargetCalories],
  );
  const weeklyBudgetCalories = useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: mainStripDays.map((day) => day.date),
        baseCalories: user?.calorieAllowance,
        settings,
      }),
    [mainStripDays, settings, user?.calorieAllowance],
  );
  const isToday = dateKey === formatFoodDateKey(new Date());

  const hourBuckets = useMemo(() => {
    const rows: FoodDiaryHourBucket[] = [];

    for (let hour = visibleStartHour; hour <= visibleEndHour; hour += 1) {
      const hourEntries = entries.filter(
        (entry) =>
          getFoodLoggedHour(entry.loggedAt ?? entry.createdAt) === hour,
      );

      rows.push({
        hour,
        entries: hourEntries,
        totals: sumLoggedNutrition(hourEntries),
      });
    }

    return rows;
  }, [entries, visibleEndHour, visibleStartHour]);

  const openAddFoodAtHour = useCallback(
    (hour: number) => {
      navigation.navigate("AddFood", {
        contextLabel: formatFoodHourLabel(hour),
        date: dateKey,
        loggedAt: buildFoodLoggedAt(dateKey, hour),
        mealType: null,
      });
    },
    [dateKey, navigation],
  );

  const openQuickAddAtHour = useCallback(
    (hour: number) => {
      navigation.navigate("QuickAddFood", {
        contextLabel: formatFoodHourLabel(hour),
        date: dateKey,
        loggedAt: buildFoodLoggedAt(dateKey, hour),
        mealType: null,
      });
    },
    [dateKey, navigation],
  );

  const openFavoriteEditorAtHour = useCallback(
    (food: DBFoodItem, hour: number) => {
      const minute =
        isToday && new Date().getHours() === hour ? new Date().getMinutes() : 0;

      navigation.navigate("ScannedFood", {
        foodId: food.id,
        date: dateKey,
        loggedAt: buildFoodLoggedAt(dateKey, hour, minute),
        mealType: null,
        contextLabel: formatFoodHourLabel(hour),
      });
    },
    [dateKey, isToday, navigation],
  );

  const deleteEntry = useCallback(
    (entryId: number) => {
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
    },
    [loadData],
  );

  const editEntry = useCallback(
    (entry: DBUserFoodLogEntry) => {
      if (entry.entrySource === "quick_add") {
        const resolvedLoggedAt = entry.loggedAt ?? entry.createdAt;

        navigation.navigate("QuickAddFood", {
          entryId: entry.id,
          date: entry.date,
          loggedAt: resolvedLoggedAt,
          mealType: entry.mealType ?? null,
          contextLabel: formatFoodLoggedTime(resolvedLoggedAt),
        });
        return;
      }

      navigation.navigate("EditFoodEntry", { entryId: entry.id });
    },
    [navigation],
  );

  const copyYesterday = useCallback(async () => {
    if (!user) {
      return;
    }

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    await DB.copyFoodLogsFromDate(user.externalId, sourceDate, dateKey);
    await loadData();
  }, [dateKey, loadData, selectedDate, user]);

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 36 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <FoodDiaryMainStrip
          days={mainStripDays}
          selectedDate={selectedDate}
          selectedTargetCalories={selectedTargetCalories}
          targetCaloriesByDate={targetCaloriesByDate}
          weeklyBudgetCalories={weeklyBudgetCalories}
          weeklyConsumedCalories={weeklyConsumedCalories}
          onNextWeek={() =>
            setSelectedDate((current) => shiftFoodDate(current, 7))
          }
          onPreviousWeek={() =>
            setSelectedDate((current) => shiftFoodDate(current, -7))
          }
          onSelectDate={setSelectedDate}
          totals={totals}
          user={user}
          hourBuckets={hourBuckets}
          selectedHour={selectedHour}
          onAddFood={openAddFoodAtHour}
          onDeleteEntry={deleteEntry}
          onEditEntry={editEntry}
          onSelectHour={setSelectedHour}
        />

        {/* <FoodDiaryQuickAdds
          favoriteFoods={favoriteFoods}
          selectedHour={selectedHour}
          onAddFavorite={(food, hour) => {
            openFavoriteEditorAtHour(food, hour);
          }}
        /> */}

        <FoodDiaryMoreSection
          selectedHour={selectedHour}
          onCopyYesterday={() => {
            void copyYesterday();
          }}
          onQuickAddFood={() => openQuickAddAtHour(selectedHour)}
          onCreateRecipe={() =>
            navigation.navigate("CreateRecipe", {
              contextLabel: formatFoodHourLabel(selectedHour),
              date: dateKey,
              loggedAt: buildFoodLoggedAt(dateKey, selectedHour),
              mealType: null,
            })
          }
          onCreateCustomFood={() =>
            navigation.navigate("CreateCustomFood", {
              contextLabel: formatFoodHourLabel(selectedHour),
              date: dateKey,
              loggedAt: buildFoodLoggedAt(dateKey, selectedHour),
              mealType: null,
            })
          }
        />
      </ScrollView>
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
  },
  orbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
});

export default FoodDiaryScreen;
