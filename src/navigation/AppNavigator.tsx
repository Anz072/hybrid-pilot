import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "./MainTabNavigator";
import LoginScreen from "../screens/Auth/LoginScreen";
import OnboardingNavigator from "./OnboardingNavigator";
import AddFoodScreen from "../screens/Food/AddFoodScreen";
import CreateCustomFoodScreen from "../screens/Food/CreateCustomFoodScreen";
import CreateRecipeScreen from "../screens/Food/CreateRecipeScreen";
import QuickAddFoodScreen from "../screens/Food/QuickAddFoodScreen";
import ScannedFoodLogScreen from "../screens/Food/ScannedFoodLogScreen";
import FoodReadOnlyScreen from "../screens/Food/FoodReadOnlyScreen";
import { getOnboardingComplete } from "../storage/localStore";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { hydrateUserFromDb } from "../store/userSlice";
import type { FoodStackParamList } from "./foodTypes";
import { appColors } from "../theme/colors";
import { appNavigationTheme } from "../theme/navigationTheme";
import { appTypography } from "../theme/typography";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Login: undefined;
  AddFood: FoodStackParamList["AddFood"];
  ScannedFood: FoodStackParamList["ScannedFood"];
  FoodReadOnly: FoodStackParamList["FoodReadOnly"];
  CreateCustomFood: FoodStackParamList["CreateCustomFood"];
  CreateRecipe: FoodStackParamList["CreateRecipe"];
  QuickAddFood: FoodStackParamList["QuickAddFood"];
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const userHydrated = useAppSelector((state) => state.user.hydrated);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const hydrateLocalSession = useCallback(async () => {
    setBootstrapError(null);

    try {
      const onboardingDone = await getOnboardingComplete();
      setHasCompletedOnboarding(onboardingDone);

      const result = await dispatch(hydrateUserFromDb());

      if (hydrateUserFromDb.rejected.match(result)) {
        setBootstrapError(
          result.error.message ?? "Could not load your local profile.",
        );
      }
    } catch (error) {
      console.error("[AppNavigator] Bootstrap failed", error);
      setBootstrapError(
        error instanceof Error
          ? error.message
          : "Could not finish loading the app.",
      );
    } finally {
      setIsBootstrapping(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void hydrateLocalSession();
  }, [hydrateLocalSession]);

  const isHydrating = isBootstrapping || (!userHydrated && !bootstrapError);
  const isLoggedIn = Boolean(user);

  if (isHydrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.foodPrimary} />
        {bootstrapError ? (
          <Text style={styles.loadingError}>{bootstrapError}</Text>
        ) : null}
      </View>
    );
  }

  if (bootstrapError && !userHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Could not start the app</Text>
        <Text style={styles.loadingError}>{bootstrapError}</Text>
        <Pressable
          onPress={() => {
            setIsBootstrapping(true);
            void hydrateLocalSession();
          }}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer theme={appNavigationTheme}>
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
    gap: 14,
    backgroundColor: appColors.surfaceCanvas,
    padding: 24,
  },
  loadingError: {
    ...appTypography.body,
    color: appColors.dangerText,
    textAlign: "center",
    maxWidth: 320,
  },
  errorTitle: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: appColors.revolutLight,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryButtonText: {
    ...appTypography.button,
    color: appColors.textPrimary,
  },
});

export default AppNavigator;
