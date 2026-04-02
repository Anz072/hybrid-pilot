import type { ActivityLevel, BodyData, FuelPlan, GoalType, TrainingType } from "../navigation/onboardingTypes";
import { getDb, initDb } from "./sqlite";

const KEY_ONBOARDING_COMPLETE = "onboardingComplete";
const KEY_LOCAL_ACCOUNT = "localAccount";
const KEY_ONBOARDING_PROFILE = "onboardingProfile";

export type AuthProvider = "local";

export type OnboardingProfile = {
  goal: GoalType;
  bodyData: BodyData;
  activity: ActivityLevel;
  training: TrainingType;
  fuelPlan: FuelPlan;
};

export type LocalAccount = {
  id: string;
  provider: AuthProvider;
  displayName: string;
  email: string | null;
  birthdate: string | null;
  createdAt: string;
};

export type BuildLocalAccountInput = {
  displayName: string;
  email?: string | null;
  birthdate?: string | null;
};

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const setKv = async (key: string, value: string): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(
    `
    INSERT INTO app_kv (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    key,
    value,
  );
};

const getKv = async (key: string): Promise<string | null> => {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_kv WHERE key = ? LIMIT 1`,
    key,
  );

  return row?.value ?? null;
};

export const setOnboardingComplete = async (value: boolean): Promise<void> => {
  await setKv(KEY_ONBOARDING_COMPLETE, JSON.stringify(value));
};

export const getOnboardingComplete = async (): Promise<boolean> => {
  const value = await getKv(KEY_ONBOARDING_COMPLETE);
  return value ? JSON.parse(value) === true : false;
};

export const saveLocalAccount = async (account: LocalAccount): Promise<void> => {
  await setKv(KEY_LOCAL_ACCOUNT, JSON.stringify(account));
};

export const getLocalAccount = async (): Promise<LocalAccount | null> => {
  const value = await getKv(KEY_LOCAL_ACCOUNT);
  return safeParse<LocalAccount>(value);
};

export const saveOnboardingProfile = async (profile: OnboardingProfile): Promise<void> => {
  await setKv(KEY_ONBOARDING_PROFILE, JSON.stringify(profile));
};

export const getOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
  const value = await getKv(KEY_ONBOARDING_PROFILE);
  return safeParse<OnboardingProfile>(value);
};

export const buildLocalAccount = (input: BuildLocalAccountInput): LocalAccount => {
  const timestamp = Date.now();

  return {
    id: `local-${timestamp}`,
    provider: "local",
    displayName: input.displayName,
    email: input.email ?? null,
    birthdate: input.birthdate ?? null,
    createdAt: new Date(timestamp).toISOString(),
  };
};
