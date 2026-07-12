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
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
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
      {icon ? <View style={[styles.iconBadge, selected && styles.iconBadgeSelected]}>{icon}</View> : null}
      <View style={styles.copy}>
        <AppText
          color={selected ? appColors.actionPrimaryPressed : "primary"}
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
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.card,
    paddingHorizontal: appSpacing.md,
    paddingVertical: appSpacing.sm,
  },
  selectedCard: {
    borderColor: appStates.selectedBorder,
    backgroundColor: appStates.selectedFill,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
    transform: [{ scale: appStates.pressedScale }],
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
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  iconBadgeSelected: {
    backgroundColor: appSurfaces.card,
    borderColor: appColors.actionPrimaryBorder,
  },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    backgroundColor: appSurfaces.card,
  },
  checkSelected: {
    backgroundColor: appColors.actionPrimary,
    borderColor: appColors.actionPrimary,
  },
});
