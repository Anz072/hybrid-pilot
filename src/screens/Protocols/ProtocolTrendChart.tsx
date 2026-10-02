import React from "react";
import { AccessibilityInfo, PanResponder, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { ApiProtocolAnnotations, ApiProtocolTrends } from "../../API/nouri/protocolTypes";
import { AppButton, AppText } from "../../components/ui";
import { formatWeightValue } from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import { displayProtocolDate } from "./protocolForm";
import { nearestTrendPoint, sampleTrendPoints, trendDatePosition } from "./trendChartGeometry";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolTrendChart({ data, events }: { data: ApiProtocolTrends; events: ApiProtocolAnnotations["events"] }) {
  const [width, setWidth] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);
  const preferences = useDisplayPreferences();
  const unit = data.metric === "weight" ? preferences.weightUnit : data.unit;
  const format = (value: number) => data.metric === "weight" ? formatWeightValue(value, preferences.weightUnit) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const chosen = selected ? nearestTrendPoint(data.points, trendDatePosition(selected)) : data.points.length - 1;
  const current = data.points[chosen];
  const readout = (index: number) => {
    const point = data.points[index];
    if (!point) return "No chart data";
    return `${displayProtocolDate(point.date)}. ${point.value === null ? "No average for this day" : `${format(point.value)} ${unit}`}${data.aggregation === "complete_day_7_day_average" ? `. ${point.coverage} of 7 complete days` : ""}`;
  };
  const step = (direction: -1 | 1, announce = false) => {
    const index = Math.max(0, Math.min(data.points.length - 1, chosen + direction));
    if (!data.points[index]) return;
    setSelected(data.points[index]!.date);
    if (announce) AccessibilityInfo.announceForAccessibility(readout(index));
  };
  const geometry = React.useMemo(() => {
    if (width <= 24) return null;
    let low = Infinity; let high = -Infinity;
    for (const point of data.points) if (point.value !== null) { low = Math.min(low, point.value); high = Math.max(high, point.value); }
    if (!Number.isFinite(low)) return null;
    const pad = (high - low || Math.abs(high) || 1) * 0.1;
    low = Math.max(0, low - pad); high += pad;
    const start = trendDatePosition(data.start); const end = trendDatePosition(data.end);
    const x = (date: string) => end === start ? width / 2 : 12 + (trendDatePosition(date) - start) / (end - start) * (width - 24);
    const y = (value: number) => 16 + (high - value) / (high - low) * 184;
    const sampled = sampleTrendPoints(data.points);
    const path = sampled.map((point, i) => `${i && sampled[i - 1]!.segment === point.segment ? "L" : "M"}${x(data.points[point.index]!.date)},${y(point.value)}`).join(" ");
    // One path also shows isolated complete days and single measurements.
    const dots = sampled.map((point) => {
      const px = x(data.points[point.index]!.date); const py = y(point.value);
      return `M${px - 2},${py}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0`;
    }).join(" ");
    return { start, end, low, high, x, y, path, dots };
  }, [data.points, data.start, data.end, width]);
  const selectAt = React.useRef((_x: number) => {});
  selectAt.current = (x) => {
    const start = trendDatePosition(data.start); const end = trendDatePosition(data.end);
    const at = start + Math.max(0, Math.min(1, (x - 12) / Math.max(1, width - 24))) * (end - start);
    const point = data.points[nearestTrendPoint(data.points, at)];
    if (point) setSelected(point.date);
  };
  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (event) => selectAt.current(event.nativeEvent.locationX),
    onPanResponderMove: (event) => selectAt.current(event.nativeEvent.locationX),
    onPanResponderTerminationRequest: () => true,
  }), []);
  const eventColumns = geometry ? [...new Set(events.filter((event) => event.date >= data.start && event.date <= data.end)
    .map((event) => Math.round(geometry.x(event.date) / 4) * 4))] : [];
  return <View style={styles.stack}>
    {current ? <View style={styles.card}>
      <AppText variant="sectionTitle" selectable>{current.value === null ? "No average for this day" : `${format(current.value)} ${unit}`}</AppText>
      <AppText color="secondary">{displayProtocolDate(current.date)}</AppText>
      {data.aggregation === "complete_day_7_day_average" ? <>
        <AppText variant="bodySmall">7-day average · {current.coverage}/7 complete days</AppText>
        <AppText variant="bodySmall" selectable>{current.recordedValue === null ? "No diary record for this day." : `Recorded this day: ${format(current.recordedValue)} ${unit}${current.isComplete ? " · Complete" : " · Incomplete, excluded from average"}`}</AppText>
      </> : null}
    </View> : null}
    {geometry ? <AppText variant="bodySmall" color="secondary">Scale: {format(geometry.low)}–{format(geometry.high)} {unit}</AppText> : null}
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers}
      accessible accessibilityRole="adjustable" accessibilityLabel={`${data.metric === "weight" ? "Body weight" : data.metric} trend`}
      accessibilityValue={{ text: readout(chosen) }} accessibilityHint="Swipe up or down to inspect the next or previous recorded point."
      accessibilityActions={[{ name: "increment", label: "Next point" }, { name: "decrement", label: "Previous point" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "decrement" ? -1 : 1)}>
      <Svg width={width || "100%"} height={224} accessible={false}>
        {[16, 108, 200].map((y) => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={appColors.borderSoft} />)}
        {geometry ? <>
          {eventColumns.map((x) => <Line key={x} x1={x} x2={x} y1={8} y2={208} stroke={appColors.textMuted} strokeDasharray="2 5" opacity={0.4} />)}
          <Path d={geometry.path} stroke={appColors.accent} strokeWidth={2} fill="none" />
          <Path d={geometry.dots} fill={appColors.accent} />
          {current?.value !== null && current?.value !== undefined ? <Circle cx={geometry.x(current.date)} cy={geometry.y(current.value)} r={6} fill={appColors.surfaceCard} stroke={appColors.accent} strokeWidth={2} /> : null}
        </> : null}
      </Svg>
    </View>
    <AppText variant="bodySmall" color="secondary">{displayProtocolDate(data.start)} → {displayProtocolDate(data.end)}</AppText>
    {current ? <View style={styles.row}>
      <AppButton label="Previous point" variant="secondary" disabled={chosen <= 0} onPress={() => step(-1, true)} />
      <AppButton label="Next point" variant="secondary" disabled={chosen >= data.points.length - 1} onPress={() => step(1, true)} />
    </View> : null}
    <AppText variant="bodySmall" color="secondary">{data.metric === "weight" ? "Recorded measurements from Weight. Lines connect measurements; no weights are inferred between them."
      : "Only complete diary days contribute to the seven-day average. Complete zero-intake days count; incomplete and missing days leave gaps."} Drag horizontally or use the point buttons to inspect values. Course annotations show timing, not cause.</AppText>
  </View>;
}
