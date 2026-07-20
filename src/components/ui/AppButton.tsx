import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
import { AppText } from "./AppText";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type AppButtonSize = "md" | "sm";

type AppButtonProps = Omit<PressableProps, "children" | "style"> & {
  icon?: React.ReactNode;
  label: string;
  size?: AppButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: AppButtonVariant;
};

const buttonTextColor: Record<AppButtonVariant, string> = {
  primary: appColors.white,
  secondary: appColors.textPrimary,
  ghost: appColors.actionPrimary,
  danger: appColors.danger700,
};

export const AppButton = ({
  disabled,
  icon,
  label,
  size = "md",
  style,
  textStyle,
  variant = "primary",
  ...props
}: AppButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    {...props}
    style={({ pressed }) => [
      styles.button,
      styles[`${variant}Button`],
      size === "sm" && styles.smallButton,
      Boolean(disabled) && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <AppText
      style={[styles.label, { color: buttonTextColor[variant] }, textStyle]}
      variant={size === "sm" ? "buttonSmall" : "button"}
    >
      {label}
    </AppText>
  </Pressable>
);

type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  accessibilityLabel: string;
  children: React.ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "primary" | "danger";
};

export const IconButton = ({
  children,
  disabled,
  selected,
  style,
  variant = "default",
  ...props
}: IconButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
    disabled={disabled}
    {...props}
    style={({ pressed }) => [
      styles.iconButton,
      variant === "primary" && styles.primaryIconButton,
      variant === "danger" && styles.dangerIconButton,
      selected && styles.selectedIconButton,
      Boolean(disabled) && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    {children}
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: appRadius.md,
    paddingHorizontal: appSpacing.md,
    paddingVertical: appSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: appSpacing.xs,
  },
  smallButton: {
    minHeight: 40,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  primaryButton: {
    backgroundColor: appColors.actionPrimary,
  },
  secondaryButton: {
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  dangerButton: {
    backgroundColor: appColors.dangerSurface,
    borderWidth: appBorders.width,
    borderColor: appColors.dangerBorder,
  },
  label: {
    ...appTypography.button,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  primaryIconButton: {
    backgroundColor: appColors.actionPrimary,
    borderColor: appColors.actionPrimary,
  },
  dangerIconButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.dangerBorder,
  },
  selectedIconButton: {
    backgroundColor: appColors.actionPrimarySoft,
    borderColor: appColors.actionPrimaryBorder,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
    transform: [{ scale: appStates.pressedScale }],
  },
});
