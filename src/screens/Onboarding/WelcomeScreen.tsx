import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BarbellIcon, RocketLaunchIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.heroRow}>
        <View style={styles.heroIconBadge}>
          <RocketLaunchIcon size={24} color={appColors.raw_hex_EA580C} weight="fill" />
        </View>
        <View style={styles.heroIconBadgeMuted}>
          <BarbellIcon size={20} color={appColors.slate900} weight="fill" />
        </View>
      </View>

      <Text style={styles.eyebrow}>Nutrition + Training</Text>
      <Text style={styles.title}>HybridPilot</Text>
      <Text style={styles.subtitle}>
        Build your plan in under a minute and get tailored calories, macros, and
        progress tracking.
      </Text>

      <OnboardingPrimaryButton
        label="Get Started"
        onPress={() => navigation.navigate("Goal")}
        style={styles.primaryButton}
      />

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
    backgroundColor: appColors.raw_hex_FFF8F2, //121212
  },
  bgOrbTop: {
    position: "absolute",
    top: -80,
    right: -50,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: appColors.dangerSoftBg,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: appColors.slate200,
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
    backgroundColor: appColors.amberSurface,
    borderWidth: 1,
    borderColor: appColors.amber300,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconBadgeMuted: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: appColors.slate100,
    borderWidth: 1,
    borderColor: appColors.slate300,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.amber800,
    backgroundColor: appColors.amberSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    color: appColors.slate900,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: appColors.slate600,
    marginBottom: 24,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  primaryButton: {
    marginBottom: 10,
  },
  secondaryButton: {
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 12,
  },
  secondaryButtonPressed: {
    backgroundColor: appColors.slate100,
  },
  secondaryButtonText: {
    color: appColors.slate700,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
