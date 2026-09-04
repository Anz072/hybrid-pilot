/**
 * The record shapes screens and stores pass around.
 *
 * The name is historical: these once described rows in a device SQLite
 * database. There is no device database any more — every one of these is a
 * shape the Nouri API returns, mapped once at the transport boundary — but the
 * name is load-bearing across ~45 files and renaming it is churn without a
 * payoff.
 *
 * The domain's *vocabulary* — the closed sets of values, as opposed to the
 * record shapes — lives in `src/domain/types.ts` and is re-exported here so
 * existing imports keep working.
 */
import type {
  AdaptiveCalorieMode,
  AdaptiveCalorieRecommendationConfidence,
  AdaptiveCalorieRecommendationStatus,
  DBIsoDateString,
  DBUserGender,
  DBUserProvider,
  FoodSource,
  NutritionBasis,
  RecipeBuildMethod,
  UserFoodLogSource,
  WeightEntrySource,
} from "../domain/types";

export type {
  AdaptiveCalorieMode,
  AdaptiveCalorieRecommendationConfidence,
  AdaptiveCalorieRecommendationStatus,
  DBIsoDateString,
  DBUserGender,
  DBUserProvider,
  FoodSource,
  NutritionBasis,
  RecipeBuildMethod,
  UserFoodLogSource,
  WeightEntrySource,
};

import type {
  GoalStrategy,
  ProteinFocus,
} from "../navigation/onboardingTypes";


