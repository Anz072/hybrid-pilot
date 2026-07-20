import React from "react";
import type { MealSlot } from "./foodUtils";

type FoodDiaryDateContextValue = {
  selectedDateKey: string;
  selectedMeal: MealSlot;
  setSelectedDateKey: (dateKey: string) => void;
  setSelectedMeal: (meal: MealSlot) => void;
};

const FoodDiaryDateContext = React.createContext<FoodDiaryDateContextValue | null>(
  null,
);

export const FoodDiaryDateProvider = FoodDiaryDateContext.Provider;

export const useFoodDiaryDateContext = () =>
  React.useContext(FoodDiaryDateContext);
