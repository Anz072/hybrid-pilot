import React from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  LayoutAnimation,
  Pressable,
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
  PlusIcon,
  ShieldCheckIcon,
  ShieldIcon,
  TrashIcon,
} from "phosphor-react-native";
import type { DBUser, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type {
  FoodDiaryFavoriteFood,
  FoodDiaryMealBucket,
} from "./foodDiaryTypes";
import FoodDiaryHeroCard from "./FoodDiaryHeroCard";
import FoodDiaryQuickAdds from "./FoodDiaryQuickAdds";
import {
  calculateLoggedNutrition,
  type FoodNutritionTotals,
  formatFoodDateKey,
  formatFoodServing,
  formatFoodShortDate,
  type MealSlot,
} from "./foodUtils";
import { formatTimeOfDay } from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import { AppButton, AppText, ErrorState, LoadingState } from "../../components/ui";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";

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
  mealBuckets: FoodDiaryMealBucket[];
  selectedMeal: MealSlot;
  favoriteFoods: FoodDiaryFavoriteFood[];
  recentFoods: FoodDiaryFavoriteFood[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasLoadedData: boolean;
  loadError: string | null;
  isDayComplete: boolean;
  isDayCompleteLoading: boolean;
  onAddFood: (slot: MealSlot) => void;
  onAddFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
  onRetryLoad: () => void;
  onSelectMeal: (slot: MealSlot) => void;
  onToggleDayComplete: () => void;
};

type FoodDiaryMealItemProps = {
  onAddFood: (slot: MealSlot) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  bucket: FoodDiaryMealBucket;
  collapsed: boolean;
  selected: boolean;
  onToggle: () => void;
};

const DAY_TILE_WIDTH = 44;
const DAY_ROW_GAP = 2;
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

const renderMealIcon = (slot: MealSlot) => {
  switch (slot) {
    case "breakfast":
      return (
        <BowlFoodIcon size={18} color={appColors.brand700} weight="fill" />
      );
    case "lunch":
      return (
        <ForkKnifeIcon size={18} color={appColors.brand700} weight="fill" />
      );
    case "dinner":
      return (
        <CookingPotIcon size={18} color={appColors.brand700} weight="fill" />
      );
    case "snacks":
      return (
        <BowlFoodIcon size={18} color={appColors.brand700} weight="regular" />
      );
  }
};

const FoodDiaryMealItem = ({
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  bucket,
  collapsed,
  selected,
  onToggle,
}: FoodDiaryMealItemProps) => {
  const { timeFormat } = useDisplayPreferences();
  const entryCount = bucket.entries.length;
  const entryCountLabel = entryCount === 1 ? "1 food" : `${entryCount} foods`;
  const summary = entryCount ? entryCountLabel : "Nothing logged yet";
  const runWithoutToggling = (
    event: GestureResponderEvent,
    action: () => void,
  ) => {
    event.stopPropagation();
    action();
  };

  return (
    <View style={[styles.mealCard, selected && styles.mealCardActive]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.mealHeader,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.mealTitleGroup}>
          <View style={styles.mealIcon}>{renderMealIcon(bucket.slot)}</View>
          <View style={styles.mealHeaderCopy}>
            <Text style={styles.mealTitle} numberOfLines={1}>
              {bucket.label}
            </Text>
            <Text
              style={[
                styles.mealMeta,
                entryCount === 0 && styles.mealMetaMuted,
              ]}
              numberOfLines={1}
            >
              {summary}
            </Text>
          </View>
        </View>
        <View style={styles.mealHeaderActions}>
          {entryCount ? (
            <Text style={styles.mealKcal} numberOfLines={1}>
              {Math.round(bucket.totals.calories)} kcal
            </Text>
          ) : null}
          <Pressable
            onPress={(event) =>
              runWithoutToggling(event, () => onAddFood(bucket.slot))
            }
            hitSlop={8}
            style={({ pressed }) => [
              styles.mealAddButton,
              pressed && styles.cardPressed,
            ]}
            accessibilityLabel={`Add food to ${bucket.label}`}
          >
            <PlusIcon size={14} color={appColors.white} weight="bold" />
          </Pressable>
          {entryCount ? (
            collapsed ? (
              <CaretDownIcon size={16} color={appColors.textSecondary} />
            ) : (
              <CaretUpIcon size={16} color={appColors.textSecondary} />
            )
          ) : null}
        </View>
      </Pressable>

      {!collapsed && entryCount >= 1 ? (
        <View style={styles.stack}>
          {bucket.entries.map((entry) => {
            const nutrition = calculateLoggedNutrition(entry);
            const time = formatTimeOfDay(
              entry.loggedAt ?? entry.createdAt,
              timeFormat,
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
                  style={styles.entryCard}
                  onPress={() => onEditEntry(entry)}
                >
                  <View style={styles.entryMain}>
                    <View style={styles.entryTopRow}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {entry.foodName}
                      </Text>
                      <Text style={styles.entryKcal} numberOfLines={1}>
                        {nutrition.calories} kcal
                      </Text>
                    </View>
                    <View style={styles.entryMetaRow}>
                      {entry.entrySource === "quick_add" ? (
                        <>
                          <Text style={styles.entryText}>Quick Add</Text>
                          <Text style={styles.entryDivider}>·</Text>
                        </>
                      ) : null}
                      <Text style={styles.entryText}>{time}</Text>
                      {entry.entrySource !== "quick_add" ? (
                        <>
                          <Text style={styles.entryDivider}>·</Text>
                          <Text style={styles.entryText}>
                            {formatFoodServing(
                              entry.quantityG,
                              entry.servingUnit,
                            )}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </Swipeable>
            );
          })}

        </View>
      ) : null}
    </View>
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
  mealBuckets,
  selectedMeal,
  favoriteFoods,
  recentFoods,
  isLoading,
  isRefreshing,
  hasLoadedData,
  loadError,
  isDayComplete,
  isDayCompleteLoading,
  onAddFood,
  onAddFavorite,
  onDeleteEntry,
  onEditEntry,
  onQuickLogFavorite,
  onRetryLoad,
  onSelectMeal,
  onToggleDayComplete,
}: FoodDiaryMainStripProps) => {
  const [collapsedSlots, setCollapsedSlots] = React.useState<Set<MealSlot>>(
    () => new Set(),
  );
  const [dayRowWidth, setDayRowWidth] = React.useState(0);

  const selectedDateKey = formatFoodDateKey(selectedDate);
  const dayTileWidth =
    dayRowWidth > 0 && days.length > 0
      ? Math.floor(
          (dayRowWidth - DAY_ROW_GAP * (days.length - 1)) / days.length,
        )
      : null;
  const weekRange =
    days.length > 0
      ? `${formatFoodShortDate(days[0].date)} - ${formatFoodShortDate(
          days[days.length - 1].date,
        )}`
      : "";
  const selectedDateHeading = formatSelectedDateHeading(selectedDate);
  const canShowContent = !isLoading && (!loadError || hasLoadedData);
  const fallbackMaxCalories = Math.max(1, ...days.map((day) => day.calories));
  const todayKey = formatFoodDateKey(new Date());
  // On day change, collapse only the empty meals so the logged day reads at a
  // glance without wasted vertical space.
  React.useEffect(() => {
    setCollapsedSlots(
      new Set(
        mealBuckets
          .filter((bucket) => bucket.entries.length === 0)
          .map((bucket) => bucket.slot),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateKey]);

  const toggleMeal = React.useCallback(
    (slot: MealSlot) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onSelectMeal(slot);
      setCollapsedSlots((current) => {
        const next = new Set(current);

        if (next.has(slot)) {
          next.delete(slot);
        } else {
          next.add(slot);
        }

        return next;
      });
    },
    [onSelectMeal],
  );
  const handleDayRowLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    setDayRowWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) >= 1 ? nextWidth : currentWidth,
    );
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.dateControls}>
        <Text style={styles.selectedDateTitle}>{selectedDateHeading}</Text>

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
          <View style={styles.weekRangeContainer}>
            <Text style={styles.weekRange} numberOfLines={1}>
              {weekRange}
            </Text>
            {isRefreshing ? (
              <ActivityIndicator
                accessibilityLabel="Refreshing diary"
                color={appColors.brand500}
                size="small"
                style={styles.refreshIndicator}
              />
            ) : null}
          </View>
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

        <View style={styles.dayRow} onLayout={handleDayRowLayout}>
        {days.map((day) => {
          const selected = day.dateKey === selectedDateKey;
          const isToday = day.dateKey === todayKey;
          const dayTargetCalories = targetCaloriesByDate[day.dateKey] ?? null;
          const ratioBase =
            dayTargetCalories != null && dayTargetCalories > 0
              ? dayTargetCalories
              : fallbackMaxCalories;
          const ratio = isLoading
            ? 0
            : Math.max(0, Math.min(1, day.calories / ratioBase));
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
                dayTileWidth == null && styles.dayPillFallback,
                dayTileWidth != null && { width: dayTileWidth },
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
                {isLoading
                  ? "..."
                  : day.calories > 0
                    ? `${Math.round(day.calories)}`
                    : "--"}
              </Text>
              {isToday ? <View style={styles.todayDot} /> : null}
            </Pressable>
          );
        })}
        </View>
      </View>

      {loadError ? (
        <ErrorState
          title="Could not load diary"
          message={loadError}
          action={
            <AppButton
              label="Try again"
              onPress={onRetryLoad}
              size="sm"
            />
          }
          style={styles.stateBlock}
        />
      ) : null}

      {isLoading ? (
        <LoadingState
          title="Loading diary"
          message="Fetching meals, totals, and day status."
          style={styles.stateBlock}
        />
      ) : canShowContent && totals && user ? (
        <FoodDiaryHeroCard
          energyTargetCalories={selectedTargetCalories}
          totals={totals}
          user={user}
        />
      ) : null}

      {canShowContent ? (
        <Pressable
          disabled={isDayCompleteLoading}
          onPress={onToggleDayComplete}
          accessibilityRole="button"
          accessibilityState={{
            selected: isDayComplete,
            busy: isDayCompleteLoading,
          }}
          style={({ pressed }) => [
            styles.dayStatusRow,
            isDayComplete && styles.dayStatusRowComplete,
            isDayCompleteLoading && styles.dayStatusRowLoading,
            pressed && !isDayCompleteLoading && styles.cardPressed,
          ]}
        >
          <View style={styles.dayStatusIcon}>
            {isDayCompleteLoading ? (
              <ActivityIndicator color={appColors.textSecondary} size="small" />
            ) : isDayComplete ? (
              <ShieldCheckIcon
                size={22}
                color={appColors.statusSuccess}
                weight="fill"
              />
            ) : (
              <ShieldIcon
                size={22}
                color={appColors.textSecondary}
                weight="bold"
              />
            )}
          </View>
          <View style={styles.dayStatusCopy}>
            <Text style={styles.dayStatusTitle}>
              {isDayComplete ? "Saved for review" : "Ready for review"}
            </Text>
            <Text style={styles.dayStatusText}>
              {isDayComplete
                ? "Adaptive calories can use this logged day."
                : "Mark when food logging is done."}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {canShowContent ? (
        <View style={styles.mealsSection}>
          <FoodDiaryQuickAdds
            favoriteFoods={favoriteFoods}
            recentFoods={recentFoods}
            selectedMeal={selectedMeal}
            onAddFavorite={onAddFavorite}
            onQuickLogFavorite={onQuickLogFavorite}
          />

          <View style={styles.mealList}>
            {mealBuckets.map((bucket) => (
              <FoodDiaryMealItem
                key={bucket.slot}
                onAddFood={onAddFood}
                onDeleteEntry={onDeleteEntry}
                onEditEntry={onEditEntry}
                bucket={bucket}
                collapsed={collapsedSlots.has(bucket.slot)}
                selected={bucket.slot === selectedMeal}
                onToggle={() => toggleMeal(bucket.slot)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: appSpacing.md,
  },
  dateControls: {
    marginTop: appSpacing.md,
  },
  weekNavRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.xs,
    marginBottom: appSpacing.xs,
  },
  weekRange: {
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  weekRangeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIndicator: {
    position: "absolute",
    right: 0,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.soft,
  },
  dayRow: {
    flexDirection: "row",
    gap: DAY_ROW_GAP,
    paddingHorizontal: 0,
    paddingVertical: 2,
    marginBottom: 6,
  },
  dayPill: {
    minWidth: 0,
    minHeight: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 6,
    gap: 2,
    overflow: "hidden",
  },
  dayPillFallback: {
    flexBasis: 0,
    flexGrow: 1,
  },
  dayPillSelected: {
    backgroundColor: appColors.actionPrimary,
    borderColor: appColors.actionPrimaryBorder,
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
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  dayNumberSelected: {
    color: appColors.white,
  },
  kcalText: {
    color: appColors.textMuted,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
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
  mealsSection: {
    marginTop: appSpacing.lg,
  },
  stateBlock: {
    marginTop: appSpacing.md,
  },
  selectedDateTitle: {
    color: appColors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    fontFamily: "Newsreader_700Bold",
    letterSpacing: -0.2,
    textAlign: "center",
    marginBottom: appSpacing.xs,
  },
  dayStatusRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    borderRadius: appRadius.md,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.sm,
    marginTop: appSpacing.md,
    backgroundColor: appColors.surfaceField,
  },
  dayStatusRowComplete: {
    backgroundColor: appColors.statusSuccessSoft,
  },
  dayStatusRowLoading: {
    opacity: appStates.disabledOpacity,
  },
  dayStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.white,
  },
  dayStatusCopy: {
    flex: 1,
  },
  dayStatusTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayStatusText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  mealList: {
    gap: 0,
  },
  mealCard: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
    paddingVertical: appSpacing.sm,
    paddingHorizontal: appSpacing.xs,
  },
  mealCardActive: {
    backgroundColor: appStates.selectedFill,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mealTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mealIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mealHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    color: appColors.textPrimary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "600",
  },
  mealMeta: {
    color: appColors.textSecondary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 1,
  },
  mealMetaMuted: {
    color: appColors.textMuted,
  },
  mealHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealKcal: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    maxWidth: 72,
    textAlign: "right",
  },
  mealAddButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    marginTop: 8,
  },
  entryCard: {
    backgroundColor: "transparent",
    paddingVertical: 6,
    borderTopWidth: appBorders.width,
    borderTopColor: appBorders.soft,
  },
  entryMain: {
    flex: 1,
  },
  entryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  entryTitle: {
    flex: 1,
    minWidth: 0,
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "500",
  },
  entryKcal: {
    color: appColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 66,
    textAlign: "right",
  },
  entryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    marginTop: 2,
  },
  entryText: {
    color: appColors.textSecondary,
    fontSize: 11,
    lineHeight: 14,
  },
  entryDivider: {
    color: appColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  deleteSwipe: {
    width: 96,
    borderRadius: 10,
    backgroundColor: appColors.danger700,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryMainStrip;
