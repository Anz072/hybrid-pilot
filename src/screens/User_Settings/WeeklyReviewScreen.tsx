import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CalendarCheckIcon, LightningIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getEffectiveCalorieTargetForDate } from "../../engine/calorieTargets";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import type {
  DBAdaptiveCalorieRecommendation,
  DBDiaryDayStatus,
  DBUserFoodLogEntry,
  DBUserSettings,
  DBWeightEntry,
} from "../../store/DB_TYPES";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  calculateLoggedNutrition,
  formatFoodDateKey,
  formatFoodNumber,
  formatFoodShortDate,
} from "../Food/foodUtils";
import { formatWeightKg } from "../Weight/weightUtils";
import SettingsStackHeader from "./SettingsStackHeader";
import {
  applyAdaptiveRecommendationForUser,
  rejectAdaptiveRecommendationForUser,
} from "./adaptiveCaloriesActions";

type Props = NativeStackScreenProps<MoreParamList, "WeeklyReviewScreen">;

type DayReview = {
  date: Date;
  dateKey: string;
  calories: number;
  entryCount: number;
  isComplete: boolean;
  target: number | null;
};

type RepeatedFood = {
  key: string;
  name: string;
  count: number;
  calories: number;
};

type WeeklyReviewState = {
  adaptiveRecommendation: DBAdaptiveCalorieRecommendation | null;
  dayReviews: DayReview[];
  entries: DBUserFoodLogEntry[];
  proposedRecommendation: DBAdaptiveCalorieRecommendation | null;
  settings: DBUserSettings | null;
  repeatedFoods: RepeatedFood[];
  reviewDates: Date[];
  weekDates: Date[];
  weightEntries: DBWeightEntry[];
};

const EMPTY_REVIEW: WeeklyReviewState = {
  adaptiveRecommendation: null,
  dayReviews: [],
  entries: [],
  proposedRecommendation: null,
  settings: null,
  repeatedFoods: [],
  reviewDates: [],
  weekDates: [],
  weightEntries: [],
};

const buildCurrentWeekDates = (reference: Date): Date[] => {
  const weekStart = new Date(reference);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return next;
  });
};

const isSameOrBeforeDay = (left: Date, right: Date): boolean => {
  const leftKey = formatFoodDateKey(left);
  const rightKey = formatFoodDateKey(right);
  return leftKey <= rightKey;
};

const formatDateRange = (dates: Date[]) => {
  const first = dates[0];
  const last = dates[dates.length - 1];

  if (!first || !last) {
    return "This week";
  }

  return `${formatFoodShortDate(first)} - ${formatFoodShortDate(last)}`;
};

const formatSignedCalories = (value: number): string => {
  const rounded = Math.round(value);
  const formatted = Math.abs(rounded).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  if (rounded > 0) {
    return `+${formatted} kcal`;
  }

  if (rounded < 0) {
    return `-${formatted} kcal`;
  }

  return "0 kcal";
};

const formatSignedWeightDelta = (value: number): string =>
  `${value > 0 ? "+" : ""}${formatWeightKg(value)} kg`;

const formatRecommendationStatus = (
  status: DBAdaptiveCalorieRecommendation["status"],
) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const getEntryDisplayName = (entry: DBUserFoodLogEntry): string => {
  if (entry.entrySource === "quick_add") {
    return entry.quickAddName?.trim() || "Quick add";
  }

  return entry.foodName.trim() || "Saved food";
};

const getRepeatedFoodKey = (entry: DBUserFoodLogEntry): string => {
  if (entry.foodId != null) {
    return `${entry.entrySource}:${entry.foodId}`;
  }

  return `quick:${getEntryDisplayName(entry).toLowerCase()}`;
};

