import React from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Circle } from "react-native-svg";
import {
  BowlFoodIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  PlusCircleIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldIcon,
  TrashIcon,
} from "phosphor-react-native";
import type { DBUser, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type {
  FoodDiaryFavoriteFood,
  FoodDiaryHourBucket,
} from "./foodDiaryTypes";
import FoodDiaryHeroCard from "./FoodDiaryHeroCard";
import FoodDiaryQuickAdds from "./FoodDiaryQuickAdds";
import {
  calculateLoggedNutrition,
  type FoodNutritionTotals,
  formatFoodDateKey,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  formatFoodServing,
  formatFoodShortDate,
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
  favoriteFoods: FoodDiaryFavoriteFood[];
  isDayComplete: boolean;
  isDayCompleteLoading: boolean;
  onAddFood: (hour: number) => void;
  onAddFavorite: (food: FoodDiaryFavoriteFood, hour: number) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, hour: number) => void;
  onSelectHour: (hour: number) => void;
  onToggleDayComplete: () => void;
};

type FoodDiaryTimelineItemProps = {
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  bucket: FoodDiaryHourBucket;
  collapsed: boolean;
  isCurrentHour: boolean;
  selected: boolean;
  onToggle: () => void;
};

const DAY_TILE_WIDTH = 44;
const DAY_RING_SIZE = 36;
const DAY_RING_STROKE = 2;
const DAY_RING_RADIUS = (DAY_RING_SIZE - DAY_RING_STROKE) / 2;
const DAY_RING_CIRCUMFERENCE = 2 * Math.PI * DAY_RING_RADIUS;

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

const formatMonth = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: "short" });

const formatSelectedDateHeading = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const withOpacity = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

const formatMealLabel = (value: string): string =>
  value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDefaultMealSlot = (hour: number): MealSlot => {
  if (hour < 11) {
    return "breakfast";
  }

  if (hour < 16) {
    return "lunch";
  }

  if (hour < 21) {
    return "dinner";
  }

  return "snacks";
};

const getDefaultMealLabel = (slot: MealSlot): string => {
  switch (slot) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case "snacks":
      return "Snacks";
  }
};

const getBucketMealLabel = (bucket: FoodDiaryHourBucket): string => {
  const mealTypes = [
    ...new Set(
      bucket.entries
        .map((entry) => entry.mealType?.trim())
        .filter((mealType): mealType is string => Boolean(mealType)),
    ),
  ];

  if (mealTypes.length === 1) {
    return formatMealLabel(mealTypes[0]);
  }

  return getDefaultMealLabel(getDefaultMealSlot(bucket.hour));
};

const getMealSlotFromLabel = (label: string, hour: number): MealSlot => {
  const normalized = label.toLowerCase();

  if (normalized.includes("breakfast")) {
    return "breakfast";
  }

  if (normalized.includes("lunch")) {
    return "lunch";
  }

  if (normalized.includes("dinner")) {
    return "dinner";
  }

  if (normalized.includes("snack")) {
    return "snacks";
  }

  return getDefaultMealSlot(hour);
};

