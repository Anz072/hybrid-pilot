import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DBUser } from "../../store/DB_TYPES";
import {
  clampFoodRatio,
  type FoodNutritionTotals,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

type MacroBarProps = {
  accent: string;
  consumed: number;
  label: string;
  places?: number;
  target: number | null;
  unit: string;
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
  places = 1,
  target,
  unit,
}: MacroBarProps) => {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = target != null && Number.isFinite(target) ? target : null;
  const hasTarget = safeTarget != null && safeTarget > 0;
  const rawRatio = hasTarget ? safeConsumed / safeTarget : 0;
  const safeRatio = Number.isFinite(rawRatio) ? rawRatio : 0;
  const ratio = clampFoodRatio(safeRatio);
  const isOver = hasTarget && safeRatio > 1;
  const remaining = hasTarget ? safeTarget - safeConsumed : null;

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
        <Text
          style={[styles.progressPercent, isOver && styles.progressPercentOver]}
        >
          {remaining != null ? `${remaining.toFixed(places)} ${unit}` : ""}
        </Text>
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
  return (
    <View style={styles.hero}>
      <View style={styles.progressPanel}>
        <MacroBar
          accent={appColors.plum820}
          consumed={Number(totals.calories.toFixed(0))}
          label="Energy"
          places={0}
          target={energyTargetCalories}
          unit="kcal"
        />
        <MacroBar
          accent={appColors.raw_hex_22C55E}
          consumed={Number(totals.proteinG.toFixed(0))}
          label="Protein"
          target={user?.proteinG ?? null}
          unit="g"
        />
        <MacroBar
          accent={appColors.cyan500}
          consumed={Number(totals.carbsG.toFixed(0))}
          label="Carbs"
          target={user?.carbsG ?? null}
          unit="g"
        />
        <MacroBar
          accent={appColors.raw_hex_F97316}
          consumed={Number(totals.fatG.toFixed(0))}
          label="Fat"
          target={user?.fatG ?? null}
          unit="g"
        />
       
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  progressPanel: {
    gap: 6,
    borderRadius: 8,
  },
  macroCard: {
    gap: 6,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  progressHeadline: {
    flex: 1,
    color: appColors.foodText,
    fontSize: 13,
    lineHeight: 16,
  },
  progressHeadlineStrong: {
    fontWeight: "500",
  },
  progressHeadlineMuted: {
    color: appColors.plum720,
    fontWeight: "400",
  },
  progressPercent: {
    color: appColors.plum820,
    fontSize: 14,
    fontWeight: "400",
  },
  progressPercentOver: {
    color: appColors.danger600,
  },
  progressTrack: {
    marginTop: -3,
    flexDirection: "row",
    height: 6,
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
