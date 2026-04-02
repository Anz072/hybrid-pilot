import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircleIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Success"> & {
  onFinish: () => void;
};

const SuccessScreen = ({ onFinish, route }: Props) => {
  return (
    <View style={styles.container}>
      <CheckCircleIcon size={46} color="#16a34a" weight="fill" />
      <Text style={styles.title}>You are all set</Text>
      <Text style={styles.subtitle}>PR your consistency today. Your cockpit is ready.</Text>

      <View style={styles.card}>
        <Text style={styles.metric}>Today calories: {route.params.onboarding.fuelPlan.calories} kcal</Text>
        <Text style={styles.metric}>Protein target: {route.params.onboarding.fuelPlan.protein} g</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={onFinish}>
        <Text style={styles.buttonText}>Start Tracking</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
  },
  title: {
    marginTop: 10,
    fontSize: 32,
    fontWeight: "800",
    color: "#14532d",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#365314",
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
  },
  metric: {
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#166534",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default SuccessScreen;
