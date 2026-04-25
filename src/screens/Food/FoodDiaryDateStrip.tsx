import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  FoodNutritionTotals,
  formatFoodDateKey,
  formatFoodShortDate,
} from "./foodUtils";
import { DBUser } from "../../store/DB_TYPES";
import FoodDiaryHeroCard from "./FoodDiaryHeroCard";
import { appColors } from "../../theme/colors";
import { CaretLeftIcon } from "phosphor-react-native";

export type FoodDiaryDateStripDay = {
  date: Date;
  dateKey: string;
  calories: number;
};

type FoodDiaryDateStripProps = {
  days: FoodDiaryDateStripDay[];
  selectedDate: Date;
  targetCalories: number | null;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onSelectDate: (date: Date) => void;
  totals?: FoodNutritionTotals;
  user?: DBUser | null;
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

const FoodDiaryDateStrip = ({
  days,
  selectedDate,
  targetCalories,
  onNextWeek,
  onPreviousWeek,
  onSelectDate,
  totals,
  user,
}: FoodDiaryDateStripProps) => {
  const selectedDateKey = formatFoodDateKey(selectedDate);
  const weekRange =
    days.length > 0
      ? `${formatFoodShortDate(days[0].date)} - ${formatFoodShortDate(days[days.length - 1].date)}`
      : "";
  const fallbackMaxCalories = Math.max(1, ...days.map((day) => day.calories));
  const todayKey = formatFoodDateKey(new Date());

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

      <View
        // horizontal
        // showsHorizontalScrollIndicator={false}
        // contentContainerStyle={styles.dayRow}
        style={styles.dayRow}
      >
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
                  stroke={appColors.brand400}
                  strokeWidth={OUTLINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={outlinePath}
                  stroke={selected ? appColors.brand700 : appColors.brand500}
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
      {totals && user && (
        <FoodDiaryHeroCard
          energyTargetCalories={targetCalories}
          totals={totals}
          user={user}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceCard,
    padding: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
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
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  subtitle: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  navButton: {
    borderRadius: 9999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navButtonText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  dayRow: {
    display: "flex",
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
    backgroundColor: appColors.surfaceFieldAlt,
    overflow: "hidden",
  },
  dayPillSelected: {
    backgroundColor: appColors.brand800,
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
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryDateStrip;

