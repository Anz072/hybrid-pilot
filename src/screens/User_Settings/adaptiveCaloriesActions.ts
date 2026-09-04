import {
  applyAdaptiveRecommendationToTargets,
} from "../../domain/adaptiveTargets";
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

/**
 * Closes an open recommendation.
 *
 * Still needed after the engine moved: turning adaptive calories off, or
 * rejecting a proposal, closes it from the app rather than from a refresh.
 */
const supersedeRecommendationIfPresent = async (
  recommendation: DBAdaptiveCalorieRecommendation | null,
  perfTrace?: DiaryPerfTrace,
) => {
  if (!recommendation || recommendation.status !== "proposed") {
    return;
  }

  await measureDiaryRequest(perfTrace, "adaptive-supersede", "logical", () =>
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

/**
 * Asks the server what this user's calorie target should be.
 *
 * One request. This used to fetch a month of diary days, a month of entries and
 * a month of weigh-ins, run the 28-day analysis on the device, and POST the
 * result back — six round trips, and a window between the reads and the write
 * in which any of the inputs could change. The engine now runs where the data
 * is, so the analysis and the write see the same snapshot.
 *
 * The staleness gate stays here, because it is a UI cadence decision — how
 * often to bother asking — not a fact about the data. The settings read it
 * depends on was already happening.
 */
export const refreshAdaptiveRecommendationForUser = async ({
  userExternalId,
  force = false,
  asOf = new Date(),
  perfTrace,
}: {
  userExternalId: string;
  force?: boolean;
  asOf?: Date;
  /** Accepted and ignored: the window is the server's to choose now. */
  windowDays?: number;
  perfTrace?: DiaryPerfTrace;
}): Promise<AdaptiveRecommendationRefreshResult> => {
  const [settings, latestRecommendation] = await Promise.all([
    measureDiaryRequest(perfTrace, "adaptive-settings", "logical", () =>
      DB.getUserSettings(userExternalId, perfTrace),
    ),
    measureDiaryRequest(perfTrace, "adaptive-recommendation", "logical", () =>
      DB.getLatestAdaptiveCalorieRecommendation(userExternalId, "proposed"),
    ),
  ]);

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
    !settings.adaptiveLastCalculatedAt;

  if (!shouldRecalculate) {
    return {
      settings,
      latestRecommendation,
      analysis: null,
      wasRecalculated: false,
    };
  }

  const { result, recommendation } = await measureDiaryRequest(
    perfTrace,
    "adaptive-refresh",
    "node-api",
    () => DB.refreshAdaptiveCalories(userExternalId, { force }),
  );

  // Marks when the app last asked, so the weekly cadence above has something to
  // measure against. It is not part of the analysis, which is why the server
  // does not own it.
  await measureDiaryRequest(perfTrace, "adaptive-save-settings", "logical", () =>
    DB.saveUserSettings({
      userExternalId,
      adaptiveLastCalculatedAt: new Date().toISOString(),
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
    latestRecommendation: recommendation,
    analysis: {
      status: result.status,
      reason: result.reason,
      confidence: result.confidence,
      estimatedTdee: result.estimatedTdee,
      recommendedBaseCalories: result.recommendedBaseCalories,
      summary: (result.summary ??
        null) as AdaptiveRecommendationOutcome["summary"],
    } as AdaptiveRecommendationOutcome,
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
