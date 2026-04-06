export type FoodStackParamList = {
  Diary: undefined;
  AddFood: { date: string; mealType: string };
  EditFoodEntry: { entryId: number };
  CreateCustomFood: { date: string; mealType: string };
  FoodLibrary: { date?: string; mealType?: string } | undefined;
};
