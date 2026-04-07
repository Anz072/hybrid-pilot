import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatFoodDateKey, formatFoodShortDate } from "./foodUtils";

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
                  stroke="#E4DDF3"
                  strokeWidth={OUTLINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={outlinePath}
                  stroke={selected ? "#5F46D9" : "#9F8AF4"}
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
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
    color: "#1B1529",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  subtitle: {
    color: "#8B839C",
    fontSize: 12,
    fontWeight: "700",
  },
  navButton: {
    borderRadius: 999,
    backgroundColor: "#F5F1FB",
    borderWidth: 1,
    borderColor: "#E4DDF3",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navButtonText: {
    color: "#3A314A",
    fontSize: 12,
    fontWeight: "800",
  },
  dayRow: {
    display:'flex',
    flexDirection: 'row',
    justifyContent: 'center',
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
    backgroundColor: "#FBFAFF",
    overflow: "hidden",
  },
  dayPillSelected: {
    backgroundColor: "#F1ECFA",
  },
  weekday: {
    color: "#8A809F",
    fontSize: 12,
  },
  weekdaySelected: {
    color: "#4A3B68",
  },
  dayNumber: {
    color: "#1B1529",
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: "#1F1831",
  },
  kcalText: {
    color: "#8A809F",
    fontSize: 10,
    marginBottom: 2,
  },
  kcalTextSelected: {
    color: "#6D52EA",
  },
  todayDot: {
    position: "absolute",
    right:6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#6e52ea4b",
  },
  todayDot2: {
    position: "absolute",
    left: 5,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#6e52ea4b",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryDateStrip;
