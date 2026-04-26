import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatFoodHourLabel } from "./foodUtils";
import { appColors } from "../../theme/colors";
import {
  BowlFoodIcon,
  CalendarCheckIcon,
  CookingPotIcon,
  LightningIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from "phosphor-react-native";

type FoodDiaryMoreSectionProps = {
  isDayComplete: boolean;
  isDayCompleteLoading: boolean;
  isCopyingYesterday: boolean;
  selectedHour: number;
  onToggleDayComplete: () => void;
  onCopyYesterday: () => void;
  onQuickAddFood: () => void;
  onCreateRecipe: () => void;
  onCreateCustomFood: () => void;
};

const FoodDiaryMoreSection = ({
  isDayComplete,
  isDayCompleteLoading,
  isCopyingYesterday,
  selectedHour,
  onToggleDayComplete,
  onCopyYesterday,
  onQuickAddFood,
  onCreateRecipe,
  onCreateCustomFood,
}: FoodDiaryMoreSectionProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.quickActionGrid}>
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
                weight="bold"
              />
            )}
          </View>
          <Text style={styles.actionTileText}>
            {isCopyingYesterday ? "Copying" : "Copy"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onQuickAddFood}
          accessibilityLabel={`Quick add at ${formatFoodHourLabel(selectedHour)}`}
          style={({ pressed }) => [
            styles.actionTile,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            <LightningIcon
              size={22}
              color={appColors.textPrimary}
              weight="fill"
            />
          </View>
          <Text style={styles.actionTileText}>Quick</Text>
        </Pressable>
        <Pressable
          onPress={onCreateCustomFood}
          accessibilityLabel="Create custom meal"
          style={({ pressed }) => [
            styles.actionTile,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            <BowlFoodIcon
              size={22}
              color={appColors.textPrimary}
              weight="bold"
            />
          </View>
          <Text style={styles.actionTileText}>Meal</Text>
        </Pressable>
        <Pressable
          onPress={onCreateRecipe}
          accessibilityLabel="Create recipe"
          style={({ pressed }) => [
            styles.actionTile,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            <CookingPotIcon
              size={22}
              color={appColors.textPrimary}
              weight="bold"
            />
          </View>
          <Text style={styles.actionTileText}>Recipe</Text>
        </Pressable>
      </View>

      <View style={styles.stack}>
        <Pressable
          disabled={isDayCompleteLoading}
          onPress={onToggleDayComplete}
          style={({ pressed }) => [
            styles.moreRow,
            isDayComplete && styles.moreRowAccent,
            isDayCompleteLoading && styles.moreRowDisabled,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>
              {isDayCompleteLoading
                ? isDayComplete
                  ? "Updating completion"
                  : "Marking day complete"
                : isDayComplete
                  ? "Day complete"
                  : "Mark day complete"}
            </Text>
            <Text style={styles.moreText}>
              {isDayCompleteLoading
                ? "Please wait while the diary day status is being saved."
                : isDayComplete
                  ? "This day is counted toward adaptive calorie analysis until the diary changes again."
                  : "Confirm this day is fully logged so adaptive calories can use it."}
            </Text>
          </View>
          <View
            style={[
              styles.morePill,
              isDayComplete && styles.morePillAccent,
              isDayCompleteLoading && styles.morePillLoading,
            ]}
          >
            {!isDayComplete ? (
              <ShieldIcon size={32} />
            ) : (
              <ShieldCheckIcon size={32} />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 12,
  },
  sectionText: {
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  quickActionGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  actionTile: {
    flex: 1,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  actionTileText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  stack: {
    gap: 10,
  },
  infoCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 14,
  },
  hourRow: {
    gap: 10,
    paddingRight: 10,
  },
  hourChip: {
    width: 64,
    borderRadius: 8,
    backgroundColor: appColors.surfaceFieldAlt,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  hourChipActive: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  hourChipLabel: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  hourChipLabelActive: {
    color: appColors.white,
  },
  hourChipText: {
    color: appColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  hourChipTextActive: {
    color: appColors.brand300,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  moreRowAccent: {
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  moreRowDisabled: {
    opacity: 0.75,
  },
  selectedSlotRow: {
    backgroundColor: appColors.surfaceCardAlt,
    borderColor: appColors.borderStrong,
  },
  moreCopy: {
    flex: 1,
  },
  moreTitle: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
    textAlign: "center",
    width: "100%",
  },
  moreText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  morePill: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  morePillAccent: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  morePillLoading: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  morePillText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  morePillTextAccent: {
    color: appColors.white,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMoreSection;
