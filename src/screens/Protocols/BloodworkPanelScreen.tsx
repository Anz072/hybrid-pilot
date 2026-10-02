import React from "react";
import { Alert, FlatList, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import { displayProtocolDate } from "./protocolForm";
import { labRange } from "./bloodworkForm";
import { protocolStyles as styles } from "./protocolStyles";

export default function BloodworkPanelScreen({ navigation,route }: NativeStackScreenProps<ProtocolStackParamList,"BloodworkPanel">) {
  const userId = useAppSelector((s) => s.user.currentUser?.externalId) ?? "";
  const query = useProtocolRead(userId,`bloodwork-panel:${route.params.panelId}`,() => DB.getBloodworkPanel(userId,route.params.panelId));
  const mutation = useProtocolMutation();
  const panel = query.data;
  return <AppScreen safeBottom><ScreenHeader title={panel ? displayProtocolDate(panel.collectedOn) : "Bloodwork"} onBack={() => navigation.goBack()} />
    <FlatList data={panel?.results ?? []} keyExtractor={(r) => r.biomarkerId} contentContainerStyle={styles.content} refreshing={query.loading} onRefresh={() => void query.reload()}
      ListHeaderComponent={<View style={styles.card}>
        {query.error ? <ErrorState title="Could not load panel" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
        {!panel && query.loading ? <LoadingState title="Loading results" /> : null}
        {panel ? <><AppText color="secondary">{panel.labName ?? "Laboratory not entered"}</AppText><AppButton label="Edit bloodwork" variant="secondary" disabled={mutation.busy} onPress={() => navigation.navigate("BloodworkEntry",{ panelId: panel.id })} /></> : null}
      </View>}
      renderItem={({ item }) => <AppCard style={styles.card}>
        <AppText variant="cardTitle">{item.name}</AppText><AppText variant="sectionTitle" selectable>{item.rawValue} {item.rawUnit}</AppText>
        <AppText variant="bodySmall" color="secondary">Reference: {labRange(item.referenceLow,item.referenceHigh,item.referenceUnit ?? item.rawUnit)}</AppText>
        <AppButton label="View marker history" variant="ghost" onPress={() => navigation.navigate("BiomarkerChart",{ biomarkerId: item.biomarkerId })} />
      </AppCard>}
      ListFooterComponent={panel ? <View style={styles.card}>
        {mutation.error ? <AppText color="error" accessibilityRole="alert">{mutation.error}</AppText> : null}
        <AppButton label="Delete bloodwork panel" variant="danger" disabled={mutation.busy} onPress={() => Alert.alert("Delete bloodwork panel?","This permanently deletes this panel and all its results. Other panels, courses, nutrition and bodyweight are kept.",[
          { text: "Cancel",style: "cancel" },{ text: "Delete panel",style: "destructive",onPress: () => { void (async () => {
            const accepted = await mutation.run(() => DB.deleteBloodworkPanel(userId,panel.id,panel.revision));
            if (accepted) navigation.popTo("Root", { screen: "Trends", params: { section: "bloodwork" } });
          })(); } },
        ])} />
      </View> : null} />
  </AppScreen>;
}
