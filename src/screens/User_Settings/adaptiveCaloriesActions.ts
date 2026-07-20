import {
  ADAPTIVE_WINDOW_DAYS,
  applyAdaptiveRecommendationToTargets,
  buildAdaptiveRecommendation,
  getCompleteDiaryDaysInWindow,
} from "../../engine/adaptiveCalories";
import {
  buildMacroTargetsForCalories,
  scaleMacroTargetsToCalories,
} from "../../engine/calorieTargets";
import { DB } from "../../store/DB";
import type { AppDispatch } from "../../store/appStore";
import type {
  AdaptiveRecommendationOutcome,
  DBDiaryDayStatus,
  DBAdaptiveCalorieRecommendation,
  DBUser,
  DBUserSettings,
} from "../../store/DB_TYPES";
import { setCurrentUser } from "../../store/userSlice";
import {
  measureDiaryRequest,
  type DiaryPerfTrace,
} from "../../performance/diaryPerformance";

const DAY_MS = 24 * 60 * 60 * 1000;
export const ADAPTIVE_RECALCULATION_DAYS = 7;
export const ADAPTIVE_RECALCULATION_INTERVAL_MS =
  ADAPTIVE_RECALCULATION_DAYS * DAY_MS;

export type AdaptiveRecommendationRefreshResult = {
  settings: DBUserSettings | null;
  latestRecommendation: DBAdaptiveCalorieRecommendation | null;
  analysis: AdaptiveRecommendationOutcome | null;
  wasRecalculated: boolean;
};

const isAdaptiveCalculationStale = (
  settings: DBUserSettings | null,
  now = new Date(),
): boolean => {
  const lastCalculatedAt = settings?.adaptiveLastCalculatedAt;

  if (!lastCalculatedAt) {
    return true;
  }

  return (
    now.getTime() - new Date(lastCalculatedAt).getTime() >=
    ADAPTIVE_RECALCULATION_INTERVAL_MS
  );
};

export const getNextAdaptiveReviewDate = (
  settings: Pick<DBUserSettings, "adaptiveLastCalculatedAt"> | null,
): Date | null => {
  const lastCalculatedAt = settings?.adaptiveLastCalculatedAt;

  if (!lastCalculatedAt) {
    return null;
  }

  const parsed = new Date(lastCalculatedAt);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getTime() + ADAPTIVE_RECALCULATION_INTERVAL_MS);
};

const areRecommendationShapesEquivalent = (
  existing: DBAdaptiveCalorieRecommendation,
  next: NonNullable<Extract<AdaptiveRecommendationOutcome, { status: "ready" }>["recommendation"]>,
): boolean =>
  existing.status === "proposed" &&
  existing.windowStart === next.windowStart &&
  existing.windowEnd === next.windowEnd &&
  existing.recommendedBaseCalories === next.recommendedBaseCalories &&
  existing.estimatedTdee === next.estimatedTdee &&
  existing.completeDaysUsed === next.completeDaysUsed &&
  existing.weighInsUsed === next.weighInsUsed &&
  existing.confidence === next.confidence;

const buildDiaryFetchRange = (
  asOf: Date,
  windowDays: number,
): { startDate: string; endDate: string } => {
  const endDate = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}-${String(
    asOf.getDate(),
  ).padStart(2, "0")}`;
  const start = new Date(asOf);
  start.setDate(start.getDate() - (windowDays * 2 - 1));

  return {
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
      start.getDate(),
    ).padStart(2, "0")}`,
    endDate,
  };
};

const supersedeRecommendationIfPresent = async (
  recommendation: DBAdaptiveCalorieRecommendation | null,
  perfTrace?: DiaryPerfTrace,
) => {
  if (!recommendation || recommendation.status !== "proposed") {
    return;
  }

  await measureDiaryRequest(
    perfTrace,
    "adaptive-supersede",
    "logical",
    () =>
      DB.updateAdaptiveCalorieRecommendation({
        id: recommendation.id,
        userExternalId: recommendation.userExternalId,
        status: "superseded",
      }),
  );
};

export const supersedeOpenAdaptiveRecommendationForUser = async (
  userExternalId: string,
): Promise<void> => {
  const latestRecommendation = await DB.getLatestAdaptiveCalorieRecommendation(
    userExternalId,
    "proposed",
  );
  await supersedeRecommendationIfPresent(latestRecommendation);
};

