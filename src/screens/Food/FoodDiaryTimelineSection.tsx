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
  XIcon,
} from "phosphor-react-native";
import type { FoodDiaryHourBucket } from "./foodDiaryTypes";
import {
  calculateLoggedNutrition,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  formatFoodServing,
  formatMacroLine,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

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
                  color: withOpacity(appColors.foodText, 0.6),
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
                  <Pressable
                    key={entry.id}
                    style={styles.entryCard}
                    onPress={(event) =>
                      runWithoutToggling(event, () => onEditEntry(entry.id))
                    }
                  >
                    <View style={styles.entryMain}>
                      <View style={styles.rowBetween}>
                        <View style={styles.entryCopy}>
                          <Text style={styles.entryTitle} numberOfLines={2}>
                            {entry.foodName}
                          </Text>
                        </View>
                        <View style={styles.entryActions}>
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
                            <XIcon size={18} color={appColors.neutral300} />
                          </Pressable>
                        </View>
                        {/* <Text style={styles.entryCalories}>
                          {Math.round(nutrition.calories)} kcal
                        </Text> */}
                      </View>
                      <View
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          gap: 4,
                        }}
                      >
                        <Text style={styles.entryText}>{time}</Text>
                        <Text style={styles.entryText}>|</Text>
                        <Text style={styles.entryText}>
                          {formatFoodServing(
                            entry.quantityG,
                            entry.servingUnit,
                          )}{" "}
                          | {(nutrition.calories)} kcal
                        </Text>
                      </View>
                    </View>
                  </Pressable>
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
    backgroundColor: appColors.white,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },
  sectionText: {
    color: appColors.foodMuted,
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
    color: appColors.foodPlaceholder,
    fontSize: 12,
    fontWeight: "800",
  },
  axisLabelActive: {
    color: appColors.foodPrimary,
  },
  axisTrack: {
    flex: 1,
    alignItems: "center",
  },
  axisDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: appColors.lavenderDot,
  },
  axisDotActive: {
    backgroundColor: appColors.foodPrimary,
  },
  axisLine: {
    width: 1,
    flex: 1,
    backgroundColor: appColors.foodSectionBg,
    marginBottom: -8,
  },
  timelineContent: {
    flex: 1,
  },
  hourCard: {
    borderRadius: 8,
    backgroundColor: appColors.foodSurfaceAlt,
    padding: 10,
  },
  hourCardActive: {
    borderColor: appColors.lavenderRowBorder,
    backgroundColor: appColors.raw_hex_f3eefc,
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
    color: appColors.foodText,
    letterSpacing: 0.5,
  },
  hourText: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 210,
  },
  addPill: {
    borderRadius: 999,
    backgroundColor: appColors.raw_hex_EFE9FA,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addPillText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  collapseText: {
    color: appColors.foodPlaceholder,
    fontSize: 11,
    fontWeight: "800",
  },
  stack: {
    gap: 10,
    marginTop: 12,
  },
  emptyState: {
    borderRadius: 14,
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.foodTimelineBorder,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyStateText: {
    color: appColors.foodText,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  emptyStateAction: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  entryCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryMain: {
    flex: 1,
  },
  entryCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  entryTitle: {
    color: appColors.foodText,
    fontSize: 16,
    marginBottom: 4,
    fontWeight: "700",
  },
  entryTime: {
    color: appColors.black65,
    fontSize: 10,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 2,
    backgroundColor: appColors.raw_hex_6e52ea1f,
  },
  entryText: {
    color: appColors.black30,
    fontSize: 12,
    lineHeight: 17,
  },
  entryActions: {
    justifyContent: "space-between",
    gap: 8,
    marginTop: -5,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryTimelineSection;
