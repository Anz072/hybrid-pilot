import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ClockIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "phosphor-react-native";
import type { FoodDiaryHourBucket } from "./foodDiaryTypes";
import {
  calculateLoggedNutrition,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  formatFoodServing,
  formatMacroLine,
} from "./foodUtils";

type FoodDiaryTimelineSectionProps = {
  hourBuckets: FoodDiaryHourBucket[];
  selectedHour: number;
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entryId: number) => void;
  onEditEntry: (entryId: number) => void;
  onSelectHour: (hour: number) => void;
};

const FoodDiaryTimelineSection = ({
  hourBuckets,
  selectedHour,
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  onSelectHour,
}: FoodDiaryTimelineSectionProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Timeline</Text>
      <Text style={styles.sectionText}>
        Every visible hour stays readable, even when it is empty.
      </Text>
      <View style={styles.timeline}>
        {hourBuckets.map((bucket, index) => {
          const selected = bucket.hour === selectedHour;
          const isLast = index === hourBuckets.length - 1;

          return (
            <View key={bucket.hour} style={styles.timelineRow}>
              <Pressable
                onPress={() => onSelectHour(bucket.hour)}
                style={styles.axis}
              >
                <Text
                  style={[
                    styles.axisLabel,
                    selected && styles.axisLabelActive,
                  ]}
                >
                  {formatFoodHourLabel(bucket.hour)}
                </Text>
                <View style={styles.axisTrack}>
                  <View
                    style={[styles.axisDot, selected && styles.axisDotActive]}
                  />
                  {!isLast ? <View style={styles.axisLine} /> : null}
                </View>
              </Pressable>
              <View style={styles.timelineContent}>
                <View
                  style={[styles.hourCard, selected && styles.hourCardActive]}
                >
                  <View
                    style={[
                      styles.rowBetween,
                      { marginBottom: bucket.entries.length ? 10 : 0 },
                    ]}
                  >
                    <View>
                      <Text style={styles.hourTitle}>
                        {bucket.entries.length
                          ? `${bucket.entries.length} ${bucket.entries.length === 1 ? "entry" : "entries"}`
                          : "No entries yet"}
                      </Text>
                      <Text style={styles.hourText}>
                        {bucket.entries.length
                          ? `${Math.round(bucket.totals.calories)} kcal | ${formatMacroLine(bucket.totals)}`
                          : "Add food here if you want the full day visible."}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onAddFood(bucket.hour)}
                      style={({ pressed }) => [
                        styles.addPill,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text style={styles.addPillText}>Add</Text>
                    </Pressable>
                  </View>
                  {bucket.entries.length > 0 ? (
                    <View style={styles.stack}>
                      {bucket.entries.map((entry) => {
                        const nutrition = calculateLoggedNutrition(entry);
                        const time = formatFoodLoggedTime(
                          entry.loggedAt ?? entry.createdAt,
                        );

                        return (
                          <View key={entry.id} style={styles.entryCard}>
                            <Pressable
                              style={styles.entryMain}
                              onPress={() => onEditEntry(entry.id)}
                            >
                              <View style={styles.rowBetween}>
                                <View style={styles.entryCopy}>
                                  <Text
                                    style={styles.entryTitle}
                                    numberOfLines={2}
                                  >
                                    {entry.foodName}
                                  </Text>
                                  <Text style={styles.entryTime}>{time}</Text>
                                </View>
                                <Text style={styles.entryCalories}>
                                  {Math.round(nutrition.calories)} kcal
                                </Text>
                              </View>
                              <View style={styles.entryMetaRow}>
                                <View style={styles.entryPill}>
                                  <ClockIcon
                                    size={12}
                                    color="#6D52EA"
                                    weight="bold"
                                  />
                                  <Text style={styles.entryPillText}>
                                    {time}
                                  </Text>
                                </View>
                                {entry.mealType?.trim() ? (
                                  <View style={styles.entryPill}>
                                    <Text style={styles.entryPillText}>
                                      {entry.mealType.trim()}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.entryText}>
                                {formatFoodServing(
                                  entry.quantityG,
                                  entry.servingUnit,
                                )}{" "}
                                | {formatMacroLine(nutrition)}
                              </Text>
                            </Pressable>
                            <View style={styles.entryActions}>
                              <Pressable
                                onPress={() => onEditEntry(entry.id)}
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.cardPressed,
                                ]}
                              >
                                <PencilSimpleIcon
                                  size={16}
                                  color="#6D52EA"
                                  weight="bold"
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => onDeleteEntry(entry.id)}
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.cardPressed,
                                ]}
                              >
                                <TrashIcon
                                  size={16}
                                  color="#DC2626"
                                  weight="bold"
                                />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
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
  timeline: {
    gap: 8,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  axis: {
    width: 62,
    alignItems: "center",
  },
  axisLabel: {
    color: "#8A809F",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 8,
  },
  axisLabelActive: {
    color: "#6D52EA",
  },
  axisTrack: {
    flex: 1,
    alignItems: "center",
  },
  axisDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: "#DDD3F3",
  },
  axisDotActive: {
    backgroundColor: "#6D52EA",
  },
  axisLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#ECE5F6",
    marginTop: 6,
    marginBottom: -2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  hourCard: {
    borderRadius: 22,
    backgroundColor: "#FCFBFF",
    borderWidth: 1,
    borderColor: "#ECE5F8",
    padding: 14,
  },
  hourCardActive: {
    borderColor: "#CDBEFF",
    backgroundColor: "#FAF7FF",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hourTitle: {
    color: "#1B1529",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  hourText: {
    color: "#7F7791",
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 210,
  },
  addPill: {
    borderRadius: 999,
    backgroundColor: "#EFE9FA",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addPillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  stack: {
    gap: 10,
  },
  entryCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE3F7",
    padding: 12,
  },
  entryMain: {
    flex: 1,
  },
  entryCopy: {
    flex: 1,
    paddingRight: 8,
  },
  entryTitle: {
    color: "#1B1529",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  entryTime: {
    color: "#8A809F",
    fontSize: 12,
    fontWeight: "700",
  },
  entryCalories: {
    color: "#1B1529",
    fontSize: 14,
    fontWeight: "900",
  },
  entryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  entryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#F3EEFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryPillText: {
    color: "#6D52EA",
    fontSize: 11,
    fontWeight: "800",
  },
  entryText: {
    color: "#6E6582",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  entryActions: {
    justifyContent: "space-between",
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2FC",
    borderWidth: 1,
    borderColor: "#E8E1F5",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryTimelineSection;
