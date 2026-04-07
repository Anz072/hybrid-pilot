import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarIcon, MinusIcon, PlusIcon } from "phosphor-react-native";
import type { DBUser } from "../../store/DB_TYPES";
import type { FoodDiaryHourBucket } from "./foodDiaryTypes";
import {
  clampFoodRatio,
  formatFoodHourLabel,
  formatFoodLongDate,
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
  dateKey: string;
  filledHours: number;
  hourBuckets: FoodDiaryHourBucket[];
  isToday: boolean;
  remainingCalories: number | null;
  selectedDate: Date;
  selectedHour: number;
  totals: FoodNutritionTotals;
  user: DBUser | null;
  visibleEndHour: number;
  visibleStartHour: number;
  onAddFood: (hour: number) => void;
  onChangeEnd: (next: number) => void;
  onChangeStart: (next: number) => void;
  onNextDate: () => void;
  onPrevDate: () => void;
  onResetHours: () => void;
  onSelectHour: (hour: number) => void;
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
  dateKey,
  filledHours,
  hourBuckets,
  isToday,
  remainingCalories,
  selectedDate,
  selectedHour,
  totals,
  user,
  visibleEndHour,
  visibleStartHour,
  onAddFood,
  onChangeEnd,
  onChangeStart,
  onNextDate,
  onPrevDate,
  onResetHours,
  onSelectHour,
}: FoodDiaryHeroCardProps) => {
  return (
    <View style={styles.hero}>
      <View style={[styles.rowBetween, styles.dateRow]}>
        <Pressable
          onPress={onPrevDate}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.navButtonText}>Prev</Text>
        </Pressable>
        <View style={styles.dateCenter}>
          <View style={styles.datePill}>
            <CalendarIcon size={14} color="#6D52EA" weight="bold" />
            <Text style={styles.datePillText}>
              {isToday ? "Today" : formatFoodLongDate(selectedDate)}
            </Text>
          </View>
          <Text style={styles.dateKey}>{dateKey}</Text>
        </View>
        <Pressable
          onPress={onNextDate}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.navButtonText}>Next</Text>
        </Pressable>
      </View>

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

      <View style={[styles.rowBetween, styles.selectedRow]}>
        <View>
          <Text style={styles.smallLabel}>Selected slot</Text>
          <Text style={styles.selectedValue}>
            {formatFoodHourLabel(selectedHour)}
          </Text>
        </View>
        <Pressable
          onPress={() => onAddFood(selectedHour)}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Add food</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hourRow}
      >
        {hourBuckets.map((bucket) => {
          const selected = bucket.hour === selectedHour;
          return (
            <Pressable
              key={bucket.hour}
              onPress={() => onSelectHour(bucket.hour)}
              style={({ pressed }) => [
                styles.hourChip,
                selected && styles.hourChipActive,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[
                  styles.hourChipLabel,
                  selected && styles.hourChipLabelActive,
                ]}
              >
                {formatFoodHourLabel(bucket.hour)}
              </Text>
              <Text
                style={[
                  styles.hourChipText,
                  selected && styles.hourChipTextActive,
                ]}
              >
                {bucket.entries.length > 0
                  ? `${Math.round(bucket.totals.calories)} kcal`
                  : "Open"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rangeCard}>
        <View style={[styles.rowBetween, styles.rangeHeader]}>
          <Text style={styles.rangeTitle}>Visible hours</Text>
          <Pressable
            onPress={onResetHours}
            style={({ pressed }) => [
              styles.resetPill,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.resetPillText}>Reset</Text>
          </Pressable>
        </View>
        <View style={styles.rangeRow}>
          <View style={styles.rangeCell}>
            <Text style={styles.smallLabel}>From</Text>
            <View style={styles.rangeStepper}>
              <Pressable
                onPress={() => onChangeStart(visibleStartHour - 1)}
                disabled={visibleStartHour <= 1}
                style={({ pressed }) => [
                  styles.stepperButton,
                  visibleStartHour <= 1 && styles.dimmed,
                  pressed && visibleStartHour > 1 && styles.cardPressed,
                ]}
              >
                <MinusIcon size={16} />
              </Pressable>
              <Text style={styles.rangeValue}>
                {formatFoodHourLabel(visibleStartHour)}
              </Text>
              <Pressable
                onPress={() => onChangeStart(visibleStartHour + 1)}
                disabled={visibleStartHour >= visibleEndHour - 1}
                style={({ pressed }) => [
                  styles.stepperButton,
                  visibleStartHour >= visibleEndHour - 1 && styles.dimmed,
                  pressed &&
                    visibleStartHour < visibleEndHour - 1 &&
                    styles.cardPressed,
                ]}
              >
                <PlusIcon size={16} />
              </Pressable>
            </View>
          </View>
          <View style={styles.rangeCell}>
            <Text style={styles.smallLabel}>To</Text>
            <View style={styles.rangeStepper}>
              <Pressable
                onPress={() => onChangeEnd(visibleEndHour - 1)}
                disabled={visibleEndHour <= visibleStartHour + 1}
                style={({ pressed }) => [
                  styles.stepperButton,
                  visibleEndHour <= visibleStartHour + 1 && styles.dimmed,
                  pressed &&
                    visibleEndHour > visibleStartHour + 1 &&
                    styles.cardPressed,
                ]}
              >
                <MinusIcon size={16} />
              </Pressable>
              <Text style={styles.rangeValue}>
                {formatFoodHourLabel(visibleEndHour)}
              </Text>
              <Pressable
                onPress={() => onChangeEnd(visibleEndHour + 1)}
                disabled={visibleEndHour >= 23}
                style={({ pressed }) => [
                  styles.stepperButton,
                  visibleEndHour >= 23 && styles.dimmed,
                  pressed && visibleEndHour < 23 && styles.cardPressed,
                ]}
              >
                <PlusIcon size={16} />
              </Pressable>
            </View>
          </View>
        </View>
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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dateRow: {
    marginBottom: 16,
  },
  navButton: {
    width: 64,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F5F1FB",
    borderWidth: 1,
    borderColor: "#E4DDF3",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    color: "#3A314A",
    fontSize: 13,
    fontWeight: "800",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F4F0FF",
    borderWidth: 1,
    borderColor: "#E5DDF8",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 5,
  },
  datePillText: {
    color: "#4F3D83",
    fontSize: 13,
    fontWeight: "800",
  },
  dateKey: {
    color: "#8B839C",
    fontSize: 12,
    fontWeight: "700",
  },
  progressPanel: {
    gap: 6,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#FBFAFF",
  },
  macroCard: {
    gap: 6,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  progressHeadline: {
    flex: 1,
    color: "#1B1529",
    fontSize: 14,
    lineHeight: 20,
  },
  progressHeadlineStrong: {
    fontWeight: "600",
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
    flexDirection: "row",
    height: 8,
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
  summaryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  summaryMetaPill: {
    borderRadius: 999,
    backgroundColor: "#F1ECFA",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryMetaPillWarn: {
    backgroundColor: "#FEE2E2",
  },
  summaryMetaText: {
    color: "#5A4E75",
    fontSize: 12,
    fontWeight: "800",
  },
  summaryMetaTextWarn: {
    color: "#B91C1C",
  },
  selectedRow: {
    marginVertical: 16,
  },
  smallLabel: {
    textAlign: "center",
    color: "#7E7399",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  selectedValue: {
    color: "#1B1529",
    fontSize: 22,
    fontWeight: "900",
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#1F1831",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  hourRow: {
    gap: 10,
    paddingRight: 10,
    marginBottom: 16,
  },
  hourChip: {
    width: 64,
    borderRadius: 8,
    backgroundColor: "#F7F3FC",
    borderWidth: 1,
    borderColor: "#E9E2F7",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  hourChipActive: {
    backgroundColor: "#1F1831",
    borderColor: "#1F1831",
  },
  hourChipLabel: {
    color: "#2F2741",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  hourChipLabelActive: {
    color: "#FFFFFF",
  },
  hourChipText: {
    color: "#827994",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  hourChipTextActive: {
    color: "#CFC5E7",
  },
  rangeCard: {
    borderRadius: 8,
    backgroundColor: "#FBF9FF",
    padding: 14,
  },
  rangeHeader: {
    marginBottom: 10,
  },
  rangeTitle: {
    color: "#1B1529",
    fontSize: 16,
    fontWeight: "900",
  },
  resetPill: {
    borderRadius: 999,
    backgroundColor: "#F0EAFB",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetPillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  rangeCell: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  rangeStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#F1ECFA",
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: {
    opacity: 0.45,
  },
  rangeValue: {
    color: "#1B1529",
    fontSize: 14,
    fontWeight: "600",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryHeroCard;
