import { getEffectiveCalorieTargetForDate } from "../../engine/calorieTargets";
import { DB } from "../../store/DB";
import type { DBUser } from "../../store/DB_TYPES";
import type { FoodNutritionTotals } from "../Food/foodUtils";
import {
  collapseEntriesByLocalDate,
  computeGoalProgress,
  computeMovingAverage,
  roundWeightKg,
} from "../Weight/weightUtils";
import {
  buildRecentDateKeys,
  type MicronutrientTotals,
  type NutritionSnapshot,
  loadNutritionSnapshot,
} from "./homeNutrition";

export type HomeDashboardSummary = {
  calorieTarget: number | null;
  currentWeightKg: number | null;
  goalProgressPercent: number | null;
  loadedAt: string;
  todayMicros: MicronutrientTotals;
  todayTotals: FoodNutritionTotals;
  trackedMicronutrientCount: number;
  sevenDayAverageWeightKg: number | null;
};

const summaryCache = new Map<string, HomeDashboardSummary>();

export const getCachedHomeDashboardSummary = (userExternalId: string) =>
  summaryCache.get(userExternalId) ?? null;

export const clearCachedHomeDashboardSummary = (userExternalId: string) => {
  summaryCache.delete(userExternalId);
};

const buildSummaryFromSnapshot = async ({
  todayDate,
  todaySnapshot,
  user,
}: {
  todayDate: Date;
  todaySnapshot: NutritionSnapshot;
  user: DBUser;
}): Promise<HomeDashboardSummary> => {
  const [settings, weightEntries, goal] = await Promise.all([
    DB.getUserSettings(user.externalId),
    DB.listWeightEntries(user.externalId, { includeDeleted: true }),
    DB.getWeightGoal(user.externalId),
  ]);
  const resolvedTarget = getEffectiveCalorieTargetForDate({
    date: todayDate,
    baseCalories: user.calorieAllowance,
    settings,
  });
  const activeWeightEntries = collapseEntriesByLocalDate(
    weightEntries.filter((entry) => entry.deletedAt == null),
  );
  const currentEntry = activeWeightEntries[0] ?? null;
  const startingEntry = activeWeightEntries[activeWeightEntries.length - 1] ?? null;
  const sevenDayAverage = computeMovingAverage(activeWeightEntries, 7);
  const goalProgress =
    currentEntry && startingEntry
      ? computeGoalProgress(currentEntry.valueKg, startingEntry.valueKg, goal)
      : null;

  return {
    calorieTarget: resolvedTarget,
    currentWeightKg: currentEntry?.valueKg ?? null,
    goalProgressPercent: goalProgress,
    loadedAt: new Date().toISOString(),
    todayMicros: todaySnapshot.micronutrients,
    todayTotals: todaySnapshot.totals,
    trackedMicronutrientCount: todaySnapshot.trackedMicronutrientCount,
    sevenDayAverageWeightKg:
      sevenDayAverage != null ? roundWeightKg(sevenDayAverage) : null,
  };
};

export const loadHomeDashboardSummary = async (
  user: DBUser,
): Promise<HomeDashboardSummary> => {
  const todayDate = new Date();
  const todaySnapshot = await loadNutritionSnapshot(
    user.externalId,
    buildRecentDateKeys(1, todayDate),
  );
  const summary = await buildSummaryFromSnapshot({
    todayDate,
    todaySnapshot,
    user,
  });

  summaryCache.set(user.externalId, summary);
  return summary;
};
