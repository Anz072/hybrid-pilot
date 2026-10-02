import React from "react";
import { Alert, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { AppButton, AppInput, AppScreen, AppSheet, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { NouriApiError } from "../../API/nouri/client";
import type { ApiProtocolReminder, CreateProtocolReminderInput, EditProtocolReminderInput } from "../../API/nouri/protocolTypes";
import { DB } from "../../store/DB";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import { useProtocolClock } from "./useProtocolClock";
import { protocolClock, protocolDate } from "./protocolForm";
import ProtocolDateField from "./ProtocolDateField";
import { protocolStyles as styles } from "./protocolStyles";

function ReminderFrame({ page, title, onClose, children }: { page?: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return page ? <AppScreen safeBottom><ScreenHeader title={title} onBack={onClose} /><KeyboardAwareScrollView>{children}</KeyboardAwareScrollView></AppScreen>
    : <AppSheet visible title={title} onClose={onClose} keyboardAware>{children}</AppSheet>;
}
export default function BloodworkReminderSheet({ userId,id,date,onClose,page }: { userId: string; id?: string; date: string; onClose: () => void; page?: boolean }) {
  const close = React.useRef(onClose);
  const query = useProtocolRead(userId,`reminder-form:${id ?? "new"}`,async () => id ? DB.getProtocolReminder(userId,id) : null);
  // Keep the native modal mounted while its data loads. Replacing a loading
  // modal with a form modal races iOS presentation against dismissal.
  return <ReminderFrame page={page} title={id ? "Edit bloodwork reminder" : "Bloodwork reminder"} onClose={() => close.current()}>
    {id && !query.data
      ? query.error ? <ErrorState title="Could not load reminder" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : <LoadingState title="Loading reminder" />
      : <ReminderForm key={`${userId}:${id ?? "new"}`} userId={userId} initialDate={date} reminder={query.data ?? undefined} onClose={onClose} page={page} registerClose={(handler) => { close.current = handler; }} />}
  </ReminderFrame>;
}
function ReminderForm({ userId,initialDate,reminder,onClose,page,registerClose }: { userId: string; initialDate: string; reminder?: ApiProtocolReminder; onClose: () => void; page?: boolean; registerClose: (handler: () => void) => void }) {
  const navigation = useNavigation();
  const allowExit = React.useRef(false);
  const clock = useProtocolClock();
  const [id] = React.useState(() => reminder?.id ?? Crypto.randomUUID());
  const [operationId] = React.useState(() => Crypto.randomUUID());
  const [timezone,setTimezone] = React.useState(reminder?.timezone ?? clock.timezone);
  const [date,setDate] = React.useState(() => reminder ? protocolDate(reminder.scheduledAt,reminder.timezone) : initialDate);
  const [time,setTime] = React.useState(() => protocolClock(reminder?.scheduledAt ?? clock.now.toISOString(),reminder?.timezone ?? clock.timezone));
  const [title,setTitle] = React.useState(reminder?.title ?? "Bloodwork");
  const [intent,setIntent] = React.useState<CreateProtocolReminderInput | EditProtocolReminderInput | null>(null);
  const initial = React.useRef(JSON.stringify({ date,time,timezone,title }));
  const mutation = useProtocolMutation();
  const dirty = initial.current !== JSON.stringify({ date,time,timezone,title });
  const locked = mutation.busy || intent !== null;
  const requestClose = (leave: () => void) => {
    if (allowExit.current) { leave(); return; }
    if (mutation.busy) return;
    if (!dirty && !intent) { leave(); return; }
    Alert.alert("Leave reminder?",intent ? "The last save may have reached Nouri. Check the calendar before adding it again." : "Unsaved changes will be discarded.",[
      { text: "Keep editing",style: "cancel" },{ text: "Leave",style: "destructive",onPress: leave },
    ]);
  };
  usePreventRemove(Boolean(page) && (dirty || locked),({ data }) => requestClose(() => navigation.dispatch(data.action)));
  registerClose(() => page ? onClose() : requestClose(onClose));
  const save = async () => {
    const accepted = await mutation.run(async () => {
      let request = intent;
      if (!request) {
        const unchangedTime = reminder && date === protocolDate(reminder.scheduledAt,reminder.timezone) && time === protocolClock(reminder.scheduledAt,reminder.timezone) && timezone === reminder.timezone;
        const scheduledAt = unchangedTime ? reminder.scheduledAt : (await DB.previewProtocolTime(userId,{ date,time,timezone })).at;
        const values = { title: title.trim(),scheduledAt,timezone };
        request = reminder ? { ...values,operationId,expectedRevision: reminder.revision } : { ...values,id };
        setIntent(request);
      }
      try { return "expectedRevision" in request ? await DB.editProtocolReminder(userId,id,request) : await DB.createProtocolReminder(userId,request); }
      catch (cause) { if (cause instanceof NouriApiError && cause.status >= 400 && cause.status < 500) setIntent(null); throw cause; }
    });
    if (accepted) { allowExit.current = true; onClose(); }
  };
  return <View style={styles.content}>
      <AppText color="secondary">A one-time item in your Protocols calendar. No device alert is sent.</AppText>
      <AppInput label="Title" value={title} onChangeText={setTitle} maxLength={120} editable={!locked} />
      <ProtocolDateField label="Date" value={date} onChange={setDate} disabled={locked} />
      <ProtocolDateField label="Time" mode="time" value={time} onChange={setTime} disabled={locked} />
      <AppInput label="Time zone" value={timezone} onChangeText={setTimezone} editable={!locked} autoCapitalize="none" autoCorrect={false} />
      {mutation.error ? <AppText color="error" accessibilityRole="alert">{mutation.error}</AppText> : null}
      <AppButton label={mutation.busy ? "Saving…" : intent ? "Retry save" : "Save calendar item"} disabled={mutation.busy || !title.trim()} onPress={() => void save()} />
      {reminder ? <AppButton label="Delete reminder" variant="danger" disabled={locked} onPress={() => Alert.alert("Delete bloodwork reminder?","Only this calendar item will be deleted. Recorded bloodwork is kept.",[
        { text: "Cancel",style: "cancel" },{ text: "Delete",style: "destructive",onPress: () => { void (async () => {
          if (await mutation.run(() => DB.deleteProtocolReminder(userId,id,reminder.revision))) { allowExit.current = true; onClose(); }
        })(); } },
      ])} /> : null}
    </View>;
}
