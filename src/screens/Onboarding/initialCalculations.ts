import {
  ActivityLevel,
  FuelPlan,
  GoalType,
} from "../../navigation/onboardingTypes";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.35,
  moderately_active: 1.5,
  very_active: 1.7,
  athlete: 1.9,
};

const DEFAULT_GOAL_OFFSET: Record<GoalType, number> = {
  lose_fat: -350,
  maintain: 0,
  build_muscle: 250,
};

const LOSS_RATE_TO_OFFSET: Record<number, number> = {
  0.25: -275,
  0.5: -550,
  0.75: -800,
};

const GAIN_RATE_TO_OFFSET: Record<number, number> = {
  0.1: 150,
  0.2: 250,
  0.3: 350,
};

export const formatGoalRateKg = (goalRateKgPerWeek: number): string =>
  Number(goalRateKgPerWeek.toFixed(2)).toString();

export const getGoalRateLabel = (
  goal: GoalType,
  goalRateKgPerWeek: number | null,
): string | null => {
  if (goal === "maintain" || goalRateKgPerWeek == null) {
    return null;
  }

  return `${goal === "lose_fat" ? "Lose" : "Gain"} ${formatGoalRateKg(goalRateKgPerWeek)} kg/week`;
};

const resolveGoalOffset = (
  goal: GoalType,
  goalRateKgPerWeek: number | null | undefined,
): number => {
  if (goal === "lose_fat" && goalRateKgPerWeek != null) {
    return LOSS_RATE_TO_OFFSET[goalRateKgPerWeek] ?? DEFAULT_GOAL_OFFSET[goal];
  }

  if (goal === "build_muscle" && goalRateKgPerWeek != null) {
    return GAIN_RATE_TO_OFFSET[goalRateKgPerWeek] ?? DEFAULT_GOAL_OFFSET[goal];
  }

  return DEFAULT_GOAL_OFFSET[goal];
};

export const buildFuelPlan = ({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal,
  goalRateKgPerWeek,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male" | "other";
  activity: ActivityLevel;
  goal: GoalType;
  goalRateKgPerWeek?: number | null;
}): FuelPlan => {
  const sexBase = sex === "female" ? -161 : sex === "male" ? 5 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexBase;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const calories = Math.max(
    1200,
    Math.round(tdee + resolveGoalOffset(goal, goalRateKgPerWeek)),
  );

  const protein = Math.round(weightKg * 2);
  const fats = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

  return { calories, protein, carbs, fats };
};
