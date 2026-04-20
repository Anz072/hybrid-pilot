import {
  ActivityLevel,
  FuelPlan,
  GoalType,
  ProteinFocus,
} from "../../navigation/onboardingTypes";
import {
  PROTEIN_FOCUS_MULTIPLIER,
  resolveProteinFocus,
} from "../../engine/proteinFocus";

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

export const buildMacroTargets = ({
  calories,
  proteinFocus,
  weightKg,
}: {
  calories: number;
  proteinFocus?: ProteinFocus | null;
  weightKg: number;
}): Pick<FuelPlan, "protein" | "carbs" | "fats"> => {
  const protein = Math.min(
    Math.round(
      weightKg * PROTEIN_FOCUS_MULTIPLIER[resolveProteinFocus(proteinFocus)],
    ),
    Math.floor(calories / 4),
  );
  const remainingCaloriesAfterProtein = Math.max(0, calories - protein * 4);
  const fats = Math.round(
    Math.min(calories * 0.28, remainingCaloriesAfterProtein) / 9,
  );
  const carbs = Math.max(
    0,
    Math.round((calories - protein * 4 - fats * 9) / 4),
  );

  return { protein, carbs, fats };
};

export const buildFuelPlan = ({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal,
  goalRateKgPerWeek,
  proteinFocus,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male" | "other";
  activity: ActivityLevel;
  goal: GoalType;
  goalRateKgPerWeek?: number | null;
  proteinFocus?: ProteinFocus | null;
}): FuelPlan => {
  const sexBase = sex === "female" ? -161 : sex === "male" ? 5 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexBase;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const calories = Math.max(
    1200,
    Math.round(tdee + resolveGoalOffset(goal, goalRateKgPerWeek)),
  );
  const { protein, carbs, fats } = buildMacroTargets({
    calories,
    proteinFocus,
    weightKg,
  });

  return { calories, protein, carbs, fats };
};
