import React from "react";
import { Pressable, View } from "react-native";
import { AppButton, AppText, NumericText } from "../../components/ui";
import type { ApiProtocolDay, ApiProtocolDoseLog, ApiProtocolOccurrence } from "../../API/nouri/protocolTypes";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { displayProtocolInstant, protocolDate } from "./protocolForm";
import type { ProtocolLogTarget } from "./LogDoseSheet";
import { protocolStyles as styles } from "./protocolStyles";

export type ProtocolDayRow =
  | { kind: "occurrence"; key: string; value: ApiProtocolOccurrence }
  | { kind: "manual"; key: string; value: ApiProtocolDay["manualLogs"][number] }
  | { kind: "preview"; key: string; value: ApiProtocolDay["previewOccurrences"][number] };
export const protocolDayRows = (day: ApiProtocolDay): ProtocolDayRow[] => [
  ...day.occurrences.filter((row) => !row.log).map((value): ProtocolDayRow => ({ kind: "occurrence", key: value.id, value })),
  ...day.previewOccurrences.map((value): ProtocolDayRow => ({ kind: "preview", key: `${value.phaseId}:${value.slotKey}:${value.scheduledAt}`, value })),
  ...day.occurrences.filter((row) => row.log).map((value): ProtocolDayRow => ({ kind: "occurrence", key: value.id, value })),
  ...day.manualLogs.map((value): ProtocolDayRow => ({ kind: "manual", key: value.id, value })),
];
export function protocolDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`;
}

export function RecordedDoseRow({ name, log, timezone, onEdit, onCourse }: {
  name: string; log: ApiProtocolDoseLog; timezone: string; onEdit: () => void; onCourse?: () => void;
}) {
  const { timeFormat } = useDisplayPreferences();
  const format = (at: string) => displayProtocolInstant(at, timezone, timeFormat === "12h");
  return <View style={styles.card}>
    {onCourse ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name} course`} onPress={onCourse} style={{ minHeight: 48, justifyContent: "center" }}><AppText variant="bodyStrong">✓ {name}</AppText></Pressable> : <AppText variant="bodyStrong">✓ {name}</AppText>}
    <NumericText align="left">{log.actual.amount} {log.actual.unit} · {log.actual.route === "SC" ? "SubQ" : "IM"}</NumericText>
    <AppText color="secondary" variant="bodySmall">Taken · {format(log.actual.at)}</AppText>
    {log.planned ? <AppText color="secondary" variant="bodySmall">Planned · {log.planned.amount} {log.planned.unit} · {format(log.planned.at)}</AppText>
      : <AppText color="secondary" variant="bodySmall">Manual administration</AppText>}
    <AppButton label="Edit dose" variant="ghost" accessibilityLabel={`Edit ${name} dose taken ${format(log.actual.at)}`} onPress={onEdit} />
  </View>;
}

export default function ProtocolDoseRow({ row, timezone, now, compact = false, onCourse, onLog }: {
  row: ProtocolDayRow; timezone: string; now: Date; compact?: boolean;
  onCourse: (courseId: string) => void; onLog: (target: ProtocolLogTarget) => void;
}) {
  const { timeFormat } = useDisplayPreferences();
  const value = row.value;
  const log = row.kind === "manual" ? row.value : row.kind === "occurrence" ? row.value.log : null;
  if (compact) {
    const amount = log?.actual ?? (row.kind === "occurrence" ? row.value.planned : row.kind === "preview" ? { ...row.value, at: row.value.scheduledAt } : row.value.actual);
    const historical = !log && protocolDate(amount.at, timezone) < protocolDate(now, timezone);
    const overdue = !log && !historical && Date.parse(amount.at) < now.getTime();
    return <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${value.compound.name} course`} onPress={() => onCourse(value.courseId)} style={[styles.grow, { minHeight: 48 }]}>
        <AppText variant="bodySmallStrong">{log ? "✓ " : ""}{value.compound.name}</AppText>
        <NumericText variant="numberMacroRow" align="left">{amount.amount} {amount.unit} · {amount.route === "SC" ? "SubQ" : "IM"}</NumericText>
        <AppText color="secondary" variant="metadata">{log ? "Taken" : historical ? "Unlogged" : "Planned"} · {displayProtocolInstant(amount.at, timezone, timeFormat === "12h")}</AppText>
        {overdue ? <AppText color="secondary" variant="metadata">Overdue · {protocolDuration(now.getTime() - Date.parse(amount.at))}</AppText> : null}
      </Pressable>
      {log ? <AppButton label="Edit" accessibilityLabel={`Edit ${value.compound.name} dose`} size="sm" variant="ghost" onPress={() => onLog({ courseId: value.courseId, logId: log.id, occurrenceId: log.occurrenceId ?? undefined })} />
        : row.kind === "occurrence" && row.value.canLog ? <AppButton label="Log" size="sm" accessibilityLabel={`Log ${value.compound.name} dose`} onPress={() => onLog({ courseId: value.courseId, occurrenceId: row.value.id })} /> : null}
    </View>;
  }
  if (log) return <RecordedDoseRow name={value.compound.name} log={log} timezone={timezone}
    onCourse={() => onCourse(value.courseId)} onEdit={() => onLog({ courseId: value.courseId, logId: log.id, occurrenceId: log.occurrenceId ?? undefined })} />;
  if (row.kind === "manual") return null;
  const planned = row.kind === "occurrence" ? row.value.planned : { ...row.value, at: row.value.scheduledAt };
  const past = protocolDate(planned.at, timezone) < protocolDate(now, timezone);
  const overdue = !past && Date.parse(planned.at) < now.getTime();
  return <View style={[styles.card, !compact && styles.section]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${value.compound.name} course`} onPress={() => onCourse(value.courseId)} style={{ minHeight: 48, justifyContent: "center" }}>
      <AppText variant="cardTitle">{value.compound.name}</AppText>
    </Pressable>
    <NumericText align="left">{planned.amount} {planned.unit} · {planned.route === "SC" ? "SubQ" : "IM"}</NumericText>
    <AppText variant="bodySmall" color="secondary">Planned · {displayProtocolInstant(planned.at, timezone, timeFormat === "12h")}</AppText>
    {past ? <AppText variant="bodySmall" color="secondary">Unlogged</AppText> : overdue ? <AppText variant="bodySmall" color="secondary">Overdue · {protocolDuration(now.getTime() - Date.parse(planned.at))}</AppText> : null}
    {row.kind === "occurrence" && row.value.canLog ? <AppButton label="Log dose" accessibilityLabel={`Log ${value.compound.name} dose`} size="sm" onPress={() => onLog({ courseId: value.courseId, occurrenceId: row.value.id })} /> : null}
    {row.kind === "preview" ? <AppText variant="bodySmall" color="secondary">Schedule preview</AppText> : null}
  </View>;
}
