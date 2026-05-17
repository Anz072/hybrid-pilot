import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircleIcon, ForkKnifeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { getGoalStrategyRateLabel } from "../../engine/goalStrategy";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import {
  formatActivitySummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "Success"> & {
  onFinish: () => void;
};

const SuccessScreen = ({ onFinish, route }: Props) => {
  const insets = useSafeAreaInsets();
  const goalRateLabel = getGoalStrategyRateLabel(
    route.params.onboarding.goal,
    route.params.onboarding.goalStrategy,
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
      <View style={styles.badge}>
        <CheckCircleIcon size={34} color={appColors.success600} weight="fill" />
      </View>

      <Text style={styles.eyebrow}>Ready</Text>
      <Text style={styles.title}>Your plan is live</Text>
      <Text style={styles.subtitle}>
        We built your starting targets from your goal, activity, training
        profile, and protein focus. You can refine them later as your progress
        comes in.
      </Text>

      <View style={styles.highlightCard}>
        <View style={styles.highlightHeader}>
          <ForkKnifeIcon size={22} color={appColors.success700} weight="fill" />
          <Text style={styles.highlightTitle}>Starting Targets</Text>
        </View>
        {goalRateLabel ? (
          <View style={styles.pacePill}>
            <Text style={styles.pacePillText}>{goalRateLabel}</Text>
          </View>
        ) : null}
        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileLabel}>Calories</Text>
            <Text style={styles.metricTileValue}>
              {route.params.onboarding.fuelPlan.calories}
            </Text>
            <Text style={styles.metricTileUnit}>kcal</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileLabel}>Protein</Text>
            <Text style={styles.metricTileValue}>
              {route.params.onboarding.fuelPlan.protein}
            </Text>
            <Text style={styles.metricTileUnit}>g</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileLabel}>Carbs</Text>
            <Text style={styles.metricTileValue}>
              {route.params.onboarding.fuelPlan.carbs}
            </Text>
            <Text style={styles.metricTileUnit}>g</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileLabel}>Fats</Text>
            <Text style={styles.metricTileValue}>
              {route.params.onboarding.fuelPlan.fats}
            </Text>
            <Text style={styles.metricTileUnit}>g</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Activity</Text>
          <Text style={styles.detailValue}>
            {formatActivitySummary(route.params.onboarding.activity)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Training</Text>
          <Text style={styles.detailValue}>
            {formatTrainingSummary(route.params.onboarding.training)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Protein focus</Text>
          <Text style={styles.detailValue}>
            {formatProteinFocusSummary(route.params.onboarding.proteinFocus)}
          </Text>
        </View>
      </View>

      <OnboardingPrimaryButton
        label="Start Tracking"
        style={styles.button}
        onPress={onFinish}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 22,
    flexGrow: 1,
  },
  bgOrbTop: {
    position: "absolute",
    top: -60,
    right: -46,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -82,
    left: -58,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.brand700,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.success700,
    backgroundColor: appColors.success700,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.slate600,
    marginBottom: 18,
  },
  highlightCard: {
    backgroundColor: appColors.surfaceCanvasAlt,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  highlightTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: appColors.textPrimary,
  },
  pacePill: {
    alignSelf: "flex-start",
    backgroundColor: appColors.brand800,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  pacePillText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    width: "47%",
    backgroundColor: appColors.slate900,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  metricTileLabel: {
    color: appColors.slate500,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  metricTileValue: {
    color: appColors.slate100,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  metricTileUnit: {
    color: appColors.slate600,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  card: {
    backgroundColor: appColors.slate900,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.slate200,
    marginBottom: 18,
  },
  detailRow: {
    gap: 6,
  },
  detailLabel: {
    color: appColors.slate500,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailValue: {
    color: appColors.slate100,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.slate200,
    marginVertical: 12,
  },
  button: {
    marginTop: 4,
  },
});

export default SuccessScreen;

