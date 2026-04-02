import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RocketLaunchIcon, BarbellIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.heroRow}>
        <RocketLaunchIcon size={34} color="#f97316" weight="fill" />
        <BarbellIcon size={34} color="#0f172a" weight="fill" />
      </View>
      <Text style={styles.title}>HybridPilot</Text>
      <Text style={styles.subtitle}>Your performance cockpit for nutrition and training.</Text>
      <Text style={styles.kicker}>Time to warm up and crush your first consistency PR.</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Goal")}>
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>I already have an account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fffaf5",
  },
  heroRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#334155",
    marginBottom: 10,
  },
  kicker: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 26,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "600",
  },
});

export default WelcomeScreen;
