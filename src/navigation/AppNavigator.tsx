import WeeklyReviewScreen from "../screens/User_Settings/WeeklyReviewScreen";
import AdaptiveCaloriesSettingsScreen from "../screens/User_Settings/AdaptiveCaloriesSettingsScreen";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
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
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearCurrentUser, hydrateUserFromDb } from "../store/userSlice";
import type { FoodStackParamList } from "./foodTypes";
import { appColors } from "../theme/colors";
import { appNavigationTheme } from "../theme/navigationTheme";
import { appTypography } from "../theme/typography";
import ProtocolsNavigator from "./ProtocolsNavigator";
import ProtocolSettingsScreen from "../screens/Protocols/ProtocolSettingsScreen";
import type { ProtocolStackParamList } from "./protocolTypes";
import { getAuthSessionGeneration } from "../API/supabase/sessionScope";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Protocols: NavigatorScreenParams<ProtocolStackParamList>;
  ProtocolSettings: undefined;
  Login: undefined;
  MicrosOverview: undefined;
  WeeklyReviewScreen: undefined;
  AdaptiveCaloriesSettingsScreen: undefined;
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
  const bootstrapSequence = useRef(0);
  const authIdentity = useRef<string | null | undefined>(undefined);

  const hydrateAuthenticatedSession = useCallback(async () => {
    const request = ++bootstrapSequence.current;
    const sessionGeneration = getAuthSessionGeneration();
    const current = () => request === bootstrapSequence.current && sessionGeneration === getAuthSessionGeneration();
    setBootstrapError(null);

    try {
      const onboardingDone = await getOnboardingComplete();
      setHasCompletedOnboarding(onboardingDone);

      // There is no development bypass. Expo Go used to sign in against a
      // device-local user with a device-local database behind it, which meant
      // the path developers exercised every day was the one path that never
      // touched the API. A real session is now the only way in.
      const sessionUser = await getValidatedSupabaseSessionUser();
      if (!current()) return;
      if (!sessionUser) {
        dispatch(clearCurrentUser());
        return;
      }

      const result = await dispatch(hydrateUserFromDb());
      if (!current()) return;

      if (hydrateUserFromDb.rejected.match(result)) {
        setBootstrapError(
          result.error.message ?? "Could not load your profile.",
        );
      }
    } catch (error) {
      if (!current()) return;
      console.error("[AppNavigator] Bootstrap failed", error);
      setBootstrapError(
        error instanceof Error
          ? error.message
          : "Could not finish loading the app.",
      );
    } finally {
      if (current()) setIsBootstrapping(false);
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
      const nextId = session?.user.id ?? null;
      // Supabase can announce the same signed-in user on foreground/renewal.
      // Do not remount a form or restart bootstrap for that identity.
      if (authIdentity.current === nextId) return;
      if (authIdentity.current !== nextId) {
        authIdentity.current = nextId;
        bootstrapSequence.current += 1;
        dispatch(clearCurrentUser());
      }
      if (nextId) {
        setIsBootstrapping(true);
        queueMicrotask(() => { void hydrateAuthenticatedSession(); });
      } else {
        setBootstrapError(null);
        setIsBootstrapping(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [dispatch, hydrateAuthenticatedSession]);

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
            ? `app:${user?.externalId}`
            : hasCompletedOnboarding
              ? "auth-login"
              : "auth-onboarding"
        }
        screenOptions={{ headerShown: false }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="Protocols" component={ProtocolsNavigator} />
            <Stack.Screen name="ProtocolSettings" component={ProtocolSettingsScreen} />
            <Stack.Screen
              name="WeeklyReviewScreen"
              component={WeeklyReviewScreen}
            />
            <Stack.Screen
              name="AdaptiveCaloriesSettingsScreen"
              component={AdaptiveCaloriesSettingsScreen}
            />
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
    paddingVertical: 16,
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
