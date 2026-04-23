import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBAdaptiveCalorieRecommendation,
  DBUser,
  DBUserSettings,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import { getFoodLogCopyPreview } from "../../store/foodLogCopyUtils";
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
import AdaptiveCaloriesBanner from "./AdaptiveCaloriesBanner";
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
  formatFoodShortDate,
  getFoodLoggedHour,
  getFoodResolvedServing,
  parseFoodDateKey,
  shiftFoodDate,
  sumLoggedNutrition,
} from "./foodUtils";
import { appColors } from "../../theme/colors";
import {
  refreshAdaptiveRecommendationForUser,
  setDiaryDayCompletionAndRefresh,
} from "../User_Settings/adaptiveCaloriesActions";

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

const formatEntryCountLabel = (count: number) =>
  `${count} ${count === 1 ? "entry" : "entries"}`;

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [user, setUser] = useState<DBUser | null>(null);
  const [weekEntries, setWeekEntries] = useState<DBUserFoodLogEntry[]>([]);
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
  const [dayCompletionByDate, setDayCompletionByDate] = useState<
    Record<string, boolean>
  >({});
  const [isDayCompleteLoading, setIsDayCompleteLoading] = useState(false);
  const [isCopyingYesterday, setIsCopyingYesterday] = useState(false);
  const [adaptiveRecommendation, setAdaptiveRecommendation] =
    useState<DBAdaptiveCalorieRecommendation | null>(null);
  const [visibleStartHour, setVisibleStartHour] = useState(INITIAL_START);
  const [visibleEndHour, setVisibleEndHour] = useState(INITIAL_END);
  const [selectedHour, setSelectedHour] = useState(() =>
    Math.min(INITIAL_END, Math.max(INITIAL_START, new Date().getHours())),
  );

  const dateKey = useMemo(
    () => formatFoodDateKey(selectedDate),
    [selectedDate],
  );
  const selectedWeekStart = useMemo(
    () => buildFoodDiaryWeekDays(selectedDate)[0] ?? selectedDate,
    [selectedDate],
  );
  const weekStart = useMemo(
    () => formatFoodDateKey(selectedWeekStart),
    [selectedWeekStart],
  );
  const weekDays = useMemo(
    () => buildFoodDiaryWeekDays(parseFoodDateKey(weekStart)),
    [weekStart],
  );
  const weekDateKeys = useMemo(
    () => weekDays.map(formatFoodDateKey),
    [weekDays],
  );
  const weekEnd = weekDateKeys[weekDateKeys.length - 1] ?? dateKey;

  const loadData = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setWeekEntries([]);
      setSettings(null);
      setDayCompletionByDate({});
      setAdaptiveRecommendation(null);
      setMainStripDays(weekDays.map((date, index) => ({
        date,
        dateKey: weekDateKeys[index],
        calories: 0,
      })));
      setFavoriteFoods([]);
      setVisibleStartHour(INITIAL_START);
      setVisibleEndHour(INITIAL_END);
      return;
    }

    const [favorites, nextSettings, weekEntries, weekDayStatuses] =
      await Promise.all([
        DB.getFavoriteFoodItems(currentUser.externalId, 10),
        DB.getUserSettings(currentUser.externalId),
        DB.getUserFoodLogEntriesBetween(currentUser.externalId, weekStart, weekEnd),
        DB.listDiaryDayStatusesBetween(currentUser.externalId, weekStart, weekEnd),
      ]);

    const weekEntriesByDate = weekDateKeys.map((weekDateKey) =>
      weekEntries.filter((entry) => entry.date === weekDateKey),
    );

    setWeekEntries(weekEntries);
    setSettings(nextSettings);
    setMainStripDays(
      weekDays.map((date, index) => ({
        date,
        dateKey: weekDateKeys[index],
        calories: sumLoggedNutrition(weekEntriesByDate[index] ?? []).calories,
      })),
    );
    setDayCompletionByDate(
      Object.fromEntries(
        weekDayStatuses.map((status) => [status.date, status.isComplete]),
      ) as Record<string, boolean>,
    );

    if (nextSettings) {
      const normalized = normalizeVisibleHours(
        nextSettings.foodDiaryStartHour,
        nextSettings.foodDiaryEndHour,
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

    if (nextSettings?.adaptiveCaloriesEnabled) {
      try {
        const refreshResult = await refreshAdaptiveRecommendationForUser({
          userExternalId: currentUser.externalId,
        });
        setAdaptiveRecommendation(refreshResult.latestRecommendation);
        if (refreshResult.settings) {
          setSettings(refreshResult.settings);
        }
      } catch {
        const latestOpenRecommendation =
          await DB.getLatestAdaptiveCalorieRecommendation(
            currentUser.externalId,
            "proposed",
          );
        setAdaptiveRecommendation(latestOpenRecommendation);
      }
    } else {
      setAdaptiveRecommendation(null);
    }
  }, [weekDateKeys, weekDays, weekEnd, weekStart]);

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

  const entries = useMemo(
    () => weekEntries.filter((entry) => entry.date === dateKey),
    [dateKey, weekEntries],
  );
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
  const isSelectedDayComplete = Boolean(dayCompletionByDate[dateKey]);

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
    if (!user || isCopyingYesterday) {
      return;
    }

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    const sourceDateLabel = formatFoodShortDate(parseFoodDateKey(sourceDate));
    const targetDateLabel = formatFoodShortDate(selectedDate);

    try {
      const [sourceEntries, destinationEntries] = await Promise.all([
        DB.getUserFoodLogEntriesByDate(user.externalId, sourceDate),
        DB.getUserFoodLogEntriesByDate(user.externalId, dateKey),
      ]);
      const preview = getFoodLogCopyPreview(sourceEntries, destinationEntries);

      if (preview.sourceCount === 0) {
        Alert.alert(
          "Nothing to copy",
          `No food entries were logged on ${sourceDateLabel}.`,
        );
        return;
      }

      if (preview.copiedCount === 0) {
        Alert.alert(
          "Already copied",
          `${targetDateLabel} already has matching ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel}. Duplicate protection will keep the diary unchanged.`,
        );
        return;
      }

      const confirmationMessage =
        preview.destinationCount > 0
          ? `${sourceDateLabel} has ${formatEntryCountLabel(preview.sourceCount)}. ${targetDateLabel} already has ${formatEntryCountLabel(preview.destinationCount)}. Duplicate protection will skip ${formatEntryCountLabel(preview.skippedDuplicates)} and copy ${formatEntryCountLabel(preview.copiedCount)}.`
          : `Copy ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel} into ${targetDateLabel}?`;

      Alert.alert("Copy yesterday?", confirmationMessage, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Copy ${preview.copiedCount}`,
          onPress: () => {
            void (async () => {
              try {
                setIsCopyingYesterday(true);

                const result = await DB.copyFoodLogsFromDate(
                  user.externalId,
                  sourceDate,
                  dateKey,
                );

                await loadData();

                if (result.copiedCount === 0) {
                  Alert.alert(
                    "No new entries copied",
                    `${targetDateLabel} already had matching entries. Duplicate protection kept the diary unchanged.`,
                  );
                  return;
                }

                Alert.alert(
                  "Yesterday copied",
                  result.skippedDuplicates > 0
                    ? `Copied ${formatEntryCountLabel(result.copiedCount)} into ${targetDateLabel} and skipped ${formatEntryCountLabel(result.skippedDuplicates)} that were already there.`
                    : `Copied ${formatEntryCountLabel(result.copiedCount)} into ${targetDateLabel}.`,
                );
              } catch {
                Alert.alert(
                  "Could not copy yesterday",
                  "Please try again.",
                );
              } finally {
                setIsCopyingYesterday(false);
              }
            })();
          },
        },
      ]);
    } catch {
      Alert.alert(
        "Could not review yesterday",
        "Please try again.",
      );
    }
  }, [dateKey, isCopyingYesterday, loadData, selectedDate, user]);

  const openAdaptiveSettings = useCallback(() => {
    const parentNavigation = navigation.getParent();
    if (!parentNavigation) {
      return;
    }

    (parentNavigation as {
      navigate: (routeName: string, params?: object) => void;
    }).navigate("More", {
      screen: "AdaptiveCaloriesSettingsScreen",
    });
  }, [navigation]);

  const toggleDayComplete = useCallback(async () => {
    if (!user || isDayCompleteLoading) {
      return;
    }

    setIsDayCompleteLoading(true);

    try {
      await setDiaryDayCompletionAndRefresh({
        userExternalId: user.externalId,
        date: dateKey,
        isComplete: !isSelectedDayComplete,
      });
      await loadData();
    } catch {
      Alert.alert(
        "Could not update completion",
        "Please try marking the day complete again.",
      );
    } finally {
      setIsDayCompleteLoading(false);
    }
  }, [dateKey, isDayCompleteLoading, isSelectedDayComplete, loadData, user]);

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
        {adaptiveRecommendation ? (
          <AdaptiveCaloriesBanner
            recommendation={adaptiveRecommendation}
            onReview={openAdaptiveSettings}
          />
        ) : null}

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
          isDayComplete={isSelectedDayComplete}
          isDayCompleteLoading={isDayCompleteLoading}
          isCopyingYesterday={isCopyingYesterday}
          selectedHour={selectedHour}
          onToggleDayComplete={() => {
            void toggleDayComplete();
          }}
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
