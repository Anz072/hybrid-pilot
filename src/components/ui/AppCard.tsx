import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";

type CardVariant = "standard" | "compact" | "soft" | "interactive" | "hero";

type AppCardProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export const AppCard = ({
  children,
  style,
  variant = "standard",
  ...props
}: AppCardProps) => (
  <View {...props} style={[styles.card, styles[variant], style]}>
    {children}
  </View>
);

type InteractiveCardProps = Omit<PressableProps, "children" | "style"> & {
  children: React.ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export const InteractiveCard = ({
  children,
  disabled,
  selected,
  style,
  variant = "standard",
  ...props
}: InteractiveCardProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
    disabled={disabled}
    {...props}
    style={({ pressed }) => [
      styles.card,
      styles[variant],
      selected && styles.selected,
      Boolean(disabled) && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    {children}
  </Pressable>
);

type ListRowProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const ListRow = ({ children, style, ...props }: ListRowProps) => (
  <View {...props} style={[styles.listRow, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  standard: {
    padding: appSpacing.md,
  },
  compact: {
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
  },
  soft: {
    padding: appSpacing.md,
    backgroundColor: appSurfaces.soft,
  },
  interactive: {
    padding: appSpacing.md,
  },
  hero: {
    padding: appSpacing.lg,
  },
  selected: {
    backgroundColor: appStates.selectedFill,
    borderColor: appStates.selectedBorder,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
    transform: [{ scale: appStates.pressedScale }],
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  listRow: {
    minHeight: 48,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.card,
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
  },
});
