export type FoodStackParamList = {
  Diary: undefined;
  AddFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
  };
  EditFoodEntry: { entryId: number };
  CreateCustomFood: {
    date: string;
    mealType?: string | null;
    loggedAt?: string | null;
    contextLabel?: string | null;
  };
  FoodLibrary: { date?: string; mealType?: string } | undefined;
};
