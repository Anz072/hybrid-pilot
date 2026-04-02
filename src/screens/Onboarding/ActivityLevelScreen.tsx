import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GaugeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ActivityLevel, OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Activity">;

const ActivityLevelScreen = ({ navigation, route }: Props) => {
  const levels: { label: string; value: ActivityLevel }[] = [ 
    { label: "Desk mode", value: "sedentary" },
    { label: "Light movement", value: "lightly_active" },
    { label: "Regular training", value: "moderately_active" },
    { label: "High output", value: "very_active" },
    { label: "Beast mode", value: "athlete" },
  ];

  return (
    <View style={styles.container}>
      <GaugeIcon size={32} color="#0ea5e9" weight="fill" />
      <Text style={styles.title}>How active are you?</Text>
      <Text style={styles.subtitle}>Choose your baseline outside dedicated workouts.</Text>

      {levels.map((item) => (
        <TouchableOpacity
          key={item.value}
          style={styles.levelButton}
          onPress={() =>
            navigation.navigate("Training", {
              goal: route.params.goal,
              bodyData: route.params.bodyData,
              activity: item.value,
            })
          }
        >
          <Text style={styles.levelText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f0f9ff",
  },
  title: {
    marginTop: 10,
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
  levelButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  levelText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default ActivityLevelScreen;
