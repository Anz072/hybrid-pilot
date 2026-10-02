import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CaretDownIcon, CaretUpIcon } from "phosphor-react-native";
import { AppText } from "./AppText";
import { appColors } from "../../theme/colors";
import { appCardSurface, appSpacing, appStates } from "../../theme/tokens";

/** Secondary information stays available without competing with the current task. */
export const Disclosure = ({
  title,
  children,
  initiallyOpen = false,
  contained = false,
}: {
  title: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
  contained?: boolean;
}) => {
  const [open, setOpen] = React.useState(initiallyOpen);
  const Icon = open ? CaretUpIcon : CaretDownIcon;
  return (
    <View style={[styles.wrap, contained && styles.contained]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <AppText style={styles.title} variant="bodySmallStrong">
          {title}
        </AppText>
        <Icon size={18} color={appColors.textSecondary} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: appSpacing.sm },
  contained: { ...appCardSurface, padding: appSpacing.md },
  pressed: { opacity: appStates.pressedOpacity },
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.borderSoft,
  },
  title: { flex: 1 },
  content: { paddingTop: appSpacing.sm, gap: appSpacing.sm },
});
