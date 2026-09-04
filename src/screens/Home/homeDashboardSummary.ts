import { coalesce } from "../../API/nouri/coalesce";
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

// The last summary this process computed, kept so returning to Home paints
// immediately while the fresh one loads. It lives for the lifetime of the app
// process and is dropped on sign-out.
//
// It used to also be written to disk, which meant a cold start could show a
// calorie total computed from a previous day's diary with no indication that it
// was stale. A summary is derived from server data; the way to have a current
// one is to ask for it.
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
    DB.listWeightEntries(user.externalId),
    DB.getWeightGoal(user.externalId),
  ]);
  const resolvedTarget = getEffectiveCalorieTargetForDate({
    date: todayDate,
    baseCalories: user.calorieAllowance,
    settings,
  });
  const activeWeightEntries = collapseEntriesByLocalDate(weightEntries);
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

export const loadHomeDashboardSummary = (
  user: DBUser,
): Promise<HomeDashboardSummary> =>
  // Home's focus effect, its pull-to-refresh and the data-change listener can
  // all ask at once; each load is roughly a dozen requests, so three of them
  // racing is worth avoiding. Coalesced by user, not cached: once it settles the
  // next caller starts a fresh one.
  coalesce(`home:summary:${user.externalId}`, async () => {
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
  });
