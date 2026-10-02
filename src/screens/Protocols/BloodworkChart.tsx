import React from "react";
import { AccessibilityInfo, PanResponder, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { AppButton, AppText } from "../../components/ui";
import type { ApiBloodworkHistoryResult } from "../../API/nouri/bloodworkTypes";
import type { ApiProtocolAnnotations } from "../../API/nouri/protocolTypes";
import { appColors } from "../../theme/colors";
import { labRange } from "./bloodworkForm";
import { displayProtocolDate } from "./protocolForm";
import { protocolStyles as styles } from "./protocolStyles";

/** Geometry approximates decimal values only for pixels. All readouts retain
 * the exact server strings. Reference bounds belong to each individual point.
 */
export default function BloodworkChart({ results,events,onPanel }: {
  results: ApiBloodworkHistoryResult[]; events: ApiProtocolAnnotations["events"]; onPanel: (id: string) => void;
}) {
  const [width,setWidth] = React.useState(0);
  const [selected,setSelected] = React.useState<string | null>(null);
  const ordered = React.useMemo(() => [...results].sort((a,b) => a.collectedOn.localeCompare(b.collectedOn) || a.panelId.localeCompare(b.panelId)),[results]);
  const chosen = Math.max(0,selected ? ordered.findIndex((r) => r.panelId === selected) : ordered.length-1);
  const current = ordered[chosen];
  const readout = (index: number) => {
    const result = ordered[index];
    return result ? `${displayProtocolDate(result.collectedOn)}${result.labName ? `, ${result.labName}` : ""}. ${result.display.value} ${result.display.unit}. Reference: ${labRange(result.display.referenceLow, result.display.referenceHigh, result.display.unit)}. Recorded: ${result.rawValue} ${result.rawUnit}.` : "No results";
  };
  const step = (direction: -1 | 1, announce = false) => {
    const index = Math.max(0, Math.min(ordered.length - 1, chosen + direction));
    if (!ordered[index]) return;
    setSelected(ordered[index]!.panelId);
    if (announce) AccessibilityInfo.announceForAccessibility(readout(index));
  };
  const geometry = React.useMemo(() => {
    if (!ordered.length || width <= 0) return null;
    const times = ordered.map((r) => Date.parse(`${r.collectedOn}T12:00:00Z`));
    const values = ordered.flatMap((r) => [r.display.value,r.display.referenceLow,r.display.referenceHigh].filter((v): v is string => v !== null).map(Number));
    const min = Math.min(...values); const max = Math.max(...values); const pad = (max-min || Math.abs(max) || 1)*0.1;
    const low = min-pad; const high = max+pad;
    const start = times[0]!; const end = times.at(-1)!;
    const x = (at: number) => start === end ? width/2 : 12+(at-start)/(end-start)*(width-24);
    const y = (value: string) => 16+(high-Number(value))/(high-low)*184;
    const points = ordered.map((r,i) => ({ x: x(times[i]!),y: y(r.display.value),r }));
    return { start,end,x,y,points,low,high,path: points.map((p,i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ") };
  },[ordered,width]);
  const selectAt = React.useRef((position: number) => {});
  selectAt.current = (position) => {
    if (!geometry) return;
    const nearest = geometry.points.reduce((best,p) => Math.abs(p.x-position) < Math.abs(best.x-position) ? p : best);
    setSelected(nearest.r.panelId);
  };
  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e,g) => Math.abs(g.dx)>6 && Math.abs(g.dx)>Math.abs(g.dy),
    onPanResponderGrant: (e) => selectAt.current(e.nativeEvent.locationX),
    onPanResponderMove: (e) => selectAt.current(e.nativeEvent.locationX),onPanResponderTerminationRequest: () => true,
  }),[]);
  if (!current) return <AppText color="secondary">No results in this range.</AppText>;
  const visibleEvents = geometry ? events.filter((e) => e.date >= ordered[0]!.collectedOn && e.date <= ordered.at(-1)!.collectedOn) : [];
  // Dense guides merge into four-pixel columns. Exact events remain paginated
  // in the annotation controls; never create thousands of native SVG nodes.
  const eventColumns = geometry ? [...new Set(visibleEvents.map((e) => Math.round(geometry.x(Date.parse(`${e.date}T12:00:00Z`)) / 4) * 4))] : [];
  const eventsOnDate = visibleEvents.filter((event) => event.date === current.collectedOn).length;
  return <View style={styles.stack}>
    <View style={styles.card}><AppText variant="sectionTitle" selectable>{current.display.value} {current.display.unit}</AppText>
      <AppText color="secondary">{displayProtocolDate(current.collectedOn)}{current.labName ? ` · ${current.labName}` : ""}</AppText>
    </View>
    {geometry ? <AppText variant="bodySmall" color="secondary">Scale: {geometry.low.toPrecision(3)} – {geometry.high.toPrecision(3)} {current.display.unit}</AppText> : null}
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...responder.panHandlers}
      accessible accessibilityRole="adjustable" accessibilityLabel="Bloodwork results timeline"
      accessibilityValue={{ text: readout(chosen) }} accessibilityHint="Swipe up or down to inspect the next or previous result, including results from the same day."
      accessibilityActions={[{ name: "increment", label: "Next result" }, { name: "decrement", label: "Previous result" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "decrement" ? -1 : 1)}>
      <Svg width={width || "100%"} height={224} accessible={false}>
        {[16,108,200].map((y) => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={appColors.borderSoft} />)}
        {geometry ? <>
          {eventColumns.map((x) => <Line key={x} x1={x} x2={x} y1={8} y2={208} stroke={appColors.textMuted} strokeDasharray="2 5" opacity={0.4} />)}
          <Path d={geometry.path} fill="none" stroke={appColors.accent} strokeWidth={2} />
          {geometry.points.map((p) => <React.Fragment key={p.r.panelId}>
            {p.r.display.referenceLow !== null && p.r.display.referenceHigh !== null ? <Line x1={p.x} x2={p.x} y1={geometry.y(p.r.display.referenceLow)} y2={geometry.y(p.r.display.referenceHigh)} stroke={appColors.textMuted} strokeWidth={3} opacity={0.35} /> : null}
            <Circle cx={p.x} cy={p.y} r={p.r.panelId === current.panelId ? 6 : 3} fill={p.r.panelId === current.panelId ? appColors.accent : appColors.surfaceCard} stroke={appColors.accent} strokeWidth={2} />
          </React.Fragment>)}
        </> : null}
      </Svg>
    </View>
    <View style={styles.row}><AppText variant="bodySmall" color="secondary">{displayProtocolDate(ordered[0]!.collectedOn)}</AppText>
      {ordered.length > 1 ? <AppText variant="bodySmall" color="secondary">→ {displayProtocolDate(ordered.at(-1)!.collectedOn)}</AppText> : null}</View>
    <AppText variant="bodySmall" color="secondary">Dots are recorded results. Grey bars show each result’s own two-sided reference range. Lines connect collection dates; sample times are not recorded.</AppText>
    <View style={styles.row}><AppButton label="Previous result" variant="secondary" disabled={chosen <= 0} onPress={() => step(-1, true)} />
      <AppButton label="Next result" variant="secondary" disabled={chosen >= ordered.length-1} onPress={() => step(1, true)} /></View>
    <AppText selectable>Reference: {labRange(current.display.referenceLow,current.display.referenceHigh,current.display.unit)}</AppText>
    <AppText variant="bodySmall" color="secondary" selectable>Recorded: {current.rawValue} {current.rawUnit}</AppText>
    <AppButton label="Open this panel" variant="ghost" onPress={() => onPanel(current.panelId)} />
    {eventsOnDate ? <AppText variant="bodySmall">{eventsOnDate} course {eventsOnDate === 1 ? "event" : "events"} on this date. See Course annotations for details.</AppText> : null}
  </View>;
}
