import type {
  ActivityLevel,
  BodyData,
  FuelPlan,
  GoalStrategy,
  GoalType,
  ProteinFocus,
  TrainingSelection,
} from "../navigation/onboardingTypes";
import { getDb, initDb } from "./sqlite";

const KEY_ONBOARDING_COMPLETE = "onboardingComplete";
const KEY_LOCAL_ACCOUNT = "localAccount";
const KEY_ONBOARDING_PROFILE = "onboardingProfile";
const KEY_FOOD_SEARCH_SECTION_STATE = "foodSearchSectionState";
const KEY_FOOD_TRACKING_PREFERENCES = "foodTrackingPreferences";
const KEY_ADAPTIVE_RECOMMENDATION_SEEN = "adaptiveRecommendationSeen";
const KEY_SHORTCUT_RECENTS = "shortcutRecents";
const KEY_FOOD_RECENT_SEARCHES = "foodRecentSearches";

export type AuthProvider = "local" | "email";

export type OnboardingProfile = {
  goal: GoalType;
  goalStrategy: GoalStrategy;
  bodyData: BodyData;
  activity: ActivityLevel;
  training: TrainingSelection;
  proteinFocus: ProteinFocus;
  fuelPlan: FuelPlan;
};

export type FoodSearchSectionState = {
  favoritesExpanded: boolean;
  recentExpanded: boolean;
};

export type FoodTrackingPreferences = {
  fastLogEnabled: boolean;
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

const DEFAULT_FOOD_SEARCH_SECTION_STATE: FoodSearchSectionState = {
  favoritesExpanded: true,
  recentExpanded: true,
};

const DEFAULT_FOOD_TRACKING_PREFERENCES: FoodTrackingPreferences = {
  fastLogEnabled: false,
};

const getAdaptiveRecommendationSeenKey = (userExternalId: string) =>
  `${KEY_ADAPTIVE_RECOMMENDATION_SEEN}:${userExternalId}`;

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

const removeKv = async (key: string): Promise<void> => {
  await initDb();
  const db = await getDb();

  await db.runAsync(`DELETE FROM app_kv WHERE key = ?`, key);
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

export const clearLocalAccount = async (): Promise<void> => {
  await removeKv(KEY_LOCAL_ACCOUNT);
};

export const saveOnboardingProfile = async (profile: OnboardingProfile): Promise<void> => {
  await setKv(KEY_ONBOARDING_PROFILE, JSON.stringify(profile));
};

export const getOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
  const value = await getKv(KEY_ONBOARDING_PROFILE);
  return safeParse<OnboardingProfile>(value);
};

export const saveFoodSearchSectionState = async (
  state: FoodSearchSectionState,
): Promise<void> => {
  await setKv(KEY_FOOD_SEARCH_SECTION_STATE, JSON.stringify(state));
};

export const getFoodSearchSectionState = async (): Promise<FoodSearchSectionState> => {
  const value = await getKv(KEY_FOOD_SEARCH_SECTION_STATE);
  const parsed = safeParse<Partial<FoodSearchSectionState>>(value);

  return {
    ...DEFAULT_FOOD_SEARCH_SECTION_STATE,
    ...(parsed ?? {}),
  };
};

export const saveFoodTrackingPreferences = async (
  preferences: FoodTrackingPreferences,
): Promise<void> => {
  await setKv(KEY_FOOD_TRACKING_PREFERENCES, JSON.stringify(preferences));
};

export const getFoodTrackingPreferences = async (): Promise<FoodTrackingPreferences> => {
  const value = await getKv(KEY_FOOD_TRACKING_PREFERENCES);
  const parsed = safeParse<Partial<FoodTrackingPreferences>>(value);

  return {
    ...DEFAULT_FOOD_TRACKING_PREFERENCES,
    ...(parsed ?? {}),
  };
};

export const saveShortcutRecents = async (
  shortcuts: string[],
): Promise<void> => {
  await setKv(KEY_SHORTCUT_RECENTS, JSON.stringify(shortcuts.slice(0, 2)));
};

export const getShortcutRecents = async (): Promise<string[]> => {
  const value = await getKv(KEY_SHORTCUT_RECENTS);
  const parsed = safeParse<string[]>(value);

  return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
};

export const saveFoodRecentSearches = async (
  searches: string[],
): Promise<void> => {
  const normalized = searches
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

  await setKv(KEY_FOOD_RECENT_SEARCHES, JSON.stringify(normalized));
};

export const getFoodRecentSearches = async (): Promise<string[]> => {
  const value = await getKv(KEY_FOOD_RECENT_SEARCHES);
  const parsed = safeParse<string[]>(value);

  return Array.isArray(parsed)
    ? parsed.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
};

export const markAdaptiveRecommendationSeen = async (
  userExternalId: string,
  recommendationId: number,
): Promise<void> => {
  await setKv(
    getAdaptiveRecommendationSeenKey(userExternalId),
    String(recommendationId),
  );
};

export const getLastSeenAdaptiveRecommendationId = async (
  userExternalId: string,
): Promise<number | null> => {
  const value = await getKv(getAdaptiveRecommendationSeenKey(userExternalId));
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) ? parsed : null;
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
