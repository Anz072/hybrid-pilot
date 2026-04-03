import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BarbellIcon, RocketLaunchIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.heroRow}>
        <View style={styles.heroIconBadge}>
          <RocketLaunchIcon size={24} color="#EA580C" weight="fill" />
        </View>
        <View style={styles.heroIconBadgeMuted}>
          <BarbellIcon size={20} color="#0F172A" weight="fill" />
        </View>
      </View>

      <Text style={styles.eyebrow}>Nutrition + Training</Text>
      <Text style={styles.title}>HybridPilot</Text>
      <Text style={styles.subtitle}>
        Build your plan in under a minute and get tailored calories, macros, and
        progress tracking.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
        ]}
        onPress={() => navigation.navigate("Goal")}
      >
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.secondaryButtonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>
          I already have an account
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 30,
    justifyContent: "center",
    backgroundColor: "#FFF8F2", //121212
  },
  bgOrbTop: {
    position: "absolute",
    top: -80,
    right: -50,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  heroRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FFEDD5",
    borderWidth: 1,
    borderColor: "#FDBA74",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconBadgeMuted: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#9A3412",
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
    marginBottom: 24,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 2,
    paddingVertical: 6,
  },
  secondaryButton: {
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 12,
  },
  secondaryButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "600",
  },
});

export default WelcomeScreen;
