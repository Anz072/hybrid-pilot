import React from "react";
import { StyleSheet, View } from "react-native";
import { BarbellIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, NumericText, OptionCard } from "../../components/ui";
import { PROTEIN_FOCUS_OPTIONS } from "../../engine/proteinFocus";
import type {
  OnboardingParamList,
  ProteinFocus,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingStepScreen, {
  onboardingStepProgress,
} from "./OnboardingStepScreen";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "ProteinFocus">;

const ProteinFocusScreen = ({ navigation, route }: Props) => {
  const [selectedProteinFocus, setSelectedProteinFocus] =
    React.useState<ProteinFocus>(route.params.proteinFocus ?? "focused");

  return (
    <OnboardingStepScreen
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(7)}
      stepLabel="Protein Focus"
      subtitle="Grams of protein per kilogram of body weight."
      title="Choose your protein target"
      footer={
        <OnboardingPrimaryButton
          label="Continue"
          onPress={() =>
            navigation.push("FuelPlan", {
              goal: route.params.goal,
              goalStrategy: route.params.goalStrategy,
              bodyData: route.params.bodyData,
              activity: route.params.activity,
              training: route.params.training,
              proteinFocus: selectedProteinFocus,
            })
          }
        />
      }
    >
      <View style={styles.listWrap}>
        {PROTEIN_FOCUS_OPTIONS.map((option) => {
          const isSelected = selectedProteinFocus === option.value;

          return (
            <OptionCard
              key={option.value}
              onPress={() => setSelectedProteinFocus(option.value)}
              selected={isSelected}
              title={option.label}
              trailing={
                <NumericText color="secondary" variant="numberTrendDelta">
                  {option.gramsPerKg} g/kg
                </NumericText>
              }
            />
          );
        })}
      </View>

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
              }),
          },
          {
            label: "Training",
            value: formatTrainingSummary(route.params.training),
            onEdit: () =>
              navigation.push("Training", {
                goal: route.params.goal,
                goalStrategy: route.params.goalStrategy,
                bodyData: route.params.bodyData,
                activity: route.params.activity,
                training: route.params.training,
                proteinFocus: selectedProteinFocus,
              }),
          },
        ]}
      />
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

export default ProteinFocusScreen;
