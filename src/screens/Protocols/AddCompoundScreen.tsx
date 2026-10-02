import React from "react";
import { SectionList } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppScreen, AppText, EmptyState, ErrorState, InteractiveCard, LoadingState, ScreenHeader, SearchInput } from "../../components/ui";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { useProtocolRead } from "./useProtocolRead";
import { protocolStyles as styles } from "./protocolStyles";

const categories = [{ key: "testosterone", title: "Testosterone" }, { key: "injectable_aas", title: "Other injectable AAS" }, { key: "incretin", title: "GLP-1 / incretin" }];
export default function AddCompoundScreen({ navigation }: NativeStackScreenProps<ProtocolStackParamList, "AddCompound">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const [search, setSearch] = React.useState("");
  const query = useProtocolRead(userId, "catalog", () => DB.listProtocolCompounds(userId));
  const sections = categories.map((category) => ({ ...category, data: (query.data?.compounds ?? []).filter((compound) => compound.active && compound.category === category.key && compound.name.toLowerCase().includes(search.trim().toLowerCase())) })).filter((section) => section.data.length > 0);
  return <AppScreen safeBottom>
    <ScreenHeader title="Add compound" onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace("Root", { screen: "Compounds" })} />
    <SearchInput label="Search compounds" placeholder="Search by compound name" value={search} onChangeText={setSearch} />
    {query.error ? <ErrorState title="Could not load compounds" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
    <SectionList sections={sections} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickySectionHeadersEnabled={false}
      ListEmptyComponent={query.loading ? <LoadingState title="Loading compounds" /> : <EmptyState title="No matching compounds" message="Try a different compound name." />}
      renderSectionHeader={({ section }) => <AppText variant="sectionTitle" accessibilityRole="header" style={styles.section}>{section.title}</AppText>}
      renderItem={({ item }) => <InteractiveCard accessibilityLabel={`Configure ${item.name}`} onPress={() => navigation.navigate("EditCourse", { compoundId: item.id })}>
        <AppText variant="cardTitle">{item.name}</AppText>
        <AppText color="secondary" variant="bodySmall">{item.routes.join(" / ")}</AppText>
      </InteractiveCard>} />
  </AppScreen>;
}
