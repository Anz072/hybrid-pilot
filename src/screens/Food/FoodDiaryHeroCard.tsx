import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DBUser } from "../../store/DB_TYPES";
import {
  clampFoodRatio,
  type FoodNutritionTotals,
} from "./foodUtils";

type MacroBarProps = {
  accent: string;
  consumed: number;
  label: string;
  places?: number;
  target: number | null;
  unit: string;
};

type FoodDiaryHeroCardProps = {
  totals: FoodNutritionTotals;
  user: DBUser | null;
};

const MacroBar = ({
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
          {target && `${target-consumed} kcal`}
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
  totals,
  user,
}: FoodDiaryHeroCardProps) => {
  return (
    <View style={styles.hero}>
      <View style={styles.progressPanel}>
        <MacroBar
          accent="#2F2A3D"
          consumed={totals.calories}
          label="Energy"
          places={0}
          target={user?.calorieAllowance ?? null}
          unit="kcal"
        />
        <MacroBar
          accent="#22C55E"
          consumed={totals.proteinG}
          label="Protein"
          target={user?.proteinG ?? null}
          unit="g"
        />
        <MacroBar
          accent="#06B6D4"
          consumed={totals.carbsG}
          label="Carbs"
          target={user?.carbsG ?? null}
          unit="g"
        />
        <MacroBar
          accent="#F97316"
          consumed={totals.fatG}
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
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
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
    color: "#1B1529",
    fontSize: 13,
    lineHeight: 16,
  },
  progressHeadlineStrong: {
    fontWeight: "500",
  },
  progressHeadlineMuted: {
    color: "#463D59",
    fontWeight: "400",
  },
  progressPercent: {
    color: "#2F2A3D",
    fontSize: 14,
    fontWeight: "400",
  },
  progressPercentOver: {
    color: "#DC2626",
  },
  progressTrack: {
    marginTop: -3,
    flexDirection: "row",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E5E1EC",
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
