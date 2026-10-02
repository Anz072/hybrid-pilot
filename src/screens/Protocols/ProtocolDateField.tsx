import React from "react";
import { Platform, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { AppButton, AppText } from "../../components/ui";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { displayProtocolDate } from "./protocolForm";

// A civil value, not an instant: the neutral UTC picker prevents the device
// timezone from changing the entered date/time. The API resolves it in the
// explicitly displayed course timezone when the user previews their settings.
export default function ProtocolDateField({ label, value, onChange, mode = "date", disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; mode?: "date" | "time"; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const onValueChange = React.useRef(onChange);
  onValueChange.current = onChange;
  // Android reopens/updates its dialog when this callback changes. Parent
  // clock/focus renders must not reset a day or time selected in the dialog.
  const handleChange = React.useCallback((event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (event.type === "set" && next) onValueChange.current(mode === "date" ? next.toISOString().slice(0, 10) : next.toISOString().slice(11, 16));
  }, [mode]);
  const preferences = useDisplayPreferences();
  const date = new Date(mode === "date" ? `${value}T12:00:00Z` : `2026-01-01T${value}:00Z`);
  const text = mode === "date" ? displayProtocolDate(value) : new Intl.DateTimeFormat(undefined, { timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: preferences.timeFormat === "12h" }).format(date);
  return <View>
    <AppText variant="metadata" color="secondary">{label}</AppText>
    <AppButton label={text} accessibilityLabel={`${label}, ${text}`} variant="secondary" disabled={disabled} onPress={() => setOpen((previous) => !previous)} />
    {open && !disabled ? <>
      <DateTimePicker value={date} timeZoneName="UTC" mode={mode} display={Platform.OS === "ios" ? "spinner" : "default"} is24Hour={preferences.timeFormat === "24h"}
        onChange={handleChange} />
      {Platform.OS === "ios" ? <AppButton variant="ghost" label="Done" onPress={() => setOpen(false)} /> : null}
    </> : null}
  </View>;
}
