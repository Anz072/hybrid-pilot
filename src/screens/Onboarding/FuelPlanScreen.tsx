import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ForkKnifeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  ActivityLevel,
  FuelPlan,
  GoalType,
  OnboardingParamList,
  OnboardingProfile,
} from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "FuelPlan">;

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.35,
  moderately_active: 1.5,
  very_active: 1.7,
  athlete: 1.9,
};

const GOAL_OFFSET: Record<GoalType, number> = {
  lose_fat: -350,
  maintain: 0,
  build_muscle: 250,
};

const buildFuelPlan = ({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male" | "other";
  activity: ActivityLevel;
  goal: GoalType;
}): FuelPlan => {
  const sexBase = sex === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexBase;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const calories = Math.max(1200, Math.round(tdee + GOAL_OFFSET[goal]));

  const protein = Math.round(weightKg * 2);
  const fats = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

  return { calories, protein, carbs, fats };
};

const FuelPlanScreen = ({ navigation, route }: Props) => {
  const { goal, bodyData, activity, training } = route.params;
  const fuelPlan = buildFuelPlan({ ...bodyData, activity, goal });

  const onboarding: OnboardingProfile = {
    goal,
    bodyData,
    activity,
    training,
    fuelPlan,
  };

  return (
    <View style={styles.container}>
      <ForkKnifeIcon size={32} color="#0f766e" weight="fill" />
      <Text style={styles.title}>Your daily fuel plan is ready</Text>
      <Text style={styles.subtitle}>Auto-generated from your body data, activity, and goal.</Text>

      <View style={styles.card}>
        <Text style={styles.metric}>Calories: {fuelPlan.calories} kcal</Text>
        <Text style={styles.metric}>Protein: {fuelPlan.protein} g</Text>
        <Text style={styles.metric}>Carbs: {fuelPlan.carbs} g</Text>
        <Text style={styles.metric}>Fats: {fuelPlan.fats} g</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Account", { onboarding })}>
        <Text style={styles.primaryButtonText}>Looks good</Text>
      </TouchableOpacity>
      <Text style={styles.helper}>Fine tuning can be added later in settings.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f0fdfa",
  },
  title: {
    marginTop: 12,
    fontSize: 29,
    fontWeight: "800",
    color: "#134e4a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  metric: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  helper: {
    marginTop: 10,
    color: "#475569",
    textAlign: "center",
    fontSize: 13,
  },
});

export default FuelPlanScreen;
