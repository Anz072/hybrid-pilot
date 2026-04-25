import type {
  ActivityLevel,
  BodyData,
  GoalStrategy,
  GoalType,
  ProteinFocus,
  TrainingSelection,
  TrainingType,
} from "../../navigation/onboardingTypes";
import { formatGoalStrategyLabel } from "../../engine/goalStrategy";
import { formatProteinFocusSummary as formatProteinFocusSummaryFromEngine } from "../../engine/proteinFocus";

const GOAL_LABELS: Record<GoalType, string> = {
  lose_fat: "Lose fat",
  maintain: "Maintain",
  build_muscle: "Build muscle",
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Desk mode",
  lightly_active: "Light movement",
  moderately_active: "Regular training",
  very_active: "High output",
  athlete: "Beast mode",
};

const TRAINING_LABELS: Record<TrainingType, string> = {
  running: "Running",
  cycling: "Cycling",
  bodybuilding: "Gym / Bodybuilding",
  crossfit: "CrossFit",
  other: "Other",
};

export const formatGoalSummary = (
  goal: GoalType,
  goalStrategy: GoalStrategy,
): string => {
  const pace = formatGoalStrategyLabel(goalStrategy);
  return pace ? `${GOAL_LABELS[goal]} / ${pace}` : GOAL_LABELS[goal];
};

export const formatActivitySummary = (activity: ActivityLevel): string =>
  ACTIVITY_LABELS[activity];

export const formatTrainingSummary = (training: TrainingSelection): string =>
  training.length > 0
    ? training.map((item) => TRAINING_LABELS[item]).join(", ")
    : "None selected";

export const formatProteinFocusSummary = (proteinFocus: ProteinFocus): string =>
  formatProteinFocusSummaryFromEngine(proteinFocus);

export const formatBodySummary = (bodyData: BodyData): string =>
  `${bodyData.birthdate.slice(0, 10)} / ${bodyData.heightCm} cm / ${bodyData.weightKg} kg`;
