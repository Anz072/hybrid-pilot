import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ForkKnifeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OnboardingParamList,
  OnboardingProfile,
} from "../../navigation/onboardingTypes";
import { Pie, PolarChart } from "victory-native";
import { buildFuelPlan, getGoalRateLabel } from "./initialCalculations";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatTrainingSummary,
} from "./onboardingSummary";

type Props = NativeStackScreenProps<OnboardingParamList, "FuelPlan">;

type MacroChartDatum = {
  label: string;
  value: number;
  color: string;
  grams: number;
};

const FuelPlanScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { goal, goalRateKgPerWeek, bodyData, activity, training } = route.params;
  const fuelPlan = buildFuelPlan({
    ...bodyData,
    activity,
    goal,
    goalRateKgPerWeek,
  });
  const goalRateLabel = getGoalRateLabel(goal, goalRateKgPerWeek);

  const onboarding: OnboardingProfile = {
    goal,
    goalRateKgPerWeek,
    bodyData,
    activity,
    training,
    fuelPlan,
  };

  const macroChartData = React.useMemo<MacroChartDatum[]>(
    () => [
      {
        label: "Protein",
        value: Math.max(1, fuelPlan.protein * 4),
        color: "#2563EB",
        grams: fuelPlan.protein,
      },
      {
        label: "Carbs",
        value: Math.max(1, fuelPlan.carbs * 4),
        color: "#0D9488",
        grams: fuelPlan.carbs,
      },
      {
        label: "Fats",
        value: Math.max(1, fuelPlan.fats * 9),
        color: "#D97706",
        grams: fuelPlan.fats,
      },
    ],
    [fuelPlan.carbs, fuelPlan.fats, fuelPlan.protein],
  );

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
      <OnboardingTopBar onBack={() => navigation.goBack()} stepLabel="Fuel Plan" />
      <Text style={styles.eyebrow}>Fuel Strategy</Text>
      <View style={styles.titleRow}>
        <ForkKnifeIcon size={26} color="#0F766E" weight="fill" />
        <Text style={styles.title}>Initial Plan</Text>
      </View>
      <Text style={styles.subtitle}>
        Auto-generated from your body data, activity, and goals.
      </Text>
      {goalRateLabel ? (
        <View style={styles.pacePill}>
          <Text style={styles.pacePillText}>{goalRateLabel}</Text>
        </View>
      ) : null}

      <OnboardingReviewCard
        items={[
          {
            label: "Goal",
            value: formatGoalSummary(goal, goalRateKgPerWeek),
            onEdit: () => navigation.push("Goal"),
          },
          {
            label: "Body data",
            value: formatBodySummary(bodyData),
            onEdit: () =>
              navigation.push("BodyData", {
                goal,
                goalRateKgPerWeek,
              }),
          },
          {
            label: "Activity",
            value: formatActivitySummary(activity),
            onEdit: () =>
              navigation.push("Activity", {
                goal,
                goalRateKgPerWeek,
                bodyData,
              }),
          },
          {
            label: "Training",
            value: formatTrainingSummary(training),
            onEdit: () =>
              navigation.push("Training", {
                goal,
                goalRateKgPerWeek,
                bodyData,
                activity,
                training,
              }),
          },
        ]}
      />

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Macro Split</Text>
        <View style={styles.chartWrap}>
          <PolarChart
            data={macroChartData}
            labelKey="label"
            valueKey="value"
            colorKey="color"
          >
            <Pie.Chart innerRadius="65%" />
          </PolarChart>

          <View style={styles.chartCenter} pointerEvents="none">
            <Text style={styles.chartCenterValue}>{fuelPlan.calories}</Text>
            <Text style={styles.chartCenterLabel}>kcal</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          {macroChartData.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[styles.legendSwatch, { backgroundColor: item.color }]}
              />
              <Text
                style={styles.legendText}
              >{`${item.label} ${item.grams}g`}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Daily calories</Text>
          <Text style={styles.metricValue}>{fuelPlan.calories} kcal</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Protein</Text>
          <Text style={styles.metricValue}>{fuelPlan.protein} g</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Carbs</Text>
          <Text style={styles.metricValue}>{fuelPlan.carbs} g</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Fats</Text>
          <Text style={styles.metricValue}>{fuelPlan.fats} g</Text>
        </View>
      </View>
      <OnboardingPrimaryButton
        label="Looks good"
        style={styles.primaryButton}
        onPress={() => navigation.push("Account", { onboarding })}
      />
      <Text style={styles.helper}>
        Use this as a starting point and review progress after 2-3 consistent weeks.
      </Text>
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
    color: "#0F766E",
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 10,
  },
  pacePill: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  pacePillText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "700",
  },
  metricValue: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "800",
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 14,
    marginBottom: 18,
  },
  chartTitle: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
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
  chartCenterValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 28,
  },
  chartCenterLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  legendRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 20,
  },
  helper: {
    marginTop: 10,
    color: "#475569",
    textAlign: "center",
    fontSize: 13,
  },
});

export default FuelPlanScreen;
