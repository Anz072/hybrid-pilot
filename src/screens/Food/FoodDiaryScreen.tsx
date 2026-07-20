import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Modal,
  PanResponder,
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
  DBDiaryDayStatus,
  DBUserSettings,
  DBUserFoodLogEntry,
} from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
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
import { appStates } from "../../theme/tokens";
import {
  refreshAdaptiveRecommendationForUser,
  setDiaryDayCompletionAndRefresh,
} from "../User_Settings/adaptiveCaloriesActions";
import {
  getLastSeenAdaptiveRecommendationId,
  markAdaptiveRecommendationSeen,
} from "../../storage/localStore";
import { prefetchAddFoodStaticLists } from "./addFoodStaticListsCache";
import { useFoodDiaryDateContext } from "./foodDiaryDateContext";
import {
  finishDiaryTrace,
  markDiaryUseful,
  measureDiaryRequest,
  measureDiaryStep,
  recordDiaryCachePath,
  recordDiaryRender,
  startDiaryTrace,
  type DiaryPerfReason,
  type DiaryPerfTrace,
} from "../../performance/diaryPerformance";

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;

const SNACKBAR_AUTO_DISMISS_MS = 4900;
const SNACKBAR_DISMISS_DISTANCE = 96;
const SNACKBAR_OFFSCREEN_DISTANCE = 420;
const SNACKBAR_BOTTOM_GAP = 8;

type SnackbarState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type DiaryActionModalState = {
  action: "copyDay" | "repeatMeal";
  copiedCount?: number;
  mealLabel?: string;
  mealSlot?: MealSlot;
  message: string;
  sourceDate?: string;
  sourceDateLabel?: string;
  stage: "checking" | "confirm" | "copying" | "success" | "empty" | "already" | "error";
  targetDate?: string;
  targetDateLabel?: string;
  title: string;
};

const formatEntryCountLabel = (count: number) =>
  `${count} ${count === 1 ? "entry" : "entries"}`;

