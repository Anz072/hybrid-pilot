import type {
  ActivityLevel,
  BodyData,
  FuelPlan,
  GoalStrategy,
  GoalType,
  ProteinFocus,
  TrainingSelection,
} from "../navigation/onboardingTypes";
import { readJsonKv, readKv, writeJsonKv, writeKv } from "./kv";

// Local, non-domain state.
//
// What lives here has to earn it. Three things do:
//
//   * `onboardingComplete` — decides the first screen, before any session or
//     network call exists, so it cannot come from the server.
//   * `OnboardingProfile` — the answers collected *before* an account exists.
//     There is nowhere to send them until signup, so they are held on device and
//     posted with the profile.
//   * UI preferences — section expansion, fast-log, the last adaptive
//     recommendation the user saw. These describe this device's chrome, not the
//     user's nutrition data, and there is no server column for them.
//
// What used to live here and no longer does:
//
//   * `LocalAccount` — a device-local identity, written alongside the Supabase
//     session. Two records of who is signed in is one too many; the Supabase
//     session is the only answer.
//   * `shortcutRecents` and `foodRecentSearches` — see below: memory-only.

const KEY_ONBOARDING_COMPLETE = "onboardingComplete";
const KEY_ONBOARDING_PROFILE = "onboardingProfile";
const KEY_FOOD_SEARCH_SECTION_STATE = "foodSearchSectionState";
const KEY_FOOD_TRACKING_PREFERENCES = "foodTrackingPreferences";
const KEY_ADAPTIVE_RECOMMENDATION_SEEN = "adaptiveRecommendationSeen";

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

const DEFAULT_FOOD_SEARCH_SECTION_STATE: FoodSearchSectionState = {
  favoritesExpanded: true,
  recentExpanded: true,
};

const DEFAULT_FOOD_TRACKING_PREFERENCES: FoodTrackingPreferences = {
  fastLogEnabled: false,
};

const getAdaptiveRecommendationSeenKey = (userExternalId: string) =>
  `${KEY_ADAPTIVE_RECOMMENDATION_SEEN}:${userExternalId}`;

// --- Onboarding ------------------------------------------------------------

export const setOnboardingComplete = async (value: boolean): Promise<void> => {
  await writeJsonKv(KEY_ONBOARDING_COMPLETE, value);
};

export const getOnboardingComplete = async (): Promise<boolean> =>
  (await readJsonKv<boolean>(KEY_ONBOARDING_COMPLETE)) === true;

export const saveOnboardingProfile = async (
  profile: OnboardingProfile,
): Promise<void> => {
  await writeJsonKv(KEY_ONBOARDING_PROFILE, profile);
};

export const getOnboardingProfile = async (): Promise<OnboardingProfile | null> =>
  readJsonKv<OnboardingProfile>(KEY_ONBOARDING_PROFILE);

// --- UI preferences --------------------------------------------------------

export const saveFoodSearchSectionState = async (
  state: FoodSearchSectionState,
): Promise<void> => {
  await writeJsonKv(KEY_FOOD_SEARCH_SECTION_STATE, state);
};

export const getFoodSearchSectionState = async (): Promise<FoodSearchSectionState> => {
  const parsed = await readJsonKv<Partial<FoodSearchSectionState>>(
    KEY_FOOD_SEARCH_SECTION_STATE,
  );

  return { ...DEFAULT_FOOD_SEARCH_SECTION_STATE, ...(parsed ?? {}) };
};

export const saveFoodTrackingPreferences = async (
  preferences: FoodTrackingPreferences,
): Promise<void> => {
  await writeJsonKv(KEY_FOOD_TRACKING_PREFERENCES, preferences);
};

export const getFoodTrackingPreferences = async (): Promise<FoodTrackingPreferences> => {
  const parsed = await readJsonKv<Partial<FoodTrackingPreferences>>(
    KEY_FOOD_TRACKING_PREFERENCES,
  );

  return { ...DEFAULT_FOOD_TRACKING_PREFERENCES, ...(parsed ?? {}) };
};

export const markAdaptiveRecommendationSeen = async (
  userExternalId: string,
  recommendationId: number,
): Promise<void> => {
  await writeKv(
    getAdaptiveRecommendationSeenKey(userExternalId),
    String(recommendationId),
  );
};

export const getLastSeenAdaptiveRecommendationId = async (
  userExternalId: string,
): Promise<number | null> => {
  const value = await readKv(getAdaptiveRecommendationSeenKey(userExternalId));
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) ? parsed : null;
};

// --- Session-scoped hints --------------------------------------------------
//
// Recently used tab shortcuts and recent search terms. These were persisted,
// which made them the only two lists in the app whose contents outlived the
// process without the server ever knowing about them. They are hints about the
// current session, not data: the server has no column for them and does not
// need one, so they live in memory and are gone when the app is.

let shortcutRecents: string[] = [];
let foodRecentSearches: string[] = [];

export const saveShortcutRecents = async (shortcuts: string[]): Promise<void> => {
  shortcutRecents = shortcuts.slice(0, 2);
};

export const getShortcutRecents = async (): Promise<string[]> =>
  shortcutRecents.slice(0, 2);

export const saveFoodRecentSearches = async (searches: string[]): Promise<void> => {
  foodRecentSearches = searches
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
};

export const getFoodRecentSearches = async (): Promise<string[]> =>
  foodRecentSearches.slice(0, 6);

/** Test seam: drops the in-memory session hints. */
export const resetSessionHints = (): void => {
  shortcutRecents = [];
  foodRecentSearches = [];
};
