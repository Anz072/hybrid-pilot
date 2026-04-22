import {
  buildAutomaticFuelPlanForUser,
  buildMacroTargetsForCalories,
  scaleMacroTargetsToCalories,
} from "../../engine/calorieTargets";
import type { ProteinFocus } from "../../navigation/onboardingTypes";
import { DB } from "../../store/DB";
import type { AppDispatch } from "../../store/appStore";
import type { DBUser } from "../../store/DB_TYPES";
import { setCurrentUser } from "../../store/userSlice";
import { supersedeOpenAdaptiveRecommendationForUser } from "./adaptiveCaloriesActions";

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
  const latestWeightKg = await getLatestUserWeightKg(user.externalId);
  const nextMacros =
    latestWeightKg != null
      ? buildMacroTargetsForCalories({
          calories,
          proteinFocus: user.proteinFocus,
          weightKg: latestWeightKg,
        }) ?? scaleMacroTargetsToCalories(user, calories)
      : scaleMacroTargetsToCalories(user, calories);

  const savedUser = await saveUserProfileChanges({
    dispatch,
    user,
    patch: {
      calorieAllowance: calories,
      ...nextMacros,
    },
  });

  await supersedeOpenAdaptiveRecommendationForUser(user.externalId);
  await DB.saveUserSettings({
    userExternalId: user.externalId,
    adaptiveLastCalculatedAt: new Date().toISOString(),
  });

  return savedUser;
};

export const saveProteinFocusForUser = async ({
  dispatch,
  proteinFocus,
  user,
}: {
  dispatch: AppDispatch;
  proteinFocus: ProteinFocus;
  user: DBUser;
}): Promise<DBUser> => {
  const latestWeightKg = await getLatestUserWeightKg(user.externalId);

  if (
    latestWeightKg != null &&
    user.calorieAllowance != null &&
    user.calorieAllowance > 0
  ) {
    const nextMacros = buildMacroTargetsForCalories({
      calories: user.calorieAllowance,
      proteinFocus,
      weightKg: latestWeightKg,
    });

    return saveUserProfileChanges({
      dispatch,
      user,
      patch: {
        proteinFocus,
        proteinG: nextMacros?.proteinG ?? user.proteinG,
        carbsG: nextMacros?.carbsG ?? user.carbsG,
        fatG: nextMacros?.fatG ?? user.fatG,
      },
    });
  }

  return saveUserProfileChanges({
    dispatch,
    user,
    patch: {
      proteinFocus,
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

  const savedUser = await saveUserProfileChanges({
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

  await supersedeOpenAdaptiveRecommendationForUser(user.externalId);
  await DB.saveUserSettings({
    userExternalId: user.externalId,
    adaptiveLastCalculatedAt: new Date().toISOString(),
  });

  return savedUser;
};
