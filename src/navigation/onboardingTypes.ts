export type GoalType = "lose_fat" | "maintain" | "build_muscle";

export type BodyData = {
  age: number;
  sex: "female" | "male" | "other";
  heightCm: number;
  weightKg: number;
};

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "athlete";

export type TrainingType =
  | "running"
  | "bodybuilding"
  | "crossfit"
  | "cycling"
  | "other";

export type FuelPlan = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type OnboardingProfile = {
  goal: GoalType;
  bodyData: BodyData;
  activity: ActivityLevel;
  training: TrainingType;
  fuelPlan: FuelPlan;
};

export type OnboardingParamList = {
  Welcome: undefined;
  Goal: undefined;
  BodyData: { goal: GoalType };
  Activity: { goal: GoalType; bodyData: BodyData };
  Training: { goal: GoalType; bodyData: BodyData; activity: ActivityLevel };
  FuelPlan: {
    goal: GoalType;
    bodyData: BodyData;
    activity: ActivityLevel;
    training: TrainingType;
  };
  Account: { onboarding: OnboardingProfile };
  Success: { onboarding: OnboardingProfile };
};
