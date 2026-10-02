import React from "react";
import { FlatList, ScrollView, View, useWindowDimensions } from "react-native";
import { AppButton, AppScreen, AppSheet, AppText, EmptyState, ErrorState, LoadingState, OptionCard } from "../../components/ui";
import type { ApiProtocolLevels, ProtocolLevelsView } from "../../API/nouri/protocolTypes";
import type { ProtocolPrimaryScreenProps } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { displayProtocolDate, protocolCourseLabel, protocolDate } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolCourses } from "./useProtocolCourses";
import { useProtocolClock } from "./useProtocolClock";
import ProtocolLevelsPanel from "./ProtocolLevelsPanel";
import { protocolStyles as styles } from "./protocolStyles";

export default function LevelsScreen({ navigation, route }: ProtocolPrimaryScreenProps<"Levels">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const timezone = clock.timezone;
  const { height } = useWindowDimensions();
  const courses = useProtocolCourses(userId, clock.today);
  const [selected, setSelected] = React.useState<string[] | null>(route.params?.courseId ? [route.params.courseId] : null);
  const [picker, setPicker] = React.useState(false);
  const [view, setView] = React.useState<ProtocolLevelsView>({ range: "1M", metric: "relative" });
  React.useEffect(() => {
    if (courses.data) setSelected((old) => old ?? courses.data!.courses.slice(0, 1).map((course) => course.id));
  }, [courses.data]);
  React.useEffect(() => {
    if (!route.params?.courseId) return;
    setSelected([route.params.courseId]); navigation.setParams({ courseId: undefined });
  }, [route.params?.courseId, navigation]);
  const ids = selected ?? courses.courses.slice(0, 1).map((course) => course.id);
  const query = useProtocolRead<ApiProtocolLevels | null>(userId, `levels:${JSON.stringify([ids, view])}`, () => ids.length
    ? DB.getProtocolLevels(userId, { ...view, metric: ids.length > 1 ? "relative" : view.metric, courseIds: ids }) : Promise.resolve(null));
  // Selected series carry their own identity even after a head refresh drops
  // loaded history pages, or when a course opens directly from its detail.
  const labels = Object.fromEntries([
    ...courses.courses.map((course) => [course.id,
      `${course.compound.name} · ${displayProtocolDate(protocolDate(course.startAt, course.phases[0]!.timezone))}`]),
    ...(query.data?.series ?? []).map((series) => [series.courseId,
      `${series.compound.name} · ${displayProtocolDate(protocolDate(series.courseStartAt, series.courseStartTimezone))}`]),
  ]);
  const selectedOutsidePage = (query.data?.series ?? []).filter((series) => ids.includes(series.courseId)
    && !courses.courses.some((course) => course.id === series.courseId));
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
    if (next.length > 8) return;
    // Keep the viewport when selecting another series instead of changing the
    // backend's default anchor for a different set of course start/end dates.
    if (query.data && view.range !== "All") setView((old) => ({ ...old, anchorAt: new Date((Date.parse(query.data!.startAt) + Date.parse(query.data!.endAt)) / 2).toISOString() }));
    setSelected(next);
  };
  return <AppScreen>
    <ScrollView contentContainerStyle={styles.content}>
      {courses.error ? <ErrorState title="Could not load compounds" message={courses.error} action={<AppButton label="Try again" onPress={() => void courses.reload()} />} /> : null}
      {!courses.data && courses.loading ? <LoadingState title="Loading compounds" /> : null}
      {courses.data && courses.courses.length === 0 ? <EmptyState title="No compounds yet" message="Add a compound to preview the schedule and its estimated levels." action={<AppButton label="Add compound" onPress={() => navigation.navigate("AddCompound")} />} /> : null}
      {courses.courses.length ? <>
        <View style={styles.row}><AppButton label={`Choose compounds · ${ids.length} selected`} variant="secondary" onPress={() => setPicker(true)} />
          <AppButton label="Compare" disabled={ids.length !== 1} onPress={() => navigation.navigate("Compare", { courseId: ids[0]! })} /></View>
        {ids.length === 0 ? <AppText color="secondary">Choose at least one course to view its estimate.</AppText> : null}
        <ProtocolLevelsPanel data={query.data ?? undefined} loading={query.loading && ids.length > 0} error={query.error} retry={() => void query.reload()}
          range={view.range} metric={view.metric} relativeOnly={ids.length > 1} onRange={(range) => setView({ ...view, range })} onMetric={(metric) => setView({ ...view, metric })}
          onWindow={(anchorAt) => setView({ ...view, anchorAt })} onInfo={(compoundId) => navigation.navigate("CompoundInfo", { compoundId })} timezone={timezone} labels={labels} />
      </> : null}
    </ScrollView>
    <AppSheet visible={picker} title="Choose compounds" scrollable={false} onClose={() => setPicker(false)}>
      <AppText variant="bodySmall" color="secondary">Select up to eight courses. Overlapping courses remain separate estimates.</AppText>
      <FlatList style={{ height: Math.min(400, height * 0.5) }} data={courses.courses} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        ListHeaderComponent={selectedOutsidePage.length ? <View style={styles.card}>
          <AppText variant="metadata" color="secondary">SELECTED</AppText>
          {selectedOutsidePage.map((series) => <OptionCard key={series.courseId} title={labels[series.courseId]!}
            selectionMode="multiple" selected onPress={() => toggle(series.courseId)} />)}
          <AppText variant="metadata" color="secondary">COURSES</AppText>
        </View> : null}
        ListFooterComponent={<View style={styles.card}>
          {courses.moreError ? <ErrorState title="Could not load more courses" message={courses.moreError} action={<AppButton label="Reload courses" onPress={courses.reload} />} /> : null}
          {courses.nextCursor ? <AppButton label={courses.loadingMore ? "Loading…" : "Load more courses"} variant="secondary" disabled={courses.loadingMore || courses.loading} onPress={() => void courses.loadMore()} /> : null}
        </View>}
        renderItem={({ item }) => <OptionCard title={labels[item.id]!} subtitle={protocolCourseLabel(item)} selectionMode="multiple" selected={ids.includes(item.id)}
          disabled={!ids.includes(item.id) && ids.length >= 8} onPress={() => toggle(item.id)} />} />
      <AppButton label="Done" onPress={() => setPicker(false)} />
    </AppSheet>
  </AppScreen>;
}
