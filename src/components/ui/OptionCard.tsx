import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { CheckIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appBorders, appRadius, appSpacing, appStates } from "../../theme/tokens";
import { AppText } from "./AppText";

type OptionCardProps = Omit<PressableProps, "children" | "style"> & {
  icon?: React.ReactNode;
  selected?: boolean;
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  trailing?: React.ReactNode;
};

/** A selectable row — not a boxed card. Selection is shown with a fill and a checkmark. */
export const OptionCard = ({
  disabled,
  icon,
  selected,
  showCheck = true,
  style,
  subtitle,
  title,
  trailing,
  ...props
}: OptionCardProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
    disabled={disabled}
    {...props}
    style={({ pressed }) => [
      styles.card,
      selected && styles.selectedCard,
      Boolean(disabled) && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    <View style={styles.content}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <View style={styles.copy}>
        <AppText
          color={selected ? "coral" : "primary"}
          variant="cardTitle"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText color="secondary" variant="bodySmall">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {showCheck ? (
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <CheckIcon size={14} color={appColors.white} weight="bold" /> : null}
        </View>
      ) : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
    paddingVertical: appSpacing.sm,
    paddingHorizontal: appSpacing.sm,
  },
  selectedCard: {
    backgroundColor: appStates.selectedFill,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
  },
  copy: {
    flex: 1,
    gap: appSpacing.xxs,
  },
  iconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
  },
  checkSelected: {
    backgroundColor: appColors.actionPrimary,
    borderColor: appColors.actionPrimary,
  },
});