const FoodDiaryTimelineItem = ({
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  bucket,
  collapsed,
  isCurrentHour,
  selected,
  onToggle,
}: FoodDiaryTimelineItemProps) => {
  const mealLabel = getBucketMealLabel(bucket);
  const mealSlot = getMealSlotFromLabel(mealLabel, bucket.hour);
  const entryCountLabel =
    bucket.entries.length === 1
      ? "1 food"
      : `${bucket.entries.length} foods`;
  const collapsedSummary = bucket.entries.length
    ? `${entryCountLabel} - ${Math.round(bucket.totals.calories)} kcal`
    : "No entries yet";
  const expandedMeta = bucket.entries.length
    ? `${formatFoodHourLabel(bucket.hour)} - ${entryCountLabel}`
    : `${formatFoodHourLabel(bucket.hour)} - Empty`;
  const runWithoutToggling = (
    event: GestureResponderEvent,
    action: () => void,
  ) => {
    event.stopPropagation();
    action();
  };
  const renderMealIcon = () => {
    switch (mealSlot) {
      case "breakfast":
        return (
          <BowlFoodIcon size={21} color={appColors.brand700} weight="fill" />
        );
      case "lunch":
        return (
          <ForkKnifeIcon size={21} color={appColors.brand700} weight="fill" />
        );
      case "dinner":
        return (
          <CookingPotIcon size={21} color={appColors.brand700} weight="fill" />
        );
      case "snacks":
        return (
          <BowlFoodIcon size={21} color={appColors.brand700} weight="regular" />
        );
    }
  };

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.timelineContent,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.mealCard, selected && styles.mealCardActive]}>
        <View style={styles.mealHeader}>
          <View style={styles.mealTitleGroup}>
            <View style={styles.mealIcon}>{renderMealIcon()}</View>
            <View style={styles.mealHeaderCopy}>
              <View style={styles.mealTitleRow}>
                <Text
                  style={[
                    styles.mealTitle,
                    bucket.entries.length === 0 && styles.mealTitleMuted,
                  ]}
                  numberOfLines={1}
                >
                  {mealLabel}
                </Text>
                {isCurrentHour ? (
                  <View style={styles.nowPill}>
                    <Text style={styles.nowPillText}>Now</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.mealMeta} numberOfLines={1}>
                {collapsed ? collapsedSummary : expandedMeta}
              </Text>
            </View>
          </View>
          <View style={styles.mealHeaderActions}>
            {bucket.entries.length ? (
              <Text style={styles.mealKcal} numberOfLines={1}>
                {Math.round(bucket.totals.calories)} kcal
              </Text>
            ) : null}
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
              <CaretDownIcon size={16} color={appColors.textSecondary} />
            ) : (
              <CaretUpIcon size={16} color={appColors.textSecondary} />
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
                          <View style={styles.entryTopRow}>
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
                            <Text style={styles.entryKcal} numberOfLines={1}>
                              {nutrition.calories} kcal
                            </Text>
                          </View>

                          <View style={styles.entryMetaRow}>
                            <Text style={styles.entryText}>{time}</Text>
                            <Text style={styles.entryText}>|</Text>
                            <Text style={styles.entryText}>
                              {entry.entrySource === "quick_add"
                                ? entry.mealType?.trim() || "One-time entry"
                                : `${formatFoodServing(
                                    entry.quantityG,
                                    entry.servingUnit,
                                  )}`}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </Swipeable>
                  );
                })}

                <View style={styles.mealTotalRow}>
                  <Text style={styles.mealTotalLabel}>Total</Text>
                  <Text style={styles.mealTotalValue}>
                    {Math.round(bucket.totals.calories)} kcal
                  </Text>
                </View>
                <Pressable
                  onPress={(event) =>
                    runWithoutToggling(event, () => onAddFood(bucket.hour))
                  }
                  style={({ pressed }) => [
                    styles.nonEmptyState,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.addMoreRow}>
                    <PlusCircleIcon size={18} color={appColors.brand500} />
                    <Text style={styles.emptyStateAction}>Add more</Text>
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
                <View style={styles.addMoreRow}>
                  <PlusCircleIcon size={18} color={appColors.brand500} />
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
  favoriteFoods,
  isDayComplete,
  isDayCompleteLoading,
  onAddFood,
  onAddFavorite,
  onDeleteEntry,
  onEditEntry,
  onQuickLogFavorite,
  onSelectHour,
  onToggleDayComplete,
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
  const selectedDateHeading = formatSelectedDateHeading(selectedDate);
  const fallbackMaxCalories = Math.max(1, ...days.map((day) => day.calories));
  const todayKey = formatFoodDateKey(new Date());
  const currentHour = new Date().getHours();
  const isViewingToday = selectedDateKey === todayKey;
  const visibleHourBuckets = React.useMemo(
    () =>
      hourBuckets.filter(
        (bucket) =>
          bucket.entries.length > 0 ||
          bucket.hour === selectedHour ||
          (isViewingToday && bucket.hour === currentHour),
      ),
    [currentHour, hourBuckets, isViewingToday, selectedHour],
  );
  const emptyHourBuckets = React.useMemo(
    () =>
      hourBuckets.filter(
        (bucket) =>
          bucket.entries.length === 0 &&
          bucket.hour !== selectedHour &&
          !(isViewingToday && bucket.hour === currentHour),
      ),
    [currentHour, hourBuckets, isViewingToday, selectedHour],
  );

  React.useEffect(() => {
    setExpandedHours(new Set([selectedHour]));
  }, [selectedDateKey, selectedHour]);

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
      <View style={styles.weekNavRow}>
        <Pressable
          onPress={onPreviousWeek}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <CaretDoubleLeftIcon size={17} color={appColors.brand500} />
        </Pressable>
        <Text style={styles.weekRange} numberOfLines={1}>
          {weekRange}
        </Text>
        <Pressable
          onPress={onNextWeek}
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.cardPressed,
          ]}
        >
          <CaretDoubleRightIcon size={17} color={appColors.brand500} />
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
          const ringTrackColor = selected
            ? withOpacity(appColors.white, 0.38)
            : appColors.borderSoft;
          const ringProgressColor = selected ? appColors.white : progressColor;

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
              <Text
                style={[styles.weekday, selected && styles.weekdaySelected]}
              >
                {formatMonth(day.date)}
              </Text>
              <View style={styles.dayRing}>
                <Svg
                  width={DAY_RING_SIZE}
                  height={DAY_RING_SIZE}
                  style={StyleSheet.absoluteFill}
                >
                  <Circle
                    cx={DAY_RING_SIZE / 2}
                    cy={DAY_RING_SIZE / 2}
                    r={DAY_RING_RADIUS}
                    stroke={ringTrackColor}
                    strokeWidth={DAY_RING_STROKE}
                    fill="none"
                  />
                  <Circle
                    cx={DAY_RING_SIZE / 2}
                    cy={DAY_RING_SIZE / 2}
                    r={DAY_RING_RADIUS}
                    stroke={ringProgressColor}
                    strokeWidth={DAY_RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${DAY_RING_CIRCUMFERENCE} ${DAY_RING_CIRCUMFERENCE}`}
                    strokeDashoffset={DAY_RING_CIRCUMFERENCE * (1 - ratio)}
                    fill="none"
                    transform={`rotate(-90 ${DAY_RING_SIZE / 2} ${DAY_RING_SIZE / 2})`}
                  />
                </Svg>
                <Text
                  style={[
                    styles.dayNumber,
                    selected && styles.dayNumberSelected,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
              </View>
              <Text
                style={[styles.kcalText, selected && styles.kcalTextSelected]}
                numberOfLines={1}
              >
                {day.calories > 0 ? `${Math.round(day.calories)}` : "--"}
              </Text>
              {isToday ? <View style={styles.todayDot} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.selectedDateTitle}>{selectedDateHeading}</Text>

      {totals && user ? (
        <FoodDiaryHeroCard
          energyTargetCalories={selectedTargetCalories}
          totals={totals}
          user={user}
        />
      ) : null}

      <Pressable
        disabled={isDayCompleteLoading}
        onPress={onToggleDayComplete}
        accessibilityRole="button"
        accessibilityState={{ selected: isDayComplete, busy: isDayCompleteLoading }}
        style={({ pressed }) => [
          styles.dayStatusRow,
          isDayComplete && styles.dayStatusRowComplete,
          isDayCompleteLoading && styles.dayStatusRowLoading,
          pressed && !isDayCompleteLoading && styles.cardPressed,
        ]}
      >
        <View style={styles.dayStatusIcon}>
          {isDayCompleteLoading ? (
            <ActivityIndicator color={appColors.brand700} size="small" />
          ) : isDayComplete ? (
            <ShieldCheckIcon size={22} color={appColors.brand700} weight="fill" />
          ) : (
            <ShieldIcon size={22} color={appColors.textSecondary} weight="bold" />
          )}
        </View>
        <View style={styles.dayStatusCopy}>
          <Text style={styles.dayStatusTitle}>
            {isDayComplete ? "Day complete" : "Mark day complete"}
          </Text>
          <Text style={styles.dayStatusText}>
            {isDayComplete
              ? "Included in adaptive calorie review."
              : "Use once the day is fully logged."}
          </Text>
        </View>
      </Pressable>

      <View style={styles.timelineSection}>
        <FoodDiaryQuickAdds
          favoriteFoods={favoriteFoods}
          selectedHour={selectedHour}
          onAddFavorite={onAddFavorite}
          onQuickLogFavorite={onQuickLogFavorite}
        />

        {emptyHourBuckets.length > 0 ? (
          <View style={styles.addRail}>
            <Text style={styles.addRailLabel}>Add at</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.addRailContent}
            >
              {emptyHourBuckets.map((bucket) => (
                <Pressable
                  key={bucket.hour}
                  onPress={() => {
                    onSelectHour(bucket.hour);
                    onAddFood(bucket.hour);
                  }}
                  accessibilityLabel={`Add food at ${formatFoodHourLabel(bucket.hour)}`}
                  style={({ pressed }) => [
                    styles.addRailChip,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <PlusIcon
                    size={13}
                    color={appColors.brand500}
                    weight="bold"
                  />
                  <Text style={styles.addRailChipText}>
                    {formatFoodHourLabel(bucket.hour)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.timeline}>
          {visibleHourBuckets.map((bucket, index) => {
            const selected = bucket.hour === selectedHour;
            const isCurrentHour = isViewingToday && bucket.hour === currentHour;
            const isLast = index === visibleHourBuckets.length - 1;

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
                  isCurrentHour={isCurrentHour}
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
    marginBottom: 16,
  },
  weekNavRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  weekRange: {
    flex: 1,
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  navButton: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 2,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  dayPill: {
    flex: 1,
    minWidth: 0,
    maxWidth: DAY_TILE_WIDTH,
    minHeight: 76,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 6,
    gap: 2,
    overflow: "hidden",
  },
  dayPillSelected: {
    backgroundColor: appColors.brand500,
    shadowColor: appColors.slate500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 4,
  },
  dayRing: {
    width: DAY_RING_SIZE,
    height: DAY_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "500",
  },
  weekdaySelected: {
    color: appColors.white,
  },
  dayNumber: {
    color: appColors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  dayNumberSelected: {
    color: appColors.white,
  },
  kcalText: {
    color: appColors.textMuted,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "700",
    maxWidth: DAY_TILE_WIDTH - 6,
  },
  kcalTextSelected: {
    color: appColors.white,
  },
  todayDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  timelineSection: {
    marginTop: 24,
  },
  selectedDateTitle: {
    color: appColors.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 20,
  },
  dayStatusRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  dayStatusRowComplete: {
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
  },
  dayStatusRowLoading: {
    opacity: 0.76,
  },
  dayStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  dayStatusCopy: {
    flex: 1,
  },
  dayStatusTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  dayStatusText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  addRail: {
    marginBottom: 18,
  },
  addRailLabel: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  addRailContent: {
    gap: 8,
    paddingRight: 8,
  },
  addRailChip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceCard,
    paddingHorizontal: 11,
  },
  addRailChipText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  timeline: {
    gap: 18,
  },
  timelineRow: {
    flexDirection: "row",
  },
  axis: {
    width: 58,
    marginRight: 10,
    alignItems: "center",
  },
  axisLabel: {
    color: appColors.slate500,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "500",
  },
  axisLabelActive: {
    color: appColors.brand700,
  },
  axisTrack: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
  },
  axisDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: appColors.borderStrong,
  },
  axisDotActive: {
    backgroundColor: appColors.brand700,
  },
  axisLine: {
    width: 1,
    flex: 1,
    backgroundColor: appColors.borderSoft,
    marginTop: 5,
    marginBottom: -18,
  },
  timelineContent: {
    flex: 1,
  },
  mealCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: withOpacity(appColors.borderSoft, 0.72),
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: appColors.slate500,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  mealCardActive: {
    borderColor: appColors.brand400,
    backgroundColor: appColors.surfaceRaised,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  mealTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  mealIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  mealHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  mealTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealTitle: {
    flexShrink: 1,
    color: appColors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
  },
  mealTitleMuted: {
    color: appColors.textSecondary,
  },
  mealMeta: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  mealHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealKcal: {
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    maxWidth: 82,
  },
  nowPill: {
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  nowPillText: {
    color: appColors.white,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hourAddButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    marginTop: 12,
  },
  emptyState: {
    borderRadius: 8,
    backgroundColor: withOpacity(appColors.brand300, 0.16),
    borderWidth: 1,
    borderColor: withOpacity(appColors.brand300, 0.34),
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  nonEmptyState: {
    borderRadius: 8,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 0,
  },
  emptyStateText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  emptyStateAction: {
    color: appColors.brand500,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  addMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryCard: {
    backgroundColor: "transparent",
    paddingVertical: 7,
  },
  entryCardWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(appColors.borderSoft, 0.62),
  },
  entryMain: {
    flex: 1,
  },
  entryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  entryCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  entryTitle: {
    color: appColors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "500",
  },
  entryKcal: {
    color: appColors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    minWidth: 78,
    textAlign: "right",
  },
  entryMetaRow: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
    marginTop: 2,
  },
  entryText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
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
  mealTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  mealTotalLabel: {
    color: appColors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  mealTotalValue: {
    color: appColors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    minWidth: 90,
    textAlign: "right",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMainStrip;

