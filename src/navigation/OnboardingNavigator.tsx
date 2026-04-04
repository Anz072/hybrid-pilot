import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/Onboarding/WelcomeScreen";
import GoalScreen from "../screens/Onboarding/GoalScreen";
import GoalRateScreen from "../screens/Onboarding/GoalRateScreen";
import BodyDataScreen from "../screens/Onboarding/BodyDataScreen";
import ActivityLevelScreen from "../screens/Onboarding/ActivityLevelScreen";
import TrainingProfileScreen from "../screens/Onboarding/TrainingProfileScreen";
import FuelPlanScreen from "../screens/Onboarding/FuelPlanScreen";
import AccountScreen from "../screens/Onboarding/AccountScreen";
import SuccessScreen from "../screens/Onboarding/SuccessScreen";
import type { OnboardingParamList } from "./onboardingTypes";

type OnboardingNavigatorProps = {
  onFinish: () => void;
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

const OnboardingNavigator = ({ onFinish }: OnboardingNavigatorProps) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Goal" component={GoalScreen} />
      <Stack.Screen name="GoalRate" component={GoalRateScreen} />
      <Stack.Screen name="BodyData" component={BodyDataScreen} />
      <Stack.Screen name="Activity" component={ActivityLevelScreen} />
      <Stack.Screen name="Training" component={TrainingProfileScreen} />
      <Stack.Screen name="FuelPlan" component={FuelPlanScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Success">
        {(props) => <SuccessScreen {...props} onFinish={onFinish} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
