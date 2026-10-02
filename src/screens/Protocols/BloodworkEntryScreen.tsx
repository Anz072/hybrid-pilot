import React from "react";
import { Alert, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { AppButton, AppCard, AppInput, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { NouriApiError } from "../../API/nouri/client";
import type { ApiBiomarker, ApiBloodworkPanel, BloodworkResultInput, CreateBloodworkPanelInput, EditBloodworkPanelInput } from "../../API/nouri/bloodworkTypes";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import { useProtocolClock } from "./useProtocolClock";
import ProtocolDateField from "./ProtocolDateField";
import BloodworkResultSheet from "./BloodworkResultSheet";
import { labRange } from "./bloodworkForm";
import { protocolStyles as styles } from "./protocolStyles";

type Props = NativeStackScreenProps<ProtocolStackParamList,"BloodworkEntry">;
export default function BloodworkEntryScreen(props: Props) {
  const userId = useAppSelector((s) => s.user.currentUser?.externalId) ?? "";
  const id = props.route.params?.panelId;
  const query = useProtocolRead(userId,`bloodwork-entry:${id ?? "new"}`,async () => {
    const [catalog,panel] = await Promise.all([DB.listBiomarkers(userId),id ? DB.getBloodworkPanel(userId,id) : undefined]);
    return { catalog: catalog.biomarkers,panel };
  });
  if (!query.data) return <AppScreen safeBottom><ScreenHeader title={id ? "Edit bloodwork" : "Add bloodwork"} onBack={() => props.navigation.goBack()} />
    {query.error ? <ErrorState title="Could not load bloodwork" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : <LoadingState title="Loading markers" />}
  </AppScreen>;
  return <BloodworkForm key={`${userId}:${id ?? "new"}`} {...props} userId={userId} {...query.data} />;
}
function BloodworkForm({ navigation,userId,catalog,panel }: Props & { userId: string; catalog: ApiBiomarker[]; panel?: ApiBloodworkPanel }) {
  const clock = useProtocolClock();
  const [id] = React.useState(() => panel?.id ?? Crypto.randomUUID());
  const [operationId] = React.useState(() => Crypto.randomUUID());
  const [date,setDate] = React.useState(panel?.collectedOn ?? clock.today);
  const [lab,setLab] = React.useState(panel?.labName ?? "");
  const [results,setResults] = React.useState<BloodworkResultInput[]>(() => panel?.results.map((r) => ({ biomarkerId: r.biomarkerId,rawValue: r.rawValue,rawUnit: r.rawUnit,
    referenceLow: r.referenceLow,referenceHigh: r.referenceHigh,referenceUnit: r.referenceUnit })) ?? []);
  const [editing,setEditing] = React.useState<string | null>(null);
  const [intent,setIntent] = React.useState<CreateBloodworkPanelInput | EditBloodworkPanelInput | null>(null);
  const original = React.useRef(JSON.stringify({ date,lab,results }));
  const allowExit = React.useRef(false);
  const mutation = useProtocolMutation();
  const dirty = original.current !== JSON.stringify({ date,lab,results });
  const locked = mutation.busy || intent !== null;
  usePreventRemove(dirty || locked,({ data }) => {
    if (allowExit.current) { navigation.dispatch(data.action); return; }
    if (mutation.busy) return;
    Alert.alert("Leave bloodwork entry?",intent ? "The last save may have reached Nouri. Check your bloodwork before adding it again." : "Your unsaved changes will be discarded.",[
      { text: "Keep editing",style: "cancel" },{ text: "Leave",style: "destructive",onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const save = async () => {
    const request = intent ?? (panel ? { operationId,expectedRevision: panel.revision,collectedOn: date,labName: lab.trim() || null,results }
      : { id,collectedOn: date,labName: lab.trim() || null,results });
    setIntent(request);
    const accepted = await mutation.run(async () => {
      try { return "expectedRevision" in request ? await DB.editBloodworkPanel(userId,id,request) : await DB.createBloodworkPanel(userId,request); }
      catch (cause) {
        // A known validation/conflict response is safe to edit. Unknown outcomes
        // keep the exact command so Retry cannot create a second panel.
        if (cause instanceof NouriApiError && cause.status !== undefined && cause.status >= 400 && cause.status < 500) setIntent(null);
        throw cause;
      }
    });
    if (accepted) { allowExit.current = true; navigation.replace("BloodworkPanel",{ panelId: accepted.id }); }
  };
  return <AppScreen safeBottom>
    <ScreenHeader title={panel ? "Edit bloodwork" : "Add bloodwork"} onBack={() => navigation.goBack()} />
    <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppCard style={styles.stack}>
        <ProtocolDateField label="Collection date" value={date} onChange={setDate} disabled={locked} />
        <AppInput label="Laboratory or provider (optional)" value={lab} onChangeText={setLab} editable={!locked} maxLength={120} />
      </AppCard>
      <AppText variant="sectionTitle">Results</AppText>
      {results.length === 0 ? <AppText color="secondary">Add the numeric results from your laboratory report.</AppText> : null}
      {results.map((r) => <AppCard key={r.biomarkerId} style={styles.card}>
        <AppText variant="bodyStrong">{catalog.find((m) => m.id === r.biomarkerId)?.name ?? "Marker"}</AppText>
        <AppText variant="sectionTitle" selectable>{r.rawValue} {r.rawUnit}</AppText>
        <AppText variant="bodySmall" color="secondary">Reference: {labRange(r.referenceLow,r.referenceHigh,r.referenceUnit ?? r.rawUnit)}</AppText>
        <View style={styles.row}><AppButton label="Edit result" variant="ghost" disabled={locked} onPress={() => setEditing(r.biomarkerId)} />
          <AppButton label="Remove result" variant="ghost" disabled={locked} onPress={() => setResults((old) => old.filter((item) => item.biomarkerId !== r.biomarkerId))} /></View>
      </AppCard>)}
      <AppButton label="Add result" variant="secondary" disabled={locked || !catalog.some((m) => m.active && !results.some((r) => r.biomarkerId === m.id))} onPress={() => setEditing("new")} />
      {mutation.error ? <AppText color="error" accessibilityRole="alert">{mutation.error}</AppText> : null}
      {intent && !mutation.busy ? <AppText variant="bodySmall" color="secondary">Retry sends the same save. Your entered values are retained.</AppText> : null}
      <AppButton label={mutation.busy ? "Saving…" : intent ? "Retry save" : "Save bloodwork"} disabled={mutation.busy || !results.length || (!dirty && Boolean(panel))} onPress={() => void save()} />
      {panel && mutation.error ? <AppButton label="Review saved panel" variant="secondary" onPress={() => { allowExit.current = true; navigation.replace("BloodworkPanel",{ panelId: id }); }} /> : null}
    </KeyboardAwareScrollView>
    {editing !== null ? <BloodworkResultSheet key={editing} catalog={catalog} existing={results.find((r) => r.biomarkerId === editing)} used={results.map((r) => r.biomarkerId)}
      onClose={() => setEditing(null)} onSave={(result) => { setResults((old) => old.some((r) => r.biomarkerId === result.biomarkerId) ? old.map((r) => r.biomarkerId === result.biomarkerId ? result : r) : [...old,result]); setEditing(null); mutation.clearError(); }} /> : null}
  </AppScreen>;
}
