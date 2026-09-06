import type {
  ActivityLevel,
  GoalType,
  ProteinFocus,
  TrainingType,
} from "../../navigation/onboardingTypes";
import { formatGoalStrategyLabel as formatGoalStrategyLabelFromEngine } from "../../engine/goalStrategy";
import { formatProteinFocusLabel as formatProteinFocusLabelFromEngine } from "../../engine/proteinFocus";

export const GOAL_OPTIONS: Array<{
  description: string;
  label: string;
  value: GoalType;
}> = [
  {
    label: "Lose fat",
    value: "lose_fat",
    description: "",
  },
  {
    label: "Maintain",
    value: "maintain",
    description: "",
  },
  {
    label: "Build muscle",
    value: "build_muscle",
    description: "",
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
    description: "Mostly seated, minimal movement.",
  },
  {
    label: "Light movement",
    value: "lightly_active",
    description: "Daily steps with occasional activity.",
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
    label: "Athlete load",
    value: "athlete",
    description: "High training volume most days.",
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

export const formatGoalStrategyLabel = (
  value: string | null | undefined,
): string => formatGoalStrategyLabelFromEngine(value);

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

export const formatProteinFocusLabel = (
  value: ProteinFocus | string | null | undefined,
): string => formatProteinFocusLabelFromEngine(value);
