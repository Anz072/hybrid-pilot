import {
  buildAutomaticFuelPlanForUser,
  scaleMacroTargetsToCalories,
} from "../../engine/calorieTargets";
import { DB } from "../../store/DB";
import type { AppDispatch } from "../../store/appStore";
import type { DBUser } from "../../store/DB_TYPES";
import { setCurrentUser } from "../../store/userSlice";

export const saveUserProfileChanges = async ({
  dispatch,
  patch,
  user,
}: {
  dispatch: AppDispatch;
  patch: Partial<DBUser>;
  user: DBUser;
}): Promise<DBUser> => {
  const nextUser: DBUser = {
    ...user,
    ...patch,
  };

  await DB.addUser(nextUser);
  const savedUser = await DB.getUser();
  const resolvedUser = savedUser ?? nextUser;
  dispatch(setCurrentUser(resolvedUser));
  return resolvedUser;
};

export const getLatestUserWeightKg = async (
  userExternalId: string,
): Promise<number | null> => {
  const entries = await DB.listWeightEntries(userExternalId, { limit: 1 });
  return entries[0]?.valueKg ?? null;
};

export const buildAutomaticFuelPlanSnapshot = async (
  user: DBUser,
): Promise<{
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
} | null> => {
  const weightKg = await getLatestUserWeightKg(user.externalId);
  if (weightKg == null) {
    return null;
  }

  const plan = buildAutomaticFuelPlanForUser({
    user,
    weightKg,
  });

  if (!plan) {
    return null;
  }

  return {
    calories: plan.calories,
    proteinG: plan.protein,
    carbsG: plan.carbs,
    fatG: plan.fats,
  };
};

export const saveManualCalorieTarget = async ({
  calories,
  dispatch,
  user,
}: {
  calories: number;
  dispatch: AppDispatch;
  user: DBUser;
}): Promise<DBUser> => {
  const nextMacros = scaleMacroTargetsToCalories(user, calories);

  return saveUserProfileChanges({
    dispatch,
    user,
    patch: {
      calorieAllowance: calories,
      ...nextMacros,
    },
  });
};

export const saveAutomaticFuelPlanForUser = async ({
  activityLevel,
  dispatch,
  goal,
  user,
}: {
  activityLevel?: DBUser["activityLevel"];
  dispatch: AppDispatch;
  goal?: DBUser["goal"];
  user: DBUser;
}): Promise<DBUser | null> => {
  const nextUser = {
    ...user,
    activityLevel: activityLevel ?? user.activityLevel,
    goal: goal ?? user.goal,
  };
  const weightKg = await getLatestUserWeightKg(user.externalId);

  if (weightKg == null) {
    return null;
  }

  const plan = buildAutomaticFuelPlanForUser({
    user: nextUser,
    weightKg,
  });

  if (!plan) {
    return null;
  }

  return saveUserProfileChanges({
    dispatch,
    user,
    patch: {
      activityLevel: nextUser.activityLevel,
      goal: nextUser.goal,
      calorieAllowance: plan.calories,
      proteinG: plan.protein,
      carbsG: plan.carbs,
      fatG: plan.fats,
    },
  });
};
