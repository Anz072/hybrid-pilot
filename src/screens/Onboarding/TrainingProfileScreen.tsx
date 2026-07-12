import React from "react";
import { StyleSheet, View } from "react-native";
import {
  BarbellIcon,
  BicycleIcon,
  SneakerMoveIcon,
} from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, OptionCard } from "../../components/ui";
import { DEFAULT_PROTEIN_FOCUS } from "../../engine/proteinFocus";
import type {
  OnboardingParamList,
  TrainingType,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "Training">;

const TrainingProfileScreen = ({ navigation, route }: Props) => {
  const [selectedTraining, setSelectedTraining] = React.useState<TrainingType[]>(
    route.params.training ?? [],
  );

  const options: {
    icon: React.ReactNode;
    label: string;
    note: string;
    value: TrainingType;
  }[] = [
    {
      label: "Running",
      value: "running",
      icon: <SneakerMoveIcon size={22} color={appColors.textPrimary} weight="fill" />,
      note: "Useful for endurance-focused fueling and recovery.",
    },
    {
      label: "Cycling",
      value: "cycling",
      icon: <BicycleIcon size={22} color={appColors.textPrimary} weight="fill" />,
      note: "Great if riding volume changes your energy demands.",
    },
    {
      label: "Gym / Bodybuilding",
      value: "bodybuilding",
      icon: <BarbellIcon size={22} color={appColors.textPrimary} weight="fill" />,
      note: "Helps bias the plan toward performance and muscle retention.",
    },
    {
      label: "CrossFit",
      value: "crossfit",
      icon: <BarbellIcon size={22} color={appColors.textPrimary} weight="fill" />,
      note: "Useful when training mixes strength and conditioning demands.",
    },
    {
      label: "Other",
      value: "other",
      icon: <BarbellIcon size={22} color={appColors.textPrimary} weight="fill" />,
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
    <OnboardingStepScreen
      eyebrow="Training Profile"
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(6)}
      stepLabel="Training"
      subtitle="Select all that apply so the plan reflects your real training mix."
      title="What do you train?"
      footer={
        <OnboardingPrimaryButton
          disabled={selectedTraining.length === 0}
          label="Continue"
          onPress={() =>
            navigation.push("ProteinFocus", {
              goal: route.params.goal,
              goalStrategy: route.params.goalStrategy,
              bodyData: route.params.bodyData,
              activity: route.params.activity,
              training: selectedTraining,
              proteinFocus:
                route.params.proteinFocus ?? DEFAULT_PROTEIN_FOCUS,
            })
          }
        />
      }
    >
      <OnboardingReviewCard
        items={[
          {
            label: "Goal",
            value: formatGoalSummary(
              route.params.goal,
              route.params.goalStrategy,
            ),
            onEdit: () => navigation.push("Goal"),
          },
          {
            label: "Body data",
            value: formatBodySummary(route.params.bodyData),
            onEdit: () =>
              navigation.push("BodyData", {
                goal: route.params.goal,
                goalStrategy: route.params.goalStrategy,
                bodyData: route.params.bodyData,
                training: selectedTraining,
                proteinFocus: route.params.proteinFocus,
              }),
          },
          {
            label: "Activity",
            value: formatActivitySummary(route.params.activity),
            onEdit: () =>
              navigation.push("Activity", {
                goal: route.params.goal,
                goalStrategy: route.params.goalStrategy,
                bodyData: route.params.bodyData,
                training: selectedTraining,
                proteinFocus: route.params.proteinFocus,
              }),
          },
        ]}
      />

      <View style={styles.listWrap}>
        {options.map((option) => {
          const isSelected = selectedTraining.includes(option.value);

          return (
            <OptionCard
              icon={option.icon}
              key={option.value}
              onPress={() => toggleTraining(option.value)}
              selected={isSelected}
              subtitle={option.note}
              title={option.label}
            />
          );
        })}
      </View>

      <AppText align="center" color="secondary" style={styles.helper} variant="metadata">
        Pick at least one. You can come back later and adjust this mix.
      </AppText>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  listWrap: {
    gap: appSpacing.sm,
  },
  helper: {
    marginTop: appSpacing.sm,
  },
});

export default TrainingProfileScreen;
