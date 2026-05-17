import { isRunningInExpoGo } from "expo";
import {
  getLocalAccount,
  saveLocalAccount,
  setOnboardingComplete,
  type LocalAccount,
} from "../storage/localStore";
import type { DBUser } from "../store/DB_TYPES";
import {
  getUserByExternalId as getLocalUserByExternalId,
  upsertUser as upsertLocalUser,
} from "../store/userRepository";

export const EXPO_GO_DEV_USER_ID = "expo-go-dev-user";
export const EXPO_GO_DEV_EMAIL = "expo-go-dev@dribsnis.local";
export const EXPO_GO_DEV_DISPLAY_NAME = "Expo Go Dev";

export const isExpoGoDevAuthEnabled = () => {
  try {
    return __DEV__ && isRunningInExpoGo();
  } catch {
    return false;
  }
};

export const isExpoGoDevUserId = (
  userExternalId?: string | null,
): boolean =>
  isExpoGoDevAuthEnabled() && userExternalId === EXPO_GO_DEV_USER_ID;

export const shouldUseExpoGoDevLocalStore = async (
  userExternalId?: string | null,
): Promise<boolean> => {
  if (!isExpoGoDevAuthEnabled()) {
    return false;
  }

  if (userExternalId != null) {
    return userExternalId === EXPO_GO_DEV_USER_ID;
  }

  const account = await getLocalAccount();
  return account?.id === EXPO_GO_DEV_USER_ID;
};

export const buildExpoGoDevAccount = (
  input: Partial<Pick<LocalAccount, "birthdate" | "displayName">> = {},
): LocalAccount => ({
  id: EXPO_GO_DEV_USER_ID,
  provider: "local",
  displayName: input.displayName?.trim() || EXPO_GO_DEV_DISPLAY_NAME,
  email: EXPO_GO_DEV_EMAIL,
  birthdate: input.birthdate ?? null,
  createdAt: new Date().toISOString(),
});

export const buildExpoGoDevUser = (
  input: Partial<DBUser> = {},
): DBUser => ({
  id: 0,
  externalId: EXPO_GO_DEV_USER_ID,
  provider: "local",
  displayName: EXPO_GO_DEV_DISPLAY_NAME,
  createdAt: new Date().toISOString(),
  email: EXPO_GO_DEV_EMAIL,
  birthdate: null,
  gender: null,
  heightCm: null,
  activityLevel: "moderate",
  goal: "maintain",
  goalStrategy: "maintain",
  trainingTypes: null,
  proteinFocus: "focused",
  calorieAllowance: 2200,
  proteinG: 150,
  carbsG: 240,
  fatG: 70,
  ...input,
});

export const signInWithExpoGoDevBypass = async (): Promise<DBUser> => {
  if (!isExpoGoDevAuthEnabled()) {
    throw new Error("Expo Go dev bypass is only available in Expo Go dev mode.");
  }

  const existingUser = await getLocalUserByExternalId(EXPO_GO_DEV_USER_ID);
  const account = buildExpoGoDevAccount({
    birthdate: existingUser?.birthdate,
    displayName: existingUser?.displayName ?? undefined,
  });

  await saveLocalAccount(account);
  await setOnboardingComplete(true);

  if (existingUser) {
    return existingUser;
  }

  const user = buildExpoGoDevUser({
    displayName: account.displayName,
    email: account.email,
    birthdate: account.birthdate,
    createdAt: account.createdAt,
  });

  await upsertLocalUser(user);

  return (await getLocalUserByExternalId(EXPO_GO_DEV_USER_ID)) ?? user;
};
