import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { DBWeightEntry, WeightEntryGoal } from "../../store/DB_TYPES";
import {
  computeEmaSeries,
  formatWeightKg,
  WEIGHT_RANGE_LABELS,
  type WeightRangeKey,
} from "./weightUtils";

type WeightTrendChartProps = {
  entries: DBWeightEntry[];
  goal: WeightEntryGoal | null;
  range: WeightRangeKey;
  onChangeRange: (range: WeightRangeKey) => void;
};

type ChartPoint = {
  entry: DBWeightEntry;
  x: number;
  y: number;
};

const CHART_HEIGHT = 224;
const CHART_LEFT_PADDING = 16;
const CHART_RIGHT_PADDING = 42;
const CHART_TOP_PADDING = 14;
const CHART_BOTTOM_PADDING = 34;
const DAY_MS = 24 * 60 * 60 * 1000;

const TREND_LINE_COLOR = "#8B5CF6";
const TREND_HALO_COLOR = "#DDD6FE";
const DAILY_LINE_COLOR = "#B8B0C9";
const DAILY_POINT_STROKE = "#A99FC0";
const DAILY_POINT_FILL = "#FFFFFF";
const CURRENT_POINT_FILL = "#8B5CF6";
const GRID_COLOR = "#E5DFEE";
const AXIS_TEXT_COLOR = "#8C839C";
const GOAL_BAND_FILL = "#E9E2FF";
const GOAL_LINE_COLOR = "#B794F4";

const buildLinePath = (points: Array<{ x: number; y: number }>): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");

const getBucketSpanDays = (
  range: WeightRangeKey,
  totalSpanDays: number,
  entryCount: number,
): number => {
  switch (range) {
    case "1W":
      return 1;
    case "1M":
      return 1;
    case "3M":
      return 3;
    case "1Y":
      return 7;
    case "ALL":
      if (entryCount <= 40) {
        return 1;
      }
      if (totalSpanDays > 730) {
        return 30;
      }
      if (totalSpanDays > 365) {
        return 14;
      }
      if (totalSpanDays > 180) {
        return 10;
      }
      return 7;
    default:
      return 1;
  }
};

const buildDisplayEntries = (
  entries: DBWeightEntry[],
  range: WeightRangeKey,
): DBWeightEntry[] => {
  if (entries.length <= 2) {
    return entries;
  }

  const firstTime = new Date(entries[0].measuredAt).getTime();
  const lastTime = new Date(entries[entries.length - 1].measuredAt).getTime();
  const totalSpanDays = Math.max(1, Math.ceil((lastTime - firstTime) / DAY_MS));
  const bucketSpanDays = getBucketSpanDays(
    range,
    totalSpanDays,
    entries.length,
  );
  if (bucketSpanDays <= 1) {
    return entries;
  }

  const buckets: DBWeightEntry[][] = [];

  for (const entry of entries) {
    const timestamp = new Date(entry.measuredAt).getTime();
    const bucketIndex = Math.floor(
      Math.max(0, timestamp - firstTime) / (bucketSpanDays * DAY_MS),
    );
    const bucket = buckets[bucketIndex] ?? [];
    bucket.push(entry);
    buckets[bucketIndex] = bucket;
  }

  return buckets
    .filter((bucket): bucket is DBWeightEntry[] => bucket.length > 0)
    .map((bucket, index, allBuckets) => {
      if (index === 0) {
        return bucket[0];
      }

      if (index === allBuckets.length - 1) {
        return bucket[bucket.length - 1];
      }

      return bucket[Math.floor(bucket.length / 2)];
    });
};

const formatPeriodLabel = (start: Date, end: Date) => {
  const sameYear = start.getFullYear() === end.getFullYear();

  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });

  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
};

const formatAxisDateLabel = (
  timestamp: number,
  range: WeightRangeKey,
): string => {
  const date = new Date(timestamp);

  if (range === "1W") {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  if (range === "1M") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  if (range === "3M") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    year: range === "ALL" ? "numeric" : undefined,
  });
};

const getXAxisTickCount = (range: WeightRangeKey) => {
  switch (range) {
    case "1W":
      return 7;
    case "1M":
      return 5;
    case "3M":
      return 4;
    case "1Y":
      return 6;
    case "ALL":
      return 6;
    default:
      return 4;
  }
};

