import React from "react";
import { Alert, ScrollView } from "react-native";
import { randomUUID } from "expo-crypto";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppSheet, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import type { EndProtocolCourseInput } from "../../API/nouri/protocolTypes";
import { currentProtocolPhase, displayProtocolDate, displayProtocolInstant, protocolCourseLabel, protocolDate } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import ScheduleSummary from "./ScheduleSummary";
import ProtocolDateField from "./ProtocolDateField";
import { protocolStyles as styles } from "./protocolStyles";
import LogDoseSheet, { type ProtocolLogTarget } from "./LogDoseSheet";
import { RecordedDoseRow } from "./ProtocolDoseRow";
import { useProtocolClock, useProtocolNextRefresh } from "./useProtocolClock";

export default function CourseDetailScreen({ navigation, route }: NativeStackScreenProps<ProtocolStackParamList, "CourseDetail">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const query = useProtocolRead(userId, `course:${route.params.courseId}`, async () => {
    const [course, recent] = await Promise.all([DB.getProtocolCourse(userId, route.params.courseId), DB.listProtocolLogs(userId, route.params.courseId, { limit: 20 })]);
    return { course, recent };
  });
  const mutation = useProtocolMutation();
  const nextQuery = useProtocolRead(userId, `course-next:${route.params.courseId}:${clock.today}`, () => DB.getProtocolNextDoses(userId, [route.params.courseId]));
  const next = nextQuery.data?.courses[0]?.nextDose;
  useProtocolNextRefresh(next?.planned.at, clock.now, nextQuery.reload);
  const course = query.data?.course;
  const phase = course ? currentProtocolPhase(course) : undefined;
  const [endOpen, setEndOpen] = React.useState(false);
  const [logTarget, setLogTarget] = React.useState<ProtocolLogTarget | null>(null);
  const [endDate, setEndDate] = React.useState("");
  const initialEndDate = React.useRef("");
  const endCommand = React.useRef<EndProtocolCourseInput | null>(null);
  const { timeFormat } = useDisplayPreferences();
  const end = async () => {
    if (!course || !phase) return;
    endCommand.current ??= { operationId: randomUUID(), expectedRevision: course.revision, endDate, timezone: phase.timezone };
    const result = await mutation.run(() => DB.endProtocolCourse(userId, course.id, endCommand.current!));
    if (result) { setEndOpen(false); endCommand.current = null; }
  };
  const closeEnd = () => {
    if (mutation.busy) return;
    const leave = () => { setEndOpen(false); void query.reload(); };
    if (endCommand.current || endDate !== initialEndDate.current) {
      Alert.alert(endCommand.current ? "Leave this save?" : "Discard end date?",
        endCommand.current ? "The request may already have changed the course end. Check the course before submitting another change." : "Your unsaved end date will be discarded.",
        [{ text: "Keep editing", style: "cancel" }, { text: "Leave", style: "destructive", onPress: leave }]);
    } else leave();
  };
  const remove = () => {
    if (!course) return;
    Alert.alert(`Delete ${course.compound.name} course?`, "This permanently deletes the course, its phases, scheduled occurrences, logged doses and their injection-site history.\n\nBloodwork, nutrition and body measurements will not be deleted.", [
      { text: "Cancel", style: "cancel" }, { text: "Delete course", style: "destructive", onPress: () => {
        void mutation.run(() => DB.deleteProtocolCourse(userId, course.id)).then((result) => { if (result) navigation.popTo("Root", { screen: "Compounds" }); });
      } },
    ]);
  };
  return <AppScreen safeBottom>
    <ScreenHeader title={course?.compound.name ?? "Course"} onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace("Root", { screen: "Compounds" })} />
    <ScrollView contentContainerStyle={styles.content}>
      {query.error ? <ErrorState title="Could not load course" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
      {!course && query.loading ? <LoadingState title="Loading course" /> : null}
      {course && phase ? <>
        <AppCard style={styles.card}>
          <AppText variant="metadata" color="secondary">{protocolCourseLabel(course)}</AppText>
          <ScheduleSummary configuration={phase} />
          {next ? <AppText variant="bodyStrong">Next · {displayProtocolInstant(next.planned.at, next.timezone, timeFormat === "12h")} · {next.timezone}</AppText> : null}
          {nextQuery.error ? <ErrorState title="Could not load next dose" message={nextQuery.error} action={<AppButton label="Try again" variant="ghost" onPress={() => void nextQuery.reload()} />} /> : null}
          <AppText color="secondary" variant="bodySmall">Starts {displayProtocolDate(protocolDate(course.startAt, phase.timezone))}{course.endAt ? ` · Last day ${displayProtocolDate(protocolDate(new Date(Date.parse(course.endAt) - 1), phase.timezone))}` : " · No end date"}</AppText>
        </AppCard>
        {course.phases.filter((item) => item.id !== phase.id && (!course.endAt || Date.parse(item.effectiveFrom) < Date.parse(course.endAt))).map((item) => <AppCard key={item.id} style={styles.card}>
          <AppText variant="metadata" color="secondary">{Date.parse(item.effectiveFrom) > Date.now() ? "Upcoming change" : "Earlier schedule"} · {displayProtocolDate(protocolDate(item.effectiveFrom, item.timezone))}</AppText>
          <ScheduleSummary configuration={item} />
        </AppCard>)}
        {course.status === "ENDED" ? <AppButton label="Start new course" disabled={mutation.busy} onPress={() => navigation.navigate("EditCourse", { compoundId: course.compound.id })} />
          : <AppButton label={course.status === "DRAFT" ? "Preview or edit draft" : "Edit schedule"} disabled={mutation.busy} onPress={() => navigation.navigate("EditCourse", { courseId: course.id })} />}
        <AppButton label="Compound info" variant="secondary" onPress={() => navigation.navigate("CompoundInfo", { compoundId: course.compound.id })} />
        <AppButton label="Estimated Levels" variant="secondary" onPress={() => navigation.popTo("Root", { screen: "Levels", params: { courseId: course.id } })} />
        {course.status !== "DRAFT" ? <AppButton label="Log manual dose" onPress={() => setLogTarget({ courseId: course.id })} /> : null}
        <AppCard style={styles.card}><AppText variant="cardTitle" accessibilityRole="header">Recent doses</AppText>
          {query.data?.recent.logs.length ? query.data.recent.logs.map((log) => <AppCard key={log.id} variant="plain" style={styles.card}>
            <RecordedDoseRow name={course.compound.name} log={log} timezone={course.phases.find((item) => item.id === log.phaseId)?.timezone ?? phase.timezone}
              onEdit={() => setLogTarget({ courseId: course.id, logId: log.id, occurrenceId: log.occurrenceId ?? undefined })} />
          </AppCard>) : <AppText color="secondary">No doses recorded.</AppText>}
          {course.status !== "DRAFT" ? <AppButton label="Full dose history" variant="secondary" onPress={() => navigation.navigate("CourseHistory", { courseId: course.id })} /> : null}
        </AppCard>
        {course.status === "ACTIVE" ? <AppButton label="End course" variant="secondary" disabled={mutation.busy} onPress={() => { initialEndDate.current = protocolDate(new Date(), phase.timezone); setEndDate(initialEndDate.current); endCommand.current = null; mutation.clearError(); setEndOpen(true); }} /> : null}
        <AppButton label="Delete course" variant="danger" disabled={mutation.busy} onPress={remove} />
      </> : null}
      {mutation.error && !endOpen ? <AppText accessibilityRole="alert" color="error">{mutation.error}</AppText> : null}
    </ScrollView>
    <AppSheet visible={endOpen} title="End course" onClose={closeEnd}>
      {endDate && phase ? <>
        <AppText>Historical schedules and recorded doses will be kept. The selected date is the last day of this course.</AppText>
        <AppButton label="End today" variant="ghost" disabled={mutation.busy || Boolean(endCommand.current)} onPress={() => setEndDate(protocolDate(new Date(), phase.timezone))} />
        <ProtocolDateField label="Last day" value={endDate} onChange={setEndDate} disabled={mutation.busy || Boolean(endCommand.current)} />
        {mutation.error ? <AppText accessibilityRole="alert" color="error">{mutation.error}</AppText> : null}
        <AppButton label={mutation.busy ? "Saving…" : endCommand.current ? "Retry end course" : "End course"} disabled={mutation.busy} onPress={() => void end()} />
      </> : null}
    </AppSheet>
    {logTarget ? <LogDoseSheet key={JSON.stringify(logTarget)} userId={userId} target={logTarget} onClose={() => { setLogTarget(null); void query.reload(); }} /> : null}
  </AppScreen>;
}
