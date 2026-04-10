import type {
  ActivityLevel,
  GoalType,
  TrainingType,
} from "../../navigation/onboardingTypes";

export const GOAL_OPTIONS: Array<{
  description: string;
  label: string;
  value: GoalType;
}> = [
  {
    label: "Lose weight",
    value: "lose_fat",
    description: "Creates a calorie deficit to drive steady weight loss.",
  },
  {
    label: "Maintain",
    value: "maintain",
    description: "Keeps calories close to maintenance for stable body weight.",
  },
  {
    label: "Gain weight",
    value: "build_muscle",
    description: "Adds a calorie surplus to support upward scale progress.",
  },
];

export const ACTIVITY_LEVEL_OPTIONS: Array<{
  description: string;
  label: string;
  value: ActivityLevel;
}> = [
  {
    label: "Desk mode",
    value: "sedentary",
    description: "Mostly seated with very little non-exercise movement.",
  },
  {
    label: "Light movement",
    value: "lightly_active",
    description: "You move through the day and get in some casual activity.",
  },
  {
    label: "Regular training",
    value: "moderately_active",
    description: "Frequent workouts and a fairly active routine.",
  },
  {
    label: "High output",
    value: "very_active",
    description: "Demanding days with heavy training volume.",
  },
  {
    label: "Beast mode",
    value: "athlete",
    description: "Performance-first workload with consistently high output.",
  },
];

export const TRAINING_TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: TrainingType;
}> = [
  {
    label: "Running",
    value: "running",
    description: "Useful for endurance-heavy weeks and higher carb demand.",
  },
  {
    label: "Cycling",
    value: "cycling",
    description: "Helpful when ride volume changes fueling needs fast.",
  },
  {
    label: "Gym / Bodybuilding",
    value: "bodybuilding",
    description: "Good for strength, muscle gain, and recovery-focused plans.",
  },
  {
    label: "CrossFit",
    value: "crossfit",
    description: "Useful when training blends lifting and conditioning.",
  },
  {
    label: "Other",
    value: "other",
    description: "Pick this for anything outside the main training buckets.",
  },
];

export const formatActivityLevelLabel = (
  value: string | null | undefined,
): string => {
  if (!value) {
    return "Not set";
  }

  const match = ACTIVITY_LEVEL_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
};

export const formatGoalLabel = (value: string | null | undefined): string => {
  if (!value) {
    return "Not set";
  }

  const match = GOAL_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
};

export const formatTrainingTypeLabel = (value: string): string => {
  const match = TRAINING_TYPE_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
};

export const formatTrainingSummary = (
  values: string[] | null | undefined,
): string => {
  if (!values || values.length === 0) {
    return "Not set";
  }

  return values.map(formatTrainingTypeLabel).join(", ");
};