const buildRepeatedFoods = (entries: DBUserFoodLogEntry[]): RepeatedFood[] => {
  const rows = new Map<string, RepeatedFood>();

  for (const entry of entries) {
    const key = getRepeatedFoodKey(entry);
    const existing = rows.get(key);
    const calories = calculateLoggedNutrition(entry).calories;

    if (existing) {
      existing.count += 1;
      existing.calories += calories;
      continue;
    }

    rows.set(key, {
      key,
      name: getEntryDisplayName(entry),
      count: 1,
      calories,
    });
  }

  return [...rows.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (right.calories !== left.calories) {
        return right.calories - left.calories;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);
};

const buildDayReviews = ({
  diaryStatuses,
  entries,
  settings,
  userBaseCalories,
  weekDates,
}: {
  diaryStatuses: DBDiaryDayStatus[];
  entries: DBUserFoodLogEntry[];
  settings: DBUserSettings | null;
  userBaseCalories: number | null | undefined;
  weekDates: Date[];
}): DayReview[] => {
  const entriesByDate = new Map<string, DBUserFoodLogEntry[]>();
  const statusByDate = new Map(
    diaryStatuses.map((status) => [status.date, status]),
  );

  for (const entry of entries) {
    const current = entriesByDate.get(entry.date) ?? [];
    current.push(entry);
    entriesByDate.set(entry.date, current);
  }

  return weekDates.map((date) => {
    const dateKey = formatFoodDateKey(date);
    const dateEntries = entriesByDate.get(dateKey) ?? [];
    const calories = dateEntries.reduce(
      (sum, entry) => sum + calculateLoggedNutrition(entry).calories,
      0,
    );

    return {
      date,
      dateKey,
      calories,
      entryCount: dateEntries.length,
      isComplete: statusByDate.get(dateKey)?.isComplete ?? false,
      target: getEffectiveCalorieTargetForDate({
        date,
        baseCalories: userBaseCalories,
        settings,
      }),
    };
  });
};

const getAverage = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getWeightTrend = (entries: DBWeightEntry[]) => {
  const sorted = [...entries].sort(
    (left, right) =>
      new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime(),
  );
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  if (!first || !last || first.id === last.id) {
    return {
      delta: null,
      first,
      last,
    };
  }

  return {
    delta: last.valueKg - first.valueKg,
    first,
    last,
  };
};

const clampRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
};

const WeeklyReviewScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [review, setReview] = React.useState<WeeklyReviewState>(EMPTY_REVIEW);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionBusy, setActionBusy] = React.useState<"accept" | "dismiss" | null>(
    null,
  );
  const [nextActionNote, setNextActionNote] = React.useState<string | null>(null);

  const loadReview = React.useCallback(
    async (options?: {
      refreshing?: boolean;
      userBaseCaloriesOverride?: number | null;
    }) => {
      if (!user) {
        setReview(EMPTY_REVIEW);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const weekDates = buildCurrentWeekDates(new Date());
      const reviewDates = weekDates.filter((date) =>
        isSameOrBeforeDay(date, new Date()),
      );
      const startDate = formatFoodDateKey(weekDates[0]);
      const endDate = formatFoodDateKey(weekDates[weekDates.length - 1]);

      if (options?.refreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const [
          settings,
          entries,
          diaryStatuses,
          weightEntries,
          proposedRecommendation,
          latestRecommendation,
        ] = await Promise.all([
          DB.getUserSettings(user.externalId),
          DB.getUserFoodLogEntriesBetween(user.externalId, startDate, endDate),
          DB.listDiaryDayStatusesBetween(user.externalId, startDate, endDate),
          DB.listWeightEntriesBetween(user.externalId, startDate, endDate),
          DB.getLatestAdaptiveCalorieRecommendation(user.externalId, "proposed"),
          DB.getLatestAdaptiveCalorieRecommendation(user.externalId),
        ]);

        const dayReviews = buildDayReviews({
          diaryStatuses,
          entries,
          settings,
          userBaseCalories:
            options?.userBaseCaloriesOverride ?? user.calorieAllowance,
          weekDates,
        });
        setReview({
          adaptiveRecommendation: proposedRecommendation ?? latestRecommendation,
          dayReviews,
          entries,
          proposedRecommendation,
          repeatedFoods: buildRepeatedFoods(entries),
          reviewDates,
          settings,
          weekDates,
          weightEntries,
        });
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your weekly review.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadReview();
    }, [loadReview]),
  );

  React.useEffect(() => {
    setNextActionNote(null);
  }, [review.proposedRecommendation?.id]);

  const elapsedDayReviews = React.useMemo(() => {
    const elapsedKeys = new Set(
      review.reviewDates.map((date) => formatFoodDateKey(date)),
    );
    return review.dayReviews.filter((day) => elapsedKeys.has(day.dateKey));
  }, [review.dayReviews, review.reviewDates]);
  const totalCalories = React.useMemo(
    () =>
      elapsedDayReviews.reduce((sum, day) => sum + day.calories, 0),
    [elapsedDayReviews],
  );
  const averageCalories = getAverage(
    elapsedDayReviews.map((day) => day.calories),
  );
  const averageTarget = getAverage(
    elapsedDayReviews
      .map((day) => day.target)
      .filter((target): target is number => target != null && target > 0),
  );
  const calorieDelta =
    averageCalories != null && averageTarget != null
      ? averageCalories - averageTarget
      : null;
  const completedDays = review.dayReviews.filter((day) => day.isComplete).length;
  const completionRatio = review.dayReviews.length > 0
    ? completedDays / review.dayReviews.length
    : 0;
  const weightTrend = React.useMemo(
    () => getWeightTrend(review.weightEntries),
    [review.weightEntries],
  );
  const weightTrendLabel =
    weightTrend.delta != null
      ? formatSignedWeightDelta(weightTrend.delta)
      : weightTrend.last
        ? `${formatWeightKg(weightTrend.last.valueKg)} kg`
        : "--";
  const completionQualityLabel = `${completedDays}/${review.dayReviews.length || 7} complete`;
  const adaptiveStatus = !review.settings?.adaptiveCaloriesEnabled
    ? "Off"
    : review.proposedRecommendation
      ? "Review ready"
      : review.adaptiveRecommendation
        ? formatRecommendationStatus(review.adaptiveRecommendation.status)
        : "On, no proposal";
  const adaptiveDetail = !review.settings?.adaptiveCaloriesEnabled
    ? "Turn on adaptive calories to compare completed diary days with weight trend."
    : review.proposedRecommendation
      ? review.proposedRecommendation.currentBaseCalories != null
        ? `${formatFoodNumber(
            review.proposedRecommendation.currentBaseCalories,
            " kcal",
          )} -> ${formatFoodNumber(
            review.proposedRecommendation.recommendedBaseCalories,
            " kcal",
          )}`
        : `Suggested ${formatFoodNumber(
            review.proposedRecommendation.recommendedBaseCalories,
            " kcal",
          )}`
      : review.adaptiveRecommendation
        ? `Latest ${formatRecommendationStatus(
            review.adaptiveRecommendation.status,
          ).toLowerCase()} on ${new Date(
            review.adaptiveRecommendation.createdAt,
          ).toLocaleDateString()}`
        : "No saved adaptive recommendation yet.";
  const hasOpenProposal = review.proposedRecommendation != null;
  const nextActionTitle = !review.settings?.adaptiveCaloriesEnabled
    ? "Turn on adaptive calories"
    : hasOpenProposal
      ? "Review this calorie proposal"
      : completedDays < 4
        ? "Complete more diary days"
        : "Keep collecting this week's signal";
  const nextActionText = !review.settings?.adaptiveCaloriesEnabled
    ? "You're already tracking intake, weight, and diary completion here. Turn adaptive calories on when you want a weekly recommendation to act on."
    : hasOpenProposal
      ? `Calories vs target are ${calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"}, weight trend is ${weightTrendLabel}, and completion quality is ${completionQualityLabel}. This proposal suggests ${formatFoodNumber(review.proposedRecommendation?.recommendedBaseCalories ?? 0, " kcal")}.`
      : completedDays < 4
        ? `Completion quality is ${completionQualityLabel}. Finish logging and mark full days complete so the next adaptive recommendation has a stronger signal.`
        : `Calories vs target are ${calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"} and weight trend is ${weightTrendLabel}. Keep logging and weigh in again if you want the next recommendation to be stronger.`;

  const openAdaptiveSettings = React.useCallback(() => {
    navigation.navigate("AdaptiveCaloriesSettingsScreen");
  }, [navigation]);

  const handleApplyRecommendation = React.useCallback(async () => {
    if (!user || !review.proposedRecommendation) {
      return;
    }

    setActionBusy("accept");

    try {
      const savedUser = await applyAdaptiveRecommendationForUser({
        dispatch,
        recommendation: review.proposedRecommendation,
        user,
        settings: review.settings,
      });
      setNextActionNote(null);
      await loadReview({
        userBaseCaloriesOverride: savedUser.calorieAllowance ?? null,
      });
    } catch {
      Alert.alert("Could not apply recommendation", "Please try again.");
    } finally {
      setActionBusy(null);
    }
  }, [dispatch, loadReview, review.proposedRecommendation, review.settings, user]);

  const handleDismissRecommendation = React.useCallback(async () => {
    if (!review.proposedRecommendation) {
      return;
    }

    setActionBusy("dismiss");

    try {
      await rejectAdaptiveRecommendationForUser({
        recommendation: review.proposedRecommendation,
      });
      setNextActionNote(null);
      await loadReview();
    } catch {
      Alert.alert("Could not dismiss recommendation", "Please try again.");
    } finally {
      setActionBusy(null);
    }
  }, [loadReview, review.proposedRecommendation]);

  const handlePostponeRecommendation = React.useCallback(() => {
    setNextActionNote(
      "This proposal will stay open so you can come back to it later.",
    );
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadReview({ refreshing: true })}
            tintColor={appColors.brand500}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <SettingsStackHeader
          eyebrow="Insights"
          onBack={() => navigation.goBack()}
          subtitle="A compact readout of the week: intake, completion, weight movement, adaptive calories, and the foods showing up most often."
          title="Weekly Review"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to review your weekly food and weight signals.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={appColors.brand700} />
            <Text style={styles.cardText}>Building your weekly review...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Could not load review</Text>
            <Text style={styles.cardText}>{loadError}</Text>
            <Pressable
              onPress={() => void loadReview()}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.nextActionCard}>
              <View style={styles.rowBetween}>
                <View style={styles.copyColumn}>
                  <Text style={styles.eyebrow}>Next action</Text>
                  <Text style={styles.nextActionTitle}>{nextActionTitle}</Text>
                  <Text style={styles.cardText}>{nextActionText}</Text>
                </View>
                <View style={styles.nextActionIcon}>
                  <LightningIcon
                    size={24}
                    color={
                      hasOpenProposal ? appColors.warning300 : appColors.brand300
                    }
                    weight="fill"
                  />
                </View>
              </View>

              <View style={styles.nextActionStats}>
                <View style={styles.nextActionStat}>
                  <Text style={styles.metricLabel}>Calories vs target</Text>
                  <Text style={styles.nextActionStatValue}>
                    {calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"}
                  </Text>
                </View>
                <View style={styles.nextActionStat}>
                  <Text style={styles.metricLabel}>Weight trend</Text>
                  <Text style={styles.nextActionStatValue}>{weightTrendLabel}</Text>
                </View>
                <View style={styles.nextActionStat}>
                  <Text style={styles.metricLabel}>Completion quality</Text>
                  <Text style={styles.nextActionStatValue}>
                    {completionQualityLabel}
                  </Text>
                </View>
              </View>

              {hasOpenProposal ? (
                <>
                  <Pressable
                    onPress={() => void handleApplyRecommendation()}
                    disabled={actionBusy != null}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      actionBusy != null && styles.buttonDisabled,
                      pressed && actionBusy == null && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {actionBusy === "accept"
                        ? "Applying update..."
                        : "Accept update"}
                    </Text>
                  </Pressable>

                  <View style={styles.nextActionButtonRow}>
                    <Pressable
                      onPress={handlePostponeRecommendation}
                      disabled={actionBusy != null}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.nextActionButton,
                        actionBusy != null && styles.buttonDisabled,
                        pressed && actionBusy == null && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Postpone</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleDismissRecommendation()}
                      disabled={actionBusy != null}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.nextActionButton,
                        styles.dismissButton,
                        actionBusy != null && styles.buttonDisabled,
                        pressed && actionBusy == null && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[styles.secondaryButtonText, styles.dismissButtonText]}
                      >
                        {actionBusy === "dismiss"
                          ? "Dismissing..."
                          : "Dismiss"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={openAdaptiveSettings}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    Open adaptive calories
                  </Text>
                </Pressable>
              )}

              {nextActionNote ? (
                <Text style={styles.nextActionNote}>{nextActionNote}</Text>
              ) : null}
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.copyColumn}>
                  <Text style={styles.eyebrow}>This week</Text>
                  <Text style={styles.heroTitle}>
                    {formatDateRange(review.weekDates)}
                  </Text>
                </View>
                <View style={styles.heroIcon}>
                  <CalendarCheckIcon
                    size={24}
                    color={appColors.brand300}
                    weight="fill"
                  />
                </View>
              </View>

              <Text style={styles.heroSummary}>
                {averageCalories != null
                  ? `${formatFoodNumber(
                      averageCalories,
                      " kcal",
                    )} average intake`
                  : "No logged intake yet"}
                {averageTarget != null
                  ? ` vs ${formatFoodNumber(averageTarget, " kcal")} target`
                  : ""}
                {calorieDelta != null
                  ? ` (${formatSignedCalories(calorieDelta)})`
                  : ""}
              </Text>

              <View style={styles.heroMetrics}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Completion quality</Text>
                  <Text style={styles.metricValue}>
                    {completedDays}/{review.dayReviews.length || 7}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Logged so far</Text>
                  <Text style={styles.metricValue}>
                    {formatFoodNumber(totalCalories, " kcal")}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Entries</Text>
                  <Text style={styles.metricValue}>{review.entries.length}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${clampRatio(completionRatio) * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.insightCard}>
                <Text style={styles.metricLabel}>Calories vs target</Text>
                <Text style={styles.bigValue}>
                  {calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"}
                </Text>
                <Text style={styles.cardText}>
                  Average difference across elapsed days this week.
                </Text>
              </View>

              <View style={styles.insightCard}>
                <Text style={styles.metricLabel}>Weight trend</Text>
                <View style={styles.iconValueRow}>
                  <TrendUpIcon size={18} color={appColors.brand300} weight="bold" />
                  <Text style={styles.bigValue}>
                    {weightTrend.delta != null
                      ? formatSignedWeightDelta(weightTrend.delta)
                      : weightTrend.last
                        ? `${formatWeightKg(weightTrend.last.valueKg)} kg`
                        : "--"}
                  </Text>
                </View>
                <Text style={styles.cardText}>
                  {weightTrend.delta != null
                    ? `From ${formatWeightKg(
                        weightTrend.first?.valueKg ?? 0,
                      )} kg to ${formatWeightKg(weightTrend.last?.valueKg ?? 0)} kg.`
                    : weightTrend.last
                      ? "Only one weigh-in this week, so no delta yet."
                      : "No weigh-ins logged this week."}
                </Text>
              </View>

              <View style={styles.insightCardFull}>
                <View style={styles.rowBetween}>
                  <View style={styles.copyColumn}>
                    <Text style={styles.metricLabel}>Adaptive recommendation</Text>
                    <Text style={styles.bigValue}>{adaptiveStatus}</Text>
                    <Text style={styles.cardText}>{adaptiveDetail}</Text>
                  </View>
                  <LightningIcon
                    size={24}
                    color={
                      review.proposedRecommendation
                        ? appColors.warning300
                        : appColors.brand300
                    }
                    weight="fill"
                  />
                </View>
                <Pressable
                  onPress={() => navigation.navigate("AdaptiveCaloriesSettingsScreen")}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    Open adaptive calories
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Diary days</Text>
              <Text style={styles.cardText}>
                Completion comes from days you explicitly marked complete in the Food Diary.
              </Text>
              <View style={styles.dayStack}>
                {review.dayReviews.map((day) => {
                  const ratio =
                    day.target != null && day.target > 0
                      ? clampRatio(day.calories / day.target)
                      : 0;

                  return (
                    <View key={day.dateKey} style={styles.dayRow}>
                      <View style={styles.dayDate}>
                        <Text style={styles.dayName}>
                          {day.date.toLocaleDateString(undefined, {
                            weekday: "short",
                          })}
                        </Text>
                        <Text style={styles.dayNumber}>
                          {day.date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                      <View style={styles.dayBody}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.dayCalories}>
                            {formatFoodNumber(day.calories, " kcal")}
                          </Text>
                          <Text
                            style={[
                              styles.completionPill,
                              day.isComplete && styles.completionPillDone,
                            ]}
                          >
                            {day.isComplete ? "Complete" : "Open"}
                          </Text>
                        </View>
                        <Text style={styles.dayMeta}>
                          {day.target != null
                            ? `${formatFoodNumber(day.target, " kcal")} target`
                            : "No target set"}{" "}
                          | {day.entryCount} entries
                        </Text>
                        <View style={styles.smallProgressTrack}>
                          <View
                            style={[
                              styles.smallProgressFill,
                              { width: `${ratio * 100}%` },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Most repeated foods</Text>
              <Text style={styles.cardText}>
                Foods are ranked by how many times they appeared in this week's diary.
              </Text>

              {review.repeatedFoods.length === 0 ? (
                <Text style={styles.emptyText}>
                  No foods logged this week yet.
                </Text>
              ) : (
                <View style={styles.foodStack}>
                  {review.repeatedFoods.map((food, index) => (
                    <View key={food.key} style={styles.foodRow}>
                      <View style={styles.rankPill}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.foodCopy}>
                        <Text style={styles.foodName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={styles.foodMeta}>
                          {food.count}x | {formatFoodNumber(food.calories, " kcal")} total
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -82,
    right: -58,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    left: -82,
    bottom: -96,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand800,
  },
  nextActionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: appColors.brand500,
    marginBottom: 14,
  },
  nextActionTitle: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
  },
  nextActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand800,
  },
  nextActionStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  nextActionStat: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 12,
  },
  nextActionStatValue: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  nextActionButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  nextActionButton: {
    flex: 1,
    marginTop: 0,
  },
  nextActionNote: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    marginTop: 12,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.label,
    color: appColors.textSecondary,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 12,
  },
  heroTitle: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
  },
  heroSummary: {
    ...appTypography.bodyStrong,
    color: appColors.textPrimary,
    marginTop: 18,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 12,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  metricLabel: {
    ...appTypography.label,
    color: appColors.textMuted,
    marginBottom: 8,
  },
  metricValue: {
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  bigValue: {
    color: appColors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.24,
  },
  insightCard: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  insightCardFull: {
    width: "100%",
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 14,
  },
  loadingCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    ...appTypography.title,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  cardText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    marginTop: 6,
  },
  copyColumn: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iconValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    overflow: "hidden",
    marginTop: 18,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: appColors.success600,
  },
  dayStack: {
    gap: 12,
    marginTop: 14,
  },
  dayRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField
  },
  dayDate: {
    width: 58,
  },
  dayName: {
    ...appTypography.label,
    color: appColors.brand300,
  },
  dayNumber: {
    color: appColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  dayBody: {
    flex: 1,
  },
  dayCalories: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  dayMeta: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  completionPill: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: appColors.textMuted,
    backgroundColor: appColors.surfaceGhost,
    fontSize: 11,
    fontWeight: "800",
  },
  completionPillDone: {
    color: appColors.white,
    backgroundColor: appColors.success700,
  },
  smallProgressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    overflow: "hidden",
    marginTop: 10,
  },
  smallProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: appColors.brand500,
  },
  foodStack: {
    gap: 10,
    marginTop: 14,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField
  },
  rankPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand800,
  },
  rankText: {
    color: appColors.brand300,
    fontSize: 12,
    fontWeight: "800",
  },
  foodCopy: {
    flex: 1,
  },
  foodName: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  foodMeta: {
    color: appColors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  emptyText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand700,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  dismissButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  dismissButtonText: {
    color: appColors.danger700,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.9,
  },
});

export default WeeklyReviewScreen;
