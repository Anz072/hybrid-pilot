import {
  CALORIE_TARGET_STEP,
  clampCalorieTarget,
} from "./calorieTargets";
import {
  collapseEntriesByLocalDate,
  computeEmaSeries,
} from "../screens/Weight/weightUtils";
import type {
  AdaptiveCalorieRecommendationConfidence,
  AdaptiveCalorieTargetApplyResult,
  AdaptiveRecommendationDraft,
  AdaptiveRecommendationInputSummary,
  AdaptiveRecommendationOutcome,
  DBDiaryDayStatus,
  DBUser,
  DBUserFoodLogEntry,
  DBUserSettings,
  DBWeightEntry,
} from "../store/DB_TYPES";

export const ADAPTIVE_WINDOW_DAYS = 28;
export const ADAPTIVE_MIN_COMPLETE_DAYS = 14;
export const ADAPTIVE_MIN_WEIGH_INS = 5;
export const ADAPTIVE_MIN_DAY_SPAN = 14;
export const ADAPTIVE_MIN_RECOMMENDATION_DELTA = 100;
export const ADAPTIVE_MAX_DAILY_SHIFT = 150;
export const ADAPTIVE_KCAL_PER_KG = 7700;
export const ADAPTIVE_ALGORITHM_VERSION = "v1";

const GOAL_OFFSETS: Record<"lose_fat" | "maintain" | "build_muscle", number> = {
  lose_fat: -350,
  maintain: 0,
  build_muscle: 250,
};

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseDateKey = (dateKey: string): Date => new Date(`${dateKey}T12:00:00`);

const shiftDateKey = (dateKey: string, deltaDays: number): string => {
  const next = parseDateKey(dateKey);
  next.setDate(next.getDate() + deltaDays);
  return toDateKey(next);
};

