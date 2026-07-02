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
  FoodDiaryHourBucket,
} from "./foodDiaryTypes";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  getFoodDefaultLogAmount,
  formatFoodShortDate,
  getFoodLoggedHour,
  getFoodResolvedServing,
  parseFoodDateKey,
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

const INITIAL_START = 7;
const INITIAL_END = 22;

type SnackbarState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

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

const getEntryLoggedHour = (entry: DBUserFoodLogEntry) =>
  getFoodLoggedHour(entry.loggedAt ?? entry.createdAt);

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
  const [settings, setSettings] = useState<DBUserSettings | null>(null);
  const [dayCompletionByDate, setDayCompletionByDate] = useState<
    Record<string, boolean>
  >({});
  const [isDayCompleteLoading, setIsDayCompleteLoading] = useState(false);
  const [isCopyingYesterday, setIsCopyingYesterday] = useState(false);
  const [isRepeatingYesterdayHour, setIsRepeatingYesterdayHour] =
    useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
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
  const currentClockHour = new Date().getHours();

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

    const [
      favorites,
      nextSettings,
      weekEntries,
      weekDayStatuses,
      lastSeenRecommendationId,
    ] =
      await Promise.all([
        DB.getFavoriteFoodItems(currentUser.externalId, 10),
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

  React.useEffect(() => {
    setSelectedHour(
      Math.min(
        visibleEndHour,
        Math.max(visibleStartHour, currentClockHour),
      ),
    );
  }, [currentClockHour, selectedDate, visibleEndHour, visibleStartHour]);

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

  const hourBuckets = useMemo(() => {
    const bucketHours = new Set<number>();

    for (let hour = visibleStartHour; hour <= visibleEndHour; hour += 1) {
      bucketHours.add(hour);
    }

    if (isToday) {
      bucketHours.add(currentClockHour);
    }

    return [...bucketHours].sort((left, right) => left - right).map((hour) => {
      const hourEntries = entries.filter(
        (entry) =>
          getFoodLoggedHour(entry.loggedAt ?? entry.createdAt) === hour,
      );

      return {
        hour,
        entries: hourEntries,
        totals: sumLoggedNutrition(hourEntries),
      };
    });
  }, [currentClockHour, entries, isToday, visibleEndHour, visibleStartHour]);

  const buildHourFoodLogRouteParams = useCallback(
    (hour: number, minute = 0) =>
      toFoodLogRouteParams(
        resolveFoodLogContext({
          contextLabel: formatFoodHourLabel(hour),
          date: dateKey,
          loggedAt: buildFoodLoggedAt(dateKey, hour, minute),
          mealType: null,
        }),
      ),
    [dateKey],
  );

  const openAddFoodAtHour = useCallback(
    (hour: number) => {
      prefetchAddFoodStaticLists();
      navigation.navigate("AddFood", {
        ...buildHourFoodLogRouteParams(hour),
      });
    },
    [buildHourFoodLogRouteParams, navigation],
  );

  const openQuickAddAtHour = useCallback(
    (hour: number) => {
      navigation.navigate("QuickAddFood", {
        ...buildHourFoodLogRouteParams(hour),
      });
    },
    [buildHourFoodLogRouteParams, navigation],
  );

  const openFavoriteEditorAtHour = useCallback(
    (food: DBFoodItem, hour: number) => {
      const minute =
        isToday && new Date().getHours() === hour ? new Date().getMinutes() : 0;

      navigation.navigate("ScannedFood", {
        ...buildHourFoodLogRouteParams(hour, minute),
        foodId: food.id,
      });
    },
    [buildHourFoodLogRouteParams, isToday, navigation],
  );

  const quickLogFavoriteAtHour = useCallback(
    async (food: FoodDiaryFavoriteFood, hour: number) => {
      if (!user) {
        Alert.alert(
          "No account found",
          "Create or restore a user before adding food.",
        );
        return;
      }

      const minute =
        isToday && new Date().getHours() === hour ? new Date().getMinutes() : 0;

      try {
        await DB.addUserFoodLog({
          userExternalId: user.externalId,
          foodId: food.id,
          date: dateKey,
          loggedAt: buildFoodLoggedAt(dateKey, hour, minute),
          quantityG: getFoodDefaultLogAmount(food),
          mealType: null,
        });
        await loadData();
        setSnackbar({
          message: `${food.name} logged`,
          actionLabel: "Edit",
          onAction: () => openFavoriteEditorAtHour(food, hour),
        });
      } catch {
        Alert.alert("Could not log food", "Please review the food and try again.");
      }
    },
    [dateKey, isToday, loadData, openFavoriteEditorAtHour, user],
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
    async (entry: DBUserFoodLogEntry, targetHour: number) => {
      const loggedAt = buildCopiedLoggedAt(dateKey, entry, targetHour);

      if (entry.entrySource === "quick_add") {
        await DB.addQuickAddFoodLog({
          userExternalId: entry.userExternalId,
          date: dateKey,
          loggedAt,
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
        throw new Error("That food entry cannot be copied.");
      }

      await DB.addUserFoodLog({
        userExternalId: entry.userExternalId,
        foodId: entry.foodId,
        date: dateKey,
        loggedAt,
        quantityG: entry.quantityG,
        mealType: entry.mealType ?? null,
      });
    },
    [dateKey],
  );

  const repeatYesterdayHour = useCallback(async () => {
    if (!user || isRepeatingYesterdayHour) {
      return;
    }

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    const sourceDateLabel = formatFoodShortDate(parseFoodDateKey(sourceDate));
    const targetDateLabel = formatFoodShortDate(selectedDate);
    const hourLabel = formatFoodHourLabel(selectedHour);

    try {
      const [sourceEntries, destinationEntries] = await Promise.all([
        DB.getUserFoodLogEntriesByDate(user.externalId, sourceDate),
        DB.getUserFoodLogEntriesByDate(user.externalId, dateKey),
      ]);
      const sourceHourEntries = sourceEntries.filter(
        (entry) => getEntryLoggedHour(entry) === selectedHour,
      );
      const destinationHourEntries = destinationEntries.filter(
        (entry) => getEntryLoggedHour(entry) === selectedHour,
      );
      const preview = getFoodLogCopyPreview(
        sourceHourEntries,
        destinationHourEntries,
      );

      if (preview.sourceCount === 0) {
        Alert.alert(
          "Nothing to repeat",
          `No food entries were logged around ${hourLabel} on ${sourceDateLabel}.`,
        );
        return;
      }

      if (preview.copiedCount === 0) {
        Alert.alert(
          "Already repeated",
          `${targetDateLabel} already has matching ${formatEntryCountLabel(preview.sourceCount)} around ${hourLabel}. Duplicate protection will keep the diary unchanged.`,
        );
        return;
      }

      const confirmationMessage =
        preview.destinationCount > 0
          ? `${sourceDateLabel} has ${formatEntryCountLabel(preview.sourceCount)} around ${hourLabel}. ${targetDateLabel} already has ${formatEntryCountLabel(preview.destinationCount)} in that slot, so duplicate protection will skip ${formatEntryCountLabel(preview.skippedDuplicates)} and copy ${formatEntryCountLabel(preview.copiedCount)}.`
          : `Repeat ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel} at ${hourLabel}?`;

      Alert.alert("Repeat this hour?", confirmationMessage, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Repeat ${preview.copiedCount}`,
          onPress: () => {
            void (async () => {
              try {
                setIsRepeatingYesterdayHour(true);

                const entriesToCopy = getFoodLogEntriesToCopy(
                  sourceHourEntries,
                  destinationHourEntries,
                );

                for (const entry of entriesToCopy) {
                  await copyEntryToDate(entry, selectedHour);
                }

                await loadData();

                setSnackbar({
                  message: `Repeated ${formatEntryCountLabel(entriesToCopy.length)} at ${hourLabel}`,
                });
              } catch {
                Alert.alert(
                  "Could not repeat this hour",
                  "Please try again.",
                );
              } finally {
                setIsRepeatingYesterdayHour(false);
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
    isRepeatingYesterdayHour,
    loadData,
    selectedDate,
    selectedHour,
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
      screen: "AdaptiveCaloriesSettingsScreen",
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
          hourBuckets={hourBuckets}
          selectedHour={selectedHour}
          favoriteFoods={favoriteFoods}
          isDayComplete={isSelectedDayComplete}
          isDayCompleteLoading={isDayCompleteLoading}
          onAddFood={openAddFoodAtHour}
          onAddFavorite={(food, hour) => {
            openFavoriteEditorAtHour(food, hour);
          }}
          onDeleteEntry={deleteEntry}
          onEditEntry={editEntry}
          onQuickLogFavorite={(food, hour) => {
            void quickLogFavoriteAtHour(food, hour);
          }}
          onSelectHour={setSelectedHour}
          onToggleDayComplete={() => {
            void toggleDayComplete();
          }}
        />

        <FoodDiaryMoreSection
          isCopyingYesterday={isCopyingYesterday}
          isRepeatingYesterdayHour={isRepeatingYesterdayHour}
          selectedHour={selectedHour}
          onCopyYesterday={() => {
            void copyYesterday();
          }}
          onRepeatYesterdayHour={() => {
            void repeatYesterdayHour();
          }}
          onQuickAddFood={() => openQuickAddAtHour(selectedHour)}
          onCreateRecipe={() =>
            navigation.navigate("CreateRecipe", {
              ...buildHourFoodLogRouteParams(selectedHour),
            })
          }
          onCreateCustomFood={() =>
            navigation.navigate("CreateCustomFood", {
              ...buildHourFoodLogRouteParams(selectedHour),
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
