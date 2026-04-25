export type GoalType = "lose_fat" | "maintain" | "build_muscle";

export type GoalStrategy =
  | "deficit_light"
  | "deficit_normal"
  | "deficit_aggressive"
  | "maintain"
  | "surplus_light"
  | "surplus_normal"
  | "surplus_aggressive";

export type BodyData = {
  birthdate: string;
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

export type ProteinFocus = "mild" | "moderate" | "focused" | "heavy";

export type FuelPlan = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type OnboardingProfile = {
  goal: GoalType;
  goalStrategy: GoalStrategy;
  bodyData: BodyData;
  activity: ActivityLevel;
  training: TrainingSelection;
  proteinFocus: ProteinFocus;
  fuelPlan: FuelPlan;
};

export type OnboardingParamList = {
  Welcome: undefined;
  Goal: undefined;
  Login: undefined;
  GoalRate: { goal: GoalType };
  BodyData: {
    goal: GoalType;
    goalStrategy: GoalStrategy;
    bodyData?: BodyData;
    training?: TrainingSelection;
    proteinFocus?: ProteinFocus;
  };
  Activity: {
    goal: GoalType;
    goalStrategy: GoalStrategy;
    bodyData: BodyData;
    training?: TrainingSelection;
    proteinFocus?: ProteinFocus;
  };
  Training: {
    goal: GoalType;
    goalStrategy: GoalStrategy;
    bodyData: BodyData;
    activity: ActivityLevel;
    training?: TrainingSelection;
    proteinFocus?: ProteinFocus;
  };
  ProteinFocus: {
    goal: GoalType;
    goalStrategy: GoalStrategy;
    bodyData: BodyData;
    activity: ActivityLevel;
    training: TrainingSelection;
    proteinFocus?: ProteinFocus;
  };
  FuelPlan: {
    goal: GoalType;
    goalStrategy: GoalStrategy;
    bodyData: BodyData;
    activity: ActivityLevel;
    training: TrainingSelection;
    proteinFocus: ProteinFocus;
  };
  Account: { onboarding: OnboardingProfile };
  Success: { onboarding: OnboardingProfile };
};
