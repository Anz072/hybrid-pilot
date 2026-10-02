import React from "react";
import { FlatList, View } from "react-native";
import { AppButton, AppText, EmptyState, ErrorState, InteractiveCard, LoadingState } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { useProtocolRead } from "./useProtocolRead";
import { displayProtocolDate } from "./protocolForm";
import { protocolStyles as styles } from "./protocolStyles";

export default function BloodworkScreen({ onAdd, onPanel }: { onAdd: () => void; onPanel: (panelId: string) => void }) {
  const userId = useAppSelector((s) => s.user.currentUser?.externalId) ?? "";
  const [cursors,setCursors] = React.useState<string[]>([]);
  const after = cursors.at(-1);
  const query = useProtocolRead(userId,`bloodwork-list:${after ?? "latest"}`,() => DB.listBloodworkPanels(userId,{ after,limit: 30 }));
  return <FlatList data={query.data?.panels ?? []} keyExtractor={(p) => p.id} contentContainerStyle={styles.content} refreshing={query.loading} onRefresh={() => void query.reload()}
      ListHeaderComponent={<View style={styles.card}><AppButton label="Add bloodwork" onPress={onAdd} />
        {query.error ? <ErrorState title="Could not load bloodwork" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}</View>}
      ListEmptyComponent={!query.data && query.loading ? <LoadingState title="Loading bloodwork" /> : !query.error ? <EmptyState title={after ? "No older bloodwork" : "No bloodwork added yet"} message="Record a panel to view its results and changes over time." /> : null}
      renderItem={({ item }) => <InteractiveCard style={styles.card} onPress={() => onPanel(item.id)} accessibilityLabel={`${displayProtocolDate(item.collectedOn)}, ${item.resultCount} markers${item.labName ? `, ${item.labName}` : ""}`}>
        <AppText variant="cardTitle">{displayProtocolDate(item.collectedOn)}</AppText><AppText color="secondary">{item.resultCount} {item.resultCount === 1 ? "marker" : "markers"}{item.labName ? ` · ${item.labName}` : ""}</AppText>
      </InteractiveCard>}
      ListFooterComponent={<View style={styles.row}>{after ? <AppButton label="Newer panels" variant="secondary" disabled={query.loading} onPress={() => setCursors((old) => old.slice(0,-1))} /> : null}
        {query.data?.nextCursor ? <AppButton label="Older panels" variant="secondary" disabled={query.loading} onPress={() => setCursors((old) => [...old,query.data!.nextCursor!])} /> : null}</View>} />;
}
