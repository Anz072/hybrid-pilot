import { StyleSheet } from "react-native";
import { appSpacing } from "../../theme/tokens";

export const protocolStyles = StyleSheet.create({
  content: { gap: appSpacing.md, paddingBottom: appSpacing.xxl },
  stack: { gap: appSpacing.md },
  card: { gap: appSpacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: appSpacing.xs, alignItems: "center" },
  grow: { flex: 1 },
  section: { marginTop: appSpacing.md },
});
