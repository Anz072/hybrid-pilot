import React from "react";
import { StyleSheet, View } from "react-native";
import { GaugeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  ActivityLevel,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingButton from "./onboardingButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";
import {
  formatBodySummary,
  formatGoalSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "Activity">;

const ActivityLevelScreen = ({ navigation, route }: Props) => {
  const levels: {
    label: string;
    note: string;
    value: ActivityLevel;
  }[] = [
    {
      label: "Desk mode",
      value: "sedentary",
      note: "Mostly seated, minimal movement.",
    },
    {
      label: "Light movement",
      value: "lightly_active",
      note: "Daily steps with occasional activity.",
    },
    {
      label: "Regular training",
      value: "moderately_active",
      note: "Frequent workouts through the week.",
    },
    {
      label: "High output",
      value: "very_active",
      note: "Demanding routine and heavy training volume.",
    },
    {
      label: "Athlete load",
      value: "athlete",
      note: "Performance-centric, high weekly load.",
    },
  ];

  return (
    <OnboardingStepScreen
      eyebrow="Daily Baseline"
      headerAccessory={<GaugeIcon size={24} color={appColors.actionPrimary} weight="fill" />}
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(5)}
      stepLabel="Activity"
      subtitle="Choose your baseline outside dedicated workouts."
      title="How active are you?"
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
                training: route.params.training,
                proteinFocus: route.params.proteinFocus,
              }),
          },
        ]}
      />

      <View style={styles.listWrap}>
        {levels.map((item) => (
          <OnboardingButton
            dataToSend={{
              goal: route.params.goal,
              goalStrategy: route.params.goalStrategy,
              bodyData: route.params.bodyData,
              activity: item.value,
              training: route.params.training,
              proteinFocus: route.params.proteinFocus,
            }}
            key={item.value}
            label={item.label}
            navGoal="Training"
            navigation={navigation}
            subtitle={item.note}
            value={item.value}
          />
        ))}
      </View>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  listWrap: {
    gap: appSpacing.sm,
  },
});

export default ActivityLevelScreen;
