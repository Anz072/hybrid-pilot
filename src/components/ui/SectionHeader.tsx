import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { appSpacing } from "../../theme/tokens";
import { AppText } from "./AppText";

type SectionHeaderProps = {
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

/** Consistent section hierarchy for cards, forms, and content groups. */
export const SectionHeader = ({
  action,
  style,
  subtitle,
  title,
}: SectionHeaderProps) => (
  <View style={[styles.row, style]}>
    <View style={styles.copy}>
      <AppText accessibilityRole="header" variant="sectionTitle">{title}</AppText>
      {subtitle ? (
        <AppText color="secondary" style={styles.subtitle} variant="bodySmall">
          {subtitle}
        </AppText>
      ) : null}
    </View>
    {action ? <View style={styles.action}>{action}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  copy: {
    flex: 1,
    gap: appSpacing.xxs,
  },
  subtitle: {
    marginTop: 0,
  },
  action: {
    alignItems: "flex-end",
  },
});
