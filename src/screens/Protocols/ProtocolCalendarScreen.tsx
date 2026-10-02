import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState, NumericText, ScreenHeader } from "../../components/ui";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing } from "../../theme/tokens";
import { addProtocolDate, displayProtocolDate } from "./protocolForm";
import { useProtocolClock } from "./useProtocolClock";
import { useProtocolRead } from "./useProtocolRead";
import { activityDescription, protocolWeekStart } from "./ProtocolWeekStrip";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolCalendarScreen({ navigation, route }: NativeStackScreenProps<ProtocolStackParamList, "Calendar">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const [month, setMonth] = React.useState(`${route.params.date.slice(0, 7)}-01`);
  const shiftMonth = (offset: number) => { const at = new Date(`${month}T12:00:00Z`); at.setUTCMonth(at.getUTCMonth() + offset); setMonth(at.toISOString().slice(0, 10)); };
  const nextMonth = new Date(`${month}T12:00:00Z`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const start = protocolWeekStart(month);
  const last = addProtocolDate(nextMonth.toISOString().slice(0, 10), -1);
  const end = addProtocolDate(protocolWeekStart(last), 6);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  const courseId = route.params.courseId;
  const query = useProtocolRead(userId, `month:${month}:${clock.timezone}:${clock.today}:${courseId ?? "all"}`, () => DB.getProtocolCalendar(userId, { start, end, tz: clock.timezone, courseId }));
  return <AppScreen safeBottom>
    <ScreenHeader title="Calendar" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <AppButton label="‹" accessibilityLabel="Previous month" variant="ghost" onPress={() => shiftMonth(-1)} />
        <AppText variant="sectionTitle" style={styles.grow}>{new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}T12:00:00Z`))}</AppText>
        <AppButton label="›" accessibilityLabel="Next month" variant="ghost" onPress={() => shiftMonth(1)} />
      </View>
      {query.error ? <ErrorState title="Could not load calendar" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
      {query.loading && !query.data ? <LoadingState title="Loading month" /> : null}
      <AppCard><ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={calendarStyles.grid}>
          <View style={calendarStyles.week}>{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <AppText key={index} align="center" variant="metadata" style={calendarStyles.cell}>{label}</AppText>)}</View>
          {Array.from({ length: days / 7 }, (_, week) => <View key={week} style={calendarStyles.week}>
            {Array.from({ length: 7 }, (_, weekday) => {
              const date = addProtocolDate(start, week * 7 + weekday);
              const day = query.data?.days.find((item) => item.date === date);
              const planned = (day?.scheduled ?? 0) + (day?.preview ?? 0) + (day?.reminders ?? 0);
              const complete = (day?.completed ?? 0) + (day?.manual ?? 0);
              return <Pressable key={date} style={({ pressed }) => [calendarStyles.cell, date === clock.today && calendarStyles.today, pressed && { opacity: 0.65 }]}
                accessibilityRole="button" accessibilityLabel={`${displayProtocolDate(date)}, ${activityDescription(day, Boolean(query.data))}`}
                onPress={() => navigation.popTo("Root", { screen: "Today", params: { date: date === clock.today ? null : date, courseId } })}>
                <NumericText color={date.slice(0, 7) === month.slice(0, 7) ? "primary" : "muted"}>{Number(date.slice(-2))}</NumericText>
                <AppText variant="metadata" accessibilityElementsHidden importantForAccessibility="no">{complete && planned ? "✓·" : complete ? "✓" : planned ? "•" : " "}</AppText>
              </Pressable>;
            })}
          </View>)}
        </View>
      </ScrollView></AppCard>
      <AppText color="secondary" variant="bodySmall">• Scheduled · ✓ Recorded · ✓· Both</AppText>
      <AppText color="secondary" variant="bodySmall">Choose a date to view its administrations. Older unlogged doses remain in their original calendar day.</AppText>
      <AppButton label="This month" variant="secondary" onPress={() => setMonth(`${clock.today.slice(0, 7)}-01`)} />
    </ScrollView>
  </AppScreen>;
}
const calendarStyles = StyleSheet.create({
  grid: { minWidth: 336 }, week: { flexDirection: "row" },
  cell: { width: 48, minHeight: 56, alignItems: "center", justifyContent: "center", paddingVertical: appSpacing.xs, borderRadius: appRadius.md },
  today: { backgroundColor: appColors.actionPrimarySoft },
});
