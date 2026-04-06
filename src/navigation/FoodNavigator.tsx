import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FoodDiaryScreen from "../screens/Food/FoodDiaryScreen";
import AddFoodScreen from "../screens/Food/AddFoodScreen";
import EditFoodEntryScreen from "../screens/Food/EditFoodEntryScreen";
import type { FoodStackParamList } from "./foodTypes";
import CreateCustomFoodScreen from "../screens/Food/CreateCustomFoodScreen";
import FoodLibraryScreen from "../screens/Food/FoodLibraryScreen";

const Stack = createNativeStackNavigator<FoodStackParamList>();

const FoodNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Diary"
    >
      <Stack.Screen name="Diary" component={FoodDiaryScreen} />
      <Stack.Screen name="AddFood" component={AddFoodScreen} />
      <Stack.Screen name="EditFoodEntry" component={EditFoodEntryScreen} />
      <Stack.Screen
        name="CreateCustomFood"
        component={CreateCustomFoodScreen}
      />
      <Stack.Screen name="FoodLibrary" component={FoodLibraryScreen} />
    </Stack.Navigator>
  );
};

export default FoodNavigator;
