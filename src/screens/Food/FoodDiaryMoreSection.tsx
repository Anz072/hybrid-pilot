import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MEAL_SLOT_LABELS, type MealSlot } from "./foodUtils";
import { appColors } from "../../theme/colors";
import { appStates } from "../../theme/tokens";
import { CalendarCheckIcon } from "phosphor-react-native";

type FoodDiaryMoreSectionProps = {
  isCopyingYesterday: boolean;
  isRepeatingYesterdayMeal: boolean;
  selectedMeal: MealSlot;
  onCopyYesterday: () => void;
  onRepeatYesterdayMeal: () => void;
};

const FoodDiaryMoreSection = ({
  isCopyingYesterday,
  isRepeatingYesterdayMeal,
  selectedMeal,
  onCopyYesterday,
  onRepeatYesterdayMeal,
}: FoodDiaryMoreSectionProps) => {
  const selectedMealLabel = MEAL_SLOT_LABELS[selectedMeal];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        Fast actions for {selectedMealLabel}
      </Text>
      <View style={styles.quickActionGrid}>
        <Pressable
          disabled={isRepeatingYesterdayMeal}
          onPress={onRepeatYesterdayMeal}
          accessibilityLabel={`Repeat yesterday's ${selectedMealLabel}`}
          style={({ pressed }) => [
            styles.actionTile,
            isRepeatingYesterdayMeal && styles.moreRowDisabled,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            {isRepeatingYesterdayMeal ? (
              <ActivityIndicator color={appColors.textPrimary} size="small" />
            ) : (
              <CalendarCheckIcon
                size={22}
                color={appColors.textPrimary}
                weight="bold"
              />
            )}
          </View>
          <Text style={styles.actionTileText}>
            {isRepeatingYesterdayMeal ? "Repeating" : "Repeat meal"}
          </Text>
        </Pressable>
        <Pressable
          disabled={isCopyingYesterday}
          onPress={onCopyYesterday}
          accessibilityLabel="Copy yesterday"
          style={({ pressed }) => [
            styles.actionTile,
            isCopyingYesterday && styles.moreRowDisabled,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            {isCopyingYesterday ? (
              <ActivityIndicator color={appColors.textPrimary} size="small" />
            ) : (
              <CalendarCheckIcon
                size={22}
                color={appColors.textPrimary}
                weight="regular"
              />
            )}
          </View>
          <Text style={styles.actionTileText}>
            {isCopyingYesterday ? "Copying" : "Copy last day"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceCanvas,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  quickActionGrid: {
    flexDirection: "row",
    gap: 8,
  },
  actionTile: {
    flex: 1,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 0,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  actionTileText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  moreRowDisabled: {
    opacity: appStates.disabledOpacity,
  },
  cardPressed: {
    opacity: appStates.pressedOpacity,
  },
});

export default FoodDiaryMoreSection;
