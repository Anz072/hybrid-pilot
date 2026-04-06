import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/Home/HomeScreen";
import WeightScreen from "../screens/Weight/WeightScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import FoodNavigator from "./FoodNavigator";
import {
  BooksIcon,
  BugDroidIcon,
  DotsThreeCircleIcon,
  FireIcon,
  ForkKnifeIcon,
  HouseSimpleIcon,
} from "phosphor-react-native";
import FoodLibraryScreen from "../screens/Food/FoodLibraryScreen";

export type MainTabParamList = {
  Home: undefined;
  Weight: undefined;
  Food: undefined;
  More: undefined;
  Debug: undefined;
  Library: undefined;
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
        component={FoodNavigator}
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
            <DotsThreeCircleIcon
              size={24}
              color={focused ? "#007AFF" : "#222"}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Debug"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <BugDroidIcon 
              size={24}
              color={focused ? "#007AFF" : "#222"}
            />
          ),
        }}
      />
       <Tab.Screen
        name="Library"
        component={FoodLibraryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <BooksIcon 
              size={24}
              color={focused ? "#007AFF" : "#222"}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
