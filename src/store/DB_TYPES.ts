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
  calorieAllowance: number | null;
};

export type DBUserRow = {
  id: number;
  external_id?: string;
  externalId?: string;
  provider: string;
  display_name?: string | null;
  displayName?: string | null;
  created_at?: string;
  createdAt?: string;
  email: string | null;
  birthdate: string | null;
  gender: string | null;
  height_cm?: number | null;
  heightCm?: number | null;
  activity_level?: string | null;
  activityLevel?: string | null;
  goal: string | null;
  calorieAllowance: number | null;
};

export type UpsertUserInput = DBUserRow;

export type DBWeightLog = {
  id: number;
  userExternalId: string;
  weightKg: number;
  note: string | null;
  loggedAt: DBIsoDateString;
  createdAt: DBIsoDateString;
};

export type DBWeightLogRow = {
  id: number;
  user_external_id: string;
  weight_kg: number;
  note: string | null;
  logged_at: string;
  created_at: string;
};

export type AddWeightLogInput = {
  userExternalId: string;
  weightKg: number;
  note?: string;
  loggedAt?: DBIsoDateString;
};

export type DBFoodItem = {
  id: number;
  name: string;
  servingSize: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  createdAt: DBIsoDateString;
};

export type DBFoodItemRow = {
  id: number;
  name: string;
  serving_size: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  created_at: string;
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

export type DBUserFoodLogRow = {
  id: number;
  user_external_id: string;
  food_id: number;
  date: string;
  quantity_g: number;
  meal_type: string | null;
  created_at: string;
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

export type DBActivityRow = {
  id: number;
  user_external_id: string;
  type: string;
  duration_min: number | null;
  calories_burned: number | null;
  date: string;
  created_at: string;
};
