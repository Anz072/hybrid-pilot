import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FoodLibraryScreen from "../screens/Food/FoodLibraryScreen";
import MoreScreen from "../screens/User_Settings/MoreScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";

export type MoreParamList = {
  FoodLibrary: undefined;
  MoreMainScreen: undefined;
  SettingsScreen: undefined;
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
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
    </Stack.Navigator>
  );
};

export default MoreNavigator;
