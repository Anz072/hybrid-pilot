import React from "react";
import { Linking, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { useProtocolRead } from "./useProtocolRead";
import { protocolStyles as styles } from "./protocolStyles";

export default function CompoundInfoScreen({ navigation, route }: NativeStackScreenProps<ProtocolStackParamList, "CompoundInfo">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const query = useProtocolRead(userId, `compound-info:${route.params.compoundId}`, () => DB.getProtocolCompound(userId, route.params.compoundId));
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const openSource = async (url: string) => {
    try {
      if (!/^https?:\/\//.test(url)) throw new Error("Unsupported source URL");
      await Linking.openURL(url); setLinkError(null);
    } catch { setLinkError("Could not open this source. Please try again."); }
  };
  const compound = query.data;
  return <AppScreen safeBottom>
    <ScreenHeader title="Compound info" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {query.error ? <ErrorState title="Could not load compound info" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
      {!compound && query.loading ? <LoadingState title="Loading compound info" /> : null}
      {compound ? <>
        <AppCard style={styles.card}><AppText variant="sectionTitle">{compound.name}</AppText><AppText>{compound.description}</AppText><AppText color="secondary" variant="bodySmall">{compound.regulatoryNote}</AppText></AppCard>
        <AppCard style={styles.card}><AppText variant="cardTitle">About these estimates</AppText><AppText color="secondary">Estimated levels are modeled dose equivalents, not measured serum concentrations. They do not show clinical effects or provide dosing advice.</AppText></AppCard>
        {!compound.models.length ? <AppCard style={styles.card}><AppText variant="cardTitle">Model unavailable</AppText><AppText color="secondary">{compound.unavailableReason ?? "No published model is available for this compound."} You can still schedule and log doses.</AppText></AppCard> : null}
        {compound.models.map((model) => <AppCard key={model.id} style={styles.card}>
          <AppText variant="cardTitle">{model.route} · Model version {model.version}</AppText>
          <AppText>{model.explanation}</AppText>
          <AppText color="secondary" variant="bodySmall">{model.definition.parameters.halfLifeBasis.replace(/_/g, " ")} half-life · {model.definition.parameters.decayHalfLifeHours} hours</AppText>
          <AppText color="secondary" variant="bodySmall">Bioavailability · {model.definition.parameters.bioavailability} ({model.definition.parameters.bioavailabilityBasis.replace(/_/g, " ")})</AppText>
          {model.definition.parameters.absorption ? <AppText color="secondary" variant="bodySmall">{model.definition.parameters.absorption.kind === "half_life" ? "Absorption half-life" : "Time to peak"} · {model.definition.parameters.absorption.hours} hours</AppText> : null}
          <AppText color="secondary">{model.limitations}</AppText>
          {model.sources.map((source) => <AppButton key={source.url + source.title} label={source.title} accessibilityRole="link" variant="ghost" onPress={() => void openSource(source.url)} />)}
        </AppCard>)}
        {compound.evidenceSources.map((source) => <AppCard key={source.url + source.title} style={styles.card}><AppText variant="bodySmall">{source.evidence}</AppText><AppButton label={source.title} accessibilityRole="link" variant="ghost" onPress={() => void openSource(source.url)} /></AppCard>)}
      </> : null}
      {linkError ? <AppText accessibilityRole="alert" color="error">{linkError}</AppText> : null}
    </ScrollView>
  </AppScreen>;
}
