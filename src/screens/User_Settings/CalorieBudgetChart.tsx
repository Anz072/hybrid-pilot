import React from "react";
import { StyleSheet, View } from "react-native";
import {
  CALORIE_SCHEDULE_DAY_LABELS,
  getMondayFirstDayIndex,
} from "../../engine/calorieTargets";
import { appColors } from "../../theme/colors";
import { AppCard, AppText, NumericText } from "../../components/ui";
import { appRadius, appSpacing, appSurfaces } from "../../theme/tokens";

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
    <AppCard style={styles.card}>
      <AppText variant="cardTitle">{title}</AppText>
      {subtitle ? (
        <AppText color="secondary" style={styles.subtitle} variant="bodySmall">
          {subtitle}
        </AppText>
      ) : null}

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
                  <NumericText
                    align="center"
                    color={highlighted ? "primary" : "muted"}
                    style={[
                      styles.barValue,
                    ]}
                    variant="numberChartAxis"
                  >
                    {safeValue > 0 ? safeValue : "--"}
                  </NumericText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height },
                        highlighted && styles.barFillHighlighted,
                      ]}
                    />
                  </View>
                  <AppText
                    align="center"
                    color={highlighted ? "primary" : "muted"}
                    style={[
                      styles.barLabel,
                    ]}
                    variant="eyebrow"
                  >
                    {CALORIE_SCHEDULE_DAY_LABELS[index]}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <AppText color="secondary" variant="bodySmall">
          Set a calorie target to see your weekly shape.
        </AppText>
      )}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: appSpacing.md,
  },
  subtitle: {
    marginTop: appSpacing.xxs,
    marginBottom: appSpacing.md,
  },
  chartWrap: {
    overflow: "hidden",
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 14,
  },
  barRail: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: appSpacing.xs,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: appSpacing.xs,
  },
  barValue: {
    minHeight: 14,
  },
  barTrack: {
    width: "100%",
    height: CHART_BAR_MAX_HEIGHT,
    justifyContent: "flex-end",
    borderRadius: appRadius.md,
    backgroundColor: appColors.surfaceGhost,
    padding: appSpacing.xxs,
  },
  barFill: {
    width: "100%",
    borderRadius: appRadius.sm,
    backgroundColor: appColors.actionPrimarySoft,
  },
  barFillHighlighted: {
    backgroundColor: appColors.actionPrimary,
  },
  barLabel: {
    minHeight: 16,
  },
});

export default CalorieBudgetChart;
