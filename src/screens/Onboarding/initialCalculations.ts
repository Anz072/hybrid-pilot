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

const GOAL_OFFSET: Record<GoalType, number> = {
  lose_fat: -350,
  maintain: 0,
  build_muscle: 250,
};

export const buildFuelPlan = ({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male" | "other";
  activity: ActivityLevel;
  goal: GoalType;
}): FuelPlan => {
  const sexBase = sex === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexBase;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const calories = Math.max(1200, Math.round(tdee + GOAL_OFFSET[goal]));

  const protein = Math.round(weightKg * 2);
  const fats = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

  return { calories, protein, carbs, fats };
};
