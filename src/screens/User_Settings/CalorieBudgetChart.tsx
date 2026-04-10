import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  CALORIE_SCHEDULE_DAY_LABELS,
  getMondayFirstDayIndex,
} from "../../engine/calorieTargets";
import { appColors } from "../../theme/colors";

type CalorieBudgetChartProps = {
  highlightDate?: Date | null;
  subtitle?: string;
  title: string;
  values: Array<number | null>;
};

const CHART_BAR_MAX_HEIGHT = 120;

const CalorieBudgetChart = ({
  highlightDate,
  subtitle,
  title,
  values,
}: CalorieBudgetChartProps) => {
  const hasAnyValues = values.some((value) => value != null && value > 0);
  const maxValue = Math.max(1, ...values.map((value) => value ?? 0));
  const highlightedIndex =
    highlightDate != null ? getMondayFirstDayIndex(highlightDate) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {hasAnyValues ? (
        <View style={styles.chartWrap}>
          <View style={styles.barRail}>
            {values.map((value, index) => {
              const safeValue = value ?? 0;
              const height = Math.max(
                safeValue > 0 ? 14 : 6,
                (safeValue / maxValue) * CHART_BAR_MAX_HEIGHT,
              );
              const highlighted = highlightedIndex === index;

              return (
                <View key={`${CALORIE_SCHEDULE_DAY_LABELS[index]}-${index}`} style={styles.barColumn}>
                  <Text
                    style={[
                      styles.barValue,
                      highlighted && styles.barValueHighlighted,
                    ]}
                  >
                    {safeValue > 0 ? safeValue : "--"}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height },
                        highlighted && styles.barFillHighlighted,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      highlighted && styles.barLabelHighlighted,
                    ]}
                  >
                    {CALORIE_SCHEDULE_DAY_LABELS[index]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Set a calorie target to see your weekly shape.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  title: {
    color: appColors.slate900,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 16,
  },
  subtitle: {
    color: appColors.slate600,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  chartWrap: {
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  barRail: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 8,
  },
  barValue: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "700",
  },
  barValueHighlighted: {
    color: appColors.foodPrimaryDark,
  },
  barTrack: {
    width: "100%",
    height: CHART_BAR_MAX_HEIGHT,
    justifyContent: "flex-end",
    borderRadius: 14,
    backgroundColor: appColors.slate100,
    padding: 4,
  },
  barFill: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: appColors.foodPrimaryOverlay,
  },
  barFillHighlighted: {
    backgroundColor: appColors.foodPrimary,
  },
  barLabel: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  barLabelHighlighted: {
    color: appColors.foodPrimaryDark,
  },
  empty: {
    color: appColors.slate500,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default CalorieBudgetChart;
