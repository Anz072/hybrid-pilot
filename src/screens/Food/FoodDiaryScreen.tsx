import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBUser,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import FoodDiaryMainStrip, {
  buildFoodDiaryWeekDays,
  type FoodDiaryMainStripDay,
} from "./FoodDiaryMainStrip";
import FoodDiaryMoreSection from "./FoodDiaryMoreSection";
import FoodDiaryQuickAdds from "./FoodDiaryQuickAdds";
import type {
  FoodDiaryFavoriteFood,
  FoodDiaryHourBucket,
} from "./foodDiaryTypes";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodHourLabel,
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
      setMainStripDays(
        buildFoodDiaryWeekDays(selectedDate).map((date) => ({
          date,
          dateKey: formatFoodDateKey(date),
          calories: 0,
        })),
      );
      setFavoriteFoods([]);
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

  const copyYesterday = useCallback(async () => {
    if (!user) {
      return;
    }

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    await DB.copyFoodLogsFromDate(user.externalId, sourceDate, dateKey);
    await loadData();
  }, [dateKey, loadData, selectedDate, user]);

  const updateVisibleHours = useCallback(
    (startHour: number, endHour: number) => {
      const normalized = normalizeVisibleHours(startHour, endHour);
      setVisibleStartHour(normalized.startHour);
      setVisibleEndHour(normalized.endHour);

      if (user) {
        void DB.saveUserSettings({
          userExternalId: user.externalId,
          foodDiaryStartHour: normalized.startHour,
          foodDiaryEndHour: normalized.endHour,
        });
      }
    },
    [user],
  );

  const changeStart = useCallback(
    (next: number) => updateVisibleHours(next, visibleEndHour),
    [updateVisibleHours, visibleEndHour],
  );

  const changeEnd = useCallback(
    (next: number) => updateVisibleHours(visibleStartHour, next),
    [updateVisibleHours, visibleStartHour],
  );

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
          targetCalories={user?.calorieAllowance ?? null}
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
          onEditEntry={(entryId) =>
            navigation.navigate("EditFoodEntry", { entryId })
          }
          onSelectHour={setSelectedHour}
        />

        <FoodDiaryQuickAdds
          favoriteFoods={favoriteFoods}
          selectedHour={selectedHour}
          onAddFavorite={(food, hour) => {
            openFavoriteEditorAtHour(food, hour);
          }}
        />

        <FoodDiaryMoreSection
          hourBuckets={hourBuckets}
          selectedHour={selectedHour}
          visibleEndHour={visibleEndHour}
          visibleStartHour={visibleStartHour}
          onChangeEnd={changeEnd}
          onChangeStart={changeStart}
          onAddFood={openAddFoodAtHour}
          onCopyYesterday={() => {
            void copyYesterday();
          }}
          onCreateCustomFood={() =>
            navigation.navigate("CreateCustomFood", {
              contextLabel: formatFoodHourLabel(selectedHour),
              date: dateKey,
              loggedAt: buildFoodLoggedAt(dateKey, selectedHour),
              mealType: null,
            })
          }
          onResetHours={() => updateVisibleHours(INITIAL_START, INITIAL_END)}
          onSelectHour={setSelectedHour}
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