const loadAdaptiveWindowInputs = async ({
  userExternalId,
  asOf,
  windowDays,
  perfTrace,
}: {
  userExternalId: string;
  asOf: Date;
  windowDays: number;
  perfTrace?: DiaryPerfTrace;
}): Promise<{
  diaryDays: DBDiaryDayStatus[];
  windowStart: string | null;
  windowEnd: string | null;
}> => {
  const range = buildDiaryFetchRange(asOf, windowDays);
  const diaryDays = await DB.listDiaryDayStatusesBetween(
    userExternalId,
    range.startDate,
    range.endDate,
    perfTrace,
  );
  const summary = getCompleteDiaryDaysInWindow({
    diaryDays,
    asOf,
    windowDays,
  });

  return {
    diaryDays,
    windowStart: summary.windowStart,
    windowEnd: summary.windowEnd,
  };
};

export const refreshAdaptiveRecommendationForUser = async ({
  userExternalId,
  force = false,
  asOf = new Date(),
  windowDays = ADAPTIVE_WINDOW_DAYS,
  perfTrace,
}: {
  userExternalId: string;
  force?: boolean;
  asOf?: Date;
  windowDays?: number;
  perfTrace?: DiaryPerfTrace;
}): Promise<AdaptiveRecommendationRefreshResult> => {
  const [user, settings, latestRecommendation] = await Promise.all([
    measureDiaryRequest(perfTrace, "adaptive-user", "logical", () =>
      DB.getUserByExternalId(userExternalId, perfTrace),
    ),
    measureDiaryRequest(perfTrace, "adaptive-settings", "logical", () =>
      DB.getUserSettings(userExternalId, perfTrace),
    ),
    measureDiaryRequest(perfTrace, "adaptive-recommendation", "logical", () =>
      DB.getLatestAdaptiveCalorieRecommendation(userExternalId, "proposed"),
    ),
  ]);

  if (!user) {
    return {
      settings,
      latestRecommendation: null,
      analysis: {
        status: "disabled",
        reason: "No active synced user was available for adaptive calories.",
        confidence: null,
        estimatedTdee: null,
        recommendedBaseCalories: null,
        summary: null,
      },
      wasRecalculated: false,
    };
  }

  if (!settings?.adaptiveCaloriesEnabled) {
    return {
      settings,
      latestRecommendation: null,
      analysis: {
        status: "disabled",
        reason: "Adaptive calories is turned off.",
        confidence: null,
        estimatedTdee: null,
        recommendedBaseCalories: null,
        summary: null,
      },
      wasRecalculated: false,
    };
  }

  const shouldRecalculate =
    force ||
    isAdaptiveCalculationStale(settings, asOf) ||
    !settings?.adaptiveLastCalculatedAt;

  if (!shouldRecalculate) {
    return {
      settings,
      latestRecommendation,
      analysis: null,
      wasRecalculated: false,
    };
  }

  const { diaryDays, windowStart, windowEnd } = await loadAdaptiveWindowInputs({
    userExternalId,
    asOf,
    windowDays,
    perfTrace,
  });
  const [entries, weightEntries] =
    windowStart && windowEnd
      ? await Promise.all([
          measureDiaryRequest(perfTrace, "adaptive-entries", "logical", () =>
            DB.getUserFoodLogEntriesBetween(
              userExternalId,
              windowStart,
              windowEnd,
              { perfTrace },
            ),
          ),
          measureDiaryRequest(perfTrace, "adaptive-weights", "logical", () =>
            DB.listWeightEntriesBetween(userExternalId, windowStart, windowEnd),
          ),
        ])
      : [[], []];
  const analysis = buildAdaptiveRecommendation({
    user,
    settings,
    entries,
    diaryDays,
    weightEntries,
    asOf,
    windowDays,
  });
  const now = new Date().toISOString();

  await measureDiaryRequest(perfTrace, "adaptive-save-settings", "logical", () =>
    DB.saveUserSettings({
      userExternalId,
      adaptiveLastCalculatedAt: now,
    }),
  );

  if (analysis.status !== "ready") {
    await supersedeRecommendationIfPresent(latestRecommendation, perfTrace);
    const refreshedSettings = await measureDiaryRequest(
      perfTrace,
      "adaptive-refreshed-settings",
      "logical",
      () => DB.getUserSettings(userExternalId, perfTrace),
    );

    return {
      settings: refreshedSettings,
      latestRecommendation: null,
      analysis,
      wasRecalculated: true,
    };
  }

  if (
    latestRecommendation &&
    areRecommendationShapesEquivalent(latestRecommendation, analysis.recommendation)
  ) {
    const refreshedSettings = await measureDiaryRequest(
      perfTrace,
      "adaptive-refreshed-settings",
      "logical",
      () => DB.getUserSettings(userExternalId, perfTrace),
    );

    return {
      settings: refreshedSettings,
      latestRecommendation,
      analysis,
      wasRecalculated: true,
    };
  }

  const createdRecommendation = await measureDiaryRequest(
    perfTrace,
    "adaptive-create-recommendation",
    "logical",
    () =>
      DB.createAdaptiveCalorieRecommendation({
        userExternalId,
        ...analysis.recommendation,
      }),
  );
  const refreshedSettings = await measureDiaryRequest(
    perfTrace,
    "adaptive-refreshed-settings",
    "logical",
    () => DB.getUserSettings(userExternalId, perfTrace),
  );

  return {
    settings: refreshedSettings,
    latestRecommendation: createdRecommendation,
    analysis,
    wasRecalculated: true,
  };
};