export type DBUser = {
  id: number;
  externalId: string;
  provider: DBUserProvider | string;
  displayName: string | null;
  createdAt: DBIsoDateString;
  email: string | null;
  birthdate: DBIsoDateString | null;
  gender: DBUserGender;
  heightCm: number | null;
  activityLevel: string | null;
  goal: string | null;
  goalStrategy: GoalStrategy | null;
  trainingTypes: string[] | null;
  proteinFocus: ProteinFocus | null;
  calorieAllowance: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type UpsertUserInput = DBUser;


export type DBUserSettings = {
  userExternalId: string;
  foodDiaryStartHour: number;
  foodDiaryEndHour: number;
  dailyCalorieOverrides: Array<number | null> | null;
  adaptiveCaloriesEnabled: boolean;
  adaptiveMode: AdaptiveCalorieMode;
  adaptiveLastCalculatedAt: DBIsoDateString | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveUserSettingsInput = {
  userExternalId: string;
  foodDiaryStartHour?: number;
  foodDiaryEndHour?: number;
  dailyCalorieOverrides?: Array<number | null> | null;
  adaptiveCaloriesEnabled?: boolean;
  adaptiveMode?: AdaptiveCalorieMode;
  adaptiveLastCalculatedAt?: DBIsoDateString | null;
};

export type DBDiaryDayStatus = {
  userExternalId: string;
  date: string;
  isComplete: boolean;
  completedAt: DBIsoDateString | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveDiaryDayStatusInput = {
  userExternalId: string;
  date: string;
  isComplete: boolean;
};

export type DBAdaptiveCalorieRecommendation = {
  id: number;
  userExternalId: string;
  status: AdaptiveCalorieRecommendationStatus;
  algorithmVersion: string;
  windowStart: string;
  windowEnd: string;
  confidence: AdaptiveCalorieRecommendationConfidence;
  currentBaseCalories: number | null;
  recommendedBaseCalories: number;
  estimatedTdee: number;
  recommendedDelta: number;
  avgLoggedCalories: number;
  completeDaysUsed: number;
  weighInsUsed: number;
  trendStartKg: number;
  trendEndKg: number;
  observedWeeklyChangeKg: number | null;
  reason: string;
  inputSummary: Record<string, unknown> | null;
  respondedAt: DBIsoDateString | null;
  appliedAt: DBIsoDateString | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type CreateAdaptiveCalorieRecommendationInput = {
  userExternalId: string;
  status?: AdaptiveCalorieRecommendationStatus;
  algorithmVersion?: string | null;
  windowStart: string;
  windowEnd: string;
  confidence: AdaptiveCalorieRecommendationConfidence;
  currentBaseCalories?: number | null;
  recommendedBaseCalories: number;
  estimatedTdee: number;
  recommendedDelta: number;
  avgLoggedCalories: number;
  completeDaysUsed: number;
  weighInsUsed: number;
  trendStartKg: number;
  trendEndKg: number;
  observedWeeklyChangeKg?: number | null;
  reason: string;
  inputSummary?: Record<string, unknown> | null;
  respondedAt?: DBIsoDateString | null;
  appliedAt?: DBIsoDateString | null;
};

export type UpdateAdaptiveCalorieRecommendationInput = {
  id: number;
  userExternalId: string;
  status?: AdaptiveCalorieRecommendationStatus;
  respondedAt?: DBIsoDateString | null;
  appliedAt?: DBIsoDateString | null;
};

export type ListAdaptiveCalorieRecommendationsInput = {
  userExternalId: string;
  limit?: number;
  status?: AdaptiveCalorieRecommendationStatus | null;
};

export type AdaptiveRecommendationInputSummary = {
  windowDays: number;
  windowStart: string | null;
  windowEnd: string | null;
  latestCompleteDate: string | null;
  daySpan: number;
  completeDaysUsed: number;
  completeDateKeys: string[];
  totalEntriesUsed: number;
  weighInsUsed: number;
  trendStartKg: number | null;
  trendEndKg: number | null;
  observedWeeklyChangeKg: number | null;
  avgLoggedCalories: number | null;
};

export type AdaptiveRecommendationDraft = Omit<
  CreateAdaptiveCalorieRecommendationInput,
  "userExternalId"
> & {
  algorithmVersion: string;
  inputSummary: Record<string, unknown> | null;
};

export type AdaptiveRecommendationOutcome =
  | {
      status: "ready";
      reason: string;
      confidence: AdaptiveCalorieRecommendationConfidence;
      estimatedTdee: number;
      recommendedBaseCalories: number;
      summary: AdaptiveRecommendationInputSummary;
      recommendation: AdaptiveRecommendationDraft;
    }
  | {
      status: "unchanged" | "insufficient" | "disabled";
      reason: string;
      confidence: AdaptiveCalorieRecommendationConfidence | null;
      estimatedTdee: number | null;
      recommendedBaseCalories: number | null;
      summary: AdaptiveRecommendationInputSummary | null;
    };

export type AdaptiveCalorieTargetApplyResult = {
  calorieAllowance: number;
  dailyCalorieOverrides: Array<number | null> | null;
  appliedDelta: number;
};


// There is no `syncStatus` and no `syncError`. Both described a device-local
// sync engine: a weight could be written to the phone, rejected by the server,
// and kept in an "error" state for the user to resolve. Writes now go to the
// server or fail, so every entry that exists is one Supabase accepted.
export type DBWeightEntry = {
  id: string;
  userExternalId: string;
  measuredAt: DBIsoDateString;
  measuredAtLocalIso: string;
  zoneOffsetMinutes: number;
  valueKg: number;
  valueOriginal: number;
  unitOriginal: "kg";
  source: WeightEntrySource;
  notes: string | null;
  clientGeneratedId: string;
  deviceId: string | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
  deletedAt: DBIsoDateString | null;
  version: number;
};

export type SaveWeightEntryInput = {
  id: string;
  userExternalId: string;
  measuredAt: DBIsoDateString;
  measuredAtLocalIso: string;
  zoneOffsetMinutes: number;
  valueKg: number;
  valueOriginal: number;
  unitOriginal: "kg";
  source: WeightEntrySource;
  notes?: string | null;
  clientGeneratedId: string;
  deviceId?: string | null;
};

export type SoftDeleteWeightEntryInput = {
  id: string;
  userExternalId: string;
};

export type WeightEntryGoal = {
  userExternalId: string;
  targetWeightKg: number;
  targetDate: string | null;
  goalBandKg: number | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveWeightGoalInput = {
  userExternalId: string;
  targetWeightKg: number;
  targetDate?: string | null;
  goalBandKg?: number | null;
};



export type DBFoodNutrientDetails = {
  fiberG: number | null;
  sugarG: number | null;
  addedSugarsG: number | null;
  waterG: number | null;
  alcoholG: number | null;
  saltG: number | null;
  fatSaturatedG: number | null;
  fatMonounsaturatedG: number | null;
  fatPolyunsaturatedG: number | null;
  fatTransG: number | null;
  omega3G: number | null;
  omega6G: number | null;
  epaG: number | null;
  dhaG: number | null;
  alaG: number | null;
  linoleicAcidG: number | null;
  alphaLinolenicAcidG: number | null;
  cholesterolMg: number | null;
  vitaminAUg: number | null;
  vitaminCMg: number | null;
  vitaminDUg: number | null;
  vitaminEMg: number | null;
  vitaminKUg: number | null;
  vitaminK1Ug: number | null;
  vitaminK2Ug: number | null;
  thiaminB1Mg: number | null;
  riboflavinB2Mg: number | null;
  niacinB3Mg: number | null;
  pantothenicAcidB5Mg: number | null;
  vitaminB6Mg: number | null;
  biotinB7Ug: number | null;
  folateB9Ug: number | null;
  vitaminB12Ug: number | null;
  cholineMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  magnesiumMg: number | null;
  phosphorusMg: number | null;
  potassiumMg: number | null;
  sodiumMg: number | null;
  zincMg: number | null;
  copperMg: number | null;
  manganeseMg: number | null;
  seleniumUg: number | null;
  iodineUg: number | null;
  chromiumUg: number | null;
  molybdenumUg: number | null;
  histidineG: number | null;
  isoleucineG: number | null;
  leucineG: number | null;
  lysineG: number | null;
  methionineG: number | null;
  phenylalanineG: number | null;
  threonineG: number | null;
  tryptophanG: number | null;
  valineG: number | null;
  alanineG: number | null;
  arginineG: number | null;
  asparticAcidG: number | null;
  cysteineG: number | null;
  glutamicAcidG: number | null;
  glycineG: number | null;
  prolineG: number | null;
  serineG: number | null;
  tyrosineG: number | null;
  caffeineMg: number | null;
  betaineMg: number | null;
  luteinZeaxanthinUg: number | null;
};

export type DBFoodItem = DBFoodNutrientDetails & {
  id: number;

  // identity
  source: FoodSource;
  sourceId: string | null; // OFF barcode, USDA fdcId, null for manual
  barcode: string | null;
  // display
  name: string;
  brand: string | null;
  imageUrl: string | null;
  // quantity / serving info
  quantityValue: number | null;      // 500
  quantityUnit: string | null;       // ml
  servingSizeValue: number | null;   // 100, 30, 1 etc
  servingSizeUnit: string | null;    // g, ml, piece
  nutritionBasis: NutritionBasis;    // "100g", "100ml", or "serving"
  // macros
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  // metadata
  ingredientsText: string | null;
  rawPayload: string | null;
  verified: boolean; //  true for imported official-ish source, false for manual
  isComplete: boolean;
  isPublic: boolean;
  /**
   * Whether the signed-in user created this recipe or custom meal.
   *
   * The server decides. The library screen used to work it out by digging a
   * `createdByUserExternalId` out of `rawPayload` — a Supabase-era field the
   * API mapper always sets to null — so every recipe a user made was filed
   * under "Public recipes from other users" and none under "Yours".
   */
  isOwn: boolean;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveFoodItemInput = Omit<
  DBFoodItem,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "rawPayload"
  | "isPublic"
  // Not a caller's to assert: ownership is derived from who the request is
  // authenticated as.
  | "isOwn"
  | keyof DBFoodNutrientDetails
> & {
  id?: number;
  rawPayload?: string | null;
  isPublic?: boolean;
} & Partial<DBFoodNutrientDetails>;

export type AddFoodItemInput = SaveFoodItemInput;

export type ListFoodItemsInput = {
  query?: string;
  limit?: number;
  source?: FoodSource | string | null;
};

export type DBUserFoodFavorite = {
  userExternalId: string;
  foodId: number;
  createdAt: DBIsoDateString;
};


export type DBRecipe = {
  id: number;
  userExternalId: string;
  createdByUserExternalId: string;
  linkedFoodId: number;
  isPublic: boolean;
  buildMethod: RecipeBuildMethod;
  name: string;
  description: string | null;
  linkUrl: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number;
  steps: string[];
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type DBRecipeIngredient = {
  id: number;
  recipeId: number;
  foodId: number;
  amount: number;
  amountUnit: string | null;
  sortOrder: number;
  createdAt: DBIsoDateString;
};

export type CreateUserRecipeIngredientInput = {
  food: DBFoodItem;
  foodId: number;
  amount: number;
};

export type CreateUserRecipeInput = {
  userExternalId: string;
  createdByUserExternalId: string;
  isPublic?: boolean;
  buildMethod?: RecipeBuildMethod;
  name: string;
  description?: string | null;
  linkUrl?: string | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  servings: number;
  preparedFoodWeightG?: number | null;
  steps?: string[];
  ingredients: CreateUserRecipeIngredientInput[];
};

export type UpdateUserRecipeInput = CreateUserRecipeInput & {
  recipeId: number;
};

export type DBRecipeIngredientDetail = DBRecipeIngredient & {
  food: DBFoodItem;
};

export type DBRecipeDetails = DBRecipe & {
  ingredients: DBRecipeIngredientDetail[];
  ingredientTotalWeightG: number | null;
  preparedFoodWeightG: number | null;
  effectiveRecipeWeightG: number | null;
  gramsPerServing: number | null;
};

export type DBCustomMeal = {
  id: number;
  userExternalId: string;
  createdByUserExternalId: string;
  linkedFoodId: number;
  isPublic: boolean;
  name: string;
  description: string | null;
  servings: number;
  totalWeightG: number | null;
  gramsPerServing: number | null;
  caloriesPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type CreateUserCustomMealInput = {
  userExternalId: string;
  createdByUserExternalId: string;
  isPublic?: boolean;
  name: string;
  description?: string | null;
  servingSizeG: number;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

export type UpdateUserCustomMealInput = CreateUserCustomMealInput & {
  mealId: number;
};


export type DBUserFoodLog = {
  id: number;
  userExternalId: string;
  foodId: number | null;
  date: string;
  loggedAt: DBIsoDateString;
  quantityG: number;
  mealType: string | null;
  createdAt: DBIsoDateString;
  entrySource: UserFoodLogSource;
};

export type AddUserFoodLogInput = {
  userExternalId: string;
  foodId: number;
  date: string;
  loggedAt?: DBIsoDateString;
  quantityG: number;
  mealType?: string | null;
};

export type UpdateUserFoodLogInput = {
  id: number;
  loggedAt?: DBIsoDateString | null;
  quantityG: number;
  mealType?: string | null;
};

export type DBQuickAddFoodLog = {
  id: number;
  userExternalId: string;
  date: string;
  loggedAt: DBIsoDateString;
  mealType: string | null;
  name: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  alcoholG: number;
  systemCalculatedCalories: number | null;
  isEnergyManuallySet: boolean;
  createdAt: DBIsoDateString;
};

export type AddQuickAddFoodLogInput = {
  userExternalId: string;
  date: string;
  loggedAt?: DBIsoDateString;
  mealType?: string | null;
  name?: string | null;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  alcoholG?: number;
  systemCalculatedCalories?: number | null;
  isEnergyManuallySet?: boolean;
};

export type UpdateQuickAddFoodLogInput = {
  id: number;
  loggedAt?: DBIsoDateString | null;
  mealType?: string | null;
  name?: string | null;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  alcoholG?: number;
  systemCalculatedCalories?: number | null;
  isEnergyManuallySet?: boolean;
};

export type DBUserFoodLogEntry = DBUserFoodLog & {
  foodName: string;
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  alcoholG: number | null;
  systemCalculatedCalories: number | null;
  isEnergyManuallySet: boolean;
  quickAddName: string | null;
};

export type DBActivity = {
  id: number;
  userExternalId: string;
  type: string;
  durationMin: number | null;
  caloriesBurned: number | null;
  date: string;
  createdAt: DBIsoDateString;
};
