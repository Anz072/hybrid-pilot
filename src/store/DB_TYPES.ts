export type DBIsoDateString = string;

export type DBUserProvider = "local" | "google" | "apple" | "email";
export type DBUserGender = "male" | "female" | "other" | null;

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
  trainingTypes: string[] | null;
  calorieAllowance: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type UpsertUserInput = DBUser;

export type DBWeightLog = {
  id: number;
  userExternalId: string;
  weightKg: number;
  note: string | null;
  loggedAt: DBIsoDateString;
  createdAt: DBIsoDateString;
};

export type AddWeightLogInput = {
  userExternalId: string;
  weightKg: number;
  note?: string;
  loggedAt?: DBIsoDateString;
};

export type WeightEntrySource =
  | "manual"
  | "import"
  | "smart_scale"
  | "healthkit"
  | "health_connect"
  | "google_fit"
  | "csv";

export type WeightEntrySyncStatus = "pending" | "synced" | "error";

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
  syncStatus: WeightEntrySyncStatus;
  syncError: string | null;
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

export type FoodSource = "custom" | "manual" | "open_food_facts" | "import" | "usda";

export type NutritionBasis = "100g" | "100ml" | "serving";

export type DBFoodItem = {
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
  fiberG: number | null;
  sugarG: number | null;
  saltG: number | null;
  saturatedFatG: number | null;
  // metadata
  ingredientsText: string | null;
  verified: boolean; //  true for imported official-ish source, false for manual
  isComplete: boolean;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveFoodItemInput = Omit<
  DBFoodItem,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: number;
};

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

export type DBUserFoodLog = {
  id: number;
  userExternalId: string;
  foodId: number;
  date: string;
  quantityG: number;
  mealType: string | null;
  createdAt: DBIsoDateString;
};

export type AddUserFoodLogInput = {
  userExternalId: string;
  foodId: number;
  date: string;
  quantityG: number;
  mealType?: string | null;
};

export type UpdateUserFoodLogInput = {
  id: number;
  quantityG: number;
  mealType?: string | null;
};

export type DBUserFoodLogEntry = DBUserFoodLog & {
  foodName: string;
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DBCustomMeal = {
  id: number;
  userExternalId: string;
  name: string;
  createdAt: DBIsoDateString;
};

export type AddCustomMealInput = {
  userExternalId: string;
  name: string;
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
