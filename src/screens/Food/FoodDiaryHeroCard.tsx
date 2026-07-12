import React from "react";
import { LayoutAnimation, StyleSheet, Text, View } from "react-native";
import { CaretDownIcon, CaretUpIcon } from "phosphor-react-native";
import type { DBUser } from "../../store/DB_TYPES";
import { InteractiveCard } from "../../components/ui";
import { clampFoodRatio, type FoodNutritionTotals } from "./foodUtils";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing } from "../../theme/tokens";

type MacroBarProps = {
  accent: string;
  consumed: number;
  label: string;
  places?: number;
  target: number | null;
  unit: string;
  accessory?: React.ReactNode;
};

type FoodDiaryHeroCardProps = {
  energyTargetCalories: number | null;
  totals: FoodNutritionTotals;
  user: DBUser | null;
};

export const MacroBar = ({
  accent,
  consumed,
  label,
  places = 0,
  target,
  unit,
  accessory,
}: MacroBarProps) => {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = target != null && Number.isFinite(target) ? target : null;
  const hasTarget = safeTarget != null && safeTarget > 0;
  const rawRatio = hasTarget ? safeConsumed / safeTarget : 0;
  const safeRatio = Number.isFinite(rawRatio) ? rawRatio : 0;
  const ratio = clampFoodRatio(safeRatio);
  const isOver = hasTarget && safeRatio > 1;
  const remaining = hasTarget ? safeTarget - safeConsumed : null;
  const progressLabel =
    remaining == null
      ? ""
      : remaining >= 0
        ? `${remaining.toFixed(places)} ${unit} left`
        : `${Math.abs(remaining).toFixed(places)} ${unit} over`;

  return (
    <View style={styles.macroCard}>
      <View style={styles.progressTextRow}>
        <Text style={styles.progressHeadline}>
          <Text style={styles.progressHeadlineStrong}>{label}</Text>
          <Text style={styles.progressHeadlineMuted}>
            {" "}
            - {safeConsumed.toFixed(places)} /{" "}
            {hasTarget ? safeTarget.toFixed(places) : "--"} {unit}
          </Text>
        </Text>
        <View style={styles.progressMetaGroup}>
          <Text
            style={[
              styles.progressPercent,
              isOver && styles.progressPercentOver,
            ]}
          >
            {progressLabel}
          </Text>
          {accessory ? (
            <View style={styles.progressAccessory}>{accessory}</View>
          ) : null}
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: accent,
              flex: ratio,
              minWidth: ratio > 0 ? 6 : 0,
            },
          ]}
        />
        <View style={[styles.progressRemainder, { flex: 1 - ratio }]} />
      </View>
    </View>
  );
};

const FoodDiaryHeroCard = ({
  energyTargetCalories,
  totals,
  user,
}: FoodDiaryHeroCardProps) => {
  const [expanded, setExpanded] = React.useState(false);
  const toggleExpanded = React.useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => !current);
  }, []);

  return (
    <InteractiveCard
      accessibilityLabel={
        expanded ? "Collapse nutrition summary" : "Expand nutrition summary"
      }
      accessibilityState={{ expanded }}
      onPress={toggleExpanded}
      variant="hero"
      style={styles.hero}
    >
      <View style={styles.progressPanel}>
        <MacroBar
          accent={appColors.calories}
          consumed={Number(totals.calories.toFixed(0))}
          label="Energy"
          places={0}
          target={energyTargetCalories}
          unit="kcal"
          accessory={
            expanded ? (
              <CaretUpIcon
                size={17}
                color={appColors.textMuted}
                weight="bold"
              />
            ) : (
              <CaretDownIcon
                size={17}
                color={appColors.textMuted}
                weight="bold"
              />
            )
          }
        />
        {expanded ? (
          <>
            <MacroBar
              accent={appColors.protein}
              consumed={Number(totals.proteinG.toFixed(0))}
              label="Protein"
              target={user?.proteinG ?? null}
              unit="g"
            />
            <MacroBar
              accent={appColors.carbs}
              consumed={Number(totals.carbsG.toFixed(0))}
              label="Carbs"
              target={user?.carbsG ?? null}
              unit="g"
            />
            <MacroBar
              accent={appColors.fat}
              consumed={Number(totals.fatG.toFixed(0))}
              label="Fat"
              target={user?.fatG ?? null}
              unit="g"
            />
          </>
        ) : null}
      </View>
    </InteractiveCard>
  );
};

const styles = StyleSheet.create({
  hero: {
    marginTop: appSpacing.xs,
    marginBottom: appSpacing.sm,
    paddingHorizontal: 0,
    paddingVertical: appSpacing.xxs,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  progressPanel: {
    gap: appSpacing.xxs,
    borderRadius: appRadius.sm,
  },
  macroCard: {
    gap: appSpacing.xxs,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: appSpacing.xs,
  },
  progressHeadline: {
    flex: 1,
    color: appColors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  progressHeadlineStrong: {
    fontWeight: "500",
  },
  progressHeadlineMuted: {
    color: appColors.textSecondary,
    fontWeight: "400",
  },
  progressMetaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  progressPercent: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  progressPercentOver: {
    color: appColors.danger600,
  },
  progressAccessory: {
    width: 18,
    height: 18,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  progressTrack: {
    marginTop: -2,
    flexDirection: "row",
    height: 9,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhostStrong,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressRemainder: {
    height: "100%",
  },
});

export default FoodDiaryHeroCard;
