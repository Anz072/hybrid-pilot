import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BarbellIcon,
  BicycleIcon,
  CheckIcon,
  SneakerMoveIcon,
} from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OnboardingParamList,
  TrainingType,
} from "../../navigation/onboardingTypes";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "Training">;

const TrainingProfileScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const [selectedTraining, setSelectedTraining] = React.useState<TrainingType[]>(
    route.params.training ?? [],
  );

  const options: {
    label: string;
    value: TrainingType;
    icon: React.ReactNode;
    note: string;
  }[] = [
    {
      label: "Running",
      value: "running",
      icon: <SneakerMoveIcon size={30} color="#0F172A" weight="fill" />,
      note: "Useful for endurance-focused fueling and recovery.",
    },
    {
      label: "Cycling",
      value: "cycling",
      icon: <BicycleIcon size={30} color="#0F172A" weight="fill" />,
      note: "Great if riding volume changes your energy demands.",
    },
    {
      label: "Gym / Bodybuilding",
      value: "bodybuilding",
      icon: <BarbellIcon size={30} color="#0F172A" weight="fill" />,
      note: "Helps bias the plan toward performance and muscle retention.",
    },
    {
      label: "CrossFit",
      value: "crossfit",
      icon: <BarbellIcon size={30} color="#0F172A" weight="fill" />,
      note: "Useful when training mixes strength and conditioning demands.",
    },
    {
      label: "Other",
      value: "other",
      icon: <BarbellIcon size={30} color="#0F172A" weight="fill" />,
      note: "Pick this if your main training mode is something else.",
    },
  ];

  const toggleTraining = (value: TrainingType) => {
    setSelectedTraining((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <OnboardingTopBar
        onBack={() => navigation.goBack()}
        stepLabel="Training"
      />
      <Text style={styles.eyebrow}>Training Profile</Text>
      <Text style={styles.title}>What do you train?</Text>
      <Text style={styles.subtitle}>
        Select all that apply so the plan reflects your real training mix.
      </Text>

      <OnboardingReviewCard
        items={[
          {
            label: "Goal",
            value: formatGoalSummary(
              route.params.goal,
              route.params.goalRateKgPerWeek,
            ),
            onEdit: () => navigation.push("Goal"),
          },
          {
            label: "Body data",
            value: formatBodySummary(route.params.bodyData),
            onEdit: () =>
              navigation.push("BodyData", {
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
              }),
          },
          {
            label: "Activity",
            value: formatActivitySummary(route.params.activity),
            onEdit: () =>
              navigation.push("Activity", {
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
                bodyData: route.params.bodyData,
              }),
          },
        ]}
      />

      <View style={styles.listWrap}>
        {options.map((option) => {
          const isSelected = selectedTraining.includes(option.value);

          return (
            <Pressable
              key={option.value}
              onPress={() => toggleTraining(option.value)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionRow}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  <Text style={styles.optionNote}>{option.note}</Text>
                </View>
                <View style={styles.optionMeta}>
                  <View style={styles.iconBadge}>{option.icon}</View>
                  <View
                    style={[
                      styles.checkBadge,
                      isSelected && styles.checkBadgeSelected,
                    ]}
                  >
                    {isSelected ? (
                      <CheckIcon size={14} color="#FFFFFF" weight="bold" />
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.helper}>
        Pick at least one. You can come back later and adjust this mix.
      </Text>

      <OnboardingPrimaryButton
        label="Continue"
        disabled={selectedTraining.length === 0}
        style={styles.primaryButton}
        onPress={() =>
          navigation.push("FuelPlan", {
            goal: route.params.goal,
            goalRateKgPerWeek: route.params.goalRateKgPerWeek,
            bodyData: route.params.bodyData,
            activity: route.params.activity,
            training: selectedTraining,
          })
        }
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 22,
    flexGrow: 1,
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 14,
  },
  optionSelected: {
    borderColor: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  optionPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 17,
    marginBottom: 4,
  },
  optionNote: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  optionMeta: {
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeSelected: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  helper: {
    marginTop: 12,
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 18,
  },
});

export default TrainingProfileScreen;
