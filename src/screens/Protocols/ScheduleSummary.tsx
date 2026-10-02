import React from "react";
import { View } from "react-native";
import { AppText } from "../../components/ui";
import type { ProtocolPhaseConfiguration } from "../../domain/types";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { displayProtocolInstant, protocolScheduleLabel, protocolWeekdays } from "./protocolForm";
import { protocolStyles as styles } from "./protocolStyles";

export default function ScheduleSummary({ configuration }: { configuration: ProtocolPhaseConfiguration }) {
  const { schedule, timezone, route } = configuration;
  const { timeFormat } = useDisplayPreferences();
  const lines = "doses" in schedule ? schedule.doses.map((dose) => `${dose.time} · ${dose.amount} ${dose.unit}`)
    : schedule.kind === "specific_weekdays" ? schedule.days.flatMap((day) => day.doses.map((dose) => `${protocolWeekdays[day.weekday]} · ${dose.time} · ${dose.amount} ${dose.unit}`))
      : [`${schedule.amount} ${schedule.unit}`];
  return <View style={styles.card}>
    <AppText variant="cardTitle">{protocolScheduleLabel(schedule)}</AppText>
    {lines.map((line, index) => <AppText key={index}>{line}</AppText>)}
    {schedule.kind === "every_n_days" ? <AppText color="secondary" variant="bodySmall">Anchor · {schedule.anchorDate}</AppText> : null}
    {schedule.kind === "one_time" || schedule.kind === "every_n_hours" ? <AppText color="secondary" variant="bodySmall">{schedule.kind === "one_time" ? "At" : "Anchor"} · {displayProtocolInstant(schedule.kind === "one_time" ? schedule.at : schedule.anchorAt, timezone, timeFormat === "12h")}</AppText> : null}
    <AppText variant="bodySmall" color="secondary">{route} · {timezone}</AppText>
  </View>;
}
