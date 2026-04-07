import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "./MainTabNavigator";
import LoginScreen from "../screens/Auth/LoginScreen";
import OnboardingNavigator from "./OnboardingNavigator";
import AddFoodScreen from "../screens/Food/AddFoodScreen";
import CreateCustomFoodScreen from "../screens/Food/CreateCustomFoodScreen";
import { getOnboardingComplete } from "../storage/localStore";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { hydrateUserFromDb } from "../store/userSlice";
import type { FoodStackParamList } from "./foodTypes";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Login: undefined;
  AddFood: FoodStackParamList["AddFood"];
  CreateCustomFood: FoodStackParamList["CreateCustomFood"];
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const userHydrated = useAppSelector((state) => state.user.hydrated);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const hydrateLocalSession = useCallback(async () => {
    const onboardingDone = await getOnboardingComplete();
    setHasCompletedOnboarding(onboardingDone);

    await dispatch(hydrateUserFromDb());
    setIsBootstrapping(false);
  }, [dispatch]);

  useEffect(() => {
    void hydrateLocalSession();
  }, [hydrateLocalSession]);

  const isHydrating = isBootstrapping || !userHydrated;
  const isLoggedIn = Boolean(user);

  if (isHydrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding">
            {() => (
              <OnboardingNavigator
                onFinish={() => void hydrateLocalSession()}
              />
            )}
          </Stack.Screen>
        ) : isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="AddFood"
              component={AddFoodScreen}
              options={{
                animation: "slide_from_bottom",
                presentation: "fullScreenModal",
              }}
            />
            <Stack.Screen
              name="CreateCustomFood"
              component={CreateCustomFoodScreen}
              options={{
                animation: "slide_from_bottom",
                presentation: "fullScreenModal",
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
});

export default AppNavigator;
