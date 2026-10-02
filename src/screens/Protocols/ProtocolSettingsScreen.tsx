import React from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import { useAppSelector } from "../../store/hooks";
import { DB } from "../../store/DB";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolSettingsScreen() {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const settings = useProtocolRead(userId, "settings", () => DB.getUserSettings(userId));
  const mutation = useProtocolMutation();
  const enabled = settings.data?.protocolsEnabled ?? false;
  const change = async (protocolsEnabled: boolean) => {
    const result = await mutation.run(() => DB.saveUserSettings({ userExternalId: userId, protocolsEnabled }));
    if (result?.protocolsEnabled) navigation.navigate("Protocols", result.protocolsIntroSeenAt ? { screen: "Root", params: { screen: "Today" } } : { screen: "Intro" });
  };
  return <AppScreen safeBottom>
    <ScreenHeader title="Protocol tracking" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {settings.error ? <ErrorState title="Could not load Protocol settings" message={settings.error} action={<AppButton label="Try again" onPress={() => void settings.reload()} />} />
        : settings.data === undefined ? <LoadingState title="Loading Protocol settings" /> : <>
          <AppCard style={styles.card}>
            <View style={styles.row}>
              <AppText variant="cardTitle" style={styles.grow}>Protocol tracking</AppText>
              <Switch accessibilityLabel="Protocol tracking" style={{ minWidth: 48, minHeight: 48 }} value={enabled} disabled={mutation.busy || settings.loading} onValueChange={(next) => {
                if (next) void change(true);
                else Alert.alert("Turn off Protocol tracking?", "Your courses, dose logs and bloodwork will be kept. You can turn tracking on again at any time.", [{ text: "Cancel", style: "cancel" }, { text: "Turn off", onPress: () => void change(false) }]);
              }} />
            </View>
            <AppText color="secondary">Schedule compounds, log actual doses, and view estimated levels alongside your health data.</AppText>
            <AppText variant="bodySmall" color="secondary">Nouri tracks the protocol you enter. It does not recommend compounds or dosing.</AppText>
          </AppCard>
          {enabled ? <AppButton label="Open Protocols" disabled={mutation.busy} onPress={() => navigation.navigate("Protocols", settings.data?.protocolsIntroSeenAt ? { screen: "Root", params: { screen: "Today" } } : { screen: "Intro" })} /> : null}
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">Delete Protocol data</AppText>
            <AppText color="secondary">Permanently remove every compound course, dose log, bloodwork panel and result, calendar reminder, and Protocol preference. Nutrition and bodyweight data are kept.</AppText>
            <AppButton label="Delete all Protocol data" variant="danger" disabled={mutation.busy || settings.loading} onPress={() => Alert.alert(
              "Delete all Protocol data?",
              "This permanently deletes all courses, planned doses, actual dose logs, bloodwork panels and results, calendar reminders, and Protocol preferences. Protocol tracking will be turned off. Your nutrition, bodyweight and other Nouri settings are kept. This cannot be undone.",
              [{ text: "Cancel", style: "cancel" }, { text: "Delete everything in Protocols", style: "destructive", onPress: () => { void (async () => {
                const result = await mutation.run(() => DB.deleteAllProtocolData(userId));
                if (result) { await settings.reload(); Alert.alert("Protocol data deleted", "Nutrition and bodyweight data were kept."); }
              })(); } }],
            )} />
          </AppCard>
        </>}
      {mutation.error ? <AppText accessibilityRole="alert" color="error">{mutation.error}</AppText> : null}
    </ScrollView>
  </AppScreen>;
}
