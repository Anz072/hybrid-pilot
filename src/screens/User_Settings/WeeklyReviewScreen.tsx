import React from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import {
  calculateLoggedNutrition,
  sumLoggedNutrition,
  formatFoodDateKey,
  formatFoodNumber,
  formatFoodShortDate,
} from "../Food/foodUtils";
import {
  formatWeight,
  formatWeightValue,
  weightUnitLabel,
  type WeightUnit,
} from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import {
  applyAdaptiveRecommendationForUser,
  rejectAdaptiveRecommendationForUser,
} from "./adaptiveCaloriesActions";
import {
  AppButton,
  AppCard,
  AppText,
  ErrorState,
  LoadingState,
  NumericText,
  ScreenHeader,
} from "../../components/ui";
import { appRadius, appSpacing, appSurfaces } from "../../theme/tokens";

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

const formatSignedWeightDelta = (value: number, unit: WeightUnit): string =>
  `${value > 0 ? "+" : ""}${formatWeightValue(value, unit)} ${weightUnitLabel(unit)}`;

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
    const calories = sumLoggedNutrition(dateEntries).calories;

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
  const { weightUnit } = useDisplayPreferences();
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
      ? formatSignedWeightDelta(weightTrend.delta, weightUnit)
      : weightTrend.last
        ? formatWeight(weightTrend.last.valueKg, weightUnit)
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
        <ScreenHeader
          eyebrow="Check-in"
          onBack={() => navigation.goBack()}
          subtitle="Your weekly check-in: intake vs target, weight movement, completion quality, and the adaptive calorie decision — all in one place."
          title="Weekly check-in"
        />

        {!user ? (
          <AppCard style={styles.card}>
            <AppText style={styles.cardTitle} variant="cardTitle">No active user</AppText>
            <AppText color="secondary" style={styles.cardText} variant="bodySmall">
              Sign in to review your weekly food and weight signals.
            </AppText>
          </AppCard>
        ) : loading ? (
          <LoadingState
            message="Building your weekly review..."
            style={styles.loadingCard}
            title="Loading check-in"
          />
        ) : loadError ? (
          <ErrorState
            message={loadError}
            style={styles.card}
            title="Could not load review"
            action={
              <AppButton
                label="Try again"
                size="sm"
                variant="secondary"
                onPress={() => void loadReview()}
              />
            }
          />
        ) : (
          <>
            <AppCard style={styles.nextActionCard}>
              <View style={styles.rowBetween}>
                <View style={styles.copyColumn}>
                  <AppText color="secondary" style={styles.eyebrow} variant="eyebrow">
                    Next action
                  </AppText>
                  <AppText style={styles.nextActionTitle} variant="sectionTitleLarge">
                    {nextActionTitle}
                  </AppText>
                  <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                    {nextActionText}
                  </AppText>
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
                <AppCard variant="compact" style={styles.nextActionStat}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Calories vs target
                  </AppText>
                  <NumericText style={styles.nextActionStatValue} variant="numberTrendDelta">
                    {calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"}
                  </NumericText>
                </AppCard>
                <AppCard variant="compact" style={styles.nextActionStat}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Weight trend
                  </AppText>
                  <NumericText style={styles.nextActionStatValue} variant="numberTrendDelta">
                    {weightTrendLabel}
                  </NumericText>
                </AppCard>
                <AppCard variant="compact" style={styles.nextActionStat}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Completion quality
                  </AppText>
                  <NumericText style={styles.nextActionStatValue} variant="numberTrendDelta">
                    {completionQualityLabel}
                  </NumericText>
                </AppCard>
              </View>

              {hasOpenProposal ? (
                <>
                  <AppButton
                    onPress={() => void handleApplyRecommendation()}
                    disabled={actionBusy != null}
                    label={actionBusy === "accept" ? "Applying update..." : "Accept update"}
                    style={styles.nextActionPrimaryButton}
                  />

                  <View style={styles.nextActionButtonRow}>
                    <AppButton
                      onPress={handlePostponeRecommendation}
                      disabled={actionBusy != null}
                      label="Postpone"
                      variant="secondary"
                      style={styles.nextActionButton}
                    />
                    <AppButton
                      onPress={() => void handleDismissRecommendation()}
                      disabled={actionBusy != null}
                      label={actionBusy === "dismiss" ? "Dismissing..." : "Dismiss"}
                      variant="danger"
                      style={styles.nextActionButton}
                    />
                  </View>
                </>
              ) : (
                <AppButton
                  onPress={openAdaptiveSettings}
                  label="Open adaptive calories"
                  variant="secondary"
                  style={styles.nextActionPrimaryButton}
                />
              )}

              {nextActionNote ? (
                <AppText color="secondary" style={styles.nextActionNote} variant="bodySmall">
                  {nextActionNote}
                </AppText>
              ) : null}
            </AppCard>

            <AppCard variant="hero" style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.copyColumn}>
                  <AppText color="secondary" style={styles.eyebrow} variant="eyebrow">
                    This week
                  </AppText>
                  <AppText style={styles.heroTitle} variant="sectionTitleLarge">
                    {formatDateRange(review.weekDates)}
                  </AppText>
                </View>
                <View style={styles.heroIcon}>
                  <CalendarCheckIcon
                    size={24}
                    color={appColors.brand300}
                    weight="fill"
                  />
                </View>
              </View>

              <NumericText style={styles.heroSummary} variant="numberCalorieRow">
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
              </NumericText>

              <View style={styles.heroMetrics}>
                <AppCard variant="compact" style={styles.metricCard}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Completion quality
                  </AppText>
                  <NumericText style={styles.metricValue} variant="numberMacroSummary">
                    {completedDays}/{review.dayReviews.length || 7}
                  </NumericText>
                </AppCard>
                <AppCard variant="compact" style={styles.metricCard}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Logged so far
                  </AppText>
                  <NumericText style={styles.metricValue} variant="numberMacroSummary">
                    {formatFoodNumber(totalCalories, " kcal")}
                  </NumericText>
                </AppCard>
                <AppCard variant="compact" style={styles.metricCard}>
                  <AppText color="muted" style={styles.metricLabel} variant="label">
                    Entries
                  </AppText>
                  <NumericText style={styles.metricValue} variant="numberMacroSummary">
                    {review.entries.length}
                  </NumericText>
                </AppCard>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${clampRatio(completionRatio) * 100}%` },
                  ]}
                />
              </View>
            </AppCard>

            <View style={styles.metricGrid}>
              <AppCard style={styles.insightCard}>
                <AppText color="muted" style={styles.metricLabel} variant="label">
                  Calories vs target
                </AppText>
                <NumericText style={styles.bigValue} variant="numberCalorieHero">
                  {calorieDelta != null ? formatSignedCalories(calorieDelta) : "--"}
                </NumericText>
                <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                  Average difference across elapsed days this week.
                </AppText>
              </AppCard>

              <AppCard style={styles.insightCard}>
                <AppText color="muted" style={styles.metricLabel} variant="label">
                  Weight trend
                </AppText>
                <View style={styles.iconValueRow}>
                  <TrendUpIcon size={18} color={appColors.brand300} weight="bold" />
                  <NumericText style={styles.bigValue} variant="numberWeightEntry">
                    {weightTrend.delta != null
                      ? formatSignedWeightDelta(weightTrend.delta, weightUnit)
                      : weightTrend.last
                        ? formatWeight(weightTrend.last.valueKg, weightUnit)
                        : "--"}
                  </NumericText>
                </View>
                <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                  {weightTrend.delta != null
                    ? `From ${formatWeight(
                        weightTrend.first?.valueKg ?? 0,
                        weightUnit,
                      )} to ${formatWeight(weightTrend.last?.valueKg ?? 0, weightUnit)}.`
                    : weightTrend.last
                      ? "Only one weigh-in this week, so no delta yet."
                      : "No weigh-ins logged this week."}
                </AppText>
              </AppCard>

              <AppCard style={styles.insightCardFull}>
                <View style={styles.rowBetween}>
                  <View style={styles.copyColumn}>
                    <AppText color="muted" style={styles.metricLabel} variant="label">
                      Adaptive recommendation
                    </AppText>
                    <AppText style={styles.bigValue} variant="sectionTitleLarge">
                      {adaptiveStatus}
                    </AppText>
                    <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                      {adaptiveDetail}
                    </AppText>
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
                <AppButton
                  onPress={() => navigation.navigate("AdaptiveCaloriesSettingsScreen")}
                  label="Open adaptive calories"
                  variant="secondary"
                  style={styles.cardButton}
                />
              </AppCard>
            </View>

            <AppCard style={styles.card}>
              <AppText style={styles.cardTitle} variant="cardTitle">Diary days</AppText>
              <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                Completion comes from days you explicitly marked complete in the Food Diary.
              </AppText>
              <View style={styles.dayStack}>
                {review.dayReviews.map((day) => {
                  const ratio =
                    day.target != null && day.target > 0
                      ? clampRatio(day.calories / day.target)
                      : 0;

                  return (
                    <AppCard key={day.dateKey} variant="compact" style={styles.dayRow}>
                      <View style={styles.dayDate}>
                        <AppText color="coral" style={styles.dayName} variant="label">
                          {day.date.toLocaleDateString(undefined, {
                            weekday: "short",
                          })}
                        </AppText>
                        <AppText color="secondary" style={styles.dayNumber} variant="label">
                          {day.date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </AppText>
                      </View>
                      <View style={styles.dayBody}>
                        <View style={styles.rowBetween}>
                          <NumericText style={styles.dayCalories} variant="numberCalorieRow">
                            {formatFoodNumber(day.calories, " kcal")}
                          </NumericText>
                          <AppText
                            style={[
                              styles.completionPill,
                              day.isComplete && styles.completionPillDone,
                            ]}
                            variant="micro"
                          >
                            {day.isComplete ? "Complete" : "Open"}
                          </AppText>
                        </View>
                        <NumericText color="secondary" style={styles.dayMeta} variant="numberMacroRow">
                          {day.target != null
                            ? `${formatFoodNumber(day.target, " kcal")} target`
                            : "No target set"}{" "}
                          | {day.entryCount} entries
                        </NumericText>
                        <View style={styles.smallProgressTrack}>
                          <View
                            style={[
                              styles.smallProgressFill,
                              { width: `${ratio * 100}%` },
                            ]}
                          />
                        </View>
                      </View>
                    </AppCard>
                  );
                })}
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <AppText style={styles.cardTitle} variant="cardTitle">
                Most repeated foods
              </AppText>
              <AppText color="secondary" style={styles.cardText} variant="bodySmall">
                Foods are ranked by how many times they appeared in this week's diary.
              </AppText>

              {review.repeatedFoods.length === 0 ? (
                <AppText color="secondary" style={styles.emptyText} variant="bodySmall">
                  No foods logged this week yet.
                </AppText>
              ) : (
                <View style={styles.foodStack}>
                  {review.repeatedFoods.map((food, index) => (
                    <AppCard key={food.key} variant="compact" style={styles.foodRow}>
                      <View style={styles.rankPill}>
                        <NumericText color={appColors.actionPrimaryPressed} style={styles.rankText} variant="numberChartAxis">
                          {index + 1}
                        </NumericText>
                      </View>
                      <View style={styles.foodCopy}>
                        <AppText style={styles.foodName} numberOfLines={1} variant="bodySmallStrong">
                          {food.name}
                        </AppText>
                        <NumericText color="secondary" style={styles.foodMeta} variant="numberMacroRow">
                          {food.count}x | {formatFoodNumber(food.calories, " kcal")} total
                        </NumericText>
                      </View>
                    </AppCard>
                  ))}
                </View>
              )}
            </AppCard>
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
    paddingHorizontal: appSpacing.gutter,
  },
  heroCard: {
    marginBottom: appSpacing.sm,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.ghost,
  },
  nextActionCard: {
    borderColor: appColors.brand500,
    marginBottom: appSpacing.sm,
  },
  nextActionTitle: {
  },
  nextActionIcon: {
    width: 46,
    height: 46,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.ghost,
  },
  nextActionStats: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginTop: appSpacing.md,
  },
  nextActionStat: {
    flex: 1,
    backgroundColor: appSurfaces.soft,
  },
  nextActionStatValue: {
    textAlign: "left",
  },
  nextActionButtonRow: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginTop: appSpacing.xs,
  },
  nextActionPrimaryButton: {
    marginTop: appSpacing.md,
  },
  nextActionButton: {
    flex: 1,
  },
  nextActionNote: {
    marginTop: appSpacing.sm,
  },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: appSurfaces.ghost,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 6,
    borderRadius: appRadius.pill,
    marginBottom: appSpacing.sm,
  },
  heroTitle: {
  },
  heroSummary: {
    textAlign: "left",
    marginTop: appSpacing.md,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginTop: appSpacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: appSurfaces.soft,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.sm,
    marginBottom: appSpacing.sm,
  },
  metricLabel: {
    marginBottom: appSpacing.xs,
  },
  metricValue: {
    textAlign: "left",
  },
  bigValue: {
    textAlign: "left",
  },
  insightCard: {
    flexGrow: 1,
    flexBasis: "47%",
  },
  insightCardFull: {
    width: "100%",
  },
  card: {
    marginBottom: appSpacing.sm,
  },
  loadingCard: {
    marginBottom: appSpacing.sm,
  },
  cardTitle: {
    marginBottom: appSpacing.xxs,
  },
  cardText: {
    marginTop: appSpacing.xxs,
  },
  copyColumn: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  iconValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.surfaceGhost,
    overflow: "hidden",
    marginTop: appSpacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: appRadius.pill,
    backgroundColor: appColors.success600,
  },
  dayStack: {
    gap: appSpacing.sm,
    marginTop: appSpacing.sm,
  },
  dayRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
    backgroundColor: appSurfaces.soft,
  },
  dayDate: {
    width: 58,
  },
  dayName: {
  },
  dayNumber: {
    marginTop: appSpacing.xxs,
  },
  dayBody: {
    flex: 1,
  },
  dayCalories: {
    textAlign: "left",
  },
  dayMeta: {
    textAlign: "left",
    marginTop: appSpacing.xxs,
  },
  completionPill: {
    overflow: "hidden",
    borderRadius: appRadius.pill,
    paddingHorizontal: appSpacing.xs,
    paddingVertical: 4,
    color: appColors.textMuted,
    backgroundColor: appColors.surfaceGhost,
  },
  completionPillDone: {
    color: appColors.white,
    backgroundColor: appColors.success700,
  },
  smallProgressTrack: {
    height: 5,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.surfaceGhost,
    overflow: "hidden",
    marginTop: appSpacing.xs,
  },
  smallProgressFill: {
    height: "100%",
    borderRadius: appRadius.pill,
    backgroundColor: appColors.brand500,
  },
  foodStack: {
    gap: appSpacing.xs,
    marginTop: appSpacing.sm,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    backgroundColor: appSurfaces.soft,
  },
  rankPill: {
    width: 30,
    height: 30,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.actionPrimarySoft,
  },
  rankText: {
    textAlign: "center",
  },
  foodCopy: {
    flex: 1,
  },
  foodName: {
  },
  foodMeta: {
    textAlign: "left",
    marginTop: appSpacing.xxs,
  },
  emptyText: {
    marginTop: appSpacing.sm,
  },
  cardButton: {
    marginTop: appSpacing.md,
  },
});

export default WeeklyReviewScreen;
