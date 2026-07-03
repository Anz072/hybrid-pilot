import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import {
  getFoodLogEntriesToCopy,
  getFoodLogCopyPreview,
} from "../../store/foodLogCopyUtils";
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
import type {
  FoodDiaryFavoriteFood,
  FoodDiaryMealBucket,
} from "./foodDiaryTypes";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodLoggedTime,
  getFoodDefaultLogAmount,
  formatFoodShortDate,
  getFoodResolvedServing,
  getDefaultMealSlotForNow,
  MEAL_SLOTS,
  MEAL_SLOT_DEFAULT_HOUR,
  MEAL_SLOT_LABELS,
  type MealSlot,
  parseFoodDateKey,
  resolveEntryMealSlot,
  shiftFoodDate,
  sumLoggedNutrition,
} from "./foodUtils";
import {
  resolveFoodLogContext,
  toFoodLogRouteParams,
} from "./foodLogContext";
import { appColors } from "../../theme/colors";
import {
  refreshAdaptiveRecommendationForUser,
  setDiaryDayCompletionAndRefresh,
} from "../User_Settings/adaptiveCaloriesActions";
import {
  getLastSeenAdaptiveRecommendationId,
  markAdaptiveRecommendationSeen,
} from "../../storage/localStore";
import { prefetchAddFoodStaticLists } from "./addFoodStaticListsCache";

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;

type SnackbarState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const formatEntryCountLabel = (count: number) =>
  `${count} ${count === 1 ? "entry" : "entries"}`;

const buildCopiedLoggedAt = (
  targetDateKey: string,
  entry: DBUserFoodLogEntry,
  fallbackHour: number,
) => {
  const sourceTimestamp = entry.loggedAt ?? entry.createdAt;
  const parsed = new Date(sourceTimestamp);
  const hour = Number.isFinite(parsed.getTime()) ? parsed.getHours() : fallbackHour;
  const minute = Number.isFinite(parsed.getTime()) ? parsed.getMinutes() : 0;

  return buildFoodLoggedAt(targetDateKey, hour, minute);
};

