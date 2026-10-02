import React from "react";
import { ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, ScreenHeader } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { useProtocolMutation } from "./useProtocolMutation";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolIntroScreen({ navigation }: NativeStackScreenProps<ProtocolStackParamList, "Intro">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const mutation = useProtocolMutation();
  const seenAt = React.useRef(new Date().toISOString());
  const finish = async (add: boolean) => {
    const settings = await mutation.run(() => DB.saveUserSettings({ userExternalId: userId, protocolsIntroSeenAt: seenAt.current }));
    if (settings) {
      if (add) navigation.replace("AddCompound");
      else navigation.replace("Root", { screen: "Today" });
    }
  };
  return <AppScreen safeBottom>
    <ScreenHeader title="Track your protocol" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <AppCard style={styles.card}>
        <AppText>Schedule compounds, log actual doses, track injection sites, visualize estimated levels, and view changes alongside your health data.</AppText>
        <AppText color="secondary">Nouri tracks the protocol you enter. It does not recommend compounds or dosing.</AppText>
      </AppCard>
      {mutation.error ? <AppText accessibilityRole="alert" color="error">{mutation.error}</AppText> : null}
      <AppButton label={mutation.busy ? "Saving…" : "Add first compound"} disabled={mutation.busy} onPress={() => void finish(true)} />
      <AppButton label="Not now" variant="ghost" disabled={mutation.busy} onPress={() => void finish(false)} />
    </ScrollView>
  </AppScreen>;
}
