import type {
  ActivityLevel,
  FuelPlan,
  GoalType,
  ProteinFocus,
} from "../navigation/onboardingTypes";
import { getAgeFromBirthdateValue } from "../helpers";
import {
  buildFuelPlan,
  buildMacroTargets,
} from "../screens/Onboarding/initialCalculations";
import type { DBUser, DBUserSettings } from "../store/DB_TYPES";

type CalorieOverrideSettings = Pick<DBUserSettings, "dailyCalorieOverrides">;

export const CALORIE_SCHEDULE_DAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export const CALORIE_SCHEDULE_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const CALORIE_TARGET_STEP = 50;
export const MIN_CALORIE_TARGET = 800;
export const MAX_CALORIE_TARGET = 7000;

const GOAL_TYPES: GoalType[] = ["lose_fat", "maintain", "build_muscle"];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "athlete",
];

const isGoalType = (value: string): value is GoalType =>
  GOAL_TYPES.includes(value as GoalType);

const isActivityLevel = (value: string): value is ActivityLevel =>
  ACTIVITY_LEVELS.includes(value as ActivityLevel);

const isFuelPlanSex = (
  value: DBUser["gender"],
): value is "female" | "male" | "other" =>
  value === "female" || value === "male" || value === "other";

export const clampCalorieTarget = (value: number): number =>
  Math.max(
    MIN_CALORIE_TARGET,
    Math.min(MAX_CALORIE_TARGET, Math.round(value)),
  );

export const getMondayFirstDayIndex = (date: Date): number =>
  (date.getDay() + 6) % 7;

export const getDailyCalorieOverrideForDate = (
  date: Date,
  settings: CalorieOverrideSettings | null | undefined,
): number | null => {
  const overrides = settings?.dailyCalorieOverrides;
  if (!overrides || overrides.length === 0) {
    return null;
  }

  return overrides[getMondayFirstDayIndex(date)] ?? null;
};

export const getEffectiveCalorieTargetForDate = ({
  date,
  baseCalories,
  settings,
}: {
  date: Date;
  baseCalories: number | null | undefined;
  settings: CalorieOverrideSettings | null | undefined;
}): number | null => {
  const dailyOverride = getDailyCalorieOverrideForDate(date, settings);

  if (dailyOverride != null && dailyOverride > 0) {
    return dailyOverride;
  }

  return baseCalories != null && baseCalories > 0 ? baseCalories : null;
};

export const buildEffectiveCalorieTargetsForDates = ({
  dates,
  baseCalories,
  settings,
}: {
  dates: Date[];
  baseCalories: number | null | undefined;
  settings: CalorieOverrideSettings | null | undefined;
}): Array<number | null> =>
  dates.map((date) =>
    getEffectiveCalorieTargetForDate({ date, baseCalories, settings }),
  );

export const getWeeklyCalorieBudget = ({
  dates,
  baseCalories,
  settings,
}: {
  dates: Date[];
  baseCalories: number | null | undefined;
  settings: CalorieOverrideSettings | null | undefined;
}): number | null => {
  const targets = buildEffectiveCalorieTargetsForDates({
    dates,
    baseCalories,
    settings,
  });

  if (!targets.some((target) => target != null && target > 0)) {
    return null;
  }

  return targets.reduce<number>((sum, target) => sum + (target ?? 0), 0);
};

export const scaleMacroTargetsToCalories = (
  user: DBUser,
  nextCalories: number,
): Pick<DBUser, "proteinG" | "carbsG" | "fatG"> => {
  const proteinG = user.proteinG ?? 0;
  const carbsG = user.carbsG ?? 0;
  const fatG = user.fatG ?? 0;
  const totalMacroCalories = proteinG * 4 + carbsG * 4 + fatG * 9;

  if (!Number.isFinite(totalMacroCalories) || totalMacroCalories <= 0) {
    return {
      proteinG: user.proteinG ?? null,
      carbsG: user.carbsG ?? null,
      fatG: user.fatG ?? null,
    };
  }

  const scale = nextCalories / totalMacroCalories;

  return {
    proteinG: Math.max(0, Math.round(proteinG * scale)),
    carbsG: Math.max(0, Math.round(carbsG * scale)),
    fatG: Math.max(0, Math.round(fatG * scale)),
  };
};

export const buildMacroTargetsForCalories = ({
  calories,
  proteinFocus,
  weightKg,
}: {
  calories: number;
  proteinFocus?: ProteinFocus | null;
  weightKg: number;
}): Pick<DBUser, "proteinG" | "carbsG" | "fatG"> | null => {
  if (!Number.isFinite(calories) || calories <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const nextMacros = buildMacroTargets({
    calories,
    proteinFocus,
    weightKg,
  });

  return {
    proteinG: nextMacros.protein,
    carbsG: nextMacros.carbs,
    fatG: nextMacros.fats,
  };
};

export const buildAutomaticFuelPlanForUser = ({
  user,
  weightKg,
}: {
  user: DBUser;
  weightKg: number;
}): FuelPlan | null => {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    user.birthdate == null ||
    user.heightCm == null ||
    user.activityLevel == null ||
    user.goal == null ||
    !isFuelPlanSex(user.gender) ||
    !isActivityLevel(user.activityLevel) ||
    !isGoalType(user.goal)
  ) {
    return null;
  }

  const age = getAgeFromBirthdateValue(user.birthdate);
  if (age == null || age <= 0) {
    return null;
  }

  return buildFuelPlan({
    weightKg,
    heightCm: user.heightCm,
    age,
    sex: user.gender,
    activity: user.activityLevel,
    goal: user.goal,
    proteinFocus: user.proteinFocus,
  });
};
