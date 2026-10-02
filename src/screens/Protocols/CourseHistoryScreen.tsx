import React from "react";
import { FlatList, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import type { ApiProtocolDoseLog } from "../../API/nouri/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { getAuthSessionGeneration } from "../../API/supabase/sessionScope";
import { currentProtocolPhase, protocolDate } from "./protocolForm";
import { protocolErrorMessage, useProtocolRead } from "./useProtocolRead";
import { RecordedDoseRow } from "./ProtocolDoseRow";
import LogDoseSheet, { type ProtocolLogTarget } from "./LogDoseSheet";
import { protocolStyles as styles } from "./protocolStyles";

export default function CourseHistoryScreen({ navigation, route }: NativeStackScreenProps<ProtocolStackParamList, "CourseHistory">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const courseId = route.params.courseId;
  const query = useProtocolRead(userId, `history:${courseId}`, async () => {
    const [course, page] = await Promise.all([DB.getProtocolCourse(userId, courseId), DB.listProtocolLogs(userId, courseId, { limit: 50 })]);
    return { course, page };
  });
  const [tail, setTail] = React.useState<{ head: typeof query.data; logs: ApiProtocolDoseLog[]; next: string | null } | null>(null);
  const [moreError, setMoreError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const busy = React.useRef(false);
  const live = React.useRef(true);
  const head = React.useRef(query.data); head.current = query.data;
  React.useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [target, setTarget] = React.useState<ProtocolLogTarget | null>(null);
  const currentTail = tail?.head === query.data ? tail : null;
  const logs = [...(query.data?.page.logs ?? []), ...(currentTail?.logs ?? [])];
  const cursor = currentTail ? currentTail.next : query.data?.page.nextCursor;
  const loadMore = async () => {
    if (!cursor || busy.current || !query.data) return;
    const started = query.data;
    const generation = getAuthSessionGeneration();
    busy.current = true; setLoadingMore(true); setMoreError(null);
    try {
      const page = await DB.listProtocolLogs(userId, courseId, { after: cursor, limit: 50 });
      if (live.current && head.current === started && generation === getAuthSessionGeneration()) setTail({ head: started, logs: [...(currentTail?.logs ?? []), ...page.logs], next: page.nextCursor });
    } catch (error) { if (live.current && head.current === started && generation === getAuthSessionGeneration()) setMoreError(protocolErrorMessage(error)); }
    finally { busy.current = false; if (live.current) setLoadingMore(false); }
  };
  const course = query.data?.course;
  return <AppScreen safeBottom>
    <ScreenHeader title="Dose history" subtitle={course?.compound.name} onBack={() => navigation.goBack()} />
    <FlatList data={logs} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} refreshing={query.loading} onRefresh={() => void query.reload()}
      ListHeaderComponent={<View style={styles.card}>
        {course ? <AppButton label="Scheduled and unlogged history" variant="secondary" onPress={() => navigation.navigate("Calendar", { date: protocolDate(course.startAt, currentProtocolPhase(course).timezone), courseId })} /> : null}
        {query.error ? <ErrorState title="Could not load history" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
      </View>}
      ListEmptyComponent={query.loading ? <LoadingState title="Loading history" /> : !query.error ? <EmptyState title="No recorded doses" message="Use scheduled history to find and backfill an earlier administration." /> : null}
      renderItem={({ item }) => <AppCard>{course ? <RecordedDoseRow name={course.compound.name} log={item} timezone={course.phases.find((phase) => phase.id === item.phaseId)?.timezone ?? currentProtocolPhase(course).timezone}
        onEdit={() => setTarget({ courseId, logId: item.id, occurrenceId: item.occurrenceId ?? undefined })} /> : null}</AppCard>}
      ListFooterComponent={<View style={styles.card}>{moreError ? <AppText color="error" accessibilityRole="alert">{moreError}</AppText> : null}
        {cursor ? <AppButton label={loadingMore ? "Loading…" : "Load older doses"} variant="secondary" disabled={loadingMore || query.loading} onPress={() => void loadMore()} /> : null}</View>} />
    {target ? <LogDoseSheet key={JSON.stringify(target)} userId={userId} target={target} onClose={() => { setTarget(null); void query.reload(); }} /> : null}
  </AppScreen>;
}
