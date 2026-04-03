import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BarbellIcon,
  BicycleIcon,
  SneakerMoveIcon,
} from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OnboardingParamList,
  TrainingType,
} from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";

type Props = NativeStackScreenProps<OnboardingParamList, "Training">;

const TrainingProfileScreen = ({ navigation, route }: Props) => {
  const options: {
    label: string;
    value: TrainingType;
    icon: React.ReactNode;
    note?: string;
  }[] = [
    {
      label: "Running",
      value: "running",
      icon: <SneakerMoveIcon size={36} color="#353535ad" weight="fill" />,
    },
    {
      label: "Cycling",
      value: "cycling",
      icon: <BicycleIcon size={36} color="#353535ad" weight="fill" />,
    },
    {
      label: "Gym / Bodybuilding",
      value: "bodybuilding",
      icon: <BarbellIcon size={36} color="#353535ad" weight="fill" />,
    },
    {
      label: "CrossFit",
      value: "crossfit",
      icon: <BarbellIcon size={36} color="#353535ad" weight="fill" />,
    },
    {
      label: "Other",
      value: "other",
      icon: <BarbellIcon size={36} color="#353535ad" weight="fill" />,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Training Profile</Text>
      <Text style={styles.title}>What do you train?</Text>
      <Text style={styles.subtitle}>
        This helps us connect fueling with performance trends.
      </Text>

      <View style={styles.listWrap}>
        {options.map((option) => (
          <OnboardingButton
            key={option.value}
            label={option.label}
            subtitle={option.note ?? " "}
            value={option.value}
            borderColor="#383838"
            navigation={navigation}
            navGoal="FuelPlan"
            dataToSend={{
              goal: route.params.goal,
              bodyData: route.params.bodyData,
              activity: route.params.activity,
              training: option.value,
            }}
            icon={option.icon}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 24,
    backgroundColor: "#F8FAFC",
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
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 18,
  },
  listWrap: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 12,
  },
  optionPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
  },
  optionNote: {
    marginTop: 2,
    color: "#9A3412",
    fontSize: 12,
  },
});

export default TrainingProfileScreen;
