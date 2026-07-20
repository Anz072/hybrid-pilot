import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { appBorders, appSpacing } from "../../theme/tokens";
import { AppText } from "./AppText";

type MetricLineProps = {
  /** Draws a hairline divider along the bottom edge, for rows inside a dense list. */
  divider?: boolean;
  icon?: React.ReactNode;
  label: string;
  secondary?: string;
  style?: StyleProp<ViewStyle>;
  value: React.ReactNode;
};

/** An aligned label/value row — the default replacement for nested metric cards. */
export const MetricLine = ({
  divider = false,
  icon,
  label,
  secondary,
  style,
  value,
}: MetricLineProps) => (
  <View style={[styles.row, divider && styles.divider, style]}>
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <View style={styles.copy}>
      <AppText variant="bodySmall">{label}</AppText>
      {secondary ? (
        <AppText color="muted" variant="micro">
          {secondary}
        </AppText>
      ) : null}
    </View>
    <View style={styles.valueWrap}>{value}</View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  divider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  valueWrap: {
    alignItems: "flex-end",
  },
});
