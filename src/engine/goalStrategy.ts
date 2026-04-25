import type {
  GoalStrategy,
  GoalType,
} from "../navigation/onboardingTypes";

export type GoalStrategyOption = {
  value: GoalStrategy;
  goal: GoalType;
  label: string;
  shortLabel: string;
  description: string;
  approxWeeklyRateKg: number | null;
  dailyCalorieDelta: number;
};

const GOAL_TYPES: GoalType[] = ["lose_fat", "maintain", "build_muscle"];

const GOAL_STRATEGY_OPTIONS: GoalStrategyOption[] = [
  {
    value: "deficit_light",
    goal: "lose_fat",
    label: "Light deficit",
    shortLabel: "Light",
    description: "About 0.25 kg/week. Easiest to recover from and great when performance matters.",
    approxWeeklyRateKg: 0.25,
    dailyCalorieDelta: -275,
  },
  {
    value: "deficit_normal",
    goal: "lose_fat",
    label: "Normal deficit",
    shortLabel: "Normal",
    description: "About 0.50 kg/week. Balanced pace and the best starting point for most people.",
    approxWeeklyRateKg: 0.5,
    dailyCalorieDelta: -550,
  },
  {
    value: "deficit_aggressive",
    goal: "lose_fat",
    label: "Aggressive deficit",
    shortLabel: "Aggressive",
    description: "About 0.75 kg/week. Faster loss, but hunger and recovery need closer attention.",
    approxWeeklyRateKg: 0.75,
    dailyCalorieDelta: -800,
  },
  {
    value: "maintain",
    goal: "maintain",
    label: "Maintain",
    shortLabel: "Maintain",
    description: "Keep calories around maintenance while body weight and performance stay steady.",
    approxWeeklyRateKg: null,
    dailyCalorieDelta: 0,
  },
  {
    value: "surplus_light",
    goal: "build_muscle",
    label: "Light surplus",
    shortLabel: "Light",
    description: "About 0.10 kg/week. Slower, leaner progress with minimal overshooting.",
    approxWeeklyRateKg: 0.1,
    dailyCalorieDelta: 150,
  },
  {
    value: "surplus_normal",
    goal: "build_muscle",
    label: "Normal surplus",
    shortLabel: "Normal",
    description: "About 0.20 kg/week. Balanced pace and the best starting point for most people.",
    approxWeeklyRateKg: 0.2,
    dailyCalorieDelta: 250,
  },
  {
    value: "surplus_aggressive",
    goal: "build_muscle",
    label: "Aggressive surplus",
    shortLabel: "Aggressive",
    description: "About 0.30 kg/week. Faster scale progress, but body-fat gain is more likely.",
    approxWeeklyRateKg: 0.3,
    dailyCalorieDelta: 350,
  },
];

const GOAL_STRATEGY_BY_VALUE = Object.fromEntries(
  GOAL_STRATEGY_OPTIONS.map((option) => [option.value, option]),
) as Record<GoalStrategy, GoalStrategyOption>;

const DEFAULT_GOAL_STRATEGY: Record<GoalType, GoalStrategy> = {
  lose_fat: "deficit_normal",
  maintain: "maintain",
  build_muscle: "surplus_normal",
};

export const isGoalType = (value: unknown): value is GoalType =>
  typeof value === "string" && GOAL_TYPES.includes(value as GoalType);

export const isGoalStrategy = (value: unknown): value is GoalStrategy =>
  typeof value === "string" &&
  value in GOAL_STRATEGY_BY_VALUE;

export const listGoalStrategyOptions = (): GoalStrategyOption[] =>
  GOAL_STRATEGY_OPTIONS;

export const listGoalStrategyOptionsForGoal = (
  goal: GoalType,
): GoalStrategyOption[] =>
  GOAL_STRATEGY_OPTIONS.filter((option) => option.goal === goal);

export const getGoalStrategyOption = (
  goalStrategy: GoalStrategy,
): GoalStrategyOption => GOAL_STRATEGY_BY_VALUE[goalStrategy];

export const getGoalTypeForStrategy = (
  goalStrategy: GoalStrategy,
): GoalType => getGoalStrategyOption(goalStrategy).goal;

export const getDefaultGoalStrategy = (goal: GoalType): GoalStrategy =>
  DEFAULT_GOAL_STRATEGY[goal];

export const resolveGoalType = (
  goal: GoalType | string | null | undefined,
  goalStrategy?: GoalStrategy | string | null,
): GoalType | null => {
  if (isGoalType(goal)) {
    return goal;
  }

  if (isGoalStrategy(goalStrategy)) {
    return getGoalTypeForStrategy(goalStrategy);
  }

  return null;
};

export const resolveGoalStrategy = (
  goal: GoalType | string | null | undefined,
  goalStrategy?: GoalStrategy | string | null,
): GoalStrategy | null => {
  if (!isGoalType(goal)) {
    return isGoalStrategy(goalStrategy) ? goalStrategy : null;
  }

  if (goal === "maintain") {
    return "maintain";
  }

  if (isGoalStrategy(goalStrategy)) {
    const option = getGoalStrategyOption(goalStrategy);
    if (option.goal === goal) {
      return goalStrategy;
    }
  }

  return getDefaultGoalStrategy(goal);
};

export const getGoalCalorieOffset = (
  goal: GoalType | string | null | undefined,
  goalStrategy?: GoalStrategy | string | null,
): number => {
  const resolved = resolveGoalStrategy(goal, goalStrategy);
  return resolved ? getGoalStrategyOption(resolved).dailyCalorieDelta : 0;
};

export const formatSignedCalories = (value: number): string =>
  `${value > 0 ? "+" : ""}${Math.round(value)} kcal/day`;

export const formatGoalStrategyLabel = (
  goalStrategy: GoalStrategy | string | null | undefined,
): string => {
  if (!isGoalStrategy(goalStrategy)) {
    return "Not set";
  }

  return getGoalStrategyOption(goalStrategy).label;
};

export const formatGoalStrategyMeta = (
  goal: GoalType | string | null | undefined,
  goalStrategy?: GoalStrategy | string | null,
): string => {
  const resolved = resolveGoalStrategy(goal, goalStrategy);
  if (!resolved) {
    return "Not set";
  }

  const option = getGoalStrategyOption(resolved);
  if (option.goal === "maintain") {
    return option.label;
  }

  return `${option.label} (${formatSignedCalories(option.dailyCalorieDelta)})`;
};

export const getGoalStrategyRateLabel = (
  goal: GoalType | string | null | undefined,
  goalStrategy?: GoalStrategy | string | null,
): string | null => {
  const resolved = resolveGoalStrategy(goal, goalStrategy);
  if (!resolved) {
    return null;
  }

  const option = getGoalStrategyOption(resolved);
  if (option.goal === "maintain" || option.approxWeeklyRateKg == null) {
    return "Maintain calories";
  }

  const paceLabel =
    option.goal === "lose_fat" ? "Lose" : "Gain";

  return `${option.label} (${paceLabel} ${option.approxWeeklyRateKg.toFixed(2)} kg/week)`;
};
