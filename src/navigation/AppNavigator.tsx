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
import CreateFoodItemScreen from "../screens/Food/CreateFoodItemScreen";
import CreateRecipeScreen from "../screens/Food/CreateRecipeScreen";
import QuickAddFoodScreen from "../screens/Food/QuickAddFoodScreen";
import ScannedFoodLogScreen from "../screens/Food/ScannedFoodLogScreen";
import FoodReadOnlyScreen from "../screens/Food/FoodReadOnlyScreen";
import MicrosOverviewScreen from "../screens/Home/MicrosOverviewScreen";
import {
  getSupabaseClient,
  getValidatedSupabaseSessionUser,
  isSupabaseConfigured,
} from "../API/supabase/client";
import { getOnboardingComplete } from "../storage/localStore";
import { shouldUseExpoGoDevLocalStore } from "../dev/expoGoDevAuth";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearCurrentUser, hydrateUserFromDb } from "../store/userSlice";
import type { FoodStackParamList } from "./foodTypes";
import { appColors } from "../theme/colors";
import { appNavigationTheme } from "../theme/navigationTheme";
import { appTypography } from "../theme/typography";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Login: undefined;
  MicrosOverview: undefined;
  AddFood: FoodStackParamList["AddFood"];
  ScannedFood: FoodStackParamList["ScannedFood"];
  FoodReadOnly: FoodStackParamList["FoodReadOnly"];
  CreateCustomFood: FoodStackParamList["CreateCustomFood"];
  CreateFoodItem: FoodStackParamList["CreateFoodItem"];
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

  const hydrateAuthenticatedSession = useCallback(async () => {
    setBootstrapError(null);

    try {
      const onboardingDone = await getOnboardingComplete();
      setHasCompletedOnboarding(onboardingDone);

      if (await shouldUseExpoGoDevLocalStore()) {
        const result = await dispatch(hydrateUserFromDb());

        if (hydrateUserFromDb.rejected.match(result)) {
          setBootstrapError(
            result.error.message ?? "Could not load your dev profile.",
          );
        }

        return;
      }

      const sessionUser = await getValidatedSupabaseSessionUser();
      if (!sessionUser) {
        dispatch(clearCurrentUser());
        return;
      }

      const result = await dispatch(hydrateUserFromDb());

      if (hydrateUserFromDb.rejected.match(result)) {
        setBootstrapError(
          result.error.message ?? "Could not load your profile.",
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
    void hydrateAuthenticatedSession();
  }, [hydrateAuthenticatedSession]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return undefined;
    }

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void dispatch(hydrateUserFromDb());
        return;
      }

      void (async () => {
        if (await shouldUseExpoGoDevLocalStore()) {
          return;
        }

        dispatch(clearCurrentUser());
      })();
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  const isHydrating = isBootstrapping || (!userHydrated && !bootstrapError);
  const isLoggedIn = Boolean(user);

  if (isHydrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.brand500} />
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
            void hydrateAuthenticatedSession();
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
      <Stack.Navigator
        initialRouteName={
          isLoggedIn ? "Main" : hasCompletedOnboarding ? "Login" : "Onboarding"
        }
        key={
          isLoggedIn
            ? "app"
            : hasCompletedOnboarding
              ? "auth-login"
              : "auth-onboarding"
        }
        screenOptions={{ headerShown: false }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="MicrosOverview"
              component={MicrosOverviewScreen}
              options={{
                animation: "slide_from_right",
                presentation: "fullScreenModal",
              }}
            />
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
          <>
            <Stack.Screen name="Onboarding">
              {() => (
                <OnboardingNavigator
                  onFinish={() => void hydrateAuthenticatedSession()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onAuthenticated={() => void hydrateAuthenticatedSession()}
                  onBackToOnboarding={() => navigation.navigate("Onboarding")}
                />
              )}
            </Stack.Screen>
          </>
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
    borderColor: appColors.slate50,
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
