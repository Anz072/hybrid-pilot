import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatFoodHourLabel } from "./foodUtils";

type FoodDiaryMoreSectionProps = {
  selectedHour: number;
  onCopyYesterday: () => void;
  onCreateCustomFood: () => void;
};

const FoodDiaryMoreSection = ({
  selectedHour,
  onCopyYesterday,
  onCreateCustomFood,
}: FoodDiaryMoreSectionProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>More</Text>
      <Text style={styles.sectionText}>
        Support actions that stay out of the way.
      </Text>
      <View style={styles.stack}>
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
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#1B1529",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionText: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  stack: {
    gap: 10,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#ECE5F8",
    padding: 14,
  },
  moreCopy: {
    flex: 1,
  },
  moreTitle: {
    color: "#1B1529",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  moreText: {
    color: "#7F7791",
    fontSize: 13,
    lineHeight: 18,
  },
  morePill: {
    borderRadius: 999,
    backgroundColor: "#1F1831",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  morePillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMoreSection;
