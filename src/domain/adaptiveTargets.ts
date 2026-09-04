import { clampCalorieTarget } from "../engine/calorieTargets";

/**
 * Turning an accepted recommendation into calorie targets.
 *
 * This is the one piece of the adaptive engine that is still the app's: the
 * *analysis* runs on the server (`POST /v1/adaptive/refresh`), but applying its
 * answer is a profile edit the user triggers, and the app has to know what it
 * is about to save before it saves it.
 *
 * The rest of the engine — the 28-day window, the TDEE estimate, the confidence
 * bands, the recommendation itself — was deleted from this repository when it
 * moved. See docs/architecture/adaptive-calories.md.
 *
 * Held equal to the backend's copy by the `applyAdaptiveRecommendationToTargets`
 * suite in the shared conformance corpus.
 */

/** A single refresh may not move a target by more than this. */
export const ADAPTIVE_MAX_DAILY_SHIFT = 150;

export interface AdaptiveTargetApplyResult {
  calorieAllowance: number;
  dailyCalorieOverrides: Array<number | null> | null;
  appliedDelta: number;
}

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
}): AdaptiveTargetApplyResult => {
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
  // Per-day overrides move with the base by the same amount, so a Saturday the
  // user deliberately set 300 kcal higher stays 300 kcal higher.
  const nextOverrides =
    dailyCalorieOverrides?.map((value) =>
      value == null ? null : clampCalorieTarget(value + appliedDelta),
    ) ?? null;

  return { calorieAllowance, dailyCalorieOverrides: nextOverrides, appliedDelta };
};
