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
import { appBorders, appSpacing, appStates } from "../../theme/tokens";
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

  const renderActionRow = ({
    accessibilityLabel,
    busy,
    divider,
    iconWeight,
    label,
    onPress,
  }: {
    accessibilityLabel: string;
    busy: boolean;
    divider: boolean;
    iconWeight: "bold" | "regular";
    label: string;
    onPress: () => void;
  }) => (
    <Pressable
      disabled={busy}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.actionRow,
        divider && styles.actionRowDivider,
        busy && styles.moreRowDisabled,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.actionIcon}>
        {busy ? (
          <ActivityIndicator color={appColors.textPrimary} size="small" />
        ) : (
          <CalendarCheckIcon
            size={20}
            color={appColors.textPrimary}
            weight={iconWeight}
          />
        )}
      </View>
      <Text style={styles.actionRowText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        Fast actions for {selectedMealLabel}
      </Text>
      {renderActionRow({
        accessibilityLabel: `Repeat yesterday's ${selectedMealLabel}`,
        busy: isRepeatingYesterdayMeal,
        divider: true,
        iconWeight: "bold",
        label: isRepeatingYesterdayMeal ? "Repeating" : "Repeat meal",
        onPress: onRepeatYesterdayMeal,
      })}
      {renderActionRow({
        accessibilityLabel: "Copy yesterday",
        busy: isCopyingYesterday,
        divider: false,
        iconWeight: "regular",
        label: isCopyingYesterday ? "Copying" : "Copy last day",
        onPress: onCopyYesterday,
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: appSpacing.md,
  },
  sectionTitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: appSpacing.xxs,
  },
  actionRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  actionRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceField,
  },
  actionRowText: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  moreRowDisabled: {
    opacity: appStates.disabledOpacity,
  },
  cardPressed: {
    opacity: appStates.pressedOpacity,
  },
});

export default FoodDiaryMoreSection;
