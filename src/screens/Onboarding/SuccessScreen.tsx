import React from "react";
import { StyleSheet, View } from "react-native";
import { CheckCircleIcon, ForkKnifeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppCard, AppText, NumericText, SuccessState } from "../../components/ui";
import { getGoalStrategyRateLabel } from "../../engine/goalStrategy";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";
import {
  formatActivitySummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "Success"> & {
  onFinish: () => void;
};

const SuccessScreen = ({ onFinish, route }: Props) => {
  const goalRateLabel = getGoalStrategyRateLabel(
    route.params.onboarding.goal,
    route.params.onboarding.goalStrategy,
  );

  return (
    <OnboardingStepScreen
      centered
      progress={onboardingStepProgress(10)}
      stepLabel="Ready"
      subtitle="We built your starting targets from your goal, activity, training profile, and protein focus. You can refine them later as your progress comes in."
      title="Your plan is live"
    >
      <SuccessState
        icon={<CheckCircleIcon size={32} color={appColors.statusSuccess} weight="fill" />}
        style={styles.successState}
        title="Ready"
      />

      <AppCard style={styles.highlightCard}>
        <View style={styles.highlightHeader}>
          <ForkKnifeIcon size={22} color={appColors.statusSuccess} weight="fill" />
          <AppText variant="cardTitle">Starting Targets</AppText>
        </View>
        {goalRateLabel ? (
          <AppText color="coral" style={styles.paceText} variant="eyebrow">
            {goalRateLabel}
          </AppText>
        ) : null}
        <View style={styles.metricGrid}>
          {[
            ["Calories", route.params.onboarding.fuelPlan.calories, "kcal"],
            ["Protein", route.params.onboarding.fuelPlan.protein, "g"],
            ["Carbs", route.params.onboarding.fuelPlan.carbs, "g"],
            ["Fats", route.params.onboarding.fuelPlan.fats, "g"],
          ].map(([label, value, unit]) => (
            <View key={label} style={styles.metricTile}>
              <AppText color="muted" variant="eyebrow">
                {label}
              </AppText>
              <NumericText variant="numberMacroSummary">
                {value}
              </NumericText>
              <AppText color="secondary" variant="label">
                {unit}
              </AppText>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.detailCard} variant="soft">
        {[
          ["Activity", formatActivitySummary(route.params.onboarding.activity)],
          ["Training", formatTrainingSummary(route.params.onboarding.training)],
          [
            "Protein focus",
            formatProteinFocusSummary(route.params.onboarding.proteinFocus),
          ],
        ].map(([label, value], index) => (
          <View key={label}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.detailRow}>
              <AppText color="muted" variant="eyebrow">
                {label}
              </AppText>
              <AppText color="secondary" variant="bodyStrong">
                {value}
              </AppText>
            </View>
          </View>
        ))}
      </AppCard>

      <OnboardingPrimaryButton
        label="Start Tracking"
        onPress={onFinish}
        style={styles.button}
      />
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  successState: {
    padding: appSpacing.md,
    marginBottom: appSpacing.md,
  },
  highlightCard: {
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  paceText: {
    alignSelf: "flex-start",
    backgroundColor: appColors.actionPrimarySoft,
    borderRadius: appRadius.pill,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.xs,
  },
  metricTile: {
    width: "47%",
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appColors.borderSoft,
    backgroundColor: appSurfaces.soft,
    padding: appSpacing.sm,
    gap: appSpacing.xxs,
  },
  detailCard: {
    marginBottom: appSpacing.md,
  },
  detailRow: {
    gap: appSpacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.borderSoft,
    marginVertical: appSpacing.sm,
  },
  button: {
    marginTop: appSpacing.xs,
  },
});

export default SuccessScreen;
