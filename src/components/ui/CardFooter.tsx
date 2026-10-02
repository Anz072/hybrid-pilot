import React from "react";
import { StyleSheet, View } from "react-native";
import { CaretRightIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing } from "../../theme/tokens";
import { AppText } from "./AppText";

/** Visual footer for an InteractiveCard; the parent owns the single tap target. */
export const CardFooter = ({ label }: { label: string }) => (
  <View style={styles.footer}>
    <AppText style={styles.label} color="coral" variant="bodySmallStrong">{label}</AppText>
    <CaretRightIcon size={18} color={appColors.actionPrimary} />
  </View>
);

const styles = StyleSheet.create({
  footer: {
    minHeight: 48,
    paddingHorizontal: appSpacing.md,
    paddingVertical: appSpacing.sm,
    borderBottomLeftRadius: appRadius.lg,
    borderBottomRightRadius: appRadius.lg,
    backgroundColor: appColors.actionPrimarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.xs,
  },
  label: { flexShrink: 1, textAlign: "center" },
});
