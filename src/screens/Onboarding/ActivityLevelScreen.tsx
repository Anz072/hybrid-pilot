import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GaugeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  ActivityLevel,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";

type Props = NativeStackScreenProps<OnboardingParamList, "Activity">;

const ActivityLevelScreen = ({ navigation, route }: Props) => {
  const levels: {
    label: string;
    value: ActivityLevel;
    note: string;
    accent: string;
    bgColor?: string;
    borderColor?: string;
  }[] = [
    {
      label: "Desk mode",
      value: "sedentary",
      note: "Mostly seated, minimal movement.",
      accent: "#BFDBFE",
      bgColor: "#bfdbfe9a",
      borderColor: "#60a5fa",
    },
    {
      label: "Light movement",
      value: "lightly_active",
      note: "Daily steps with occasional activity.",
      accent: "#A7F3D0",
      bgColor: "#a7f3d09a",
      borderColor: "#10b981",
    },
    {
      label: "Regular training",
      value: "moderately_active",
      note: "Frequent workouts through the week.",
      accent: "#FDE68A",
      bgColor: "#fde68a9a",
      borderColor: "#f59e0b",
    },
    {
      label: "High output",
      value: "very_active",
      note: "Demanding routine and heavy training volume.",
      accent: "#FECACA",
      bgColor: "#fecaca9a",
      borderColor: "#ef4444",
    },
    {
      label: "Beast mode",
      value: "athlete",
      note: "Performance-centric, high weekly load.",
      accent: "#DDD6FE",
      bgColor: "#ddd6fe9a",
      borderColor: "#7c3aed",
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <GaugeIcon size={24} color="#0369A1" weight="fill" />
          <Text style={styles.eyebrow}>Daily Baseline</Text>
        </View>
        <Text style={styles.title}>How active are you?</Text>
        <Text style={styles.subtitle}>
          Choose your baseline outside dedicated workouts.
        </Text>
      </View>

      <View style={styles.listWrap}>
        {levels.map((item) => (
          <View key={item.value}>
            <OnboardingButton
              label={item.label}
              subtitle={item.note}
              dataToSend={{
                goal: route.params.goal,
                bodyData: route.params.bodyData,
                activity: item.value,
              }}
              value={item.value}
              borderColor={`#383838`}
              navigation={navigation}
              navGoal="Training"
            />
          </View>
        ))}
      </View>
    </ScrollView>
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
    top: -64,
    right: -46,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -72,
    left: -56,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  headerWrap: {
    marginTop: 18,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#075985",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  listWrap: {
    gap: 10,
  },
  // levelButton: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   backgroundColor: "#FFFFFF",
  //   borderWidth: 1,
  //   borderColor: "#E2E8F0",
  //   borderRadius: 14,
  //   paddingVertical: 14,
  //   paddingHorizontal: 14,
  //   shadowColor: "#0F172A",
  //   shadowOpacity: 0.06,
  //   shadowRadius: 8,
  //   shadowOffset: { width: 0, height: 4 },
  //   elevation: 2,
  // },
  levelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  levelButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  accentBar: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: 999,
    marginRight: 10,
  },
  levelTextWrap: {
    flex: 1,
  },
  levelText: {
    fontSize: 20,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 3,
    marginTop: 4,
  },
  levelNote: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  levelText99: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 3,
  },
  levelNote99: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ActivityLevelScreen;
