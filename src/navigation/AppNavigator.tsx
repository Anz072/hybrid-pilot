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
        <ActivityIndicator size="large" color="#0f172a" />
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
    gap: 12,
    backgroundColor: "#ffffff",
    padding: 24,
  },
  loadingError: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  errorTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonPressed: {
    opacity: 0.86,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});

export default AppNavigator;
