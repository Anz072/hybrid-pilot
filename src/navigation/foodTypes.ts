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
  EditFoodEntry: { entryId: number };
  CreateCustomFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
  };
  CreateRecipe: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
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
