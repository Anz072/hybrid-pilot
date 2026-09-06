import React from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretUpIcon,
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
  type MealSlot,
} from "./foodUtils";
import { formatTimeOfDay } from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import {
  AppButton,
  IconButton,
  AppText,
  ErrorState,
  LoadingState,
} from "../../components/ui";
import {
  appBorders,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../../theme/tokens";

import { useReducedMotion } from "../../theme/useReducedMotion";

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
  onBeforeMealToggle: () => void;
  revealEntryId: number | null;
  highlightedEntryId: number | null;
  registerEntry: (id: number, view: View | null) => void;
  onEntryLayout: () => void;
};

type FoodDiaryMealItemProps = {
  onAddFood: (slot: MealSlot) => void;
  onDeleteEntry: (entry: DBUserFoodLogEntry) => void;
  onEditEntry: (entry: DBUserFoodLogEntry) => void;
  bucket: FoodDiaryMealBucket;
  collapsed: boolean;
  highlightedEntryId: number | null;
  registerEntry: (id: number, view: View | null) => void;
  onEntryLayout: () => void;
  onToggle: () => void;
};

const DAY_TILE_WIDTH = 44;
const DAY_ROW_GAP = 2;
const DAY_RING_SIZE = 36;

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

const formatSelectedDateHeading = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const FoodDiaryMealItem = ({
  onAddFood,
  onDeleteEntry,
  onEditEntry,
  bucket,
  collapsed,
  highlightedEntryId,
  registerEntry,
  onEntryLayout,
  onToggle,
}: FoodDiaryMealItemProps) => {
  const { fontScale } = useWindowDimensions();
  const { timeFormat } = useDisplayPreferences();
  const entryCount = bucket.entries.length;
  const entryCountLabel = entryCount === 1 ? "1 food" : `${entryCount} foods`;
  const hasFood = entryCount > 0;

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasFood
              ? `${bucket.label}, ${entryCountLabel}, ${Math.round(bucket.totals.calories)} kcal`
              : `Add food to ${bucket.label}`
          }
          accessibilityState={hasFood ? { expanded: !collapsed } : undefined}
          onPress={hasFood ? onToggle : () => onAddFood(bucket.slot)}
          style={({ pressed }) => [
            styles.mealDisclosure,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.mealHeaderCopy}>
            <Text style={styles.mealTitle}>{bucket.label}</Text>
            {fontScale > 1.3 && hasFood ? (
              <Text style={[styles.mealKcal, styles.mealKcalBelow]}>
                {Math.round(bucket.totals.calories)} kcal
              </Text>
            ) : null}
          </View>
          {hasFood && fontScale <= 1.3 ? (
            <Text style={styles.mealKcal} numberOfLines={1}>
              {Math.round(bucket.totals.calories)} kcal
            </Text>
          ) : null}
          {hasFood ? (
            collapsed ? (
              <CaretDownIcon size={16} color={appColors.textSecondary} />
            ) : (
              <CaretUpIcon size={16} color={appColors.textSecondary} />
            )
          ) : null}
        </Pressable>
        <IconButton
          accessibilityLabel={`Add food to ${bucket.label}`}
          onPress={() => onAddFood(bucket.slot)}
          style={styles.mealAddButton}
        >
          <PlusIcon size={20} color={appColors.actionPrimary} weight="bold" />
        </IconButton>
      </View>

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
                  ref={(node) => registerEntry(entry.id, node)}
                  onLayout={onEntryLayout}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${entry.foodName}, ${nutrition.calories} kcal, ${time}${entry.entrySource !== "quick_add" ? `, ${formatFoodServing(entry.quantityG, entry.servingUnit)}` : ""}`}
                  style={({ pressed }) => [
                    styles.entryCard,
                    highlightedEntryId === entry.id && styles.entryHighlighted,
                    pressed && styles.entryPressed,
                  ]}
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
                      {entry.entrySource === "quick_add" &&
                      entry.foodName.toLowerCase() !== "quick add" ? (
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
  onBeforeMealToggle,
  revealEntryId,
  highlightedEntryId,
  registerEntry,
  onEntryLayout,
}: FoodDiaryMainStripProps) => {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Only explicit user choices are stored. Empty buckets have no disclosure
  // state until they contain food; server refreshes do not reset other meals.
  const [collapsedByDate, setCollapsedByDate] = React.useState<
    Record<string, Partial<Record<MealSlot, boolean>>>
  >({});
  const [dayRowWidth, setDayRowWidth] = React.useState(0);

  const selectedDateKey = formatFoodDateKey(selectedDate);
  const dayTileWidth =
    dayRowWidth > 0 && days.length > 0
      ? Math.floor(
          (dayRowWidth - DAY_ROW_GAP * (days.length - 1)) / days.length,
        )
      : null;
  const selectedDateHeading = formatSelectedDateHeading(selectedDate);
  const canShowContent = !isLoading && (!loadError || hasLoadedData);
  const todayKey = formatFoodDateKey(new Date());
  React.useEffect(() => setCollapsedByDate({}), [user?.externalId]);
  const revealMeal = mealBuckets.find((bucket) =>
    bucket.entries.some((entry) => entry.id === revealEntryId),
  )?.slot;
  React.useEffect(() => {
    if (!revealMeal) return;
    setCollapsedByDate((current) => ({
      ...current,
      [selectedDateKey]: { ...current[selectedDateKey], [revealMeal]: false },
    }));
  }, [revealEntryId, revealMeal, selectedDateKey]);

  const toggleMeal = (slot: MealSlot) => {
    onBeforeMealToggle();
    if (!reducedMotion) {
      LayoutAnimation.configureNext({
        ...LayoutAnimation.Presets.easeInEaseOut,
        duration: 160,
      });
    }
    setCollapsedByDate((current) => ({
      ...current,
      [selectedDateKey]: {
        ...current[selectedDateKey],
        [slot]: !(current[selectedDateKey]?.[slot] ?? false),
      },
    }));
  };
  const handleDayRowLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    setDayRowWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) >= 1 ? nextWidth : currentWidth,
    );
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.dateControls}>
        <View style={styles.weekNavRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            onPress={onPreviousWeek}
            style={({ pressed }) => [
              styles.navButton,
              pressed && styles.cardPressed,
            ]}
          >
            <CaretDoubleLeftIcon size={17} color={appColors.brand500} />
          </Pressable>
          <View style={styles.weekRangeContainer}>
            <Text style={styles.selectedDateTitle}>{selectedDateHeading}</Text>
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
            accessibilityRole="button"
            accessibilityLabel="Next week"
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
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={day.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                accessibilityState={{ selected }}
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
                  numberOfLines={1}
                  style={[styles.weekday, selected && styles.weekdaySelected]}
                >
                  {day.date.toLocaleDateString(undefined, {
                    weekday: fontScale > 1.3 ? "narrow" : "short",
                  })}
                </Text>
                <View style={styles.dayRing}>
                  <Text
                    style={[
                      styles.dayNumber,
                      selected && styles.dayNumberSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                </View>
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
            <AppButton label="Try again" onPress={onRetryLoad} size="sm" />
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
        <View style={styles.mealsSection}>
          <View style={styles.mealList}>
            {mealBuckets.map((bucket) => (
              <FoodDiaryMealItem
                key={bucket.slot}
                onAddFood={onAddFood}
                onDeleteEntry={onDeleteEntry}
                onEditEntry={onEditEntry}
                bucket={bucket}
                collapsed={
                  collapsedByDate[selectedDateKey]?.[bucket.slot] ??
                  bucket.entries.length === 0
                }
                highlightedEntryId={highlightedEntryId}
                registerEntry={registerEntry}
                onEntryLayout={onEntryLayout}
                onToggle={() => toggleMeal(bucket.slot)}
              />
            ))}
          </View>
          <FoodDiaryQuickAdds
            favoriteFoods={favoriteFoods}
            recentFoods={recentFoods}
            selectedMeal={selectedMeal}
            onSelectMeal={onSelectMeal}
            onBeforeToggle={onBeforeMealToggle}
            onAddFavorite={onAddFavorite}
            onQuickLogFavorite={onQuickLogFavorite}
          />
        </View>
      ) : null}
      {canShowContent ? (
        <Pressable
          disabled={isDayCompleteLoading}
          onPress={onToggleDayComplete}
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: isDayComplete,
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
              {isDayComplete ? "Day complete" : "Mark day complete"}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: appSpacing.md,
  },
  dateControls: {
    marginTop: appSpacing.xxs,
  },
  weekNavRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.xs,
    marginBottom: appSpacing.xs,
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
    minHeight: 56,
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
    minWidth: DAY_RING_SIZE,
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
    marginTop: appSpacing.xs,
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
    marginBottom: 0,
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
    paddingVertical: appSpacing.xxs,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mealDisclosure: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
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
  mealKcal: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    maxWidth: 72,
    textAlign: "right",
  },
  mealKcalBelow: { maxWidth: "100%", textAlign: "left" },
  mealAddButton: { backgroundColor: "transparent", borderWidth: 0 },
  stack: {
    marginTop: 8,
  },
  entryCard: {
    backgroundColor: "transparent",
    paddingVertical: 6,
    borderTopWidth: appBorders.width,
    borderTopColor: appBorders.soft,
  },
  entryHighlighted: { backgroundColor: appColors.actionPrimarySoft },
  entryPressed: { backgroundColor: appColors.surfaceField },
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
