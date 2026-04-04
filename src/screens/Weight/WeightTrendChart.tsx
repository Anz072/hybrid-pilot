import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { DBWeightEntry, WeightEntryGoal } from "../../store/DB_TYPES";
import {
  computeEmaSeries,
  formatLocalDateLabel,
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

const CHART_HEIGHT = 220;
const CHART_LEFT_PADDING = 46;
const CHART_RIGHT_PADDING = 18;
const CHART_TOP_PADDING = 18;
const CHART_BOTTOM_PADDING = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_LINE_COLOR = "#1E3A8A";
const TREND_HALO_COLOR = "#C7D2FE";
const DAILY_LINE_COLOR = "#64748B";
const DAILY_POINT_STROKE = "#94A3B8";
const DAILY_POINT_FILL = "#FFFFFF";
const SELECTED_POINT_FILL = "#1E3A8A";
const SELECTED_GUIDE_COLOR = "#A5B4FC";
const GOAL_BAND_FILL = "#DBEAFE";
const GOAL_LINE_COLOR = "#60A5FA";

const buildLinePath = (points: Array<{ x: number; y: number }>): string =>
  points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");

const formatAxisDateLabel = (timestamp: number, range: WeightRangeKey): string => {
  const date = new Date(timestamp);

  if (range === "1Y" || range === "ALL") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }

  return formatLocalDateLabel(date.toISOString());
};

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
  const bucketSpanDays = getBucketSpanDays(range, totalSpanDays, entries.length);
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
          new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime(),
      ),
    [entries],
  );

  const displayEntries = React.useMemo(
    () => buildDisplayEntries(sortedEntries, range),
    [range, sortedEntries],
  );

  const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null;

  const emaSeries = React.useMemo(
    () => (displayEntries.length >= 3 ? computeEmaSeries(displayEntries) : []),
    [displayEntries],
  );

  const pointMetrics = React.useMemo(() => {
    if (displayEntries.length <= 7) {
      return {
        pointRadius: 3.5,
        selectedRadius: 5.5,
        lineWidth: 2,
        trendWidth: 3.1,
        trendHaloWidth: 6.5,
        dailyLineOpacity: 0.7,
        pointOpacity: 0.96,
      };
    }

    if (displayEntries.length <= 18) {
      return {
        pointRadius: 3,
        selectedRadius: 5,
        lineWidth: 1.8,
        trendWidth: 2.8,
        trendHaloWidth: 5.8,
        dailyLineOpacity: 0.62,
        pointOpacity: 0.84,
      };
    }

    return {
      pointRadius: 2.5,
      selectedRadius: 4.5,
      lineWidth: 1.5,
      trendWidth: 2.5,
      trendHaloWidth: 5,
      dailyLineOpacity: 0.48,
      pointOpacity: 0.72,
    };
  }, [displayEntries.length]);

  const helperText = React.useMemo(() => {
    if (sortedEntries.length < 3) {
      return "Trend needs more data.";
    }

    if (displayEntries.length < sortedEntries.length) {
      if (range === "ALL") {
        return "Showing representative snapshots for your full history.";
      }

      return range === "1Y"
        ? "Showing weekly snapshots for a clearer long-range view."
        : "Showing 3-day snapshots for a clearer 3-month view.";
    }

    return "Daily fluctuations are normal. Focus on the trend line.";
  }, [displayEntries.length, range, sortedEntries.length]);

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
    const yMin = minValue - valueRange * 0.15;
    const yMax = maxValue + valueRange * 0.15;
    const usableWidth = chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING;
    const usableHeight = CHART_HEIGHT - CHART_TOP_PADDING - CHART_BOTTOM_PADDING;

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

    const yTicks = [yMax, (yMax + yMin) / 2, yMin].map((value) => ({
      label: formatWeightKg(value),
      y: scaleY(value),
    }));

    const xTickTimes =
      minTime === maxTime ? [minTime] : [minTime, minTime + (maxTime - minTime) / 2, maxTime];
    const xTicks = xTickTimes.map((timestamp, index) => ({
      label: formatAxisDateLabel(timestamp, range),
      x: scaleX(timestamp),
      anchor: (
        xTickTimes.length === 1
          ? "middle"
          : index === 0
            ? "start"
            : index === xTickTimes.length - 1
              ? "end"
              : "middle"
      ) as "start" | "middle" | "end",
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

  const chartSummary = latestEntry
    ? `${sortedEntries.length} logs`
    : "Add entries to see your trend.";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.rangeRow}>
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
      </View>
      <Text style={styles.selectionText}>{chartSummary}</Text>
      <Text style={styles.helperText}>{helperText}</Text>

      <View
        style={styles.chartFrame}
        onLayout={handleLayout}
        accessible
        accessibilityLabel={chartSummary}
      >
        <Svg width="100%" height={CHART_HEIGHT}>
          {chartData ? (
            <>
              {chartData.yTicks.map((tick) => (
                <Line
                  key={`grid-${tick.label}`}
                  x1={CHART_LEFT_PADDING}
                  x2={chartWidth - CHART_RIGHT_PADDING}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
              ))}
              {chartData.yTicks.map((tick) => (
                <SvgText
                  key={`y-label-${tick.label}`}
                  x={CHART_LEFT_PADDING - 8}
                  y={tick.y + 4}
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {tick.label}
                </SvgText>
              ))}
              {goal ? (
                <>
                  <Rect
                    x={CHART_LEFT_PADDING}
                    y={chartData.scaleY(goal.targetWeightKg + (goal.goalBandKg ?? 0.3))}
                    width={Math.max(
                      0,
                      chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING,
                    )}
                    height={Math.abs(
                      chartData.scaleY(goal.targetWeightKg - (goal.goalBandKg ?? 0.3)) -
                        chartData.scaleY(goal.targetWeightKg + (goal.goalBandKg ?? 0.3)),
                    )}
                    fill={GOAL_BAND_FILL}
                    opacity={0.3}
                  />
                  <Line
                    x1={CHART_LEFT_PADDING}
                    x2={chartWidth - CHART_RIGHT_PADDING}
                    y1={chartData.scaleY(goal.targetWeightKg)}
                    y2={chartData.scaleY(goal.targetWeightKg)}
                    stroke={GOAL_LINE_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.85}
                  />
                </>
              ) : null}
              {chartData.points.length >= 2 ? (
                <Path
                  d={buildLinePath(chartData.points)}
                  stroke={DAILY_LINE_COLOR}
                  strokeWidth={pointMetrics.lineWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={pointMetrics.dailyLineOpacity}
                />
              ) : null}
              {chartData.trendPoints.length >= 3 ? (
                <Path
                  d={buildLinePath(chartData.trendPoints)}
                  stroke={TREND_HALO_COLOR}
                  strokeWidth={pointMetrics.trendHaloWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.55}
                />
              ) : null}
              {chartData.trendPoints.length >= 3 ? (
                <Path
                  d={buildLinePath(chartData.trendPoints)}
                  stroke={TREND_LINE_COLOR}
                  strokeWidth={pointMetrics.trendWidth}
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
                  r={pointMetrics.pointRadius}
                  fill={DAILY_POINT_FILL}
                  fillOpacity={0.96}
                  stroke={DAILY_POINT_STROKE}
                  strokeWidth={1.5}
                  opacity={pointMetrics.pointOpacity}
                />
              ))}
              {chartData.currentPoint ? (
                <>
                  <Circle
                    cx={chartData.currentPoint.x}
                    cy={chartData.currentPoint.y}
                    r={pointMetrics.selectedRadius + 3}
                    fill={TREND_HALO_COLOR}
                    opacity={0.55}
                  />
                  <Circle
                    cx={chartData.currentPoint.x}
                    cy={chartData.currentPoint.y}
                    r={pointMetrics.selectedRadius}
                    fill={SELECTED_POINT_FILL}
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                  />
                </>
              ) : null}
              <Line
                x1={CHART_LEFT_PADDING}
                x2={chartWidth - CHART_RIGHT_PADDING}
                y1={CHART_HEIGHT - CHART_BOTTOM_PADDING}
                y2={CHART_HEIGHT - CHART_BOTTOM_PADDING}
                stroke="#CBD5E1"
                strokeWidth={1}
              />
              {chartData.xTicks.map((tick, index) => (
                <SvgText
                  key={`x-label-${index}-${tick.label}`}
                  x={tick.x}
                  y={CHART_HEIGHT - 8}
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor={tick.anchor}
                >
                  {tick.label}
                </SvgText>
              ))}
            </>
          ) : null}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  title: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  selectionText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  helperText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  chartFrame: {
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rangeRow: {
    marginTop: 6,
    marginBottom: 6,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segment: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  segmentActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  segmentPressed: {
    opacity: 0.92,
  },
  segmentText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
});

export default WeightTrendChart;
