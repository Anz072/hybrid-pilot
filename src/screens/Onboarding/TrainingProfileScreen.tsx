import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarbellIcon, SneakerMoveIcon, BicycleIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList, TrainingType } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Training">;

const TrainingProfileScreen = ({ navigation, route }: Props) => {
  const options: { label: string; value: TrainingType; icon: React.ReactNode; note?: string }[] = [
    { label: "Running", value: "running", icon: <SneakerMoveIcon size={20} color="#0f172a" weight="fill" /> },
    { label: "Gym / Bodybuilding", value: "bodybuilding", icon: <BarbellIcon size={20} color="#0f172a" weight="fill" /> },
    { label: "CrossFit", value: "crossfit", icon: <BarbellIcon size={20} color="#f97316" weight="fill" />, note: "Choose your box life." },
    { label: "Cycling", value: "cycling", icon: <BicycleIcon size={20} color="#0f172a" weight="fill" /> },
    { label: "Other", value: "other", icon: <BarbellIcon size={20} color="#0f172a" /> },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What do you train?</Text>
      <Text style={styles.subtitle}>This helps us connect fueling with performance trends.</Text>

      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.option}
          onPress={() =>
            navigation.navigate("FuelPlan", {
              goal: route.params.goal,
              bodyData: route.params.bodyData,
              activity: route.params.activity,
              training: option.value,
            })
          }
        >
          {option.icon}
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionText}>{option.label}</Text>
            {option.note ? <Text style={styles.optionNote}>{option.note}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#fff7ed",
  },
  title: {
    marginTop: 40,
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  optionNote: {
    marginTop: 2,
    color: "#9a3412",
    fontSize: 12,
  },
});

export default TrainingProfileScreen;
