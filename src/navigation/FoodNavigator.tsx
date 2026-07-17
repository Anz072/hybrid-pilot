import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FoodDiaryScreen from "../screens/Food/FoodDiaryScreen";
import AddFoodScreen from "../screens/Food/AddFoodScreen";
import EditFoodEntryScreen from "../screens/Food/EditFoodEntryScreen";
import type { FoodStackParamList } from "./foodTypes";
import CreateCustomFoodScreen from "../screens/Food/CreateCustomFoodScreen";
import CreateFoodItemScreen from "../screens/Food/CreateFoodItemScreen";
import CreateRecipeScreen from "../screens/Food/CreateRecipeScreen";
import QuickAddFoodScreen from "../screens/Food/QuickAddFoodScreen";
import ScannedFoodLogScreen from "../screens/Food/ScannedFoodLogScreen";
import FoodReadOnlyScreen from "../screens/Food/FoodReadOnlyScreen";

const Stack = createNativeStackNavigator<FoodStackParamList>();

const FoodNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Diary"
    >
      <Stack.Screen name="Diary" component={FoodDiaryScreen} />
      <Stack.Screen
        name="AddFood"
        component={AddFoodScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ScannedFood"
        component={ScannedFoodLogScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="FoodReadOnly"
        component={FoodReadOnlyScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen name="EditFoodEntry" component={EditFoodEntryScreen} />
      <Stack.Screen
        name="CreateCustomFood"
        component={CreateCustomFoodScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="CreateFoodItem"
        component={CreateFoodItemScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="CreateRecipe"
        component={CreateRecipeScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="QuickAddFood"
        component={QuickAddFoodScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
    </Stack.Navigator>
  );
};

export default FoodNavigator;
