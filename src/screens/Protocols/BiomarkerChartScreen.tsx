import React from "react";
import { Linking, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, Chip, Disclosure, EmptyState, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import { useProtocolClock } from "./useProtocolClock";
import BloodworkChart from "./BloodworkChart";
import ProtocolAnnotationControls from "./ProtocolAnnotationControls";
import { protocolStyles as styles } from "./protocolStyles";

export default function BiomarkerChartScreen({ navigation,route }: NativeStackScreenProps<ProtocolStackParamList,"BiomarkerChart">) {
  const userId = useAppSelector((s) => s.user.currentUser?.externalId) ?? "";
  const id = route.params.biomarkerId;
  const clock = useProtocolClock();
  const [unit,setUnit] = React.useState<string>();
  const [cursors,setCursors] = React.useState<string[]>([]);
  const [hidden,setHidden] = React.useState<string[]>([]);
  const after = cursors.at(-1);
  const history = useProtocolRead(userId,`marker:${id}:${unit ?? "preferred"}:${after ?? "latest"}`,() => DB.getBloodworkHistory(userId,id,{ displayUnit: unit,after,limit: 50 }));
  const results = history.data?.results ?? [];
  const start = results.at(-1)?.collectedOn ?? clock.today;
  const end = results[0]?.collectedOn ?? clock.today;
  const annotations = useProtocolRead(userId,`bloodwork-annotations:${start}:${end}:${clock.timezone}`,() => DB.getProtocolAnnotations(userId,{ start,end,tz: clock.timezone }));
  const mutation = useProtocolMutation();
  const marker = history.data?.biomarker;
  return <AppScreen safeBottom><ScreenHeader title={marker?.name ?? "Marker history"} onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {history.error ? <ErrorState title="Could not load marker history" message={history.error} action={<AppButton label="Try again" onPress={() => void history.reload()} />} /> : null}
      {!history.data && history.loading ? <LoadingState title="Loading results" /> : null}
      {marker ? <>
        <AppCard style={styles.card}><AppText variant="metadata" color="secondary">Display unit</AppText>
          <View style={styles.row}>{marker.units.map((u) => <Chip key={u.unit} label={u.unit} selected={history.data?.displayUnit === u.unit} disabled={mutation.busy}
            onPress={() => { void (async () => { const accepted = await mutation.run(() => DB.setBiomarkerDisplayUnit(userId,id,u.unit)); if (accepted) setUnit(accepted.displayUnit); })(); }} />)}</View>
          {mutation.error ? <AppText color="error" accessibilityRole="alert">{mutation.error}</AppText> : null}
        </AppCard>
        {results.length ? <AppCard><BloodworkChart results={results} events={(annotations.data?.events ?? []).filter((e) => !hidden.includes(e.courseId))}
          onPanel={(panelId) => navigation.navigate("BloodworkPanel",{ panelId })} /></AppCard> : <EmptyState title="No results in this range" message="Add this marker to a bloodwork panel to view its history." />}
        <View style={styles.card}><AppText variant="bodySmall" color="secondary">{after ? "Older" : "Most recent"} results · {results.length} shown</AppText>
          <View style={styles.row}>{after ? <AppButton label="Newer results" variant="secondary" disabled={history.loading} onPress={() => setCursors((old) => old.slice(0,-1))} /> : null}
            {history.data?.nextCursor ? <AppButton label="Older results" variant="secondary" disabled={history.loading} onPress={() => setCursors((old) => [...old,history.data!.nextCursor!])} /> : null}</View>
        </View>
        {annotations.error ? <ErrorState title="Course annotations unavailable" message={annotations.error} action={<AppButton label="Try again" onPress={() => void annotations.reload()} />} /> : null}
        {annotations.data ? <ProtocolAnnotationControls data={annotations.data} hidden={hidden} onHiddenChange={setHidden} /> : null}
        <Disclosure title="About this marker" contained><AppText>{marker.explanation}</AppText>
          {marker.sources.map((s) => <AppButton key={s.url} label={s.title} variant="ghost" onPress={() => { void mutation.run(() => Linking.openURL(s.url)); }} />)}
        </Disclosure>
      </> : null}
    </ScrollView>
  </AppScreen>;
}
