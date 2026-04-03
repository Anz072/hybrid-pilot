import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircleIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Success"> & {
  onFinish: () => void;
};

const SuccessScreen = ({ onFinish, route }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <CheckCircleIcon size={34} color="#16A34A" weight="fill" />
      </View>
      <Text style={styles.eyebrow}>Ready</Text>
      <Text style={styles.title}>You are all set</Text>
      <Text style={styles.subtitle}>PR your consistency today. Your cockpit is ready.</Text>

      <View style={styles.card}>
        <Text style={styles.metricLabel}>Today calories</Text>
        <Text style={styles.metricValue}>{route.params.onboarding.fuelPlan.calories} kcal</Text>
        <View style={styles.divider} />
        <Text style={styles.metricLabel}>Protein target</Text>
        <Text style={styles.metricValue}>{route.params.onboarding.fuelPlan.protein} g</Text>
      </View>

      <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onFinish}>
        <Text style={styles.buttonText}>Start Tracking</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 24,
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#166534",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#14532D",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#3F6212",
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  metricLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  metricValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  button: {
    backgroundColor: "#166534",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});

export default SuccessScreen;
