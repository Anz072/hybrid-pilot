import React from "react";
import { StyleSheet, View } from "react-native";
import { ForkKnifeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pie, PolarChart } from "victory-native";
import { AppCard, AppText, Chip, NumericText } from "../../components/ui";
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
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "FuelPlan">;

type MacroChartDatum = {
  color: string;
  grams: number;
  label: string;
  value: number;
};

const FuelPlanScreen = ({ navigation, route }: Props) => {
  const {
    activity,
    bodyData,
    goal,
    goalStrategy,
    proteinFocus,
    training,
  } = route.params;
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

  const macroChartData = React.useMemo<MacroChartDatum[]>(
    () => [
      {
        label: "Protein",
        value: Math.max(1, fuelPlan.protein * 4),
        color: appColors.protein,
        grams: fuelPlan.protein,
      },
      {
        label: "Carbs",
        value: Math.max(1, fuelPlan.carbs * 4),
        color: appColors.carbs,
        grams: fuelPlan.carbs,
      },
      {
        label: "Fats",
        value: Math.max(1, fuelPlan.fats * 9),
        color: appColors.fat,
        grams: fuelPlan.fats,
      },
    ],
    [fuelPlan.carbs, fuelPlan.fats, fuelPlan.protein],
  );

  return (
    <OnboardingStepScreen
      eyebrow="Fuel Strategy"
      headerAccessory={<ForkKnifeIcon size={24} color={appColors.statusSuccess} weight="fill" />}
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(8)}
      stepLabel="Fuel Plan"
      subtitle="Auto-generated from your body data, activity, goals, and protein bias."
      title="Initial plan"
    >
      {goalRateLabel ? (
        <Chip label={goalRateLabel} selected style={styles.pacePill} />
      ) : null}

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

      <AppCard style={styles.chartCard}>
        <AppText align="center" color="secondary" variant="cardTitle">
          Macro Split
        </AppText>
        <View style={styles.chartWrap}>
          <PolarChart
            colorKey="color"
            data={macroChartData}
            labelKey="label"
            valueKey="value"
          >
            <Pie.Chart innerRadius="65%" />
          </PolarChart>

          <View pointerEvents="none" style={styles.chartCenter}>
            <NumericText variant="numberCalorieHero">
              {fuelPlan.calories}
            </NumericText>
            <AppText color="muted" variant="eyebrow">
              kcal
            </AppText>
          </View>
        </View>
        <View style={styles.legendRow}>
          {macroChartData.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[styles.legendSwatch, { backgroundColor: item.color }]}
              />
              <AppText color="secondary" variant="label">
                {item.label} {item.grams}g
              </AppText>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.metricsCard} variant="soft">
        {[
          ["Daily calories", `${fuelPlan.calories} kcal`],
          ["Protein", `${fuelPlan.protein} g`],
          ["Protein focus", formatProteinFocusSummary(proteinFocus)],
          ["Carbs", `${fuelPlan.carbs} g`],
          ["Fats", `${fuelPlan.fats} g`],
        ].map(([label, value]) => (
          <View key={label} style={styles.metricRow}>
            <AppText color="secondary" variant="bodySmall">
              {label}
            </AppText>
            <NumericText variant="numberMacroRow">
              {value}
            </NumericText>
          </View>
        ))}
      </AppCard>

      <OnboardingPrimaryButton
        label="Looks good"
        onPress={() => navigation.push("Account", { onboarding })}
        style={styles.primaryButton}
      />
      <AppText align="center" color="secondary" style={styles.helper} variant="metadata">
        Use this as a starting point and review progress after 2-3 consistent weeks.
      </AppText>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  pacePill: {
    alignSelf: "flex-start",
    marginBottom: appSpacing.md,
  },
  chartCard: {
    gap: appSpacing.md,
    marginBottom: appSpacing.md,
  },
  chartWrap: {
    height: 180,
    position: "relative",
  },
  chartCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: appSpacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
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