export const applyAdaptiveRecommendationForUser = async ({
  dispatch,
  recommendation,
  user,
  settings,
}: {
  dispatch: AppDispatch;
  recommendation: DBAdaptiveCalorieRecommendation;
  user: DBUser;
  settings: DBUserSettings | null;
}): Promise<DBUser> => {
  const now = new Date().toISOString();
  const [latestWeightEntry] = await DB.listWeightEntries(user.externalId, {
    limit: 1,
  });
  const nextTargets = applyAdaptiveRecommendationToTargets({
    currentBaseCalories: user.calorieAllowance,
    dailyCalorieOverrides: settings?.dailyCalorieOverrides,
    recommendedBaseCalories: recommendation.recommendedBaseCalories,
  });
  const nextMacros =
    latestWeightEntry != null
      ? buildMacroTargetsForCalories({
          calories: nextTargets.calorieAllowance,
          proteinFocus: user.proteinFocus,
          weightKg: latestWeightEntry.valueKg,
        }) ?? scaleMacroTargetsToCalories(user, nextTargets.calorieAllowance)
      : scaleMacroTargetsToCalories(user, nextTargets.calorieAllowance);
  const nextUser: DBUser = {
    ...user,
    calorieAllowance: nextTargets.calorieAllowance,
    ...nextMacros,
  };

  await DB.addUser(nextUser);
  await DB.saveUserSettings({
    userExternalId: user.externalId,
    dailyCalorieOverrides: nextTargets.dailyCalorieOverrides,
    adaptiveLastCalculatedAt: now,
  });
  await DB.updateAdaptiveCalorieRecommendation({
    id: recommendation.id,
    userExternalId: user.externalId,
    status: "applied",
    respondedAt: now,
    appliedAt: now,
  });

  const savedUser = (await DB.getUserByExternalId(user.externalId)) ?? nextUser;
  dispatch(setCurrentUser(savedUser));
  return savedUser;
};

export const rejectAdaptiveRecommendationForUser = async ({
  recommendation,
}: {
  recommendation: DBAdaptiveCalorieRecommendation;
}): Promise<void> => {
  const now = new Date().toISOString();

  await DB.updateAdaptiveCalorieRecommendation({
    id: recommendation.id,
    userExternalId: recommendation.userExternalId,
    status: "rejected",
    respondedAt: now,
  });
  await DB.saveUserSettings({
    userExternalId: recommendation.userExternalId,
    adaptiveLastCalculatedAt: now,
  });
};

export const setDiaryDayCompletionAndRefresh = async ({
  userExternalId,
  date,
  isComplete,
}: {
  userExternalId: string;
  date: string;
  isComplete: boolean;
}): Promise<AdaptiveRecommendationRefreshResult> => {
  await DB.saveDiaryDayStatus({
    userExternalId,
    date,
    isComplete,
  });

  return refreshAdaptiveRecommendationForUser({
    userExternalId,
  });
};

export const markDiaryDayCompleteAndRefresh = async ({
  userExternalId,
  date,
}: {
  userExternalId: string;
  date: string;
}): Promise<AdaptiveRecommendationRefreshResult> =>
  setDiaryDayCompletionAndRefresh({
    userExternalId,
    date,
    isComplete: true,
  });
