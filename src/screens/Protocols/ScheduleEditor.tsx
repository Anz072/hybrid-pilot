import React from "react";
import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import { AppButton, AppCard, AppInput, AppText, Chip } from "../../components/ui";
import type { ProtocolDoseUnit } from "../../domain/types";
import { protocolScheduleKinds, protocolWeekdays, type ProtocolConfigurationDraft, type ProtocolDoseField } from "./protocolForm";
import ProtocolDateField from "./ProtocolDateField";
import { protocolStyles as styles } from "./protocolStyles";

export default function ScheduleEditor({ value, onChange, units, disabled = false }: {
  value: ProtocolConfigurationDraft; onChange: (draft: ProtocolConfigurationDraft) => void; units: ProtocolDoseUnit[]; disabled?: boolean;
}) {
  const multiple = ["daily", "every_n_days", "specific_weekdays"].includes(value.kind);
  const instant = value.kind === "one_time" || value.kind === "every_n_hours";
  const updateDose = (key: string, patch: Partial<ProtocolDoseField>) => onChange({ ...value, doses: value.doses.map((dose) => dose.key === key ? { ...dose, ...patch } : dose) });
  const fields = multiple ? value.doses : value.doses.slice(0, 1);
  return <View style={styles.stack}>
    <AppCard style={styles.card}>
      <AppText variant="cardTitle" accessibilityRole="header">Schedule</AppText>
      <View style={styles.row}>{protocolScheduleKinds.map((kind) => <Chip key={kind.value} label={kind.label} selected={value.kind === kind.value} disabled={disabled} onPress={() => onChange({ ...value, kind: kind.value })} />)}</View>
      {value.kind === "every_n_days" || value.kind === "every_n_hours" ? <AppInput label={value.kind === "every_n_days" ? "Interval in days" : "Interval in hours"} keyboardType="number-pad" editable={!disabled} value={value.interval} onChangeText={(interval) => onChange({ ...value, interval })} /> : null}
      {value.kind === "every_n_days" || instant ? <ProtocolDateField label={value.kind === "one_time" ? "Administration date" : "Anchor date"} value={value.anchorDate} disabled={disabled} onChange={(anchorDate) => onChange({ ...value, anchorDate })} /> : null}
      {instant ? <ProtocolDateField mode="time" label={value.kind === "one_time" ? "Administration time" : "Anchor time"} value={value.anchorTime} disabled={disabled} onChange={(anchorTime) => onChange({ ...value, anchorTime })} /> : null}
      {value.kind === "every_n_hours" ? <AppText color="secondary" variant="bodySmall">Intervals use elapsed hours from this anchor, including across daylight-saving changes.</AppText> : null}
      {value.kind === "every_n_days" ? <AppText color="secondary" variant="bodySmall">The anchor fixes the planned calendar. Logging late will not move it.</AppText> : null}
      {value.kind === "as_needed" ? <AppText color="secondary" variant="bodySmall">No doses are scheduled. These values prefill manual logs and remain editable when logging.</AppText> : null}
    </AppCard>
    {fields.map((dose, index) => <AppCard key={dose.key} style={styles.card}>
      <AppText variant="cardTitle" accessibilityRole="header">{multiple ? `Administration ${index + 1}` : "Dose"}</AppText>
      {value.kind === "specific_weekdays" ? <View style={styles.row}>{protocolWeekdays.map((day, weekday) => <Chip key={day} label={day.slice(0, 3)} accessibilityLabel={`${day}, administration ${index + 1}`} selected={dose.weekday === weekday} disabled={disabled} onPress={() => updateDose(dose.key, { weekday })} />)}</View> : null}
      <AppInput label={`Amount${multiple ? `, administration ${index + 1}` : ""}`} placeholder="Enter amount" value={dose.amount} keyboardType="decimal-pad" editable={!disabled} onChangeText={(amount) => updateDose(dose.key, { amount: amount.replace(",", ".") })} />
      <View style={styles.row}>{units.map((unit) => <Chip key={unit} label={unit} selected={dose.unit === unit} disabled={disabled} onPress={() => updateDose(dose.key, { unit })} />)}</View>
      {multiple ? <>
        <ProtocolDateField mode="time" label={`Time, administration ${index + 1}`} value={dose.time} disabled={disabled} onChange={(time) => updateDose(dose.key, { time })} />
        <View style={styles.row}>
          <AppButton label="Morning · 08:00" variant="ghost" disabled={disabled} onPress={() => updateDose(dose.key, { time: "08:00" })} />
          <AppButton label="Evening · 20:00" variant="ghost" disabled={disabled} onPress={() => updateDose(dose.key, { time: "20:00" })} />
        </View>
        {value.doses.length > 1 ? <AppButton label={`Remove administration ${index + 1}`} variant="danger" disabled={disabled} onPress={() => onChange({ ...value, doses: value.doses.filter((item) => item.key !== dose.key) })} /> : null}
      </> : null}
    </AppCard>)}
    {multiple ? <AppButton label="Add administration" variant="secondary" disabled={disabled || value.doses.length >= (value.kind === "specific_weekdays" ? 168 : 24)} onPress={() => onChange({ ...value, doses: [...value.doses, { key: randomUUID(), time: "20:00", amount: "", unit: units[0]!, weekday: 0 }] })} /> : null}
    <AppText variant="bodySmall" color="secondary">Times use {value.timezone}. Your schedule stays in this timezone if your device timezone changes.</AppText>
  </View>;
}
