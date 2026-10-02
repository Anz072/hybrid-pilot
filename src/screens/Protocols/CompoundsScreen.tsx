import React from "react";
import { FlatList, View } from "react-native";
import { AppButton, AppScreen, AppText, EmptyState, ErrorState, InteractiveCard, LoadingState } from "../../components/ui";
import { useAppSelector } from "../../store/hooks";
import type { ProtocolPrimaryScreenProps } from "../../navigation/protocolTypes";
import { currentProtocolPhase, displayProtocolDate, displayProtocolInstant, protocolCourseLabel, protocolDate, protocolScheduleLabel } from "./protocolForm";
import { useProtocolCourses } from "./useProtocolCourses";
import { useProtocolClock, useProtocolNextRefresh } from "./useProtocolClock";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { protocolStyles as styles } from "./protocolStyles";

export default function CompoundsScreen({ navigation }: ProtocolPrimaryScreenProps<"Compounds">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const clock = useProtocolClock();
  const { timeFormat } = useDisplayPreferences();
  const query = useProtocolCourses(userId, clock.today, true);
  const nextAt = query.courses.flatMap((course) => course.nextDose ? [course.nextDose.planned.at] : []).sort()[0];
  useProtocolNextRefresh(nextAt, clock.now, query.reload);
  return <AppScreen>
    <FlatList data={query.courses} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
      refreshing={query.loading} onRefresh={() => void query.reload()}
      ListHeaderComponent={<View style={styles.card}><AppButton label="Add compound" onPress={() => navigation.navigate("AddCompound")} />
        {query.error ? <ErrorState title="Could not load courses" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}</View>}
      ListEmptyComponent={query.loading ? <LoadingState title="Loading courses" /> : !query.error ? <EmptyState title="No compounds yet" message="Add a compound and preview the schedule you enter before starting." /> : null}
      ListFooterComponent={<View style={styles.card}>
        {query.moreError ? <ErrorState title="Could not load more courses" message={query.moreError} action={<AppButton label="Reload courses" onPress={query.reload} />} /> : null}
        {query.nextCursor ? <AppButton label={query.loadingMore ? "Loading…" : "Load more courses"} variant="secondary" disabled={query.loadingMore || query.loading} onPress={() => void query.loadMore()} /> : null}
      </View>}
      renderItem={({ item }) => {
        const phase = currentProtocolPhase(item);
        const doses = "doses" in phase.schedule ? phase.schedule.doses : phase.schedule.kind === "specific_weekdays" ? phase.schedule.days.flatMap((day) => day.doses) : [phase.schedule];
        const amounts = [...new Set(doses.map((dose) => `${dose.amount} ${dose.unit}`))];
        const startDate = displayProtocolDate(protocolDate(item.startAt, item.phases[0]!.timezone));
        const schedule = `${amounts.length === 1 ? amounts[0] : "Varied doses"} · ${protocolScheduleLabel(phase.schedule)} · ${phase.route === "SC" ? "SubQ" : "IM"}`;
        const dates = `${startDate}${item.endAt ? ` – ${displayProtocolDate(protocolDate(new Date(Date.parse(item.endAt) - 1), phase.timezone))}` : " · No end date"}`;
        const nextDose = item.nextDose ? `Next · ${displayProtocolInstant(item.nextDose.planned.at, clock.timezone, timeFormat === "12h")}` : null;
        return <InteractiveCard style={styles.card} accessibilityLabel={[item.compound.name, protocolCourseLabel(item), dates, schedule, nextDose].filter(Boolean).join(", ")} onPress={() => navigation.navigate("CourseDetail", { courseId: item.id })}>
          <AppText variant="metadata" color="secondary">{protocolCourseLabel(item)}</AppText>
          <AppText variant="cardTitle">{item.compound.name}</AppText>
          <AppText color="secondary">{schedule}</AppText>
          <AppText variant="bodySmall" color="secondary">{dates}</AppText>
          {nextDose ? <AppText variant="bodySmallStrong">{nextDose}</AppText> : null}
        </InteractiveCard>;
      }} />
  </AppScreen>;
}
