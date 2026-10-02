import React from "react";
import { View } from "react-native";
import { AppButton, AppText, Chip, Disclosure } from "../../components/ui";
import type { ApiProtocolAnnotations } from "../../API/nouri/protocolTypes";
import { displayProtocolDate, protocolDate } from "./protocolForm";
import { protocolStyles as styles } from "./protocolStyles";

/** Bound native views, while keeping every course and event reachable. */
export default function ProtocolAnnotationControls({ data, hidden, onHiddenChange }: {
  data: ApiProtocolAnnotations; hidden: string[]; onHiddenChange: (ids: string[]) => void;
}) {
  const [coursePage, setCoursePage] = React.useState(0);
  const [eventPage, setEventPage] = React.useState(0);
  const events = data.events.filter((event) => !hidden.includes(event.courseId));
  const coursesAt = Math.min(coursePage, Math.max(0, Math.ceil(data.courses.length / 20) - 1)) * 20;
  const eventsAt = Math.min(eventPage, Math.max(0, Math.ceil(events.length / 25) - 1)) * 25;
  const names = new Map(data.courses.map((course) => [course.courseId, course.name]));
  if (!data.courses.length) return null;
  return <Disclosure title="Course annotations" contained>
    <View style={styles.stack}>
      <AppText variant="bodySmall" color="secondary">Choose which courses appear on the chart. Dates use {data.timezone}.</AppText>
      <View style={styles.row}>{data.courses.slice(coursesAt, coursesAt + 20).map((course) => <Chip key={course.courseId}
        label={`${course.name} · ${displayProtocolDate(protocolDate(course.startAt, data.timezone))}`} selected={!hidden.includes(course.courseId)}
        onPress={() => { setEventPage(0); onHiddenChange(hidden.includes(course.courseId) ? hidden.filter((id) => id !== course.courseId) : [...hidden, course.courseId]); }} />)}</View>
      {data.courses.length > 20 ? <View style={styles.card}>
        <AppText variant="bodySmall">Courses {coursesAt + 1}–{Math.min(coursesAt + 20, data.courses.length)} of {data.courses.length}</AppText>
        <View style={styles.row}>
          <AppButton label="Previous courses" variant="ghost" disabled={!coursesAt} onPress={() => setCoursePage(coursesAt / 20 - 1)} />
          <AppButton label="More courses" variant="ghost" disabled={coursesAt + 20 >= data.courses.length} onPress={() => setCoursePage(coursesAt / 20 + 1)} />
        </View>
      </View> : null}
      {events.slice(eventsAt, eventsAt + 25).map((event) => <AppText key={`${event.courseId}:${event.kind}:${event.at}`} variant="bodySmall">
        {displayProtocolDate(event.date)} · {names.get(event.courseId)} · {event.kind === "start" ? "Course start" : event.kind === "end" ? "Course end" : "Schedule change"}
      </AppText>)}
      {!events.length ? <AppText variant="bodySmall" color="secondary">No selected course events in this range.</AppText> : null}
      {events.length > 25 ? <View style={styles.card}>
        <AppText variant="bodySmall">Events {eventsAt + 1}–{Math.min(eventsAt + 25, events.length)} of {events.length}</AppText>
        <View style={styles.row}>
          <AppButton label="Previous events" variant="ghost" disabled={!eventsAt} onPress={() => setEventPage(eventsAt / 25 - 1)} />
          <AppButton label="More events" variant="ghost" disabled={eventsAt + 25 >= events.length} onPress={() => setEventPage(eventsAt / 25 + 1)} />
        </View>
      </View> : null}
    </View>
  </Disclosure>;
}
