import React from "react";
import { ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppScreen, AppText, ScreenHeader } from "../../components/ui";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import type { ProtocolLevelsView } from "../../API/nouri/protocolTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useProtocolRead } from "./useProtocolRead";
import ProtocolLevelsPanel from "./ProtocolLevelsPanel";
import { protocolStyles as styles } from "./protocolStyles";

export default function PreviewLevelsScreen({ navigation, route }: NativeStackScreenProps<ProtocolStackParamList, "PreviewLevels">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const [view, setView] = React.useState<ProtocolLevelsView>({ range: "1M", metric: "relative" });
  const input = route.params.configuration;
  const query = useProtocolRead(userId, `unsaved-levels:${JSON.stringify([input, view])}`, () => DB.previewProtocolLevels(userId, { ...input, ...view }));
  return <AppScreen safeBottom>
    <ScreenHeader title="Estimated Levels" subtitle="Unsaved schedule preview" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <AppText color="secondary">All administrations here are hypothetical. This preview creates no course, scheduled occurrences or dose logs. Return to your schedule to save or start tracking.</AppText>
      <ProtocolLevelsPanel data={query.data} loading={query.loading} error={query.error} retry={() => void query.reload()}
        range={view.range} metric={view.metric} relativeOnly={false} onRange={(range) => setView({ ...view, range })} onMetric={(metric) => setView({ ...view, metric })}
        onWindow={(anchorAt) => setView({ ...view, anchorAt })} onInfo={(compoundId) => navigation.navigate("CompoundInfo", { compoundId })} timezone={input.timezone} />
    </ScrollView>
  </AppScreen>;
}
