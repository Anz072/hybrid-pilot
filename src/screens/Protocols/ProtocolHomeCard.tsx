import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppText, ErrorState, LoadingState } from "../../components/ui";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appSpacing } from "../../theme/tokens";
import { displayProtocolDate } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolClock, useProtocolNextRefresh } from "./useProtocolClock";
import ProtocolWeekStrip from "./ProtocolWeekStrip";
import ProtocolDoseRow, { protocolDayRows, protocolDuration } from "./ProtocolDoseRow";
import LogDoseSheet, { type ProtocolLogTarget } from "./LogDoseSheet";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolHomeCard() {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const settings = useProtocolRead(userId, "home-protocol-settings", () => DB.getUserSettings(userId));
  // No Protocol UI or data request before opt-in is confirmed for this account.
  return settings.data?.protocolsEnabled ? <ProtocolCardContent key={userId} userId={userId} /> : null;
}
function ProtocolCardContent({ userId }: { userId: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const clock = useProtocolClock();
  const [selection, setSelection] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<ProtocolLogTarget | null>(null);
  const date = selection ?? clock.today;
  const query = useProtocolRead(userId, `home-protocol:${date}:${clock.today}:${clock.timezone}`, () => DB.getProtocolHome(userId, { date, tz: clock.timezone }));
  const rows = query.data ? protocolDayRows(query.data) : [];
  const next = query.data?.nextDose ?? query.data?.nextDosePreview;
  useProtocolNextRefresh(next?.planned.at, clock.now, query.reload);
  return <AppCard style={[styles.stack, { marginBottom: appSpacing.md }]}>
    <AppButton label="PROTOCOL  ›" accessibilityLabel="Open Protocols Today" variant="ghost" onPress={() => navigation.navigate("Protocols", { screen: "Root", params: { screen: "Today", params: { date: null } } })} />
    <ProtocolWeekStrip selected={date} days={query.data?.week ?? []} activityKnown={Boolean(query.data)} onSelect={(selected) => setSelection(selected === clock.today ? null : selected)} />
    {date !== clock.today ? <View style={styles.card}><AppText variant="bodyStrong">{displayProtocolDate(date)}</AppText><AppButton label="Back to today" variant="ghost" onPress={() => setSelection(null)} /></View>
      : next ? <AppText variant="bodyStrong">{Date.parse(next.planned.at) > clock.now.getTime() ? `Next dose in ${protocolDuration(Date.parse(next.planned.at) - clock.now.getTime())}` : "Dose due now"}</AppText> : null}
    {query.error ? <ErrorState title="Could not load Protocols" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
    {!query.data && query.loading ? <LoadingState title="Loading schedule" /> : null}
    {!query.error && query.data && !rows.length ? <AppText color="secondary">Nothing scheduled {date === clock.today ? "today" : "this day"}.</AppText> : null}
    {rows.slice(0, 3).map((row) => <ProtocolDoseRow key={row.key} row={row} timezone={clock.timezone} now={clock.now} compact={rows.length > 1}
      onCourse={(courseId) => navigation.navigate("Protocols", { screen: "CourseDetail", params: { courseId } })} onLog={setTarget} />)}
    {rows.length > 3 ? <AppButton label={`View all ${rows.length}`} variant="secondary" onPress={() => navigation.navigate("Protocols", { screen: "Root", params: { screen: "Today", params: { date: date === clock.today ? null : date } } })} /> : null}
    {target ? <LogDoseSheet key={JSON.stringify(target)} userId={userId} target={target} onClose={() => { setTarget(null); void query.reload(); }} /> : null}
  </AppCard>;
}
