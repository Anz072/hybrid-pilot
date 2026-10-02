import React from "react";
import { SectionList, View } from "react-native";
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import type { ProtocolPrimaryScreenProps } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { addProtocolDate, displayProtocolDate, protocolClock } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolClock, useProtocolNextRefresh } from "./useProtocolClock";
import ProtocolWeekStrip from "./ProtocolWeekStrip";
import ProtocolDoseRow, { protocolDayRows, protocolDuration, type ProtocolDayRow } from "./ProtocolDoseRow";
import LogDoseSheet, { type ProtocolLogTarget } from "./LogDoseSheet";
import { protocolStyles as styles } from "./protocolStyles";
import BloodworkReminderSheet from "./BloodworkReminderSheet";
import type { ApiProtocolReminder } from "../../API/nouri/protocolTypes";
import { displayProtocolInstant } from "./protocolForm";

type TodayRow = ProtocolDayRow | { kind: "reminder"; key: string; value: ApiProtocolReminder };

export default function TodayScreen({ navigation, route }: ProtocolPrimaryScreenProps<"Today">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const { timeFormat } = useDisplayPreferences();
  const [target, setTarget] = React.useState<ProtocolLogTarget | null>(null);
  const [reminder,setReminder] = React.useState<{ id?: string } | null>(null);
  const courseId = route.params?.courseId;
  // Keep selection in one place. Clearing a nested route's date to undefined
  // can restore its initial date; null must continue to mean "follow today".
  const date = route.params?.date ?? clock.today;
  const query = useProtocolRead(userId, `day:${date}:${clock.timezone}:${clock.today}:${courseId ?? "all"}`, () => DB.getProtocolDay(userId, { date, tz: clock.timezone, courseId }));
  const select = (next: string) => navigation.setParams({ date: next === clock.today ? null : next });
  const rows = query.data ? protocolDayRows(query.data) : [];
  const names = ["Night", "Morning", "Afternoon", "Evening", "Completed"];
  const sections: Array<{ title: string; data: TodayRow[] }> = names.map((title) => ({ title, data: rows.filter((row) => {
    if (row.kind === "manual" || (row.kind === "occurrence" && row.value.log)) return title === "Completed";
    const at = row.kind === "occurrence" ? row.value.planned.at : row.value.scheduledAt;
    const hour = Number(protocolClock(at, clock.timezone).slice(0, 2));
    return title === names[hour < 6 ? 0 : hour < 12 ? 1 : hour < 17 ? 2 : 3];
  }) })).filter((section) => section.data.length);
  if (query.data?.reminders?.length) sections.push({ title: "Bloodwork calendar",data: query.data.reminders.map((r) => ({ kind: "reminder",key: r.id,value: r })) });
  const next = query.data?.nextDose ?? query.data?.nextDosePreview;
  useProtocolNextRefresh(next?.planned.at, clock.now, query.reload);
  return <AppScreen>
    <SectionList<TodayRow> sections={sections} keyExtractor={(item) => item.key} stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content} refreshing={query.loading} onRefresh={() => void query.reload()}
      ListHeaderComponent={<View style={styles.stack}>
        {courseId ? <AppButton label="Show all compounds" variant="ghost" onPress={() => navigation.setParams({ courseId: undefined })} /> : null}
        <AppText variant="sectionTitle">{displayProtocolDate(date)}</AppText>
        <AppCard style={styles.card}>
          <View style={styles.row}>
            <AppButton label="‹" accessibilityLabel="Previous week" variant="ghost" onPress={() => select(addProtocolDate(date, -7))} />
            <AppButton label="Today" variant="ghost" onPress={() => select(clock.today)} />
            <AppButton label="›" accessibilityLabel="Next week" variant="ghost" onPress={() => select(addProtocolDate(date, 7))} />
            <AppButton label="Calendar" variant="secondary" onPress={() => navigation.navigate("Calendar", { date, courseId })} />
          </View>
          <ProtocolWeekStrip selected={date} days={query.data?.week ?? []} activityKnown={Boolean(query.data)} onSelect={select} />
        </AppCard>
        {next && date === clock.today ? <AppText variant="bodyStrong">{Date.parse(next.planned.at) > clock.now.getTime() ? `Next dose in ${protocolDuration(Date.parse(next.planned.at) - clock.now.getTime())}` : "Dose due now"}</AppText> : null}
        {date === clock.today && (query.data?.yesterdayUnlogged ?? 0) > 0 ? <AppCard style={styles.card}>
          <AppText variant="metadata" color="secondary">NEEDS ATTENTION</AppText>
          <AppButton label={`${query.data!.yesterdayUnlogged} unlogged ${query.data!.yesterdayUnlogged === 1 ? "dose" : "doses"} from yesterday`} variant="ghost" onPress={() => select(addProtocolDate(clock.today, -1))} />
        </AppCard> : null}
        <AppText variant="bodySmall" color="secondary">Times shown in {clock.timezone}</AppText>
        {query.error ? <ErrorState title="Could not load this day" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
      </View>}
      ListEmptyComponent={query.loading ? <LoadingState title="Loading this day" /> : !query.error ? <EmptyState title="Nothing scheduled this day" message="Use the calendar to view another date, or open a compound to record a manual dose." /> : null}
      renderSectionHeader={({ section }) => <AppText variant="metadata" color="secondary" style={styles.section}>{section.title.toUpperCase()}</AppText>}
      renderItem={({ item }) => item.kind === "reminder" ? <AppCard style={styles.card}>
        <AppText variant="cardTitle">{item.value.title}</AppText><AppText color="secondary">{displayProtocolInstant(item.value.scheduledAt,clock.timezone,timeFormat === "12h")}</AppText>
        <AppText variant="bodySmall" color="secondary">Calendar item · no device alert</AppText>
        <AppButton label="Edit reminder" variant="ghost" onPress={() => setReminder({ id: item.value.id })} />
      </AppCard> : <AppCard><ProtocolDoseRow row={item} timezone={clock.timezone} now={clock.now} onCourse={(id) => navigation.navigate("CourseDetail", { courseId: id })} onLog={setTarget} /></AppCard>} />
    {target ? <LogDoseSheet key={JSON.stringify(target)} userId={userId} target={target} onClose={() => { setTarget(null); void query.reload(); }} /> : null}
    {reminder ? <BloodworkReminderSheet key={reminder.id ?? "new"} userId={userId} id={reminder.id} date={date} onClose={() => { setReminder(null); void query.reload(); }} /> : null}
  </AppScreen>;
}
