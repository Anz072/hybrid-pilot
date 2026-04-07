import React from "react";
import {
  type GestureResponderEvent,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CaretDownIcon,
  CaretUpIcon,
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

type FoodDiaryTimelineItemProps = {
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entryId: number) => void;
  onEditEntry: (entryId: number) => void;
  bucket: FoodDiaryHourBucket;
  collapsed: boolean;
  selected: boolean;
  onToggle: () => void;
};

const withOpacity = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const FoodDiaryTimelineItem = ({
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  bucket,
  collapsed,
  selected,
  onToggle,
}: FoodDiaryTimelineItemProps) => {
  const runWithoutToggling = (
    event: GestureResponderEvent,
    action: () => void,
  ) => {
    event.stopPropagation();
    action();
  };

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.timelineContent,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.hourCard]}>
        <View style={styles.hourHeader}>
          <View style={styles.hourHeaderCopy}>
            <Text
              style={[
                styles.hourTitle,
                bucket.entries.length === 0 && {
                  color: withOpacity("#1B1529", 0.6),
                },
              ]}
            >
              {bucket.entries.length
                ? `${bucket.entries.length} ${bucket.entries.length === 1 ? "entry" : "entries"}`
                : "No entries yet"}
            </Text>
            {bucket.entries.length ? (
              <Text style={styles.hourText}>
                {bucket.entries.length
                  ? `${Math.round(bucket.totals.calories)} kcal | ${formatMacroLine(bucket.totals)}`
                  : "Tap Add to log food here."}
              </Text>
            ) : null}
          </View>
          <View style={styles.hourHeaderActions}>
            {collapsed ? (
              <CaretDownIcon size={16} />
            ) : (
              <CaretUpIcon size={16} />
            )}
          </View>
        </View>

        {!collapsed ? (
          <View style={styles.stack}>
            {bucket.entries.length >= 1 ? (
              bucket.entries.map((entry) => {
                const nutrition = calculateLoggedNutrition(entry);
                const time = formatFoodLoggedTime(
                  entry.loggedAt ?? entry.createdAt,
                );

                return (
                  <View key={entry.id} style={styles.entryCard}>
                    <Pressable
                      style={styles.entryMain}
                      onPress={(event) =>
                        runWithoutToggling(event, () => onEditEntry(entry.id))
                      }
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.entryCopy}>
                          <Text style={styles.entryTitle} numberOfLines={2}>
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
                          <ClockIcon size={12} color="#6D52EA" weight="bold" />
                          <Text style={styles.entryPillText}>{time}</Text>
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
                        {formatFoodServing(entry.quantityG, entry.servingUnit)}{" "}
                        | {formatMacroLine(nutrition)}
                      </Text>
                    </Pressable>
                    <View style={styles.entryActions}>
                      <Pressable
                        onPress={(event) =>
                          runWithoutToggling(event, () => onEditEntry(entry.id))
                        }
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
                        onPress={(event) =>
                          runWithoutToggling(event, () =>
                            onDeleteEntry(entry.id),
                          )
                        }
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <TrashIcon size={16} color="#DC2626" weight="bold" />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <Pressable
                onPress={(event) =>
                  runWithoutToggling(event, () => onAddFood(bucket.hour))
                }
                style={({ pressed }) => [
                  styles.emptyState,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.emptyStateText}>No entries here.</Text>
                <Text style={styles.emptyStateAction}>Tap to add food</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const FoodDiaryTimelineSection = ({
  hourBuckets,
  selectedHour,
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  onSelectHour,
}: FoodDiaryTimelineSectionProps) => {
  const [expandedHours, setExpandedHours] = React.useState<Set<number>>(
    () => new Set(),
  );

  const toggleHour = React.useCallback((hour: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedHours((current) => {
      const next = new Set(current);

      if (next.has(hour)) {
        next.delete(hour);
      } else {
        next.add(hour);
      }

      return next;
    });
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Timeline</Text>
      <View style={styles.timeline}>
        {hourBuckets.map((bucket, index) => {
          const selected = bucket.hour === selectedHour;
          const isLast = index === hourBuckets.length - 1;

          return (
            <View key={bucket.hour} style={styles.timelineRow}>
              <View style={styles.axis}>
                <Text style={[styles.axisLabel]}>
                  {formatFoodHourLabel(bucket.hour)}
                </Text>
                <View style={styles.axisTrack}>
                  <View style={[styles.axisDot]} />
                  {!isLast ? <View style={styles.axisLine} /> : null}
                </View>
              </View>
              <FoodDiaryTimelineItem
                onAddFood={onAddFood}
                onDeleteEntry={onDeleteEntry}
                onEditEntry={onEditEntry}
                bucket={bucket}
                collapsed={!expandedHours.has(bucket.hour)}
                selected={selected}
                onToggle={() => toggleHour(bucket.hour)}
              />
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
    marginBottom: 12,
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
  },
  axis: {
    width: 36,
    marginRight: 6,
    alignItems: "center",
  },
  axisLabel: {
    color: "#8A809F",
    fontSize: 12,
    fontWeight: "800",
  },
  axisLabelActive: {
    color: "#6D52EA",
  },
  axisTrack: {
    flex: 1,
    alignItems: "center",
  },
  axisDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#DDD3F3",
  },
  axisDotActive: {
    backgroundColor: "#6D52EA",
  },
  axisLine: {
    width: 1,
    flex: 1,
    backgroundColor: "#ECE5F6",
    marginBottom: -8,
  },
  timelineContent: {
    flex: 1,
  },
  hourCard: {
    borderRadius: 8,
    backgroundColor: "#FAF7FF",
    padding: 10,
  },
  hourCardActive: {
    borderColor: "#CDBEFF",
    backgroundColor: "#f3eefc",
  },
  hourHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hourHeaderCopy: {
    flex: 1,
  },
  hourHeaderActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hourTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1B1529",
    letterSpacing: 0.5,
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
  collapseText: {
    color: "#8A809F",
    fontSize: 11,
    fontWeight: "800",
  },
  stack: {
    gap: 10,
    marginTop: 12,
  },
  emptyState: {
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE3F7",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyStateText: {
    color: "#1B1529",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  emptyStateAction: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "700",
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
