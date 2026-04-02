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

export type DBFoodItem = {
  id: number;
  name: string;
  servingSize: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  isFavorite: boolean;
  createdAt: DBIsoDateString;
};

export type AddFoodItemInput = {
  name: string;
  servingSize: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  isFavorite?: boolean;
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
