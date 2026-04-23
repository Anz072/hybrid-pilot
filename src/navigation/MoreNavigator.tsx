import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FoodLibraryScreen from "../screens/Food/FoodLibraryScreen";
import MoreScreen from "../screens/User_Settings/MoreScreen";
import AdjustGoalSettingsScreen from "../screens/User_Settings/ActivityLevelSettingsScreen";
import CalorieAllowanceSettingsScreen from "../screens/User_Settings/CalorieAllowanceSettingsScreen";
import AdaptiveCaloriesSettingsScreen from "../screens/User_Settings/AdaptiveCaloriesSettingsScreen";
import CalorieScheduleScreen from "../screens/User_Settings/CalorieScheduleScreen";
import PreferencesScreen from "../screens/User_Settings/DiaryHoursDebugScreen";
import ProfileSettingsScreen from "../screens/User_Settings/ProfileSettingsScreen";
import TrainingTypesSettingsScreen from "../screens/User_Settings/TrainingTypesSettingsScreen";
import ProteinFocusSettingsScreen from "../screens/User_Settings/ProteinFocusSettingsScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import {
  UserCreatedCustomMealsScreen,
  UserCreatedRecipesScreen,
} from "../screens/User_Settings/UserCreatedFoodLibraryScreen";

export type MoreParamList = {
  FoodLibrary: undefined;
  MoreMainScreen: undefined;
  ProfileSettingsScreen: undefined;
  PreferencesScreen: undefined;
  SettingsScreen: undefined;
  CalorieAllowanceSettingsScreen: undefined;
  AdaptiveCaloriesSettingsScreen: undefined;
  AdjustGoalSettingsScreen: undefined;
  TrainingTypesSettingsScreen: undefined;
  ProteinFocusSettingsScreen: undefined;
  CalorieScheduleScreen: undefined;
  UserCreatedRecipesScreen: undefined;
  UserCreatedCustomMealsScreen: undefined;
};

const Stack = createNativeStackNavigator<MoreParamList>();

const MoreNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="MoreMainScreen"
    >
      <Stack.Screen name="MoreMainScreen" component={MoreScreen} />
      <Stack.Screen name="FoodLibrary" component={FoodLibraryScreen} />
      <Stack.Screen
        name="ProfileSettingsScreen"
        component={ProfileSettingsScreen}
      />
      <Stack.Screen name="PreferencesScreen" component={PreferencesScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen
        name="CalorieAllowanceSettingsScreen"
        component={CalorieAllowanceSettingsScreen}
      />
      <Stack.Screen
        name="AdaptiveCaloriesSettingsScreen"
        component={AdaptiveCaloriesSettingsScreen}
      />
      <Stack.Screen
        name="AdjustGoalSettingsScreen"
        component={AdjustGoalSettingsScreen}
      />
      <Stack.Screen
        name="TrainingTypesSettingsScreen"
        component={TrainingTypesSettingsScreen}
      />
      <Stack.Screen
        name="ProteinFocusSettingsScreen"
        component={ProteinFocusSettingsScreen}
      />
      <Stack.Screen
        name="CalorieScheduleScreen"
        component={CalorieScheduleScreen}
      />
      <Stack.Screen
        name="UserCreatedRecipesScreen"
        component={UserCreatedRecipesScreen}
      />
      <Stack.Screen
        name="UserCreatedCustomMealsScreen"
        component={UserCreatedCustomMealsScreen}
      />
    </Stack.Navigator>
  );
};

export default MoreNavigator;
