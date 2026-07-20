import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { appColors } from "../../theme/colors";
import { appBorders, appSpacing } from "../../theme/tokens";
import type { AppTypographyRole } from "../../theme/typography";
import { AppText } from "./AppText";

type CoachNoteProps = {
  action?: React.ReactNode;
  eyebrow?: string;
  message: string;
  messageVariant?: AppTypographyRole;
  style?: StyleProp<ViewStyle>;
};

/** The one plain-language coaching sentence — quiet by default, not a badge or a banner. */
export const CoachNote = ({
  action,
  eyebrow,
  message,
  messageVariant = "coachStatement",
  style,
}: CoachNoteProps) => (
  <View style={[styles.container, style]}>
    {eyebrow ? (
      <AppText color="secondary" variant="eyebrow">
        {eyebrow}
      </AppText>
    ) : null}
    <AppText style={styles.message} variant={messageVariant}>
      {message}
    </AppText>
    {action ? <View style={styles.actions}>{action}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: appBorders.ruleWidth,
    borderLeftColor: appColors.actionPrimary,
    paddingLeft: appSpacing.md,
    gap: appSpacing.xs,
  },
  message: {
    color: appColors.textPrimary,
  },
  actions: {
    marginTop: appSpacing.xs,
    flexDirection: "row",
    gap: appSpacing.sm,
  },
});
