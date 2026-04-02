import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FireIcon, ShieldCheckIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GoalType, OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Goal">;

const GoalScreen = ({ navigation }: Props) => {
  const options: { label: string; value: GoalType; icon: React.ReactNode }[] = [
    { label: "Lose fat", value: "lose_fat", icon: <FireIcon size={20} color="#dc2626" weight="fill" /> },
    { label: "Maintain", value: "maintain", icon: <ShieldCheckIcon size={20} color="#0369a1" weight="fill" /> },
    { label: "Build muscle", value: "build_muscle", icon: <TrendUpIcon size={20} color="#15803d" weight="fill" /> },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What is your goal?</Text>
      <Text style={styles.subtitle}>Pick one so we can tune your calories, macros, and coach vibe.</Text>

      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.option}
          onPress={() => navigation.navigate("BodyData", { goal: option.value })}
        >
          {option.icon}
          <Text style={styles.optionText}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 24,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
});

export default GoalScreen;
