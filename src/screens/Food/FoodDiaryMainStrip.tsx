import React from "react";
import {
  type GestureResponderEvent,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { CaretDownIcon, CaretUpIcon, XIcon } from "phosphor-react-native";
import type { DBUser } from "../../store/DB_TYPES";
import type { FoodDiaryHourBucket } from "./foodDiaryTypes";
import FoodDiaryHeroCard from "./FoodDiaryHeroCard";
import {
  calculateLoggedNutrition,
  type FoodNutritionTotals,
  formatFoodDateKey,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  formatFoodServing,
  formatFoodShortDate,
  formatMacroLine,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

export type FoodDiaryMainStripDay = {
  date: Date;
  dateKey: string;
  calories: number;
};

type FoodDiaryMainStripProps = {
  days: FoodDiaryMainStripDay[];
  selectedDate: Date;
  targetCalories: number | null;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onSelectDate: (date: Date) => void;
  totals?: FoodNutritionTotals;
  user?: DBUser | null;
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

const PILL_WIDTH = 36;
const PILL_HEIGHT = 52;
const PILL_RADIUS = 12;
const OUTLINE_INSET = 1;
const OUTLINE_WIDTH = 2;
const OUTLINE_RADIUS = PILL_RADIUS - OUTLINE_INSET;
const OUTLINE_PATH_WIDTH = PILL_WIDTH - 2 * OUTLINE_INSET;
const OUTLINE_PATH_HEIGHT = PILL_HEIGHT - 2 * OUTLINE_INSET;
const OUTLINE_PERIMETER =
  2 * (OUTLINE_PATH_WIDTH + OUTLINE_PATH_HEIGHT - 4 * OUTLINE_RADIUS) +
  2 * Math.PI * OUTLINE_RADIUS;

const buildRoundedPillPath = () => {
  const left = OUTLINE_INSET;
  const top = OUTLINE_INSET;
  const right = PILL_WIDTH - OUTLINE_INSET;
  const bottom = PILL_HEIGHT - OUTLINE_INSET;
  const radius = OUTLINE_RADIUS;

  return [
    `M ${left + radius} ${top}`,
    `H ${right - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
    `V ${bottom - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
    `H ${left + radius}`,
    `A ${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
    `V ${top + radius}`,
    `A ${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
  ].join(" ");
};

export const buildFoodDiaryWeekDays = (date: Date): Date[] => {
  const weekStart = new Date(date);
  weekStart.setHours(12, 0, 0, 0);
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return next;
  });
};

const outlinePath = buildRoundedPillPath();

const formatWeekday = (date: Date): string =>
  date
    .toLocaleDateString(undefined, { weekday: "short" })
    .slice(0, 1)
    .toUpperCase();

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
      <View style={[styles.hourCard, selected && styles.hourCardActive]}>
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
                ? `${bucket.entries.length} ${
                    bucket.entries.length === 1 ? "entry" : "entries"
                  }`
                : "No entries yet"}
            </Text>
            {bucket.entries.length ? (
              <Text style={styles.hourText}>
                {`${Math.round(bucket.totals.calories)} kcal | ${formatMacroLine(
                  bucket.totals,
                )}`}
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
                      </View>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryText}>{time}</Text>
                        <Text style={styles.entryText}>|</Text>
                        <Text style={styles.entryText}>
                          {formatFoodServing(
                            entry.quantityG,
                            entry.servingUnit,
                          )}{" "}
                          | {nutrition.calories} kcal
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

const FoodDiaryMainStrip = ({
  days,
  selectedDate,
  targetCalories,
  onNextWeek,
  onPreviousWeek,
  onSelectDate,
  totals,
  user,
  hourBuckets,
  selectedHour,
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  onSelectHour,
}: FoodDiaryMainStripProps) => {
  const [expandedHours, setExpandedHours] = React.useState<Set<number>>(
    () => new Set(),
  );

  const selectedDateKey = formatFoodDateKey(selectedDate);
  const weekRange =
    days.length > 0
      ? `${formatFoodShortDate(days[0].date)} - ${formatFoodShortDate(
          days[days.length - 1].date,
        )}`
      : "";
  const fallbackMaxCalories = Math.max(1, ...days.map((day) => day.calories));
  const todayKey = formatFoodDateKey(new Date());

  const toggleHour = React.useCallback(
    (hour: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onSelectHour(hour);
      setExpandedHours((current) => {
        const next = new Set(current);

        if (next.has(hour)) {
          next.delete(hour);
        } else {
          next.add(hour);
        }

        return next;
      });
    },
    [onSelectHour],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={onPreviousWeek}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.navButtonText}>Prev</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Week view</Text>
          <Text style={styles.subtitle}>{weekRange}</Text>
        </View>
        <Pressable
          onPress={onNextWeek}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.navButtonText}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.dayRow}>
        {days.map((day) => {
          const selected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const ratioBase =
            targetCalories != null && targetCalories > 0
              ? targetCalories
              : fallbackMaxCalories;
          const ratio = Math.max(0, Math.min(1, day.calories / ratioBase));

          return (
            <Pressable
              key={day.dateKey}
              onPress={() => onSelectDate(day.date)}
              style={({ pressed }) => [
                styles.dayPill,
                selected && styles.dayPillSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <Svg
                width={PILL_WIDTH}
                height={PILL_HEIGHT}
                style={StyleSheet.absoluteFill}
              >
                <Path
                  d={outlinePath}
                  stroke={appColors.lavenderShadow}
                  strokeWidth={OUTLINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={outlinePath}
                  stroke={selected ? appColors.indigo600 : appColors.violetAccent}
                  strokeWidth={OUTLINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${OUTLINE_PERIMETER} ${OUTLINE_PERIMETER}`}
                  strokeDashoffset={OUTLINE_PERIMETER * (1 - ratio)}
                />
              </Svg>
              <Text
                style={[styles.weekday, selected && styles.weekdaySelected]}
              >
                {formatWeekday(day.date)}
              </Text>
              <Text
                style={[styles.dayNumber, selected && styles.dayNumberSelected]}
              >
                {day.date.getDate()}
              </Text>
              <Text
                style={[styles.kcalText, selected && styles.kcalTextSelected]}
              >
                {day.calories > 0 ? `${Math.round(day.calories)}` : "--"}
              </Text>
              {isToday ? <View style={styles.todayDot} /> : null}
              {isToday ? <View style={styles.todayDot2} /> : null}
            </Pressable>
          );
        })}
      </View>

      {totals && user ? <FoodDiaryHeroCard totals={totals} user={user} /> : null}

      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timeline}>
          {hourBuckets.map((bucket, index) => {
            const selected = bucket.hour === selectedHour;
            const isLast = index === hourBuckets.length - 1;

            return (
              <View key={bucket.hour} style={styles.timelineRow}>
                <View style={styles.axis}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  subtitle: {
    color: appColors.plumPlaceholder,
    fontSize: 12,
    fontWeight: "700",
  },
  navButton: {
    borderRadius: 999,
    backgroundColor: appColors.raw_hex_F5F1FB,
    borderWidth: 1,
    borderColor: appColors.lavenderShadow,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navButtonText: {
    color: appColors.plum760,
    fontSize: 12,
    fontWeight: "800",
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  dayPill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.raw_hex_FBFAFF,
    overflow: "hidden",
  },
  dayPillSelected: {
    backgroundColor: appColors.lavenderPanel,
  },
  weekday: {
    color: appColors.foodPlaceholder,
    fontSize: 12,
  },
  weekdaySelected: {
    color: appColors.plum700,
  },
  dayNumber: {
    color: appColors.foodText,
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: appColors.foodPrimaryDark,
  },
  kcalText: {
    color: appColors.foodPlaceholder,
    fontSize: 10,
    marginBottom: 2,
  },
  kcalTextSelected: {
    color: appColors.foodPrimary,
  },
  todayDot: {
    position: "absolute",
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryOverlay,
  },
  todayDot2: {
    position: "absolute",
    left: 5,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryOverlay,
  },
  timelineSection: {
    marginTop: 2,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
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
    borderWidth: 1,
    borderColor: appColors.lavenderRowBorder,
    backgroundColor: appColors.foodPillBg,
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
  entryMetaRow: {
    flexDirection: "row",
    gap: 4,
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

export default FoodDiaryMainStrip;
