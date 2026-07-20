import React from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
import { CaretDownIcon, CaretUpIcon } from "phosphor-react-native";
import type { DBUser } from "../../store/DB_TYPES";
import { AppText, InteractiveCard, NumericText, ProgressRail } from "../../components/ui";
import type { FoodNutritionTotals } from "./foodUtils";
import { appColors, type AppColorValue } from "../../theme/colors";
import { appSpacing, appSurfaces } from "../../theme/tokens";

type MacroBarProps = {
  accent: AppColorValue;
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
        <AppText numberOfLines={1} style={styles.progressHeadline} variant="bodySmall">
          <AppText variant="bodySmallStrong">{label}</AppText>
          <AppText color="secondary" variant="bodySmall">
            {"  "}
            {safeConsumed.toFixed(places)} / {hasTarget ? safeTarget.toFixed(places) : "--"} {unit}
          </AppText>
        </AppText>
        <View style={styles.progressMetaGroup}>
          <NumericText color={isOver ? "error" : "secondary"} variant="numberTrendDelta">
            {progressLabel}
          </NumericText>
          {accessory ? (
            <View style={styles.progressAccessory}>{accessory}</View>
          ) : null}
        </View>
      </View>
      <ProgressRail
        color={accent}
        height={6}
        max={hasTarget ? safeTarget : 0}
        overColor={accent}
        value={safeConsumed}
      />
    </View>
  );
};

const formatWholeNumber = (value: number) => Math.round(value).toLocaleString();

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

  const consumed = Number.isFinite(totals.calories) ? totals.calories : 0;
  const target =
    energyTargetCalories != null && energyTargetCalories > 0
      ? energyTargetCalories
      : null;
  const remaining = target != null ? Math.round(target - consumed) : null;
  const remainingLabel =
    remaining == null
      ? "Set a calorie target"
      : remaining >= 0
        ? `${formatWholeNumber(remaining)} kcal left`
        : `${formatWholeNumber(Math.abs(remaining))} kcal over`;

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
      <View style={styles.calorieRow}>
        <View style={styles.calorieValueGroup}>
          <View style={styles.calorieValueRow}>
            <NumericText adjustsFontSizeToFit numberOfLines={1} variant="numberDisplay">
              {formatWholeNumber(consumed)}
            </NumericText>
            <AppText color="secondary" style={styles.calorieTarget} variant="label">
              / {target != null ? formatWholeNumber(target) : "--"} kcal
            </AppText>
          </View>
          <AppText
            color={remaining != null && remaining < 0 ? "error" : "muted"}
            variant="bodySmall"
          >
            {remainingLabel}
          </AppText>
        </View>
        <View style={styles.disclosure}>
          {expanded ? (
            <CaretUpIcon size={18} color={appColors.textSecondary} weight="bold" />
          ) : (
            <CaretDownIcon size={18} color={appColors.textSecondary} weight="bold" />
          )}
        </View>
      </View>
      <ProgressRail
        color={appColors.calories}
        height={6}
        max={target ?? 0}
        style={styles.calorieRail}
        value={consumed}
      />
      {expanded ? (
        <View style={styles.macroPanel}>
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
        </View>
      ) : null}
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
  calorieRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  calorieValueGroup: {
    flex: 1,
    gap: appSpacing.xxs,
  },
  calorieValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  calorieTarget: {
    marginLeft: appSpacing.xxs,
  },
  disclosure: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.soft,
  },
  calorieRail: {
    marginTop: appSpacing.sm,
  },
  macroPanel: {
    marginTop: appSpacing.md,
    gap: appSpacing.sm,
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
  },
  progressMetaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  progressAccessory: {
    width: 18,
    height: 18,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});

export default FoodDiaryHeroCard;
