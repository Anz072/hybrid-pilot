import React from "react";
import { AccessibilityInfo, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { AppButton, AppText, NumericText } from "../../components/ui";
import type { ApiProtocolLevels } from "../../API/nouri/protocolTypes";
import { appColors, type AppColorValue } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { displayProtocolInstant } from "./protocolForm";
import { nearestProtocolChartTime, protocolChartNumber, protocolChartValue } from "./protocolChart";
import { protocolStyles } from "./protocolStyles";

const palette = [appColors.actionPrimary, appColors.water, appColors.fat, appColors.carbs, appColors.textPrimary, appColors.success700, appColors.danger700, appColors.textSecondary];
const HEIGHT = 220; const TOP = 12; const BOTTOM = 196;

/** A persistent native SVG viewport shared by real, draft and Compare levels. */
export default function ProtocolTimelineChart({ data, timezone, labels = {} }: { data?: ApiProtocolLevels; timezone: string; labels?: Record<string, string> }) {
  const [width, setWidth] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const colors = React.useRef(new Map<string, AppColorValue>());
  const { timeFormat } = useDisplayPreferences();
  const geometry = React.useMemo(() => {
    if (!data || !width) return null;
    const from = Date.parse(data.startAt); const until = Date.parse(data.endAt);
    const value = (point: ApiProtocolLevels["series"][number]["points"][number]) => data.metric === "relative" ? point.relative : point.amount;
    const maximum = Math.max(1, ...data.series.flatMap((series) => series.points.map((point) => value(point) ?? 0))) * 1.08;
    const x = (at: number) => (at - from) / (until - from) * width;
    const y = (amount: number) => BOTTOM - amount / maximum * (BOTTOM - TOP);
    const used = new Set<AppColorValue>(); const nextColors = new Map<string, AppColorValue>();
    // Reserve existing visible colors before assigning newly enabled courses.
    for (const series of data.series) {
      const previous = colors.current.get(series.key);
      if (previous && !used.has(previous)) { nextColors.set(series.key, previous); used.add(previous); }
    }
    for (const series of data.series) if (!nextColors.has(series.key)) {
      const color = palette.find((entry) => !used.has(entry)) ?? palette[0]!;
      nextColors.set(series.key, color); used.add(color);
    }
    colors.current = nextColors;
    const times = [...new Set(data.series.flatMap((series) => [...series.points.map((point) => Date.parse(point.at)),
      ...series.doseMarkers.map((marker) => Date.parse(marker.at)), ...series.phaseMarkers.map((marker) => Date.parse(marker.at))]))]
      .filter((at) => at >= from && at <= until).sort((a, b) => a - b);
    const series = data.series.map((item) => {
      const paths: Array<{ key: string; d: string; planned: boolean }> = [];
      let previous: { x: number; y: number; planned: boolean } | null = null;
      for (const point of item.points) {
        const amount = value(point);
        if (amount === null) { previous = null; continue; }
        const current = { x: x(Date.parse(point.at)), y: y(amount), planned: point.segment !== "actual" };
        if (!previous || previous.planned !== current.planned) paths.push({ key: `${point.at}:${paths.length}`,
          d: previous ? `M${previous.x},${previous.y} L${current.x},${current.y}` : `M${current.x},${current.y}`, planned: current.planned });
        else paths[paths.length - 1]!.d += ` L${current.x},${current.y}`;
        previous = current;
      }
      // Dense markers share an eight-point display bucket. Exact event times
      // remain in the scrub sequence and selected-event readout below.
      const markers = new Map<string, { x: number; actual: boolean; count: number }>();
      const dosesByTime = new Map<number, typeof item.doseMarkers>();
      for (const marker of item.doseMarkers) {
        const time = Date.parse(marker.at);
        const atTime = dosesByTime.get(time);
        if (atTime) atTime.push(marker); else dosesByTime.set(time, [marker]);
        const position = x(time); const actual = marker.kind === "actual";
        const key = `${Math.round(position / 8)}:${actual}`;
        const bucket = markers.get(key);
        if (bucket) bucket.count += 1; else markers.set(key, { x: position, actual, count: 1 });
      }
      return { item, paths, markers: [...markers.values()], dosesByTime, color: nextColors.get(item.key)! };
    });
    return { from, until, maximum, x, y, times, series };
  }, [data, width]);
  const at = geometry ? Math.max(geometry.from, Math.min(geometry.until, selected ?? Date.parse(data!.evaluatedAt))) : null;
  const choose = (position: number) => {
    if (!geometry) return;
    const instant = geometry.from + Math.max(0, Math.min(width, position)) / width * (geometry.until - geometry.from);
    setSelected(nearestProtocolChartTime(geometry.times, instant));
  };
  const chooser = React.useRef(choose); chooser.current = choose;
  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (event) => chooser.current(event.nativeEvent.locationX),
    onPanResponderMove: (event) => chooser.current(event.nativeEvent.locationX),
    onPanResponderTerminationRequest: () => true,
  }), []);
  const format = (instant: number | string) => displayProtocolInstant(new Date(instant).toISOString(), timezone, timeFormat === "12h");
  const suffix = data?.metric === "amount" ? data.series[0]?.amountUnit ?? "" : "%";
  const readout = (instant: number) => [format(instant), ...(geometry?.series ?? []).map(({ item, dosesByTime }) => {
    const doses = dosesByTime.get(instant) ?? [];
    const value = protocolChartValue(item.points, instant, doses);
    const label = data?.comparisonBranchAt ? item.mode === "comparison" ? "Compare" : "Current" : labels[item.courseId] ?? item.compound.name;
    return `${label}: ${protocolChartNumber(data?.metric === "amount" ? value?.amount : value?.relative)} ${suffix}${doses.length ? `. ${doses.slice(0, 6).map((dose) => `${dose.kind === "actual" ? "Recorded" : "Planned"} ${dose.amount} ${dose.unit}, ${dose.route === "SC" ? "SubQ" : "IM"}`).join(". ")}${doses.length > 6 ? `. ${doses.length - 6} more administrations; see course history` : ""}` : ""}`;
  })].join(". ");
  const step = (direction: -1 | 1, announce = false) => {
    if (!geometry || at === null || !geometry.times.length) return;
    const nearest = nearestProtocolChartTime(geometry.times, at);
    const index = geometry.times.indexOf(nearest);
    const next = geometry.times[Math.max(0, Math.min(geometry.times.length - 1, index + direction))]!;
    setSelected(next);
    if (announce) AccessibilityInfo.announceForAccessibility(readout(next));
  };
  return <View style={protocolStyles.stack}>
    <View style={styles.axis}><NumericText variant="numberChartAxis">{geometry ? protocolChartNumber(geometry.maximum) : "—"} {suffix}</NumericText><AppText variant="bodySmall" color="secondary">{data?.metric === "amount" ? "Estimated amount" : "Estimated level"}</AppText></View>
    <Pressable onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onPress={(event) => choose(event.nativeEvent.locationX)}
      accessibilityRole="adjustable" accessibilityLabel="Estimated Levels timeline" accessibilityHint="Swipe up or down to move through modeled values and dose events. Previous and Next controls are also available."
      accessibilityValue={{ text: at === null ? "No chart data" : readout(at) }}
      accessibilityActions={[{ name: "increment", label: "Next point" }, { name: "decrement", label: "Previous point" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "decrement" ? -1 : 1)} {...responder.panHandlers}>
      <Svg width={width || "100%"} height={HEIGHT} accessible={false}>
        {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((y) => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={appColors.borderSoft} />)}
        {geometry?.series.map(({ item, paths, markers, dosesByTime, color }) => <React.Fragment key={item.key}>
          {item.phaseMarkers.map((marker) => <Line key={`${marker.kind}:${marker.at}`} x1={geometry.x(Date.parse(marker.at))} x2={geometry.x(Date.parse(marker.at))} y1={TOP} y2={BOTTOM} stroke={color} opacity={0.25} strokeDasharray="2 5" />)}
          {paths.map((path) => <Path key={path.key} d={path.d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={path.planned ? "3 5" : undefined} />)}
          {markers.map((marker, index) => <Path key={index} d={`M${marker.x},${BOTTOM + 3} l-4,7 h8 Z`} fill={marker.actual ? color : appColors.surfaceCard} stroke={color} />)}
          {at !== null && (() => { const selectedValue = protocolChartValue(item.points, at, dosesByTime.get(at)); const value = data?.metric === "amount" ? selectedValue?.amount : selectedValue?.relative;
            return value != null ? <Circle cx={geometry.x(at)} cy={geometry.y(value)} r={4} fill={appColors.surfaceCard} stroke={color} strokeWidth={2} /> : null; })()}
        </React.Fragment>)}
        {geometry && at !== null ? <Line x1={geometry.x(at)} x2={geometry.x(at)} y1={TOP} y2={BOTTOM} stroke={appColors.textMuted} strokeDasharray="3 3" /> : null}
      </Svg>
    </Pressable>
    <View style={styles.axis}><AppText variant="metadata" color="secondary">{geometry ? format(geometry.from) : " "}</AppText><AppText variant="metadata" color="secondary">{geometry ? format(geometry.until) : " "}</AppText></View>
    <AppText variant="bodySmall" color="secondary">Solid · logged history. Dotted · planned or draft estimate. ▲ Actual dose · △ Planned dose. Vertical lines · course changes.</AppText>
    {geometry?.series.some((series) => series.markers.some((marker) => marker.count > 1)) ? <AppText variant="bodySmall" color="secondary">Nearby dose markers overlap at this scale. Zoom in or use Previous and Next to inspect exact events.</AppText> : null}
    <View style={styles.axis}>
      <AppButton label="Previous" accessibilityLabel="Previous chart point or event" variant="ghost" disabled={!geometry?.times.length} onPress={() => step(-1, true)} />
      <AppButton label="Next" accessibilityLabel="Next chart point or event" variant="ghost" disabled={!geometry?.times.length} onPress={() => step(1, true)} />
    </View>
    {at !== null ? <AppText variant="bodyStrong">{format(at)} · {timezone}</AppText> : null}
    {geometry?.series.map(({ item, color, dosesByTime }, index) => {
      const selectedValue = at === null ? null : protocolChartValue(item.points, at, dosesByTime.get(at));
      const label = data?.comparisonBranchAt ? item.mode === "comparison" ? "Compare" : "Current" : labels[item.courseId] ?? item.compound.name;
      const doses = at === null ? [] : dosesByTime.get(at) ?? [];
      const events = at === null ? [] : item.phaseMarkers.filter((marker) => Date.parse(marker.at) === at);
      return <View key={item.key} style={protocolStyles.card}>
        <AppText variant="bodyStrong" color={color}>{index + 1}. {label}</AppText>
        <NumericText align="left" variant="numberTrendDelta">{protocolChartNumber(data?.metric === "amount" ? selectedValue?.amount : selectedValue?.relative)} {suffix}</NumericText>
        {selectedValue && data?.series.length === 1 ? <AppText variant="bodySmall" color="secondary">Estimated amount · {protocolChartNumber(selectedValue.amount)} {item.amountUnit}</AppText> : null}
        {doses.slice(0, 6).map((dose) => <AppText key={dose.key} variant="bodySmall">{dose.kind === "actual" ? "Recorded" : "Planned"} · {dose.amount} {dose.unit} · {dose.route === "SC" ? "SubQ" : "IM"}</AppText>)}
        {doses.length > 6 ? <AppText variant="bodySmall" color="secondary">{doses.length - 6} more administrations at this time; see course history for all records.</AppText> : null}
        {events.map((event) => <AppText key={event.kind + event.at} variant="bodySmall">{event.kind === "start" ? "Course start" : event.kind === "end" ? "Course end" : "Schedule changed"}</AppText>)}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({ axis: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: appSpacing.sm } });
