import React from "react";
import { ScrollView, View } from "react-native";
import type { ProtocolPrimaryScreenProps } from "../../navigation/protocolTypes";
import type { ProtocolChartRange } from "../../domain/types";
import type { ApiProtocolTrends, ProtocolTrendMetric } from "../../API/nouri/protocolTypes";
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState, SegmentedControl } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import BloodworkScreen from "./BloodworkScreen";
import ProtocolDateField from "./ProtocolDateField";
import ProtocolTrendChart from "./ProtocolTrendChart";
import ProtocolAnnotationControls from "./ProtocolAnnotationControls";
import { addProtocolDate } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolClock } from "./useProtocolClock";
import { protocolStyles as styles } from "./protocolStyles";

export default function TrendsScreen({ navigation, route }: ProtocolPrimaryScreenProps<"Trends">) {
  const section = route.params?.section ?? "metrics";
  return <AppScreen>
    <SegmentedControl value={section} onChange={(value) => navigation.setParams({ section: value })}
      options={[{ label: "Metrics", value: "metrics" }, { label: "Bloodwork", value: "bloodwork" }]} />
    {section === "bloodwork" ? <BloodworkScreen onAdd={() => navigation.navigate("BloodworkEntry")}
      onPanel={(panelId) => navigation.navigate("BloodworkPanel", { panelId })} /> : <Metrics />}
  </AppScreen>;
}

function Metrics() {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const [metric, setMetric] = React.useState<ProtocolTrendMetric>("weight");
  const [range, setRange] = React.useState<ProtocolChartRange>("1M");
  const [selectedEnd, setSelectedEnd] = React.useState<string | null>(null);
  const end = selectedEnd ?? clock.today;
  const query = useProtocolRead(userId, `trends:${metric}:${range}:${end}:${clock.timezone}`,
    () => DB.getProtocolTrends(userId, { metric, range, end, tz: clock.timezone }), true);
  const days = range === "1W" ? 7 : range === "3M" ? 90 : 30;
  return <ScrollView contentContainerStyle={styles.content}>
    <AppText variant="sectionTitle">Health trends</AppText>
    <SegmentedControl value={metric} onChange={setMetric} options={[
      { label: "Body weight", value: "weight" }, { label: "Calories", value: "calories" }, { label: "Protein", value: "protein" },
      { label: "Carbs", value: "carbs" }, { label: "Fat", value: "fat" },
    ]} />
    <SegmentedControl value={range} onChange={setRange} options={["1W", "1M", "3M", "All"].map((value) => ({ value: value as ProtocolChartRange, label: value }))} />
    <ProtocolDateField label="Range ending" value={end} onChange={(value) => setSelectedEnd(value === clock.today ? null : value)} />
    <View style={styles.row}>
      {range !== "All" ? <AppButton label="Previous range" variant="ghost" onPress={() => setSelectedEnd(addProtocolDate(end, -days))} /> : null}
      <AppButton label="Through today" variant="ghost" onPress={() => setSelectedEnd(null)} />
      {range !== "All" ? <AppButton label="Next range" variant="ghost" disabled={end >= clock.today} onPress={() => setSelectedEnd(addProtocolDate(end, days) > clock.today ? null : addProtocolDate(end, days))} /> : null}
    </View>
    {query.error ? <ErrorState title="Could not load trends" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
    {query.loading ? <LoadingState title={query.data ? "Refreshing trends" : "Loading trends"} /> : null}
    {query.data ? <MetricProjection userId={userId} data={query.data} /> : null}
  </ScrollView>;
}

function MetricProjection({ userId, data }: { userId: string; data: ApiProtocolTrends }) {
  const annotations = useProtocolRead(userId, `trend-events:${data.start}:${data.end}:${data.timezone}`,
    () => DB.getProtocolAnnotations(userId, { start: data.start, end: data.end, tz: data.timezone }));
  const [hidden, setHidden] = React.useState<string[]>([]);
  return <>
    {!data.recordedDays ? <EmptyState title="No records in this range" message={data.metric === "weight" ? "Add measurements in Weight to see them here." : "Log food in the diary to see it here. Mark finished days complete to include them in averages."} /> : null}
    {data.recordedDays > 0 && data.eligibleDays === 0 ? <AppText color="secondary">These diary days are incomplete. Mark finished days complete in the diary to show an average.</AppText> : null}
    <AppCard style={styles.card}>
      <ProtocolTrendChart data={data} events={(annotations.data?.events ?? []).filter((event) => !hidden.includes(event.courseId))} />
    </AppCard>
    <AppText variant="bodySmall" color="secondary">Dates retain the day recorded in Diary or Weight. Course event dates use {data.timezone}. {data.recordedDays} recorded days{data.metric === "weight" ? "." : `; ${data.eligibleDays} complete.`}</AppText>
    {annotations.error ? <ErrorState title="Could not load course annotations" message={annotations.error} action={<AppButton label="Retry annotations" onPress={() => void annotations.reload()} />} /> : null}
    {annotations.loading ? <LoadingState title="Loading course annotations" /> : null}
    {annotations.data ? <ProtocolAnnotationControls data={annotations.data} hidden={hidden} onHiddenChange={setHidden} /> : null}
  </>;
}