const shouldShowAdaptiveRecommendationBanner = (
  recommendation: DBAdaptiveCalorieRecommendation | null,
  lastSeenRecommendationId: number | null,
) => {
  if (!recommendation) {
    return null;
  }

  return recommendation.id === lastSeenRecommendationId ? null : recommendation;
};

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
  const [recentFoods, setRecentFoods] = useState<FoodDiaryFavoriteFood[]>([]);
  const [settings, setSettings] = useState<DBUserSettings | null>(null);
  const [dayCompletionByDate, setDayCompletionByDate] = useState<
    Record<string, boolean>
  >({});
  const [isDayCompleteLoading, setIsDayCompleteLoading] = useState(false);
  const [isCopyingYesterday, setIsCopyingYesterday] = useState(false);
  const [isRepeatingYesterdayMeal, setIsRepeatingYesterdayMeal] =
    useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] =
    useState<DBAdaptiveCalorieRecommendation | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealSlot>(() =>
    getDefaultMealSlotForNow(),
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
      setRecentFoods([]);
      return;
    }

    const [
      favorites,
      recents,
      nextSettings,
      weekEntries,
      weekDayStatuses,
      lastSeenRecommendationId,
    ] =
      await Promise.all([
        DB.getFavoriteFoodItems(currentUser.externalId, 10),
        DB.getRecentFoodItems(currentUser.externalId, 12),
        DB.getUserSettings(currentUser.externalId),
        DB.getUserFoodLogEntriesBetween(currentUser.externalId, weekStart, weekEnd),
        DB.listDiaryDayStatusesBetween(currentUser.externalId, weekStart, weekEnd),
        getLastSeenAdaptiveRecommendationId(currentUser.externalId),
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

    const toQuickPick = (food: (typeof favorites)[number]): FoodDiaryFavoriteFood => {
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
    };

    const mappedFavorites = favorites.map(toQuickPick);
    const favoriteIds = new Set(mappedFavorites.map((food) => food.id));

    setFavoriteFoods(mappedFavorites);
    setRecentFoods(
      recents
        .filter((food) => !favoriteIds.has(food.id))
        .map(toQuickPick)
        .slice(0, 8),
    );

    if (nextSettings?.adaptiveCaloriesEnabled) {
      try {
        const refreshResult = await refreshAdaptiveRecommendationForUser({
          userExternalId: currentUser.externalId,
        });
        setAdaptiveRecommendation(
          shouldShowAdaptiveRecommendationBanner(
            refreshResult.latestRecommendation,
            lastSeenRecommendationId,
          ),
        );
        if (refreshResult.settings) {
          setSettings(refreshResult.settings);
        }
      } catch {
        const latestOpenRecommendation =
          await DB.getLatestAdaptiveCalorieRecommendation(
            currentUser.externalId,
            "proposed",
          );
        setAdaptiveRecommendation(
          shouldShowAdaptiveRecommendationBanner(
            latestOpenRecommendation,
            lastSeenRecommendationId,
          ),
        );
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
    if (!snackbar) {
      return;
    }

    const timeout = setTimeout(() => setSnackbar(null), 7000);
    return () => clearTimeout(timeout);
  }, [snackbar]);

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

  React.useEffect(() => {
    if (!user?.externalId) {
      return;
    }

    prefetchAddFoodStaticLists();
  }, [user?.externalId]);

  const mealBuckets = useMemo<FoodDiaryMealBucket[]>(() => {
    const bySlot = new Map<MealSlot, DBUserFoodLogEntry[]>(
      MEAL_SLOTS.map((slot) => [slot, [] as DBUserFoodLogEntry[]]),
    );

    for (const entry of entries) {
      bySlot.get(resolveEntryMealSlot(entry))?.push(entry);
    }

    return MEAL_SLOTS.map((slot) => {
      const slotEntries = bySlot.get(slot) ?? [];
      return {
        slot,
        label: MEAL_SLOT_LABELS[slot],
        entries: slotEntries,
        totals: sumLoggedNutrition(slotEntries),
      };
    });
  }, [entries]);

  // A logged-at timestamp for a fresh entry: use the live clock when logging the
  // current meal today, otherwise anchor to the meal's representative hour.
  const buildMealLoggedAt = useCallback(
    (slot: MealSlot) => {
      if (isToday && slot === getDefaultMealSlotForNow()) {
        const now = new Date();
        return buildFoodLoggedAt(dateKey, now.getHours(), now.getMinutes());
      }

      return buildFoodLoggedAt(dateKey, MEAL_SLOT_DEFAULT_HOUR[slot], 0);
    },
    [dateKey, isToday],
  );

  const buildMealFoodLogRouteParams = useCallback(
    (slot: MealSlot) =>
      toFoodLogRouteParams(
        resolveFoodLogContext({
          contextLabel: MEAL_SLOT_LABELS[slot],
          date: dateKey,
          loggedAt: buildMealLoggedAt(slot),
          mealType: MEAL_SLOT_LABELS[slot],
        }),
      ),
    [buildMealLoggedAt, dateKey],
  );

  const openAddFoodAtMeal = useCallback(
    (slot: MealSlot) => {
      prefetchAddFoodStaticLists();
      navigation.navigate("AddFood", {
        ...buildMealFoodLogRouteParams(slot),
      });
    },
    [buildMealFoodLogRouteParams, navigation],
  );

  const openQuickAddAtMeal = useCallback(
    (slot: MealSlot) => {
      navigation.navigate("QuickAddFood", {
        ...buildMealFoodLogRouteParams(slot),
      });
    },
    [buildMealFoodLogRouteParams, navigation],
  );

  const openFavoriteEditorAtMeal = useCallback(
    (food: DBFoodItem, slot: MealSlot) => {
      navigation.navigate("ScannedFood", {
        ...buildMealFoodLogRouteParams(slot),
        foodId: food.id,
      });
    },
    [buildMealFoodLogRouteParams, navigation],
  );

  const quickLogFavoriteAtMeal = useCallback(
    async (food: FoodDiaryFavoriteFood, slot: MealSlot) => {
      if (!user) {
        Alert.alert(
          "No account found",
          "Create or restore a user before adding food.",
        );
        return;
      }

      try {
        await DB.addUserFoodLog({
          userExternalId: user.externalId,
          foodId: food.id,
          date: dateKey,
          loggedAt: buildMealLoggedAt(slot),
          quantityG: getFoodDefaultLogAmount(food),
          mealType: MEAL_SLOT_LABELS[slot],
        });
        await loadData();
        setSnackbar({
          message: `${food.name} logged to ${MEAL_SLOT_LABELS[slot]}`,
          actionLabel: "Edit",
          onAction: () => openFavoriteEditorAtMeal(food, slot),
        });
      } catch {
        Alert.alert("Could not log food", "Please review the food and try again.");
      }
    },
    [buildMealLoggedAt, dateKey, loadData, openFavoriteEditorAtMeal, user],
  );

  const restoreDeletedEntry = useCallback(
    async (entry: DBUserFoodLogEntry) => {
      if (entry.entrySource === "quick_add") {
        await DB.addQuickAddFoodLog({
          userExternalId: entry.userExternalId,
          date: entry.date,
          loggedAt: entry.loggedAt ?? entry.createdAt,
          mealType: entry.mealType ?? null,
          name: entry.quickAddName,
          calories: entry.calories,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
          systemCalculatedCalories: entry.systemCalculatedCalories,
          isEnergyManuallySet: entry.isEnergyManuallySet,
        });
        return;
      }

      if (entry.foodId == null) {
        throw new Error("That food entry cannot be restored.");
      }

      await DB.addUserFoodLog({
        userExternalId: entry.userExternalId,
        foodId: entry.foodId,
        date: entry.date,
        loggedAt: entry.loggedAt ?? entry.createdAt,
        quantityG: entry.quantityG,
        mealType: entry.mealType ?? null,
      });
    },
    [],
  );

  const deleteEntry = useCallback(
    (entry: DBUserFoodLogEntry) => {
      const entrySnapshot = { ...entry };

      Alert.alert(
        "Delete food entry?",
        "This removes the item from this diary day. You can undo it right after deleting.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              setWeekEntries((current) =>
                current.filter((item) => item.id !== entrySnapshot.id),
              );
              setSnackbar({
                message: "Food deleted",
                actionLabel: "Undo",
                onAction: () => {
                  setSnackbar(null);
                  void (async () => {
                    try {
                      await restoreDeletedEntry(entrySnapshot);
                      await loadData();
                    } catch {
                      Alert.alert(
                        "Undo failed",
                        "Please add the food entry again.",
                      );
                    }
                  })();
                },
              });

              void (async () => {
                try {
                  await DB.deleteUserFoodLog(entrySnapshot.id);
                  await loadData();
                } catch {
                  setSnackbar(null);
                  await loadData();
                  Alert.alert("Could not delete food", "Please try again.");
                }
              })();
            },
          },
        ],
      );
    },
    [loadData, restoreDeletedEntry],
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

  const copyEntryToDate = useCallback(
    async (entry: DBUserFoodLogEntry, slot: MealSlot) => {
      const loggedAt = buildCopiedLoggedAt(
        dateKey,
        entry,
        MEAL_SLOT_DEFAULT_HOUR[slot],
      );

      if (entry.entrySource === "quick_add") {
        await DB.addQuickAddFoodLog({
          userExternalId: entry.userExternalId,
          date: dateKey,
          loggedAt,
          mealType: entry.mealType ?? MEAL_SLOT_LABELS[slot],
          name: entry.quickAddName,
          calories: entry.calories,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
          systemCalculatedCalories: entry.systemCalculatedCalories,
          isEnergyManuallySet: entry.isEnergyManuallySet,
        });
        return;
      }

      if (entry.foodId == null) {
        throw new Error("That food entry cannot be copied.");
      }

      await DB.addUserFoodLog({
        userExternalId: entry.userExternalId,
        foodId: entry.foodId,
        date: dateKey,
        loggedAt,
        quantityG: entry.quantityG,
        mealType: entry.mealType ?? MEAL_SLOT_LABELS[slot],
      });
    },
    [dateKey],
  );

  const repeatYesterdayMeal = useCallback(async () => {
    if (!user || isRepeatingYesterdayMeal) {
      return;
    }

    const slot = selectedMeal;
    const mealLabel = MEAL_SLOT_LABELS[slot];
    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    const sourceDateLabel = formatFoodShortDate(parseFoodDateKey(sourceDate));
    const targetDateLabel = formatFoodShortDate(selectedDate);

    try {
      const [sourceEntries, destinationEntries] = await Promise.all([
        DB.getUserFoodLogEntriesByDate(user.externalId, sourceDate),
        DB.getUserFoodLogEntriesByDate(user.externalId, dateKey),
      ]);
      const sourceMealEntries = sourceEntries.filter(
        (entry) => resolveEntryMealSlot(entry) === slot,
      );
      const destinationMealEntries = destinationEntries.filter(
        (entry) => resolveEntryMealSlot(entry) === slot,
      );
      const preview = getFoodLogCopyPreview(
        sourceMealEntries,
        destinationMealEntries,
      );

      if (preview.sourceCount === 0) {
        Alert.alert(
          "Nothing to repeat",
          `No ${mealLabel.toLowerCase()} entries were logged on ${sourceDateLabel}.`,
        );
        return;
      }

      if (preview.copiedCount === 0) {
        Alert.alert(
          "Already repeated",
          `${targetDateLabel} already has matching ${mealLabel.toLowerCase()} entries. Duplicate protection will keep the diary unchanged.`,
        );
        return;
      }

      const confirmationMessage =
        preview.destinationCount > 0
          ? `${sourceDateLabel} has ${formatEntryCountLabel(preview.sourceCount)} in ${mealLabel}. ${targetDateLabel} already has ${formatEntryCountLabel(preview.destinationCount)}, so duplicate protection will skip ${formatEntryCountLabel(preview.skippedDuplicates)} and copy ${formatEntryCountLabel(preview.copiedCount)}.`
          : `Repeat ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel} ${mealLabel}?`;

      Alert.alert(`Repeat ${mealLabel}?`, confirmationMessage, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Repeat ${preview.copiedCount}`,
          onPress: () => {
            void (async () => {
              try {
                setIsRepeatingYesterdayMeal(true);

                const entriesToCopy = getFoodLogEntriesToCopy(
                  sourceMealEntries,
                  destinationMealEntries,
                );

                for (const entry of entriesToCopy) {
                  await copyEntryToDate(entry, slot);
                }

                await loadData();

                setSnackbar({
                  message: `Repeated ${formatEntryCountLabel(entriesToCopy.length)} in ${mealLabel}`,
                });
              } catch {
                Alert.alert(
                  "Could not repeat this meal",
                  "Please try again.",
                );
              } finally {
                setIsRepeatingYesterdayMeal(false);
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
  }, [
    copyEntryToDate,
    dateKey,
    isRepeatingYesterdayMeal,
    loadData,
    selectedDate,
    selectedMeal,
    user,
  ]);

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

  const dismissAdaptiveRecommendation = useCallback(() => {
    if (!user || !adaptiveRecommendation) {
      return;
    }

    const recommendationId = adaptiveRecommendation.id;
    setAdaptiveRecommendation(null);
    void markAdaptiveRecommendationSeen(user.externalId, recommendationId);
  }, [adaptiveRecommendation, user]);

  const openAdaptiveSettings = useCallback(() => {
    if (user && adaptiveRecommendation) {
      const recommendationId = adaptiveRecommendation.id;
      setAdaptiveRecommendation(null);
      void markAdaptiveRecommendationSeen(user.externalId, recommendationId);
    }

    const parentNavigation = navigation.getParent();
    if (!parentNavigation) {
      return;
    }

    (parentNavigation as {
      navigate: (routeName: string, params?: object) => void;
    }).navigate("More", {
      screen: "WeeklyReviewScreen",
    });
  }, [adaptiveRecommendation, navigation, user]);

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
            onDismiss={dismissAdaptiveRecommendation}
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
          mealBuckets={mealBuckets}
          selectedMeal={selectedMeal}
          favoriteFoods={favoriteFoods}
          recentFoods={recentFoods}
          isDayComplete={isSelectedDayComplete}
          isDayCompleteLoading={isDayCompleteLoading}
          onAddFood={openAddFoodAtMeal}
          onAddFavorite={(food, slot) => {
            openFavoriteEditorAtMeal(food, slot);
          }}
          onDeleteEntry={deleteEntry}
          onEditEntry={editEntry}
          onQuickLogFavorite={(food, slot) => {
            void quickLogFavoriteAtMeal(food, slot);
          }}
          onSelectMeal={setSelectedMeal}
          onToggleDayComplete={() => {
            void toggleDayComplete();
          }}
        />

        <FoodDiaryMoreSection
          isCopyingYesterday={isCopyingYesterday}
          isRepeatingYesterdayMeal={isRepeatingYesterdayMeal}
          selectedMeal={selectedMeal}
          onCopyYesterday={() => {
            void copyYesterday();
          }}
          onRepeatYesterdayMeal={() => {
            void repeatYesterdayMeal();
          }}
          onQuickAddFood={() => openQuickAddAtMeal(selectedMeal)}
          onCreateRecipe={() =>
            navigation.navigate("CreateRecipe", {
              ...buildMealFoodLogRouteParams(selectedMeal),
            })
          }
          onCreateCustomFood={() =>
            navigation.navigate("CreateCustomFood", {
              ...buildMealFoodLogRouteParams(selectedMeal),
            })
          }
        />
      </ScrollView>

      {snackbar ? (
        <View style={[styles.snackbar, { bottom: insets.bottom + 98 }]}>
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
          {snackbar.actionLabel && snackbar.onAction ? (
            <Pressable
              onPress={snackbar.onAction}
              style={({ pressed }) => [
                styles.snackbarAction,
                pressed && styles.snackbarActionPressed,
              ]}
            >
              <Text style={styles.snackbarActionText}>
                {snackbar.actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 14,
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 8,
    backgroundColor: appColors.slate900,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  snackbarText: {
    flex: 1,
    color: appColors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  snackbarAction: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  snackbarActionPressed: {
    opacity: 0.88,
  },
  snackbarActionText: {
    color: appColors.slate900,
    fontSize: 12,
    fontWeight: "800",
  },
});

export default FoodDiaryScreen;
