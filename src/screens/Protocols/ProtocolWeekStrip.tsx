import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, NumericText } from "../../components/ui";
import type { ApiProtocolCalendarIndicator } from "../../API/nouri/protocolTypes";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing } from "../../theme/tokens";
import { addProtocolDate, displayProtocolDate } from "./protocolForm";

export function protocolWeekStart(date: string): string {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addProtocolDate(date, -weekday);
}
export function activityDescription(day?: ApiProtocolCalendarIndicator, known = true): string {
  if (!known) return "Activity not loaded";
  if (!day) return "No scheduled activity";
  const planned = day.scheduled + day.preview;
  const completed = day.completed + day.manual;
  return [planned ? `${planned} scheduled` : "", completed ? `${completed} recorded` : "",day.reminders ? `${day.reminders} bloodwork calendar items` : ""].filter(Boolean).join(", ") || "No scheduled activity";
}
export default function ProtocolWeekStrip({ selected, days, onSelect, activityKnown = true }: { selected: string; days: ApiProtocolCalendarIndicator[]; onSelect: (date: string) => void; activityKnown?: boolean }) {
  const start = protocolWeekStart(selected);
  const scroller = React.useRef<ScrollView>(null);
  const [viewport, setViewport] = React.useState(0);
  const [content, setContent] = React.useState(0);
  React.useEffect(() => {
    if (!viewport || !content) return;
    const index = Math.round((Date.parse(selected) - Date.parse(start)) / 86_400_000);
    scroller.current?.scrollTo({ x: Math.max(0, Math.min(content - viewport, (index + 0.5) * content / 7 - viewport / 2)), animated: false });
  }, [selected, start, viewport, content]);
  return <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}
    onLayout={(event) => setViewport(event.nativeEvent.layout.width)} onContentSizeChange={(width) => setContent(width)}><View style={styles.week}>
    {Array.from({ length: 7 }, (_, offset) => {
      const date = addProtocolDate(start, offset);
      const day = days.find((item) => item.date === date);
      const completed = (day?.completed ?? 0) + (day?.manual ?? 0);
      const planned = (day?.scheduled ?? 0) + (day?.preview ?? 0) + (day?.reminders ?? 0);
      const active = date === selected;
      return <Pressable key={date} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${displayProtocolDate(date)}, ${activityDescription(day, activityKnown)}`}
        onPress={() => onSelect(date)} style={({ pressed }) => [styles.day, active && styles.selected, pressed && styles.pressed]}>
        <AppText variant="metadata" color={active ? "primary" : "secondary"}>{["M", "T", "W", "T", "F", "S", "S"][offset]}</AppText>
        <NumericText variant="numberMacroRow" align="center">{Number(date.slice(-2))}</NumericText>
        <AppText variant="metadata" accessibilityElementsHidden importantForAccessibility="no">{completed && !planned ? "✓" : completed && planned ? "✓·" : planned ? "•".repeat(Math.min(3, planned)) : " "}</AppText>
      </Pressable>;
    })}
  </View></ScrollView>;
}
const styles = StyleSheet.create({
  week: { flexDirection: "row", minWidth: 336, flex: 1 },
  day: { flex: 1, minWidth: 48, minHeight: 64, paddingVertical: appSpacing.xs, alignItems: "center", justifyContent: "center", borderRadius: appRadius.md },
  selected: { backgroundColor: appColors.actionPrimarySoft }, pressed: { opacity: 0.65 },
});
