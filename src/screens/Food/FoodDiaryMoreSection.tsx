import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MinusIcon, PlusIcon } from "phosphor-react-native";
import type { FoodDiaryHourBucket } from "./foodDiaryTypes";
import { formatFoodHourLabel } from "./foodUtils";

type FoodDiaryMoreSectionProps = {
  hourBuckets: FoodDiaryHourBucket[];
  selectedHour: number;
  visibleEndHour: number;
  visibleStartHour: number;
  onChangeEnd: (next: number) => void;
  onChangeStart: (next: number) => void;
  onAddFood: (hour: number) => void;
  onCopyYesterday: () => void;
  onCreateCustomFood: () => void;
  onResetHours: () => void;
  onSelectHour: (hour: number) => void;
};

const FoodDiaryMoreSection = ({
  hourBuckets,
  selectedHour,
  visibleEndHour,
  visibleStartHour,
  onChangeEnd,
  onChangeStart,
  onAddFood,
  onCopyYesterday,
  onCreateCustomFood,
  onResetHours,
  onSelectHour,
}: FoodDiaryMoreSectionProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>More</Text>
      <Text style={styles.sectionText}>
        Support actions that stay out of the way.
      </Text>
      <View style={styles.stack}>
        <Pressable
          onPress={() => onAddFood(selectedHour)}
          style={({ pressed }) => [
            styles.moreRow,
            styles.selectedSlotRow,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>Selected slot</Text>
            <Text style={styles.moreText}>
              Add food directly into {formatFoodHourLabel(selectedHour)}.
            </Text>
          </View>
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>Add food</Text>
          </View>
        </Pressable>
        <View style={styles.preferenceCard}>
          <View style={styles.preferenceHeader}>
            <View style={styles.moreCopy}>
              <Text style={styles.moreTitle}>Quick slot</Text>
              <Text style={styles.moreText}>
                Choose the hour used by quick actions.
              </Text>
            </View>
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
        </View>
        <View style={styles.preferenceCard}>
          <View style={styles.preferenceHeader}>
            <View style={styles.moreCopy}>
              <Text style={styles.moreTitle}>Timeline hours</Text>
              <Text style={styles.moreText}>
                Your diary will remember this visible range.
              </Text>
            </View>
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
                  disabled={visibleStartHour <= 0}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    visibleStartHour <= 0 && styles.dimmed,
                    pressed && visibleStartHour > 0 && styles.cardPressed,
                  ]}
                >
                  <MinusIcon size={16} color="#4F3D83" weight="bold" />
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
                  <PlusIcon size={16} color="#4F3D83" weight="bold" />
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
                  <MinusIcon size={16} color="#4F3D83" weight="bold" />
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
                  <PlusIcon size={16} color="#4F3D83" weight="bold" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
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
  preferenceCard: {
    borderRadius: 18,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#ECE5F8",
    padding: 14,
  },
  preferenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
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
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  smallLabel: {
    textAlign: "center",
    color: "#7E7399",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  rangeStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
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
    fontWeight: "700",
  },
  hourRow: {
    gap: 10,
    paddingRight: 10,
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
  selectedSlotRow: {
    backgroundColor: "#F4F0FF",
    borderColor: "#DCD2F8",
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
