import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { DBWeightEntry, WeightEntryGoal } from "../../store/DB_TYPES";
import {
  computeEmaSeries,
  formatLocalDateTimeLabel,
  formatWeightKg,
  WEIGHT_RANGE_LABELS,
  type WeightRangeKey,
} from "./weightUtils";

type WeightTrendChartProps = {
  entries: DBWeightEntry[];
  goal: WeightEntryGoal | null;
  range: WeightRangeKey;
  selectedEntryId: string | null;
  onChangeRange: (range: WeightRangeKey) => void;
  onSelectEntry: (entry: DBWeightEntry) => void;
};

type ChartPoint = {
  entry: DBWeightEntry;
  x: number;
  y: number;
};

const CHART_HEIGHT = 220;
const CHART_PADDING = 18;

const buildLinePath = (points: Array<{ x: number; y: number }>): string =>
  points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");

const WeightTrendChart = ({
  entries,
  goal,
  range,
  selectedEntryId,
  onChangeRange,
  onSelectEntry,
}: WeightTrendChartProps) => {
  const [chartWidth, setChartWidth] = React.useState(0);
  const gestureState = React.useRef<{ startX: number; moved: boolean }>({
    startX: 0,
    moved: false,
  });

  const sortedEntries = React.useMemo(
    () =>
      [...entries].sort(
        (left, right) =>
          new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime(),
      ),
    [entries],
  );

  const selectedEntry =
    sortedEntries.find((entry) => entry.id === selectedEntryId) ??
    sortedEntries[sortedEntries.length - 1] ??
    null;

  const emaSeries = React.useMemo(
    () => (sortedEntries.length >= 3 ? computeEmaSeries(sortedEntries) : []),
    [sortedEntries],
  );

  const chartData = React.useMemo(() => {
    if (sortedEntries.length === 0 || chartWidth === 0) {
      return null;
    }

    const timestamps = sortedEntries.map((entry) =>
      new Date(entry.measuredAt).getTime(),
    );
    const values = sortedEntries.map((entry) => entry.valueKg);

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
    const usableWidth = chartWidth - CHART_PADDING * 2;
    const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;

    const scaleX = (timestamp: number) => {
      if (maxTime === minTime) {
        return CHART_PADDING + usableWidth / 2;
      }

      return (
        CHART_PADDING +
        ((timestamp - minTime) / (maxTime - minTime)) * usableWidth
      );
    };

    const scaleY = (value: number) =>
      CHART_PADDING + ((yMax - value) / (yMax - yMin)) * usableHeight;

    const points: ChartPoint[] = sortedEntries.map((entry) => ({
      entry,
      x: scaleX(new Date(entry.measuredAt).getTime()),
      y: scaleY(entry.valueKg),
    }));

    const trendPoints = emaSeries.map((item, index) => ({
      x: points[index]?.x ?? CHART_PADDING,
      y: scaleY(item.value),
    }));

    return {
      scaleY,
      points,
      trendPoints,
      selectedPoint:
        points.find((point) => point.entry.id === selectedEntry?.id) ?? null,
    };
  }, [chartWidth, emaSeries, goal, selectedEntry?.id, sortedEntries]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  const selectFromTouch = (locationX: number) => {
    if (!chartData || chartData.points.length === 0) {
      return;
    }

    const next = [...chartData.points].reduce((closest, candidate) =>
      Math.abs(candidate.x - locationX) < Math.abs(closest.x - locationX)
        ? candidate
        : closest,
    );

    onSelectEntry(next.entry);
  };

  const selectedSummary = selectedEntry
    ? `Selected: ${formatLocalDateTimeLabel(selectedEntry.measuredAtLocalIso)} | ${formatWeightKg(
        selectedEntry.valueKg,
      )} kg`
    : "Add entries to see your trend.";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Trend</Text>
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
      <Text style={styles.selectionText}>{selectedSummary}</Text>
      {sortedEntries.length < 3 ? (
        <Text style={styles.helperText}>Trend needs more data.</Text>
      ) : (
        <Text style={styles.helperText}>
          Daily fluctuations are normal. Focus on the trend line.
        </Text>
      )}

      <View
        style={styles.chartFrame}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          gestureState.current = {
            startX: event.nativeEvent.locationX,
            moved: false,
          };
          selectFromTouch(event.nativeEvent.locationX);
        }}
        onResponderMove={(event) => {
          if (
            Math.abs(event.nativeEvent.locationX - gestureState.current.startX) > 6
          ) {
            gestureState.current.moved = true;
          }
          selectFromTouch(event.nativeEvent.locationX);
        }}
        onResponderRelease={() => {
          gestureState.current = {
            startX: 0,
            moved: false,
          };
        }}
        accessible
        accessibilityLabel={selectedSummary}
      >
        <Svg width="100%" height={CHART_HEIGHT}>
          {chartData ? (
            <>
              {[0.2, 0.5, 0.8].map((fraction) => (
                <Line
                  key={fraction}
                  x1={CHART_PADDING}
                  x2={chartWidth - CHART_PADDING}
                  y1={CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * fraction}
                  y2={CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * fraction}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
              ))}
              {goal ? (
                <>
                  <Rect
                    x={CHART_PADDING}
                    y={chartData.scaleY(goal.targetWeightKg + (goal.goalBandKg ?? 0.3))}
                    width={Math.max(0, chartWidth - CHART_PADDING * 2)}
                    height={Math.abs(
                      chartData.scaleY(goal.targetWeightKg - (goal.goalBandKg ?? 0.3)) -
                        chartData.scaleY(goal.targetWeightKg + (goal.goalBandKg ?? 0.3)),
                    )}
                    fill="#DBEAFE"
                    opacity={0.45}
                  />
                  <Line
                    x1={CHART_PADDING}
                    x2={chartWidth - CHART_PADDING}
                    y1={chartData.scaleY(goal.targetWeightKg)}
                    y2={chartData.scaleY(goal.targetWeightKg)}
                    stroke="#1D4ED8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                </>
              ) : null}
              {chartData.trendPoints.length >= 3 ? (
                <Path
                  d={buildLinePath(chartData.trendPoints)}
                  stroke="#0F766E"
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                />
              ) : null}
              {chartData.points.length >= 2 ? (
                <Path
                  d={buildLinePath(chartData.points)}
                  stroke="#0F172A"
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {chartData.selectedPoint ? (
                <Line
                  x1={chartData.selectedPoint.x}
                  x2={chartData.selectedPoint.x}
                  y1={CHART_PADDING}
                  y2={CHART_HEIGHT - CHART_PADDING}
                  stroke="#94A3B8"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ) : null}
              {chartData.points.map((point) => (
                <Circle
                  key={point.entry.id}
                  cx={point.x}
                  cy={point.y}
                  r={point.entry.id === selectedEntry?.id ? 5 : 4}
                  fill={point.entry.id === selectedEntry?.id ? "#0F766E" : "#FFFFFF"}
                  stroke="#0F172A"
                  strokeWidth={2}
                />
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
    fontWeight: "700",
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
  },
  rangeRow: {
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