// Preserve the source entry's full local time (including seconds) on the new
// day, matching the copy-day path — duplicate detection keys on the timestamp,
// so dropping seconds would make a second "repeat meal" re-copy its own output.
const buildCopiedLoggedAt = (
  targetDateKey: string,
  entry: DBUserFoodLogEntry,
  fallbackHour: number,
) => {
  const sourceTimestamp = entry.loggedAt ?? entry.createdAt;
  const parsed = new Date(sourceTimestamp);

  if (!Number.isFinite(parsed.getTime())) {
    return buildFoodLoggedAt(targetDateKey, fallbackHour, 0);
  }

  const [year, month, day] = targetDateKey.split("-").map(Number);
  return new Date(
    year,
    (month || 1) - 1,
    day || 1,
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds(),
    parsed.getMilliseconds(),
  ).toISOString();
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

const getDiaryWeekStartKey = (date: Date) =>
  formatFoodDateKey(buildFoodDiaryWeekDays(date)[0] ?? date);

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();
  const insets = useSafeAreaInsets();
  const foodDiaryDateContext = useFoodDiaryDateContext();
  const setSharedSelectedDateKey = foodDiaryDateContext?.setSelectedDateKey;
  const setSharedSelectedMeal = foodDiaryDateContext?.setSelectedMeal;
  const user = useAppSelector((state) => state.user.currentUser);

  const [selectedDate, setSelectedDate] = useState(() =>
    foodDiaryDateContext
      ? parseFoodDateKey(foodDiaryDateContext.selectedDateKey)
      : new Date(),
  );
  // Keep the displayed date stable across week boundaries until that week's
  // entries and statuses are ready; same-week requests commit immediately.
  const [requestedDate, setRequestedDate] = useState(selectedDate);
  const [weekEntries, setWeekEntries] = useState<DBUserFoodLogEntry[]>([]);
  const [mainStripDays, setMainStripDays] = useState<FoodDiaryMainStripDay[]>(
    () =>
      buildFoodDiaryWeekDays(selectedDate).map((date) => ({
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
  const [isInitialDiaryLoading, setIsInitialDiaryLoading] = useState(true);
  const [isDiaryRefreshing, setIsDiaryRefreshing] = useState(false);
  const [diaryLoadError, setDiaryLoadError] = useState<string | null>(null);
  const [dayCompletionByDate, setDayCompletionByDate] = useState<
    Record<string, boolean>
  >({});
  const [isDayCompleteLoading, setIsDayCompleteLoading] = useState(false);
  const [isCopyingYesterday, setIsCopyingYesterday] = useState(false);
  const [isRepeatingYesterdayMeal, setIsRepeatingYesterdayMeal] =
    useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [diaryActionModal, setDiaryActionModal] =
    useState<DiaryActionModalState | null>(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] =
    useState<DBAdaptiveCalorieRecommendation | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealSlot>(() =>
    foodDiaryDateContext?.selectedMeal ?? getDefaultMealSlotForNow(),
  );
  const snackbarTranslateX = React.useRef(new Animated.Value(0)).current;
  const diaryLoadRequestRef = useRef(0);
  const activeDiaryLoadWeekRef = useRef<string | null>(null);
  const hasLoadedDiaryRef = useRef(false);
  const weekLoadInFlightRef = useRef(
    new Map<
      string,
      Promise<[DBUserFoodLogEntry[], DBDiaryDayStatus[]]>
    >(),
  );
  const adaptiveRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const adaptiveRefreshGenerationRef = useRef(0);
  const activeDiaryTraceRef = useRef<DiaryPerfTrace | null>(null);
  const readyDiaryTraceIdRef = useRef<string | null>(null);
  const visitedDiaryDatesRef = useRef(new Set<string>());
  const todayDateKeyRef = useRef(formatFoodDateKey(new Date()));
  // Synchronous re-entrancy lock: a double-tap on a quick-log chip must not
  // create two diary entries while the first write is in flight.
  const quickLoggingKeysRef = useRef(new Set<string>());

  const dateKey = useMemo(
    () => formatFoodDateKey(selectedDate),
    [selectedDate],
  );
  const selectedDateKeyRef = useRef(dateKey);
  selectedDateKeyRef.current = dateKey;
  const requestedDateKey = useMemo(
    () => formatFoodDateKey(requestedDate),
    [requestedDate],
  );
  const requestedDateKeyRef = useRef(requestedDateKey);
  requestedDateKeyRef.current = requestedDateKey;
  React.useEffect(() => {
    setSharedSelectedDateKey?.(dateKey);
  }, [dateKey, setSharedSelectedDateKey]);
  React.useEffect(() => {
    setSharedSelectedMeal?.(selectedMeal);
  }, [selectedMeal, setSharedSelectedMeal]);
  const selectedWeekStart = useMemo(
    () => buildFoodDiaryWeekDays(requestedDate)[0] ?? requestedDate,
    [requestedDate],
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

  const beginDiaryTrace = useCallback(
    (reason: DiaryPerfReason, fromDate: string, toDate: string) => {
      finishDiaryTrace(activeDiaryTraceRef.current, "obsolete");
      const trace = startDiaryTrace({
        reason,
        fromDate,
        toDate,
        visit: visitedDiaryDatesRef.current.has(toDate) ? "repeat" : "first",
      });
      activeDiaryTraceRef.current = trace;
      readyDiaryTraceIdRef.current = null;
      return trace;
    },
    [],
  );

  const completeDiaryTraceAfterFrame = useCallback(
    (trace: DiaryPerfTrace, afterUsefulContent?: () => void) => {
      requestAnimationFrame(() => {
        if (
          activeDiaryTraceRef.current?.id !== trace.id ||
          readyDiaryTraceIdRef.current !== trace.id
        ) {
          return;
        }

        markDiaryUseful(trace);
        visitedDiaryDatesRef.current.add(trace.toDate);
        finishDiaryTrace(trace, "success");
        activeDiaryTraceRef.current = null;
        readyDiaryTraceIdRef.current = null;
        afterUsefulContent?.();
      });
    },
    [],
  );

  const loadWeekData = useCallback(
    (
      userExternalId: string,
      startDate: string,
      endDate: string,
      trace: DiaryPerfTrace,
    ) => {
      const key = `${userExternalId}:${startDate}:${endDate}`;
      const existing = weekLoadInFlightRef.current.get(key);
      if (existing) {
        recordDiaryCachePath(trace, "week-load", "in-flight-coalesced");
        return measureDiaryStep(trace, "week-load.coalesced", () => existing);
      }

      const request = Promise.all([
        measureDiaryRequest(trace, "week-entries", "logical", () =>
          DB.getUserFoodLogEntriesBetween(
            userExternalId,
            startDate,
            endDate,
            { perfTrace: trace },
          ),
        ),
        measureDiaryRequest(trace, "week-statuses", "logical", () =>
          DB.listDiaryDayStatusesBetween(
            userExternalId,
            startDate,
            endDate,
            trace,
          ),
        ),
      ]);
      const trackedRequest = request.finally(() => {
        if (weekLoadInFlightRef.current.get(key) === trackedRequest) {
          weekLoadInFlightRef.current.delete(key);
        }
      });
      weekLoadInFlightRef.current.set(key, trackedRequest);
      return trackedRequest;
    },
    [],
  );

  const refreshAdaptiveInBackground = useCallback(
    (userExternalId: string, nextSettings: DBUserSettings | null) => {
      if (!nextSettings?.adaptiveCaloriesEnabled) {
        adaptiveRefreshGenerationRef.current += 1;
        setAdaptiveRecommendation(null);
        return;
      }

      if (adaptiveRefreshInFlightRef.current) {
        return;
      }

      const generation = adaptiveRefreshGenerationRef.current + 1;
      adaptiveRefreshGenerationRef.current = generation;
      const refresh = (async () => {
        try {
          const [lastSeenRecommendationId, refreshResult] = await Promise.all([
            getLastSeenAdaptiveRecommendationId(userExternalId),
            refreshAdaptiveRecommendationForUser({ userExternalId }),
          ]);
          if (adaptiveRefreshGenerationRef.current !== generation) {
            return;
          }
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
          const [lastSeenRecommendationId, latestOpenRecommendation] =
            await Promise.all([
              getLastSeenAdaptiveRecommendationId(userExternalId),
              DB.getLatestAdaptiveCalorieRecommendation(
                userExternalId,
                "proposed",
              ),
            ]);
          if (adaptiveRefreshGenerationRef.current !== generation) {
            return;
          }
          setAdaptiveRecommendation(
            shouldShowAdaptiveRecommendationBanner(
              latestOpenRecommendation,
              lastSeenRecommendationId,
            ),
          );
        }
      })()
        .catch(() => undefined)
        .finally(() => {
          adaptiveRefreshInFlightRef.current = null;
        });

      adaptiveRefreshInFlightRef.current = refresh;
    },
    [],
  );

  React.useEffect(
    () => () => {
      diaryLoadRequestRef.current += 1;
      activeDiaryLoadWeekRef.current = null;
      adaptiveRefreshGenerationRef.current += 1;
      finishDiaryTrace(activeDiaryTraceRef.current, "obsolete");
      activeDiaryTraceRef.current = null;
      readyDiaryTraceIdRef.current = null;
    },
    [],
  );

  const loadData = useCallback(
    async (options?: {
      showBlockingState?: boolean;
      reason?: DiaryPerfReason;
    }) => {
      const showBlockingState = options?.showBlockingState ?? true;
      const requestId = diaryLoadRequestRef.current + 1;
      diaryLoadRequestRef.current = requestId;
      activeDiaryLoadWeekRef.current = weekStart;
      const isCurrentRequest = () => requestId === diaryLoadRequestRef.current;
      const targetDateKey = requestedDateKeyRef.current;
      const existingTrace = activeDiaryTraceRef.current;
      const trace =
        existingTrace &&
        !existingTrace.finished &&
        existingTrace.toDate === targetDateKey
          ? existingTrace
          : beginDiaryTrace(
              options?.reason ??
                (hasLoadedDiaryRef.current
                  ? "post-mutation"
                  : "initial-focus"),
              selectedDateKeyRef.current,
              targetDateKey,
            );

      if (showBlockingState) {
        if (hasLoadedDiaryRef.current) {
          setIsDiaryRefreshing(true);
        } else {
          setIsInitialDiaryLoading(true);
        }
      }
      setDiaryLoadError(null);

      try {
        const currentUser = user;

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
          const latestRequestedDateKey = requestedDateKeyRef.current;
          setSelectedDate(
            parseFoodDateKey(
              weekDateKeys.includes(latestRequestedDateKey)
                ? latestRequestedDateKey
                : targetDateKey,
            ),
          );
          hasLoadedDiaryRef.current = true;
          if (activeDiaryTraceRef.current?.id === trace.id && !trace.finished) {
            readyDiaryTraceIdRef.current = trace.id;
            completeDiaryTraceAfterFrame(trace);
          }
          return;
        }

        const [
          favorites,
          recents,
          nextSettings,
          [loadedWeekEntries, weekDayStatuses],
        ] =
          await Promise.all([
            measureDiaryRequest(trace, "favorites", "logical", () =>
              DB.getFavoriteFoodItems(currentUser.externalId, 10, trace),
            ),
            measureDiaryRequest(trace, "recents", "logical", () =>
              DB.getRecentFoodItems(currentUser.externalId, 12, trace),
            ),
            measureDiaryRequest(trace, "settings", "logical", () =>
              DB.getUserSettings(currentUser.externalId, trace),
            ),
            loadWeekData(
              currentUser.externalId,
              weekStart,
              weekEnd,
              trace,
            ),
          ]);

        if (!isCurrentRequest()) {
          return;
        }

        const weekEntriesByDate = await measureDiaryStep(
          trace,
          "transform.group-week-entries",
          () =>
            weekDateKeys.map((weekDateKey) =>
              loadedWeekEntries.filter((entry) => entry.date === weekDateKey),
            ),
        );

        await measureDiaryStep(trace, "transform-and-state-commit", () => {
          setWeekEntries(loadedWeekEntries);
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
          const latestRequestedDateKey = requestedDateKeyRef.current;
          setSelectedDate(
            parseFoodDateKey(
              weekDateKeys.includes(latestRequestedDateKey)
                ? latestRequestedDateKey
                : targetDateKey,
            ),
          );
        });

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

        await measureDiaryStep(trace, "transform.quick-picks", () => {
          const mappedFavorites = favorites.map(toQuickPick);
          const favoriteIds = new Set(mappedFavorites.map((food) => food.id));

          setFavoriteFoods(mappedFavorites);
          setRecentFoods(
            recents
              .filter((food) => !favoriteIds.has(food.id))
              .map(toQuickPick)
              .slice(0, 8),
          );
        });

        hasLoadedDiaryRef.current = true;
        if (activeDiaryTraceRef.current?.id === trace.id && !trace.finished) {
          readyDiaryTraceIdRef.current = trace.id;
          completeDiaryTraceAfterFrame(
            trace,
            () =>
              refreshAdaptiveInBackground(
                currentUser.externalId,
                nextSettings,
              ),
          );
        } else {
          refreshAdaptiveInBackground(currentUser.externalId, nextSettings);
        }
      } catch {
        if (isCurrentRequest()) {
          setDiaryLoadError("Could not load the diary. Check your connection and try again.");
          finishDiaryTrace(trace, "failed");
          if (activeDiaryTraceRef.current?.id === trace.id) {
            activeDiaryTraceRef.current = null;
            readyDiaryTraceIdRef.current = null;
          }
        }
      } finally {
        if (isCurrentRequest()) {
          activeDiaryLoadWeekRef.current = null;
          setIsInitialDiaryLoading(false);
          setIsDiaryRefreshing(false);
        }
      }
    },
    [
      beginDiaryTrace,
      completeDiaryTraceAfterFrame,
      loadWeekData,
      refreshAdaptiveInBackground,
      user,
      weekDateKeys,
      weekDays,
      weekEnd,
      weekStart,
    ],
  );

  const requestDiaryDate = useCallback(
    (nextDate: Date, reason: "date-select" | "week-change") => {
      const fromDateKey = selectedDateKeyRef.current;
      const nextDateKey = formatFoodDateKey(nextDate);
      if (
        nextDateKey === fromDateKey &&
        nextDateKey === requestedDateKeyRef.current
      ) {
        return;
      }

      const staysInDisplayedWeek =
        getDiaryWeekStartKey(nextDate) ===
        getDiaryWeekStartKey(parseFoodDateKey(fromDateKey));
      if (staysInDisplayedWeek && !hasLoadedDiaryRef.current) {
        setRequestedDate(nextDate);
        setSelectedDate(nextDate);
        return;
      }

      const trace = beginDiaryTrace(reason, fromDateKey, nextDateKey);
      const activeLoadWeek = activeDiaryLoadWeekRef.current;
      if (
        hasLoadedDiaryRef.current &&
        activeLoadWeek != null &&
        activeLoadWeek !== getDiaryWeekStartKey(nextDate)
      ) {
        diaryLoadRequestRef.current += 1;
        activeDiaryLoadWeekRef.current = null;
        setIsDiaryRefreshing(false);
      }
      setRequestedDate(nextDate);

      if (staysInDisplayedWeek && hasLoadedDiaryRef.current) {
        setSelectedDate(nextDate);
        readyDiaryTraceIdRef.current = trace.id;
        completeDiaryTraceAfterFrame(trace);
      }
    },
    [beginDiaryTrace, completeDiaryTraceAfterFrame],
  );

  const rollSelectedTodayForward = useCallback(() => {
    const now = new Date();
    const nextTodayDateKey = formatFoodDateKey(now);
    const previousTodayDateKey = todayDateKeyRef.current;
    todayDateKeyRef.current = nextTodayDateKey;

    if (
      selectedDateKeyRef.current === previousTodayDateKey &&
      nextTodayDateKey !== previousTodayDateKey
    ) {
      requestDiaryDate(now, "date-select");
      setSelectedMeal(getDefaultMealSlotForNow());
      return true;
    }

    return false;
  }, [requestDiaryDate]);

  useFocusEffect(
    useCallback(() => {
      if (!rollSelectedTodayForward()) {
        void loadData({
          showBlockingState: true,
          reason: hasLoadedDiaryRef.current ? "focus" : "initial-focus",
        });
      }
    }, [loadData, rollSelectedTodayForward]),
  );

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      if (!rollSelectedTodayForward()) {
        void loadData({ showBlockingState: false, reason: "resume" });
      }
    });

    return () => subscription.remove();
  }, [loadData, rollSelectedTodayForward]);

  const dismissSnackbar = useCallback(
    (direction: 1 | -1 = 1) => {
      Animated.timing(snackbarTranslateX, {
        toValue: direction * SNACKBAR_OFFSCREEN_DISTANCE,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          snackbarTranslateX.setValue(0);
          setSnackbar(null);
        }
      });
    },
    [snackbarTranslateX],
  );

  const snackbarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_event, gestureState) => {
          snackbarTranslateX.setValue(gestureState.dx);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldDismiss =
            Math.abs(gestureState.dx) > SNACKBAR_DISMISS_DISTANCE ||
            Math.abs(gestureState.vx) > 0.75;

          if (shouldDismiss) {
            dismissSnackbar(gestureState.dx < 0 ? -1 : 1);
            return;
          }

          Animated.spring(snackbarTranslateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(snackbarTranslateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [dismissSnackbar, snackbarTranslateX],
  );

  React.useEffect(() => {
    if (!snackbar) {
      return;
    }

    snackbarTranslateX.setValue(0);
    const timeout = setTimeout(() => dismissSnackbar(), SNACKBAR_AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [dismissSnackbar, snackbar, snackbarTranslateX]);

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
  const isDiaryLoading = isInitialDiaryLoading;
  const isToday = dateKey === formatFoodDateKey(new Date());
  const isSelectedDayComplete = Boolean(dayCompletionByDate[dateKey]);

  const selectDiaryDate = useCallback(
    (nextDate: Date) => {
      requestDiaryDate(nextDate, "date-select");
    },
    [requestDiaryDate],
  );

  const shiftDiaryWeek = useCallback(
    (amount: -7 | 7) => {
      requestDiaryDate(shiftFoodDate(requestedDate, amount), "week-change");
    },
    [requestDiaryDate, requestedDate],
  );

  const retryDiaryLoad = useCallback(() => {
    beginDiaryTrace(
      "retry",
      selectedDateKeyRef.current,
      requestedDateKeyRef.current,
    );
    void loadData({ showBlockingState: true, reason: "retry" });
  }, [beginDiaryTrace, loadData]);

  const handleDiaryProfilerRender = useCallback<React.ProfilerOnRenderCallback>(
    (_id, _phase, actualDuration) => {
      recordDiaryRender(activeDiaryTraceRef.current, actualDuration);
    },
    [],
  );

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

      const quickLogKey = `${food.id}:${slot}:${dateKey}`;
      if (quickLoggingKeysRef.current.has(quickLogKey)) {
        return;
      }
      quickLoggingKeysRef.current.add(quickLogKey);

      try {
        await DB.addUserFoodLog({
          userExternalId: user.externalId,
          foodId: food.id,
          date: dateKey,
          loggedAt: buildMealLoggedAt(slot),
          quantityG: getFoodDefaultLogAmount(food),
          mealType: MEAL_SLOT_LABELS[slot],
        });
        await loadData({ showBlockingState: false });
        setSnackbar({
          message: `${food.name} logged to ${MEAL_SLOT_LABELS[slot]}`,
          actionLabel: "Edit",
          onAction: () => openFavoriteEditorAtMeal(food, slot),
        });
      } catch {
        Alert.alert("Could not log food", "Please review the food and try again.");
      } finally {
        quickLoggingKeysRef.current.delete(quickLogKey);
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
          alcoholG: entry.alcoholG ?? 0,
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

              // Undo must wait for this to settle: restoring while the delete
              // is still in flight (or after it failed) would duplicate the
              // entry, because undo re-adds a new row rather than reviving the
              // old one.
              const deleteSettled = (async () => {
                try {
                  await DB.deleteUserFoodLog(entrySnapshot.id);
                  await loadData({ showBlockingState: false });
                  return true;
                } catch {
                  setSnackbar(null);
                  await loadData({ showBlockingState: false });
                  Alert.alert("Could not delete food", "Please try again.");
                  return false;
                }
              })();

              setSnackbar({
                message: "Food deleted",
                actionLabel: "Undo",
                onAction: () => {
                  setSnackbar(null);
                  void (async () => {
                    const deleted = await deleteSettled;
                    if (!deleted) {
                      // Delete failed, so the entry is still in the diary —
                      // there is nothing to restore.
                      return;
                    }

                    try {
                      await restoreDeletedEntry(entrySnapshot);
                      await loadData({ showBlockingState: false });
                    } catch {
                      Alert.alert(
                        "Undo failed",
                        "Please add the food entry again.",
                      );
                    }
                  })();
                },
              });
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
          alcoholG: entry.alcoholG ?? 0,
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

    setIsRepeatingYesterdayMeal(true);
    setDiaryActionModal({
      action: "repeatMeal",
      mealLabel,
      mealSlot: slot,
      message: `Checking ${sourceDateLabel} ${mealLabel} and today's diary for duplicates.`,
      sourceDate,
      sourceDateLabel,
      stage: "checking",
      targetDate: dateKey,
      targetDateLabel,
      title: "Preparing repeat",
    });

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
        setDiaryActionModal({
          action: "repeatMeal",
          mealLabel,
          mealSlot: slot,
          message: `No ${mealLabel.toLowerCase()} entries were logged on ${sourceDateLabel}.`,
          stage: "empty",
          title: "Nothing to repeat",
        });
        return;
      }

      if (preview.copiedCount === 0) {
        setDiaryActionModal({
          action: "repeatMeal",
          mealLabel,
          mealSlot: slot,
          message: `${targetDateLabel} already has matching ${mealLabel.toLowerCase()} entries. Duplicate protection will keep the diary unchanged.`,
          stage: "already",
          title: "Already repeated",
        });
        return;
      }

      const confirmationMessage =
        preview.destinationCount > 0
          ? `${sourceDateLabel} has ${formatEntryCountLabel(preview.sourceCount)} in ${mealLabel}. ${targetDateLabel} already has ${formatEntryCountLabel(preview.destinationCount)}, so duplicate protection will skip ${formatEntryCountLabel(preview.skippedDuplicates)} and copy ${formatEntryCountLabel(preview.copiedCount)}.`
          : `Repeat ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel} ${mealLabel}.`;

      setDiaryActionModal({
        action: "repeatMeal",
        copiedCount: preview.copiedCount,
        mealLabel,
        mealSlot: slot,
        message: confirmationMessage,
        sourceDate,
        sourceDateLabel,
        stage: "confirm",
        targetDate: dateKey,
        targetDateLabel,
        title: `Repeat ${mealLabel}?`,
      });
    } catch {
      setDiaryActionModal({
        action: "repeatMeal",
        mealLabel,
        mealSlot: slot,
        message: "Could not check yesterday's diary. Check your connection and try again.",
        sourceDate,
        sourceDateLabel,
        stage: "error",
        targetDate: dateKey,
        targetDateLabel,
        title: "Could not prepare repeat",
      });
    } finally {
      setIsRepeatingYesterdayMeal(false);
    }
  }, [
    dateKey,
    isRepeatingYesterdayMeal,
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

    setIsCopyingYesterday(true);
    setDiaryActionModal({
      action: "copyDay",
      message: `Checking ${sourceDateLabel} and today's diary for duplicates.`,
      sourceDate,
      sourceDateLabel,
      stage: "checking",
      targetDate: dateKey,
      targetDateLabel,
      title: "Preparing copy",
    });

    try {
      const [sourceEntries, destinationEntries] = await Promise.all([
        DB.getUserFoodLogEntriesByDate(user.externalId, sourceDate),
        DB.getUserFoodLogEntriesByDate(user.externalId, dateKey),
      ]);
      const preview = getFoodLogCopyPreview(sourceEntries, destinationEntries);

      if (preview.sourceCount === 0) {
        setDiaryActionModal({
          action: "copyDay",
          message: `No food entries were logged on ${sourceDateLabel}.`,
          stage: "empty",
          title: "Nothing to copy",
        });
        return;
      }

      if (preview.copiedCount === 0) {
        setDiaryActionModal({
          action: "copyDay",
          message: `${targetDateLabel} already has matching ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel}. Duplicate protection will keep the diary unchanged.`,
          stage: "already",
          title: "Already copied",
        });
        return;
      }

      const confirmationMessage =
        preview.destinationCount > 0
          ? `${sourceDateLabel} has ${formatEntryCountLabel(preview.sourceCount)}. ${targetDateLabel} already has ${formatEntryCountLabel(preview.destinationCount)}. Duplicate protection will skip ${formatEntryCountLabel(preview.skippedDuplicates)} and copy ${formatEntryCountLabel(preview.copiedCount)}.`
          : `Copy ${formatEntryCountLabel(preview.sourceCount)} from ${sourceDateLabel} into ${targetDateLabel}.`;

      setDiaryActionModal({
        action: "copyDay",
        copiedCount: preview.copiedCount,
        message: confirmationMessage,
        sourceDate,
        sourceDateLabel,
        stage: "confirm",
        targetDate: dateKey,
        targetDateLabel,
        title: "Copy yesterday?",
      });
    } catch {
      setDiaryActionModal({
        action: "copyDay",
        message: "Could not check yesterday's diary. Check your connection and try again.",
        sourceDate,
        sourceDateLabel,
        stage: "error",
        targetDate: dateKey,
        targetDateLabel,
        title: "Could not prepare copy",
      });
    } finally {
      setIsCopyingYesterday(false);
    }
  }, [dateKey, isCopyingYesterday, selectedDate, user]);

  const dismissDiaryActionModal = useCallback(() => {
    setDiaryActionModal((current) => {
      if (current?.stage === "checking" || current?.stage === "copying") {
        return current;
      }

      return null;
    });
  }, []);

  const confirmDiaryAction = useCallback(async () => {
    if (
      !user ||
      !diaryActionModal?.sourceDate ||
      !diaryActionModal.targetDate
    ) {
      return;
    }

    const {
      action,
      copiedCount,
      mealLabel,
      mealSlot,
      sourceDate,
      sourceDateLabel = formatFoodShortDate(parseFoodDateKey(sourceDate)),
      targetDate,
      targetDateLabel = formatFoodShortDate(parseFoodDateKey(targetDate)),
    } = diaryActionModal;

    if (action === "copyDay") {
      setIsCopyingYesterday(true);
      setDiaryActionModal({
        ...diaryActionModal,
        message: `Copying ${formatEntryCountLabel(copiedCount ?? 0)} into ${targetDateLabel}. This can take a moment for larger days.`,
        stage: "copying",
        title: "Copying yesterday",
      });

      try {
        const result = await DB.copyFoodLogsFromDate(
          user.externalId,
          sourceDate,
          targetDate,
        );

        await loadData({ showBlockingState: false });

        if (result.copiedCount === 0) {
          setDiaryActionModal({
            action,
            message: `${targetDateLabel} already had matching entries. Duplicate protection kept the diary unchanged.`,
            sourceDate,
            sourceDateLabel,
            stage: "already",
            targetDate,
            targetDateLabel,
            title: "No new entries copied",
          });
          return;
        }

        setDiaryActionModal({
          action,
          copiedCount: result.copiedCount,
          message:
            result.skippedDuplicates > 0
              ? `Copied ${formatEntryCountLabel(result.copiedCount)} into ${targetDateLabel} and skipped ${formatEntryCountLabel(result.skippedDuplicates)} that were already there.`
              : `Copied ${formatEntryCountLabel(result.copiedCount)} into ${targetDateLabel}.`,
          sourceDate,
          sourceDateLabel,
          stage: "success",
          targetDate,
          targetDateLabel,
          title: "Yesterday copied",
        });
      } catch {
        setDiaryActionModal({
          action,
          copiedCount,
          message: "The copy did not finish. No confirmation was received, so refresh the diary or try again before adding duplicates manually.",
          sourceDate,
          sourceDateLabel,
          stage: "error",
          targetDate,
          targetDateLabel,
          title: "Could not copy yesterday",
        });
      } finally {
        setIsCopyingYesterday(false);
      }
      return;
    }

    if (!mealSlot || !mealLabel) {
      return;
    }

    setIsRepeatingYesterdayMeal(true);
    setDiaryActionModal({
      ...diaryActionModal,
      message: `Repeating ${formatEntryCountLabel(copiedCount ?? 0)} into ${mealLabel}.`,
      stage: "copying",
      title: `Repeating ${mealLabel}`,
    });

    try {
      const [sourceEntries, destinationEntries] = await Promise.all([
        DB.getUserFoodLogEntriesByDate(user.externalId, sourceDate),
        DB.getUserFoodLogEntriesByDate(user.externalId, targetDate),
      ]);
      const sourceMealEntries = sourceEntries.filter(
        (entry) => resolveEntryMealSlot(entry) === mealSlot,
      );
      const destinationMealEntries = destinationEntries.filter(
        (entry) => resolveEntryMealSlot(entry) === mealSlot,
      );
      const entriesToCopy = getFoodLogEntriesToCopy(
        sourceMealEntries,
        destinationMealEntries,
      );

      for (const entry of entriesToCopy) {
        await copyEntryToDate(entry, mealSlot);
      }

      await loadData({ showBlockingState: false });

      if (entriesToCopy.length === 0) {
        setDiaryActionModal({
          action,
          mealLabel,
          mealSlot,
          message: `${targetDateLabel} already had matching ${mealLabel.toLowerCase()} entries. Duplicate protection kept the diary unchanged.`,
          sourceDate,
          sourceDateLabel,
          stage: "already",
          targetDate,
          targetDateLabel,
          title: "No new entries repeated",
        });
        return;
      }

      setDiaryActionModal({
        action,
        copiedCount: entriesToCopy.length,
        mealLabel,
        mealSlot,
        message: `Repeated ${formatEntryCountLabel(entriesToCopy.length)} in ${mealLabel}.`,
        sourceDate,
        sourceDateLabel,
        stage: "success",
        targetDate,
        targetDateLabel,
        title: `${mealLabel} repeated`,
      });
    } catch {
      setDiaryActionModal({
        action,
        copiedCount,
        mealLabel,
        mealSlot,
        message: "The repeat did not finish. No confirmation was received, so refresh the diary or try again before adding duplicates manually.",
        sourceDate,
        sourceDateLabel,
        stage: "error",
        targetDate,
        targetDateLabel,
        title: "Could not repeat this meal",
      });
    } finally {
      setIsRepeatingYesterdayMeal(false);
    }
  }, [copyEntryToDate, diaryActionModal, loadData, user]);

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
      await loadData({ showBlockingState: false });
    } catch {
      Alert.alert(
        "Could not update completion",
        "Please try marking the day complete again.",
      );
    } finally {
      setIsDayCompleteLoading(false);
    }
  }, [dateKey, isDayCompleteLoading, isSelectedDayComplete, loadData, user]);

  const isDiaryActionModalBusy =
    diaryActionModal?.stage === "checking" ||
    diaryActionModal?.stage === "copying";
  const diaryActionConfirmLabel =
    diaryActionModal?.action === "repeatMeal"
      ? `Repeat ${diaryActionModal.copiedCount ?? ""}`.trim()
      : `Copy ${diaryActionModal?.copiedCount ?? ""}`.trim();

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

        <React.Profiler
          id="FoodDiaryMainStrip"
          onRender={handleDiaryProfilerRender}
        >
          <FoodDiaryMainStrip
            days={mainStripDays}
            selectedDate={selectedDate}
            selectedTargetCalories={selectedTargetCalories}
            targetCaloriesByDate={targetCaloriesByDate}
            weeklyBudgetCalories={weeklyBudgetCalories}
            weeklyConsumedCalories={weeklyConsumedCalories}
            onNextWeek={() => shiftDiaryWeek(7)}
            onPreviousWeek={() => shiftDiaryWeek(-7)}
            onSelectDate={selectDiaryDate}
            totals={totals}
            user={user}
            mealBuckets={mealBuckets}
            selectedMeal={selectedMeal}
            favoriteFoods={favoriteFoods}
            recentFoods={recentFoods}
            isLoading={isDiaryLoading}
            isRefreshing={isDiaryRefreshing}
            hasLoadedData={hasLoadedDiaryRef.current}
            loadError={diaryLoadError}
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
            onRetryLoad={retryDiaryLoad}
            onSelectMeal={setSelectedMeal}
            onToggleDayComplete={() => {
              void toggleDayComplete();
            }}
          />
        </React.Profiler>

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
        />
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={dismissDiaryActionModal}
        transparent
        visible={diaryActionModal != null}
      >
        <View style={styles.actionModalBackdrop}>
          <View style={styles.actionModalCard}>
            {isDiaryActionModalBusy ? (
              <ActivityIndicator
                color={appColors.actionPrimary}
                size="small"
              />
            ) : null}
            <Text style={styles.actionModalTitle}>
              {diaryActionModal?.title}
            </Text>
            <Text style={styles.actionModalMessage}>
              {diaryActionModal?.message}
            </Text>

            {diaryActionModal?.stage === "confirm" ? (
              <View style={styles.actionModalActions}>
                <Pressable
                  onPress={dismissDiaryActionModal}
                  style={({ pressed }) => [
                    styles.actionModalSecondaryButton,
                    pressed && styles.actionModalButtonPressed,
                  ]}
                >
                  <Text style={styles.actionModalSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void confirmDiaryAction();
                  }}
                  style={({ pressed }) => [
                    styles.actionModalPrimaryButton,
                    pressed && styles.actionModalButtonPressed,
                  ]}
                >
                  <Text style={styles.actionModalPrimaryText}>
                    {diaryActionConfirmLabel}
                  </Text>
                </Pressable>
              </View>
            ) : diaryActionModal?.stage === "error" ? (
              <View style={styles.actionModalActions}>
                <Pressable
                  onPress={dismissDiaryActionModal}
                  style={({ pressed }) => [
                    styles.actionModalSecondaryButton,
                    pressed && styles.actionModalButtonPressed,
                  ]}
                >
                  <Text style={styles.actionModalSecondaryText}>Close</Text>
                </Pressable>
                {diaryActionModal.sourceDate &&
                diaryActionModal.targetDate ? (
                  <Pressable
                    onPress={() => {
                      if (diaryActionModal.copiedCount != null) {
                        void confirmDiaryAction();
                      } else if (diaryActionModal.action === "repeatMeal") {
                        void repeatYesterdayMeal();
                      } else {
                        void copyYesterday();
                      }
                    }}
                    style={({ pressed }) => [
                      styles.actionModalPrimaryButton,
                      pressed && styles.actionModalButtonPressed,
                    ]}
                  >
                    <Text style={styles.actionModalPrimaryText}>Try again</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : diaryActionModal && !isDiaryActionModalBusy ? (
              <View style={styles.actionModalActions}>
                <Pressable
                  onPress={dismissDiaryActionModal}
                  style={({ pressed }) => [
                    styles.actionModalPrimaryButton,
                    pressed && styles.actionModalButtonPressed,
                  ]}
                >
                  <Text style={styles.actionModalPrimaryText}>Done</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {snackbar ? (
        <Animated.View
          {...snackbarPanResponder.panHandlers}
          style={[
            styles.snackbar,
            {
              bottom: SNACKBAR_BOTTOM_GAP,
              opacity: snackbarTranslateX.interpolate({
                inputRange: [
                  -SNACKBAR_DISMISS_DISTANCE,
                  0,
                  SNACKBAR_DISMISS_DISTANCE,
                ],
                outputRange: [0.6, 1, 0.6],
                extrapolate: "clamp",
              }),
              transform: [{ translateX: snackbarTranslateX }],
            },
          ]}
        >
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
        </Animated.View>
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
    paddingHorizontal: 16,
  },
  actionModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceOverlay,
    paddingHorizontal: 22,
  },
  actionModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  actionModalTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "500",
  },
  actionModalMessage: {
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actionModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  actionModalPrimaryButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: appColors.actionPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionModalSecondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionModalPrimaryText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "500",
  },
  actionModalSecondaryText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  actionModalButtonPressed: {
    opacity: appStates.pressedOpacity,
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 10,
    backgroundColor: appColors.slate900,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  snackbarActionPressed: {
    opacity: 0.88,
  },
  snackbarActionText: {
    color: appColors.slate900,
    fontSize: 12,
    fontWeight: "600",
  },
});

export default FoodDiaryScreen;
