import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FireIcon, ShieldCheckIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  GoalType,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";
import OnboardingTopBar from "./OnboardingTopBar";

type Props = NativeStackScreenProps<OnboardingParamList, "Goal">;

type GoalOption = {
  label: string;
  value: GoalType;
  subtitle: string;
  icon: React.ReactNode;
  borderColor: string;
};

const GoalScreen = ({ navigation }: Props) => {
  const options: GoalOption[] = [
    {
      label: "Lose fat",
      value: "lose_fat",
      subtitle: "Slight calorie deficit with protein-first targets.",
      icon: <FireIcon size={36} color="#353535ad" weight="fill" />,
      borderColor: "#383838",
    },
    {
      label: "Maintain",
      value: "maintain",
      subtitle: "Balanced intake to keep performance steady.",
      icon: <ShieldCheckIcon size={36} color="#353535ad" weight="fill" />,
      borderColor: "#383838",
    },
    {
      label: "Build muscle",
      value: "build_muscle",
      subtitle: "Lean surplus and recovery-focused macro split.",
      icon: <TrendUpIcon size={36} color="#353535ad" weight="fill" />,
      borderColor: "#383838",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <OnboardingTopBar onBack={() => navigation.goBack()} stepLabel="Goal" />
      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>Setup</Text>
        <Text style={styles.title}>What is your primary goal?</Text>
        <Text style={styles.subtitle}>
          Pick one to tune calories, macros, and training recommendations.
        </Text>
      </View>
      <View style={styles.optionsWrap}>
        {options.map((option) => (
          <View key={option.value}>
            <OnboardingButton
              label={option.label}
              subtitle={option.subtitle}
              value={option.value}
              dataToSend={
                option.value === "maintain"
                  ? { goal: option.value, goalRateKgPerWeek: null }
                  : { goal: option.value }
              }
              borderColor={option.borderColor}
              navigation={navigation}
              icon={option.icon}
              navGoal={option.value === "maintain" ? "BodyData" : "GoalRate"}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
    backgroundColor: "#F8FAFC",
  },
  bgOrbTop: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#FFE4CC",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  headerWrap: {
    marginTop: 20,
    marginBottom: 22,
  },
  eyebrow: {
    alignSelf: "flex-start",
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
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  optionsWrap: {
    gap: 12,
  },
});

export default GoalScreen;
