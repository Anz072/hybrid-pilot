import {
  buildFoodLoggedAt,
  formatFoodLoggedTime,
  formatFoodShortDate,
} from "./foodUtils";

export type FoodLogContextInput = {
  contextLabel?: string | null;
  date: string;
  loggedAt?: string | null;
  mealType?: string | null;
};

export type FoodLogContext = {
  contextLabel: string;
  date: string;
  dateLabel: string;
  loggedAt: string;
  mealType: string | null;
  subtitle: string;
  timeLabel: string;
};

export const resolveFoodLogContext = ({
  contextLabel,
  date,
  loggedAt,
  mealType,
}: FoodLogContextInput): FoodLogContext => {
  const now = new Date();
  const resolvedLoggedAt =
    loggedAt ?? buildFoodLoggedAt(date, now.getHours(), now.getMinutes());
  const timeLabel = formatFoodLoggedTime(resolvedLoggedAt);
  const resolvedContextLabel = contextLabel?.trim() || timeLabel;
  const dateLabel = formatFoodShortDate(date);
  const resolvedMealType = mealType?.trim() || null;

  return {
    contextLabel: resolvedContextLabel,
    date,
    dateLabel,
    loggedAt: resolvedLoggedAt,
    mealType: resolvedMealType,
    subtitle: resolvedMealType
      ? `${dateLabel} | ${resolvedContextLabel} | ${resolvedMealType}`
      : `${dateLabel} | ${resolvedContextLabel}`,
    timeLabel,
  };
};

export const toFoodLogRouteParams = (context: FoodLogContext) => ({
  contextLabel: context.contextLabel,
  date: context.date,
  loggedAt: context.loggedAt,
  mealType: context.mealType,
});
