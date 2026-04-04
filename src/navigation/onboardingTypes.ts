export type GoalType = "lose_fat" | "maintain" | "build_muscle";

export type GoalRatePace = number | null;

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

export type TrainingSelection = TrainingType[];

export type FuelPlan = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type OnboardingProfile = {
  goal: GoalType;
  goalRateKgPerWeek: GoalRatePace;
  bodyData: BodyData;
  activity: ActivityLevel;
  training: TrainingSelection;
  fuelPlan: FuelPlan;
};

export type OnboardingParamList = {
  Welcome: undefined;
  Goal: undefined;
  GoalRate: { goal: GoalType };
  BodyData: { goal: GoalType; goalRateKgPerWeek: GoalRatePace };
  Activity: {
    goal: GoalType;
    goalRateKgPerWeek: GoalRatePace;
    bodyData: BodyData;
  };
  Training: {
    goal: GoalType;
    goalRateKgPerWeek: GoalRatePace;
    bodyData: BodyData;
    activity: ActivityLevel;
    training?: TrainingSelection;
  };
  FuelPlan: {
    goal: GoalType;
    goalRateKgPerWeek: GoalRatePace;
    bodyData: BodyData;
    activity: ActivityLevel;
    training: TrainingSelection;
  };
  Account: { onboarding: OnboardingProfile };
  Success: { onboarding: OnboardingProfile };
};
