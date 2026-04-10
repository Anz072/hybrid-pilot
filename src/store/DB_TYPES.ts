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

export type DBUserSettings = {
  userExternalId: string;
  foodDiaryStartHour: number;
  foodDiaryEndHour: number;
  dailyCalorieOverrides: Array<number | null> | null;
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveUserSettingsInput = {
  userExternalId: string;
  foodDiaryStartHour?: number;
  foodDiaryEndHour?: number;
  dailyCalorieOverrides?: Array<number | null> | null;
};

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

export type DBFoodNutrientDetails = {
  fiberG: number | null;
  sugarG: number | null;
  addedSugarsG: number | null;
  waterG: number | null;
  alcoholG: number | null;
  saltG: number | null;
  saturatedFatG: number | null;
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
  createdAt: DBIsoDateString;
  updatedAt: DBIsoDateString;
};

export type SaveFoodItemInput = Omit<
  DBFoodItem,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "rawPayload"
  | keyof DBFoodNutrientDetails
> & {
  id?: number;
  rawPayload?: string | null;
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

export type UserFoodLogSource = "food_item" | "quick_add";

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
