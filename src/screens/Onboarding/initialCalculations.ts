import {
  ActivityLevel,
  FuelPlan,
  GoalStrategy,
  GoalType,
  ProteinFocus,
} from "../../navigation/onboardingTypes";
import {
  getGoalCalorieOffset,
  getGoalStrategyRateLabel,
} from "../../engine/goalStrategy";
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

export const getGoalStrategyLabel = (
  goal: GoalType,
  goalStrategy: GoalStrategy,
): string | null => {
  return getGoalStrategyRateLabel(goal, goalStrategy);
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
  goalStrategy,
  proteinFocus,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male" | "other";
  activity: ActivityLevel;
  goal: GoalType;
  goalStrategy: GoalStrategy;
  proteinFocus?: ProteinFocus | null;
}): FuelPlan => {
  const sexBase = sex === "female" ? -161 : sex === "male" ? 5 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexBase;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const calories = Math.max(
    1200,
    Math.round(tdee + getGoalCalorieOffset(goal, goalStrategy)),
  );
  const { protein, carbs, fats } = buildMacroTargets({
    calories,
    proteinFocus,
    weightKg,
  });

  return { calories, protein, carbs, fats };
};
