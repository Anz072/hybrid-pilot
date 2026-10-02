import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { randomUUID } from "expo-crypto";
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type { ApiProtocolCourse, ProtocolLevelsView } from "../../API/nouri/protocolTypes";
import type { ProtocolPhaseConfiguration } from "../../domain/types";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { configurationDraft, currentProtocolPhase, resolveProtocolConfiguration } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import ScheduleEditor from "./ScheduleEditor";
import ScheduleSummary from "./ScheduleSummary";
import ProtocolLevelsPanel from "./ProtocolLevelsPanel";
import { protocolStyles as styles } from "./protocolStyles";

type Props = NativeStackScreenProps<ProtocolStackParamList, "Compare">;
export default function CompareScreen(props: Props) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const query = useProtocolRead(userId, `compare-course:${props.route.params.courseId}`, () => DB.getProtocolCourse(userId, props.route.params.courseId));
  if (!query.data) return <AppScreen safeBottom><ScreenHeader title="Compare" onBack={() => props.navigation.goBack()} />
    {query.error ? <ErrorState title="Could not load course" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : <LoadingState title="Loading course" />}</AppScreen>;
  return <Comparison key={`${userId}:${query.data.id}`} {...props} userId={userId} course={query.data} />;
}
function Comparison({ userId, course, navigation }: Props & { userId: string; course: ApiProtocolCourse }) {
  const current = currentProtocolPhase(course);
  const [draft, setDraft] = React.useState(() => configurationDraft(current, current.timezone, randomUUID()));
  const [configuration, setConfiguration] = React.useState<ProtocolPhaseConfiguration | null>(null);
  const request = useProtocolMutation();
  const preview = async () => {
    const result = await request.run(() => resolveProtocolConfiguration(draft, (input) => DB.previewProtocolTime(userId, input)));
    if (result) setConfiguration(result);
  };
  return <AppScreen safeBottom>
    <ScreenHeader title="Compare" subtitle={course.compound.name} onBack={() => navigation.goBack()} />
    <KeyboardAwareScrollView key={configuration ? "comparison" : "configuration"} contentContainerStyle={styles.content}>
      <AppText color="secondary">This comparison is temporary. Your course, planned administrations and actual dose logs stay unchanged.</AppText>
      {configuration ? <>
        <AppButton label="Edit comparison" variant="secondary" onPress={() => setConfiguration(null)} />
        <ComparisonResult userId={userId} courseId={course.id} configuration={configuration} onInfo={(compoundId) => navigation.navigate("CompoundInfo", { compoundId })} />
      </> : <>
        <AppCard style={styles.card}><AppText variant="metadata">CURRENT</AppText><ScheduleSummary configuration={current} /></AppCard>
        <AppText variant="sectionTitle">Hypothetical schedule</AppText>
        <ScheduleEditor value={draft} onChange={setDraft} units={course.compound.doseUnits} disabled={request.busy} />
        <AppText variant="bodySmall" color="secondary">{course.status === "ACTIVE" ? "The comparison keeps logged history and uses this schedule from now, or from a future course start. Existing later phase changes are replaced only in this temporary scenario." : "For a draft or ended course, the hypothetical schedule is simulated from its original start."}</AppText>
        {request.error ? <AppText accessibilityRole="alert" color="error">{request.error}</AppText> : null}
        <AppButton label={request.busy ? "Preparing comparison…" : "Compare estimated levels"} disabled={request.busy} onPress={() => void preview()} />
      </>}
      <AppButton label="Close Compare" variant="ghost" onPress={() => navigation.goBack()} />
    </KeyboardAwareScrollView>
  </AppScreen>;
}
function ComparisonResult({ userId, courseId, configuration, onInfo }: { userId: string; courseId: string; configuration: ProtocolPhaseConfiguration; onInfo: (id: string) => void }) {
  const [view, setView] = React.useState<ProtocolLevelsView>({ range: "1M", metric: "relative" });
  const query = useProtocolRead(userId, `comparison:${JSON.stringify([courseId, configuration, view])}`, () => DB.compareProtocolLevels(userId, { ...view, courseId, configuration }));
  return <ProtocolLevelsPanel data={query.data} loading={query.loading} error={query.error} retry={() => void query.reload()}
    range={view.range} metric="relative" relativeOnly onRange={(range) => setView({ ...view, range })} onMetric={() => undefined}
    onWindow={(anchorAt) => setView({ ...view, anchorAt })} onInfo={onInfo} timezone={configuration.timezone} />;
}