const diffDateKeysInDays = (startDateKey: string, endDateKey: string): number =>
  Math.max(
    0,
    Math.round(
      (parseDateKey(endDateKey).getTime() - parseDateKey(startDateKey).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

const roundToCalorieStep = (value: number): number =>
  clampCalorieTarget(
    Math.round(value / CALORIE_TARGET_STEP) * CALORIE_TARGET_STEP,
  );

const isAdaptiveGoal = (
  value: DBUser["goal"],
): value is "lose_fat" | "maintain" | "build_muscle" =>
  value === "lose_fat" || value === "maintain" || value === "build_muscle";

const buildEmptySummary = (
  windowDays: number,
): AdaptiveRecommendationInputSummary => ({
  windowDays,
  windowStart: null,
  windowEnd: null,
  latestCompleteDate: null,
  daySpan: 0,
  completeDaysUsed: 0,
  completeDateKeys: [],
  totalEntriesUsed: 0,
  weighInsUsed: 0,
  trendStartKg: null,
  trendEndKg: null,
  observedWeeklyChangeKg: null,
  avgLoggedCalories: null,
});

const getGoalOffset = (goal: DBUser["goal"]): number =>
  isAdaptiveGoal(goal) ? GOAL_OFFSETS[goal] : 0;

export const getCompleteDiaryDaysInWindow = ({
  diaryDays,
  asOf = new Date(),
  windowDays = ADAPTIVE_WINDOW_DAYS,
}: {
  diaryDays: DBDiaryDayStatus[];
  asOf?: Date;
  windowDays?: number;
}): AdaptiveRecommendationInputSummary => {
  const asOfDateKey = toDateKey(asOf);
  const completeDays = diaryDays
    .filter((day) => day.isComplete && day.date <= asOfDateKey)
    .sort((left, right) => left.date.localeCompare(right.date));

  const latestCompleteDate = completeDays.at(-1)?.date ?? null;

  if (!latestCompleteDate) {
    return buildEmptySummary(windowDays);
  }

  const windowStart = shiftDateKey(latestCompleteDate, -(windowDays - 1));
  const completeDateKeys = completeDays
    .filter((day) => day.date >= windowStart && day.date <= latestCompleteDate)
    .map((day) => day.date);

  return {
    ...buildEmptySummary(windowDays),
    windowStart,
    windowEnd: latestCompleteDate,
    latestCompleteDate,
    completeDateKeys,
    completeDaysUsed: completeDateKeys.length,
  };
};

export const collapseAdaptiveWeightsByLocalDay = (
  entries: DBWeightEntry[],
): DBWeightEntry[] =>
  collapseEntriesByLocalDate(entries.filter((entry) => entry.deletedAt == null)).sort(
    (left, right) =>
      new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime(),
  );

export const computeAdaptiveWeightTrend = (
  entries: DBWeightEntry[],
  smoothing = 0.35,
): {
  trendStartKg: number;
  trendEndKg: number;
  weighInsUsed: number;
  daySpan: number;
  observedWeeklyChangeKg: number | null;
} | null => {
  const collapsed = collapseAdaptiveWeightsByLocalDay(entries);

  if (collapsed.length === 0) {
    return null;
  }

  const ema = computeEmaSeries(collapsed, smoothing);
  const trendStart = ema[0];
  const trendEnd = ema.at(-1);
  const firstDate = collapsed[0]?.measuredAtLocalIso.slice(0, 10) ?? null;
  const lastDate = collapsed.at(-1)?.measuredAtLocalIso.slice(0, 10) ?? null;

  if (!trendStart || !trendEnd || !firstDate || !lastDate) {
    return null;
  }

  const daySpan = diffDateKeysInDays(firstDate, lastDate);
  const observedWeeklyChangeKg =
    daySpan > 0 ? ((trendEnd.value - trendStart.value) * 7) / daySpan : null;

  return {
    trendStartKg: trendStart.value,
    trendEndKg: trendEnd.value,
    weighInsUsed: collapsed.length,
    daySpan,
    observedWeeklyChangeKg:
      observedWeeklyChangeKg != null
        ? Math.round(observedWeeklyChangeKg * 1000) / 1000
        : null,
  };
};

export const estimateAdaptiveTdee = ({
  avgLoggedCalories,
  trendStartKg,
  trendEndKg,
  daySpan,
}: {
  avgLoggedCalories: number;
  trendStartKg: number;
  trendEndKg: number;
  daySpan: number;
}): number | null => {
  if (!Number.isFinite(avgLoggedCalories) || daySpan <= 0) {
    return null;
  }

  const weightDeltaKg = trendEndKg - trendStartKg;
  const estimatedTdee =
    avgLoggedCalories - (ADAPTIVE_KCAL_PER_KG * weightDeltaKg) / daySpan;

  return Number.isFinite(estimatedTdee) ? estimatedTdee : null;
};

export const getAdaptiveRecommendationConfidence = ({
  completeDaysUsed,
  weighInsUsed,
  daySpan,
}: Pick<
  AdaptiveRecommendationInputSummary,
  "completeDaysUsed" | "weighInsUsed" | "daySpan"
>): AdaptiveCalorieRecommendationConfidence | null => {
  if (
    completeDaysUsed >= 24 &&
    weighInsUsed >= 8 &&
    daySpan >= 21
  ) {
    return "high";
  }

  if (
    completeDaysUsed >= 18 &&
    weighInsUsed >= 6 &&
    daySpan >= 18
  ) {
    return "medium";
  }

  if (
    completeDaysUsed >= ADAPTIVE_MIN_COMPLETE_DAYS &&
    weighInsUsed >= ADAPTIVE_MIN_WEIGH_INS &&
    daySpan >= ADAPTIVE_MIN_DAY_SPAN
  ) {
    return "low";
  }

  return null;
};

export const getAdaptiveRecommendationReason = ({
  goal,
  avgLoggedCalories,
  observedWeeklyChangeKg,
  estimatedTdee,
  currentBaseCalories,
  recommendedBaseCalories,
}: {
  goal: DBUser["goal"];
  avgLoggedCalories: number;
  observedWeeklyChangeKg: number | null;
  estimatedTdee: number;
  currentBaseCalories: number | null;
  recommendedBaseCalories: number;
}): string => {
  const trendText =
    observedWeeklyChangeKg == null
      ? "Weight trend was too sparse to estimate a weekly pace."
      : `Smoothed trend changed by ${observedWeeklyChangeKg > 0 ? "+" : ""}${observedWeeklyChangeKg.toFixed(2)} kg/week.`;
  const currentTargetText =
    currentBaseCalories != null
      ? `Current base target is ${currentBaseCalories} kcal/day.`
      : "No current base target was set.";
  const goalText = isAdaptiveGoal(goal)
    ? goal === "lose_fat"
      ? "Weight-loss offset applied."
      : goal === "build_muscle"
        ? "Muscle-gain offset applied."
        : "Maintenance target applied."
    : "Maintenance target applied.";

  return `Average logged intake was ${Math.round(avgLoggedCalories)} kcal/day. ${trendText} Estimated maintenance is ${Math.round(
    estimatedTdee,
  )} kcal/day. ${goalText} ${currentTargetText} Recommended base target is ${recommendedBaseCalories} kcal/day.`;
};

export const buildAdaptiveWindow = ({
  entries,
  diaryDays,
  weightEntries,
  asOf = new Date(),
  windowDays = ADAPTIVE_WINDOW_DAYS,
}: {
  entries: DBUserFoodLogEntry[];
  diaryDays: DBDiaryDayStatus[];
  weightEntries: DBWeightEntry[];
  asOf?: Date;
  windowDays?: number;
}): AdaptiveRecommendationInputSummary => {
  const summary = getCompleteDiaryDaysInWindow({
    diaryDays,
    asOf,
    windowDays,
  });

  if (!summary.windowStart || !summary.windowEnd) {
    return summary;
  }

  const completeDateKeys = new Set(summary.completeDateKeys);
  const entryTotalsByDate = new Map<string, number>();
  let totalEntriesUsed = 0;

  for (const entry of entries) {
    if (
      entry.date < summary.windowStart ||
      entry.date > summary.windowEnd ||
      !completeDateKeys.has(entry.date)
    ) {
      continue;
    }

    entryTotalsByDate.set(
      entry.date,
      (entryTotalsByDate.get(entry.date) ?? 0) + entry.calories,
    );
    totalEntriesUsed += 1;
  }

  const avgLoggedCalories =
    summary.completeDateKeys.length > 0
      ? summary.completeDateKeys.reduce(
          (sum, date) => sum + (entryTotalsByDate.get(date) ?? 0),
          0,
        ) / summary.completeDateKeys.length
      : null;

  const windowWeights = weightEntries.filter((entry) => {
    const localDate = entry.measuredAtLocalIso.slice(0, 10);
    return (
      entry.deletedAt == null &&
      localDate >= summary.windowStart! &&
      localDate <= summary.windowEnd!
    );
  });
  const trend = computeAdaptiveWeightTrend(windowWeights);

  return {
    ...summary,
    totalEntriesUsed,
    weighInsUsed: trend?.weighInsUsed ?? 0,
    daySpan: trend?.daySpan ?? 0,
    trendStartKg: trend?.trendStartKg ?? null,
    trendEndKg: trend?.trendEndKg ?? null,
    observedWeeklyChangeKg: trend?.observedWeeklyChangeKg ?? null,
    avgLoggedCalories:
      avgLoggedCalories != null ? Math.round(avgLoggedCalories * 10) / 10 : null,
  };
};

export const applyAdaptiveRecommendationToTargets = ({
  currentBaseCalories,
  dailyCalorieOverrides,
  recommendedBaseCalories,
  maxDailyShift = ADAPTIVE_MAX_DAILY_SHIFT,
}: {
  currentBaseCalories: number | null | undefined;
  dailyCalorieOverrides: Array<number | null> | null | undefined;
  recommendedBaseCalories: number;
  maxDailyShift?: number;
}): AdaptiveCalorieTargetApplyResult => {
  const resolvedCurrentBase = currentBaseCalories ?? recommendedBaseCalories;
  const rawDelta = recommendedBaseCalories - resolvedCurrentBase;
  const appliedDelta =
    currentBaseCalories == null
      ? 0
      : Math.max(-maxDailyShift, Math.min(maxDailyShift, rawDelta));
  const calorieAllowance =
    currentBaseCalories == null
      ? clampCalorieTarget(recommendedBaseCalories)
      : clampCalorieTarget(resolvedCurrentBase + appliedDelta);
  const nextOverrides =
    dailyCalorieOverrides?.map((value) =>
      value == null ? null : clampCalorieTarget(value + appliedDelta),
    ) ?? null;

  return {
    calorieAllowance,
    dailyCalorieOverrides: nextOverrides,
    appliedDelta,
  };
};

export const buildAdaptiveRecommendation = ({
  user,
  settings,
  entries,
  diaryDays,
  weightEntries,
  asOf = new Date(),
  windowDays = ADAPTIVE_WINDOW_DAYS,
}: {
  user: DBUser | null;
  settings: DBUserSettings | null;
  entries: DBUserFoodLogEntry[];
  diaryDays: DBDiaryDayStatus[];
  weightEntries: DBWeightEntry[];
  asOf?: Date;
  windowDays?: number;
}): AdaptiveRecommendationOutcome => {
  if (!user || settings?.adaptiveCaloriesEnabled === false) {
    return {
      status: "disabled",
      reason: "Adaptive calories is turned off.",
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary: null,
    };
  }

  const summary = buildAdaptiveWindow({
    entries,
    diaryDays,
    weightEntries,
    asOf,
    windowDays,
  });

  if (!summary.latestCompleteDate || !summary.windowStart || !summary.windowEnd) {
    return {
      status: "insufficient",
      reason: "Mark at least one diary day complete to start adaptive calorie analysis.",
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  if (summary.completeDaysUsed < ADAPTIVE_MIN_COMPLETE_DAYS) {
    return {
      status: "insufficient",
      reason: `Need at least ${ADAPTIVE_MIN_COMPLETE_DAYS} complete diary days in the last ${windowDays} days.`,
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  if (summary.weighInsUsed < ADAPTIVE_MIN_WEIGH_INS) {
    return {
      status: "insufficient",
      reason: `Need at least ${ADAPTIVE_MIN_WEIGH_INS} weigh-ins in the analysis window.`,
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  if (summary.daySpan < ADAPTIVE_MIN_DAY_SPAN) {
    return {
      status: "insufficient",
      reason: `Need at least ${ADAPTIVE_MIN_DAY_SPAN} days between the first and last usable weigh-in.`,
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  if (
    summary.avgLoggedCalories == null ||
    summary.trendStartKg == null ||
    summary.trendEndKg == null
  ) {
    return {
      status: "insufficient",
      reason: "The current window is missing enough logged calories or weight data to build a stable recommendation.",
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  const confidence = getAdaptiveRecommendationConfidence(summary);
  if (!confidence) {
    return {
      status: "insufficient",
      reason: "The analysis window is still too sparse to trust.",
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  const estimatedTdee = estimateAdaptiveTdee({
    avgLoggedCalories: summary.avgLoggedCalories,
    trendStartKg: summary.trendStartKg,
    trendEndKg: summary.trendEndKg,
    daySpan: summary.daySpan,
  });

  if (estimatedTdee == null) {
    return {
      status: "insufficient",
      reason: "Could not estimate maintenance calories from the current data window.",
      confidence: null,
      estimatedTdee: null,
      recommendedBaseCalories: null,
      summary,
    };
  }

  const currentBaseCalories = user.calorieAllowance ?? null;
  const goalOffset = getGoalOffset(user.goal);
  const uncappedRecommendation = roundToCalorieStep(estimatedTdee + goalOffset);
  const recommendedBaseCalories =
    currentBaseCalories == null
      ? uncappedRecommendation
      : roundToCalorieStep(
          currentBaseCalories +
            Math.max(
              -ADAPTIVE_MAX_DAILY_SHIFT,
              Math.min(
                ADAPTIVE_MAX_DAILY_SHIFT,
                uncappedRecommendation - currentBaseCalories,
              ),
            ),
        );
  const recommendedDelta =
    currentBaseCalories == null
      ? 0
      : recommendedBaseCalories - currentBaseCalories;
  const reason = getAdaptiveRecommendationReason({
    goal: user.goal,
    avgLoggedCalories: summary.avgLoggedCalories,
    observedWeeklyChangeKg: summary.observedWeeklyChangeKg,
    estimatedTdee,
    currentBaseCalories,
    recommendedBaseCalories,
  });

  if (
    currentBaseCalories != null &&
    Math.abs(recommendedDelta) < ADAPTIVE_MIN_RECOMMENDATION_DELTA
  ) {
    return {
      status: "unchanged",
      reason:
        "Current calories are already close enough to the observed trend, so no update is suggested right now.",
      confidence,
      estimatedTdee: Math.round(estimatedTdee),
      recommendedBaseCalories,
      summary,
    };
  }

  const recommendation: AdaptiveRecommendationDraft = {
    status: "proposed",
    algorithmVersion: ADAPTIVE_ALGORITHM_VERSION,
    windowStart: summary.windowStart,
    windowEnd: summary.windowEnd,
    confidence,
    currentBaseCalories,
    recommendedBaseCalories,
    estimatedTdee: Math.round(estimatedTdee),
    recommendedDelta,
    avgLoggedCalories: Math.round(summary.avgLoggedCalories),
    completeDaysUsed: summary.completeDaysUsed,
    weighInsUsed: summary.weighInsUsed,
    trendStartKg: summary.trendStartKg,
    trendEndKg: summary.trendEndKg,
    observedWeeklyChangeKg: summary.observedWeeklyChangeKg,
    reason,
    inputSummary: {
      ...summary,
      goalOffset,
      currentGoal: user.goal,
    },
  };

  return {
    status: "ready",
    reason,
    confidence,
    estimatedTdee: recommendation.estimatedTdee,
    recommendedBaseCalories,
    summary,
    recommendation,
  };
};
