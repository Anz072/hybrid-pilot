import React from "react";
import {
  type GestureResponderEvent,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  FireIcon,
  PlusCircleIcon,
  PlusIcon,
  TrashIcon,
} from "phosphor-react-native";
import type { DBUser, DBUserFoodLogEntry } from "../../store/DB_TYPES";
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
  selectedTargetCalories: number | null;
  targetCaloriesByDate: Record<string, number | null>;
  weeklyBudgetCalories: number | null;
  weeklyConsumedCalories: number;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onSelectDate: (date: Date) => void;
  totals?: FoodNutritionTotals;
  user?: DBUser | null;
  hourBuckets: FoodDiaryHourBucket[];
  selectedHour: number;
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  onSelectHour: (hour: number) => void;
};

type FoodDiaryTimelineItemProps = {
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
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
                  color: withOpacity(appColors.textPrimary, 0.6),
                },
              ]}
            >
              {bucket.entries.length
                ? `${bucket.entries.length} ${
                    bucket.entries.length === 1 ? "entry" : "entries"
                  }`
                : "No entries yet"}
            </Text>
          </View>
          {bucket.entries.length ? (
            <View
              style={{ flexDirection: "row", gap: 2, alignItems: "center" }}
            >
              <FireIcon size={13} />
              <Text style={styles.hourText}>
                {`${Math.round(bucket.totals.calories)} kcal `}
              </Text>
            </View>
          ) : null}
          <View style={styles.hourHeaderActions}>
            <Pressable
              onPress={(event) =>
                runWithoutToggling(event, () => onAddFood(bucket.hour))
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.hourAddButton,
                pressed && styles.cardPressed,
              ]}
              accessibilityLabel={`Add food at ${formatFoodHourLabel(bucket.hour)}`}
            >
              <PlusIcon size={15} color={appColors.white} weight="bold" />
            </Pressable>
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
              <View>
                {bucket.entries.map((entry) => {
                  const nutrition = calculateLoggedNutrition(entry);
                  const time = formatFoodLoggedTime(
                    entry.loggedAt ?? entry.createdAt,
                  );

                  return (
                    <Swipeable
                      key={entry.id}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => onDeleteEntry(entry)}
                          style={({ pressed }) => [
                            styles.deleteSwipe,
                            pressed && styles.cardPressed,
                          ]}
                          accessibilityLabel={`Delete ${entry.foodName} entry`}
                        >
                          <TrashIcon
                            size={18}
                            color={appColors.white}
                            weight="bold"
                          />
                          <Text style={styles.deleteSwipeText}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <Pressable
                        style={[
                          styles.entryCard,
                          bucket.entries.length > 1 &&
                            styles.entryCardWithDivider,
                        ]}
                        onPress={(event) =>
                          runWithoutToggling(event, () => onEditEntry(entry))
                        }
                      >
                        <View style={styles.entryMain}>
                          <View style={styles.rowBetween}>
                            <View style={styles.entryCopy}>
                              <Text style={styles.entryTitle} numberOfLines={2}>
                                {entry.foodName}
                              </Text>
                              {entry.entrySource === "quick_add" ? (
                                <View style={styles.entryTag}>
                                  <Text style={styles.entryTagText}>
                                    Quick Add
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.entryMetaRow}>
                            <Text style={styles.entryText}>{time}</Text>
                            <Text style={styles.entryText}>|</Text>
                            <Text style={styles.entryText}>
                              {entry.entrySource === "quick_add"
                                ? `${entry.mealType?.trim() || "One-time entry"} | ${nutrition.calories} kcal`
                                : `${formatFoodServing(
                                    entry.quantityG,
                                    entry.servingUnit,
                                  )} | ${nutrition.calories} kcal`}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </Swipeable>
                  );
                })}

                <Pressable
                  onPress={(event) =>
                    runWithoutToggling(event, () => onAddFood(bucket.hour))
                  }
                  style={({ pressed }) => [
                    styles.nonEmptyState,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 2,
                      alignItems: "center",
                    }}
                  >
                    <PlusCircleIcon size={14} color={appColors.brand500} />
                    <Text style={styles.emptyStateAction}>Tap to add more</Text>
                  </View>
                </Pressable>
              </View>
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
                <View
                  style={{
                    flexDirection: "row",
                    gap: 2,
                    alignItems: "center",
                  }}
                >
                  <PlusCircleIcon size={14} color={appColors.brand500} />
                  <Text style={styles.emptyStateAction}>Tap to add food</Text>
                </View>
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
  selectedTargetCalories,
  targetCaloriesByDate,
  weeklyBudgetCalories,
  weeklyConsumedCalories,
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
          <CaretDoubleLeftIcon size={18} color={appColors.brand400} />
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
          <CaretDoubleRightIcon size={18} color={appColors.brand400} />
        </Pressable>
      </View>

      <View style={styles.dayRow}>
        {days.map((day) => {
          const selected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const dayTargetCalories = targetCaloriesByDate[day.dateKey] ?? null;
          const ratioBase =
            dayTargetCalories != null && dayTargetCalories > 0
              ? dayTargetCalories
              : fallbackMaxCalories;
          const ratio = Math.max(0, Math.min(1, day.calories / ratioBase));
          const progressColor = selected
            ? appColors.brand700
            : appColors.brand500;
          const fillColor = withOpacity(
            progressColor,
            selected ? 0.28 : 0.18,
          );

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
              <View
                style={[
                  styles.dayPillFill,
                  {
                    backgroundColor: fillColor,
                  },
                ]}
              />
              <Svg
                width={PILL_WIDTH}
                height={PILL_HEIGHT}
                style={StyleSheet.absoluteFill}
              >
                <Path
                  d={outlinePath}
                  stroke={
                    selected ? appColors.brand700 : appColors.borderSoft
                  }
                  strokeWidth={OUTLINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={outlinePath}
                  stroke={progressColor}
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

      {totals && user ? (
        <FoodDiaryHeroCard
          energyTargetCalories={selectedTargetCalories}
          totals={totals}
          user={user}
        />
      ) : null}

      <View style={styles.timelineSection}>
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
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerCopy: {
    alignItems: "center",
  },
  title: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  subtitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
  },
  navButton: {
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  weekBudgetCard: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weekBudgetCopy: {
    flex: 1,
  },
  weekBudgetEyebrow: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  weekBudgetValue: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  weekBudgetMeta: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekBudgetMetaLabel: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  dayPill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceFieldAlt,
    overflow: "hidden",
  },
  dayPillSelected: {
    backgroundColor: appColors.brand800,
  },
  dayPillFill: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
  },
  weekday: {
    color: appColors.textMuted,
    fontSize: 12,
  },
  weekdaySelected: {
    color: appColors.brand400,
  },
  dayNumber: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: appColors.brand700,
  },
  kcalText: {
    color: appColors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  kcalTextSelected: {
    color: appColors.brand500,
  },
  todayDot: {
    position: "absolute",
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  todayDot2: {
    position: "absolute",
    left: 5,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  timelineSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 18,
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
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  axisLabelActive: {
    color: appColors.brand500,
  },
  axisTrack: {
    flex: 1,
    alignItems: "center",
  },
  axisDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: appColors.brand400,
  },
  axisDotActive: {
    backgroundColor: appColors.brand500,
  },
  axisLine: {
    width: 1,
    flex: 1,
    backgroundColor: appColors.surfaceCardAlt,
    marginBottom: -8,
  },
  timelineContent: {
    flex: 1,
  },
  hourCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 10,
  },
  hourCardActive: {
    borderWidth: 1,
    borderColor: appColors.brand500,
    backgroundColor: appColors.surfaceRaised,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hourAddButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
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
    color: appColors.textPrimary,
    letterSpacing: 0.5,
  },
  hourText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 210,
  },
  stack: {
    // gap: 10,
    marginTop: 12,
  },
  emptyState: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  nonEmptyState: {
    backgroundColor: appColors.surfaceCardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyStateText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  emptyStateAction: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "700",
  },
  entryCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: appColors.surfaceCardAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryCardWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: appColors.borderSoft,
  },
  entryMain: {
    flex: 1,
  },
  entryCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  entryTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "500",
  },
  entryMetaRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  entryText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  entryTag: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  entryTagText: {
    color: appColors.brand500,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  deleteSwipe: {
    width: 96,
    borderRadius: 8,
    backgroundColor: appColors.danger700,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMainStrip;

