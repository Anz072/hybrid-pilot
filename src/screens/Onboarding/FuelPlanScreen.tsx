import React from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppCard, AppText, NumericText } from "../../components/ui";
import { getGoalStrategyRateLabel } from "../../engine/goalStrategy";
import { getAgeFromBirthdateValue } from "../../helpers";
import type {
  OnboardingParamList,
  OnboardingProfile,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import { buildFuelPlan } from "./initialCalculations";
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

type Props = NativeStackScreenProps<OnboardingParamList, "FuelPlan">;

const FuelPlanScreen = ({ navigation, route }: Props) => {
  const { activity, bodyData, goal, goalStrategy, proteinFocus, training } =
    route.params;
  const age = getAgeFromBirthdateValue(bodyData.birthdate) ?? 25;
  const fuelPlan = buildFuelPlan({
    activity,
    age,
    goal,
    goalStrategy,
    heightCm: bodyData.heightCm,
    proteinFocus,
    sex: bodyData.sex,
    weightKg: bodyData.weightKg,
  });
  const goalRateLabel = getGoalStrategyRateLabel(goal, goalStrategy);

  const onboarding: OnboardingProfile = {
    activity,
    bodyData,
    fuelPlan,
    goal,
    goalStrategy,
    proteinFocus,
    training,
  };

  return (
    <OnboardingStepScreen
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(8)}
      stepLabel="Fuel Plan"

      title="Your starting targets"
    >
      <View style={styles.calorieHero}>
        <NumericText variant="numberCalorieHero">
          {fuelPlan.calories}
        </NumericText>
        <AppText color="secondary" variant="bodySmall">
          kcal / day
        </AppText>
      </View>
      {goalRateLabel ? (
        <AppText
          color="secondary"
          style={styles.paceText}
          variant="bodySmallStrong"
        >
          {goalRateLabel}
        </AppText>
      ) : null}

      <AppCard style={styles.metricsCard} variant="plain">
        {[
          ["Protein", `${fuelPlan.protein} g`],
          ["Carbs", `${fuelPlan.carbs} g`],
          ["Fats", `${fuelPlan.fats} g`],
        ].map(([label, value]) => (
          <View key={label} style={styles.metricRow}>
            <AppText color="secondary" variant="bodySmall">
              {label}
            </AppText>
            <NumericText variant="numberMacroRow">{value}</NumericText>
          </View>
        ))}
      </AppCard>

      <OnboardingReviewCard
        items={[
          {
            label: "Goal",
            value: formatGoalSummary(goal, goalStrategy),
            onEdit: () => navigation.push("Goal"),
          },
          {
            label: "Body data",
            value: formatBodySummary(bodyData),
            onEdit: () =>
              navigation.push("BodyData", {
                goal,
                goalStrategy,
                bodyData,
                training,
                proteinFocus,
              }),
          },
          {
            label: "Activity",
            value: formatActivitySummary(activity),
            onEdit: () =>
              navigation.push("Activity", {
                goal,
                goalStrategy,
                bodyData,
                training,
                proteinFocus,
              }),
          },
          {
            label: "Training",
            value: formatTrainingSummary(training),
            onEdit: () =>
              navigation.push("Training", {
                goal,
                goalStrategy,
                bodyData,
                activity,
                training,
                proteinFocus,
              }),
          },
          {
            label: "Protein focus",
            value: formatProteinFocusSummary(proteinFocus),
            onEdit: () =>
              navigation.push("ProteinFocus", {
                goal,
                goalStrategy,
                bodyData,
                activity,
                training,
                proteinFocus,
              }),
          },
        ]}
      />
      <OnboardingPrimaryButton
        label="Looks good"
        onPress={() => navigation.push("Account", { onboarding })}
        style={styles.primaryButton}
      />
      <AppText
        align="center"
        color="secondary"
        style={styles.helper}
        variant="metadata"
      >
        Use this as a starting point and review progress after 2-3 consistent
        weeks.
      </AppText>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  calorieHero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: appSpacing.xs,
    marginBottom: appSpacing.sm,
  },
  paceText: {
    alignSelf: "flex-start",
    marginBottom: appSpacing.md,
  },
  metricsCard: {
    gap: appSpacing.xs,
    marginBottom: appSpacing.md,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: appSpacing.sm,
  },
  primaryButton: {
    marginTop: appSpacing.xs,
  },
  helper: {
    marginTop: appSpacing.sm,
  },
});

export default FuelPlanScreen;
