import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatFoodHourLabel } from "./foodUtils";
import { appColors } from "../../theme/colors";

type FoodDiaryMoreSectionProps = {
  selectedHour: number;
  onCopyYesterday: () => void;
  onQuickAddFood: () => void;
  onCreateRecipe: () => void;
  onCreateCustomFood: () => void;
};

const FoodDiaryMoreSection = ({
  selectedHour,
  onCopyYesterday,
  onQuickAddFood,
  onCreateRecipe,
  onCreateCustomFood,
}: FoodDiaryMoreSectionProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>More Actions</Text>
      <View style={styles.stack}>
        <Pressable
          onPress={onCreateRecipe}
          style={({ pressed }) => [
            styles.moreRow,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>Create recipe</Text>
            <Text style={styles.moreText}>
              Build a reusable recipe and log one serving into {formatFoodHourLabel(selectedHour)}.
            </Text>
          </View>
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>Recipe</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onCopyYesterday}
          style={({ pressed }) => [
            styles.moreRow,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>Copy yesterday</Text>
            <Text style={styles.moreText}>
              Reuse the previous day when meals repeat.
            </Text>
          </View>
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>Copy</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onCreateCustomFood}
          style={({ pressed }) => [
            styles.moreRow,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>Create custom food</Text>
            <Text style={styles.moreText}>
              Add a new item directly into {formatFoodHourLabel(selectedHour)}.
            </Text>
          </View>
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>New</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 14,
  },
  sectionText: {
    color: appColors.foodMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  stack: {
    gap: 10,
  },
  infoCard: {
    borderRadius: 18,
    backgroundColor: appColors.foodFieldBg,
    padding: 14,
  },
  hourRow: {
    gap: 10,
    paddingRight: 10,
  },
  hourChip: {
    width: 64,
    borderRadius: 8,
    backgroundColor: appColors.raw_hex_F7F3FC,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  hourChipActive: {
    backgroundColor: appColors.foodPrimaryDark,
    borderColor: appColors.foodPrimaryDark,
  },
  hourChipLabel: {
    color: appColors.foodInk,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  hourChipLabelActive: {
    color: appColors.white,
  },
  hourChipText: {
    color: appColors.raw_hex_827994,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  hourChipTextActive: {
    color: appColors.foodPreviewText,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  moreRowAccent: {
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  selectedSlotRow: {
    backgroundColor: appColors.raw_hex_F4F0FF,
    borderColor: appColors.raw_hex_DCD2F8,
  },
  moreCopy: {
    flex: 1,
  },
  moreTitle: {
    color: appColors.foodText,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  moreText: {
    color: appColors.foodMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  morePill: {
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  morePillAccent: {
    backgroundColor: appColors.foodPrimary,
  },
  morePillText: {
    color: appColors.revolutDark,
    fontSize: 12,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMoreSection;