const WeightTrendChart = ({
  entries,
  goal,
  range,
  onChangeRange,
}: WeightTrendChartProps) => {
  const [chartWidth, setChartWidth] = React.useState(0);

  const sortedEntries = React.useMemo(
    () =>
      [...entries].sort(
        (left, right) =>
          new Date(left.measuredAt).getTime() -
          new Date(right.measuredAt).getTime(),
      ),
    [entries],
  );

  const displayEntries = React.useMemo(
    () => buildDisplayEntries(sortedEntries, range),
    [range, sortedEntries],
  );

  const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null;
  const firstEntry = sortedEntries[0] ?? null;

  const emaSeries = React.useMemo(
    () => (displayEntries.length >= 3 ? computeEmaSeries(displayEntries) : []),
    [displayEntries],
  );

  const helperText = React.useMemo(() => {
    if (sortedEntries.length < 3) {
      return "Trend needs more data.";
    }

    if (displayEntries.length < sortedEntries.length) {
      if (range === "ALL") {
        return "Showing representative snapshots across your full history.";
      }

      return range === "1Y"
        ? "Showing weekly snapshots for a cleaner long-range view."
        : "Showing simplified snapshots for a cleaner long-range view.";
    }

    return "";
  }, [displayEntries.length, range, sortedEntries.length]);

  const periodLabel =
    firstEntry && latestEntry
      ? formatPeriodLabel(
          new Date(firstEntry.measuredAt),
          new Date(latestEntry.measuredAt),
        )
      : "Add entries to build a trend";

  const chartData = React.useMemo(() => {
    if (displayEntries.length === 0 || chartWidth === 0) {
      return null;
    }

    const timestamps = displayEntries.map((entry) =>
      new Date(entry.measuredAt).getTime(),
    );
    const values = displayEntries.map((entry) => entry.valueKg);

    if (goal) {
      values.push(goal.targetWeightKg);
      values.push(goal.targetWeightKg + (goal.goalBandKg ?? 0.3));
      values.push(goal.targetWeightKg - (goal.goalBandKg ?? 0.3));
    }

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(0.5, maxValue - minValue);
    const yMin = minValue - valueRange * 0.18;
    const yMax = maxValue + valueRange * 0.18;
    const usableWidth = chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING;
    const usableHeight =
      CHART_HEIGHT - CHART_TOP_PADDING - CHART_BOTTOM_PADDING;

    const scaleX = (timestamp: number) => {
      if (maxTime === minTime) {
        return CHART_LEFT_PADDING + usableWidth / 2;
      }

      return (
        CHART_LEFT_PADDING +
        ((timestamp - minTime) / (maxTime - minTime)) * usableWidth
      );
    };

    const scaleY = (value: number) =>
      CHART_TOP_PADDING + ((yMax - value) / (yMax - yMin)) * usableHeight;

    const points: ChartPoint[] = displayEntries.map((entry) => ({
      entry,
      x: scaleX(new Date(entry.measuredAt).getTime()),
      y: scaleY(entry.valueKg),
    }));

    const trendPoints = emaSeries.map((item, index) => ({
      x: points[index]?.x ?? CHART_LEFT_PADDING,
      y: scaleY(item.value),
    }));

    const yTickValues = [yMax, (yMax + yMin) / 2, yMin];
    const yTicks = yTickValues.map((value) => ({
      label: `${Math.round(value)}`,
      y: scaleY(value),
    }));

    const tickCount = getXAxisTickCount(range);
    const xTickTimes =
      minTime === maxTime
        ? [minTime]
        : Array.from({ length: tickCount }, (_, index) => {
            return minTime + ((maxTime - minTime) * index) / (tickCount - 1);
          });

    const xTicks = xTickTimes.map((timestamp) => ({
      label: formatAxisDateLabel(timestamp, range),
      x: scaleX(timestamp),
    }));

    return {
      scaleY,
      yTicks,
      xTicks,
      points,
      trendPoints,
      currentPoint: points[points.length - 1] ?? null,
    };
  }, [chartWidth, displayEntries, emaSeries, goal, range]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card}>
      <View style={styles.metaRow}>
        <View style={styles.metaCopy}>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          {helperText !== "" && (
            <Text style={styles.helperText}>{helperText}</Text>
          )}
        </View>
        <View style={styles.logsPill}>
          <Text style={styles.logsPillText}>
            {latestEntry ? `${sortedEntries.length} logs` : "No logs"}
          </Text>
        </View>
      </View>

      <View
        style={styles.chartFrame}
        onLayout={handleLayout}
        accessible
        accessibilityLabel={periodLabel}
      >
        <Svg width="100%" height={CHART_HEIGHT}>
          {chartData ? (
            <>
              {chartData.yTicks.map((tick, index) => (
                <Line
                  key={`grid-${index}-${tick.label}`}
                  x1={CHART_LEFT_PADDING}
                  x2={chartWidth - CHART_RIGHT_PADDING}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={GRID_COLOR}
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              ))}

              {goal ? (
                <>
                  <Rect
                    x={CHART_LEFT_PADDING}
                    y={chartData.scaleY(
                      goal.targetWeightKg + (goal.goalBandKg ?? 0.3),
                    )}
                    width={Math.max(
                      0,
                      chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING,
                    )}
                    height={Math.abs(
                      chartData.scaleY(
                        goal.targetWeightKg - (goal.goalBandKg ?? 0.3),
                      ) -
                        chartData.scaleY(
                          goal.targetWeightKg + (goal.goalBandKg ?? 0.3),
                        ),
                    )}
                    fill={GOAL_BAND_FILL}
                    opacity={0.45}
                  />
                  <Line
                    x1={CHART_LEFT_PADDING}
                    x2={chartWidth - CHART_RIGHT_PADDING}
                    y1={chartData.scaleY(goal.targetWeightKg)}
                    y2={chartData.scaleY(goal.targetWeightKg)}
                    stroke={GOAL_LINE_COLOR}
                    strokeWidth={1.4}
                    strokeDasharray="4 5"
                    opacity={0.9}
                  />
                </>
              ) : null}

              {chartData.points.length >= 2 ? (
                <Path
                  d={buildLinePath(chartData.points)}
                  stroke={DAILY_LINE_COLOR}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.75}
                />
              ) : null}

              {chartData.trendPoints.length >= 3 ? (
                <Path
                  d={buildLinePath(chartData.trendPoints)}
                  stroke={TREND_HALO_COLOR}
                  strokeWidth={6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.72}
                />
              ) : null}

              {chartData.trendPoints.length >= 3 ? (
                <Path
                  d={buildLinePath(chartData.trendPoints)}
                  stroke={TREND_LINE_COLOR}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {chartData.points.map((point) => (
                <Circle
                  key={point.entry.id}
                  cx={point.x}
                  cy={point.y}
                  r={2.9}
                  fill={DAILY_POINT_FILL}
                  stroke={DAILY_POINT_STROKE}
                  strokeWidth={1.4}
                  opacity={0.96}
                />
              ))}

              {chartData.currentPoint ? (
                <>
                  <Circle
                    cx={chartData.currentPoint.x}
                    cy={chartData.currentPoint.y}
                    r={6.5}
                    fill={TREND_HALO_COLOR}
                    opacity={0.9}
                  />
                  <Circle
                    cx={chartData.currentPoint.x}
                    cy={chartData.currentPoint.y}
                    r={4}
                    fill={CURRENT_POINT_FILL}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                </>
              ) : null}

              <Line
                x1={CHART_LEFT_PADDING}
                x2={chartWidth - CHART_RIGHT_PADDING}
                y1={CHART_HEIGHT - CHART_BOTTOM_PADDING}
                y2={CHART_HEIGHT - CHART_BOTTOM_PADDING}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />

              {chartData.xTicks.map((tick, index) => (
                <SvgText
                  key={`x-label-${index}-${tick.label}`}
                  x={tick.x}
                  y={CHART_HEIGHT - 8}
                  fill={AXIS_TEXT_COLOR}
                  fontSize="10.5"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {tick.label}
                </SvgText>
              ))}

              {chartData.yTicks.map((tick, index) => (
                <SvgText
                  key={`y-label-${index}-${tick.label}`}
                  x={chartWidth - 6}
                  y={tick.y + 4}
                  fill={AXIS_TEXT_COLOR}
                  fontSize="10.5"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {tick.label}
                </SvgText>
              ))}
            </>
          ) : null}
        </Svg>
      </View>

      <View style={styles.rangeRail}>
        {WEIGHT_RANGE_LABELS.map((item) => {
          const selected = item === range;

          return (
            <Pressable
              key={item}
              onPress={() => onChangeRange(item)}
              style={({ pressed }) => [
                styles.segment,
                selected && styles.segmentActive,
                pressed && styles.segmentPressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legendCard}>
        <View style={styles.legendItem}>
          <View style={styles.legendGraphic}>
            <View style={styles.dailyLegendLine} />
            <View style={styles.dailyLegendDot} />
          </View>
          <Text style={styles.legendText}>Scale Weight</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendGraphic}>
            <View style={styles.trendLegendLine} />
          </View>
          <Text style={styles.legendText}>Trend Weight</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    paddingHorizontal: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  metaCopy: {
    flex: 1,
  },
  periodLabel: {
    color: "#3B3448",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  helperText: {
    color: "#857C95",
    fontSize: 12,
    lineHeight: 17,
  },
  logsPill: {
    borderRadius: 999,
    backgroundColor: "#F1EDF7",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logsPillText: {
    color: "#5C5569",
    fontSize: 12,
    fontWeight: "700",
  },
  chartFrame: {
    backgroundColor: "#F7F4FB",
    overflow: "hidden",
    borderColor: "#ECE5F6",
    paddingVertical: 6,
  },
  rangeRail: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#ECE7F3",
    padding: 6,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#B8AEC9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  segmentPressed: {
    opacity: 0.92,
  },
  segmentText: {
    color: "#675F77",
    fontSize: 12,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#221C2D",
  },
  legendCard: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    borderRadius: 20,
    backgroundColor: "#F4F0F8",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#ECE5F6",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendGraphic: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyLegendLine: {
    position: "absolute",
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: DAILY_LINE_COLOR,
  },
  dailyLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: DAILY_POINT_STROKE,
  },
  trendLegendLine: {
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: TREND_LINE_COLOR,
  },
  legendText: {
    color: "#4A4258",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default WeightTrendChart;
