import type {
  ActivityLevel,
  BodyData,
  GoalType,
  TrainingSelection,
  TrainingType,
} from "../../navigation/onboardingTypes";
import { getGoalRateLabel } from "./initialCalculations";

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
  goalRateKgPerWeek: number | null,
): string => {
  const pace = getGoalRateLabel(goal, goalRateKgPerWeek);
  return pace ? `${GOAL_LABELS[goal]} / ${pace}` : GOAL_LABELS[goal];
};

export const formatActivitySummary = (activity: ActivityLevel): string =>
  ACTIVITY_LABELS[activity];

export const formatTrainingSummary = (training: TrainingSelection): string =>
  training.length > 0
    ? training.map((item) => TRAINING_LABELS[item]).join(", ")
    : "None selected";

export const formatBodySummary = (bodyData: BodyData): string =>
  `${bodyData.age}y / ${bodyData.heightCm} cm / ${bodyData.weightKg} kg`;
