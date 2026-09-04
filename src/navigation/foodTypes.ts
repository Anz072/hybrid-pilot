export type ScannedFoodLogParams = {
  foodId: number;
  date: string;
  mealType?: string | null;
  loggedAt?: string | null;
  contextLabel?: string | null;
  barcode?: string | null;
  scanStatus?: "existing" | "created";
};

export type FoodStackParamList = {
  Diary: undefined;
  AddFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
  };
  ScannedFood: ScannedFoodLogParams;
  FoodReadOnly: {
    foodId: number;
    quantity: number;
    date: string;
    loggedAt?: string | null;
    contextLabel?: string | null;
  };
  // The diary day is part of the address: an entry is reachable only through
  // the day that holds it, and the caller is always looking at that day.
  EditFoodEntry: { entryId: number; date: string };
  CreateCustomFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
    mealId?: number;
  };
  CreateFoodItem: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
    barcode?: string | null;
    prefillName?: string | null;
  };
  CreateRecipe: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
    recipeId?: number;
  };
  QuickAddFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
    entryId?: number;
  };
  FoodLibrary: { date?: string; mealType?: string } | undefined;
};
