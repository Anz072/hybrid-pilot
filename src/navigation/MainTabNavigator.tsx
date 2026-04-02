import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/Home/HomeScreen";
import WeightScreen from "../screens/Weight/WeightScreen";
import FoodScreen from "../screens/Food/FoodScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import { DotsThreeCircleIcon, FireIcon, ForkKnifeIcon, GearIcon, HouseSimpleIcon } from "phosphor-react-native";

export type MainTabParamList = {
  Home: undefined;
  Weight: undefined;
  Food: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <HouseSimpleIcon size={24} color={focused ? "#007AFF" : "#222"} />
          ),
        }}
      />
      <Tab.Screen
        name="Food"
        component={FoodScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <ForkKnifeIcon size={24} color={focused ? "#007AFF" : "#222"} />
          ),
        }}
      />
      <Tab.Screen
        name="Weight"
        component={WeightScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <FireIcon size={24} color={focused ? "#007AFF" : "#222"} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <DotsThreeCircleIcon size={24} color={focused ? "#007AFF" : "#222"} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
