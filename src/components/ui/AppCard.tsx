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
import {
  appBorders,
  appElevation,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../../theme/tokens";

/** Raised white surfaces; plain and inset variants remain flat for nested content. */
type CardVariant =
  | "plain"
  | "surface"
  | "subtle"
  | "spotlight"
  | "outlined"
  | "standard"
  | "compact"
  | "soft"
  | "hero";

type AppCardProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export const AppCard = ({
  children,
  style,
  variant = "surface",
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
  variant = "surface",
  ...props
}: InteractiveCardProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{
      disabled: Boolean(disabled),
      selected: Boolean(selected),
    }}
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
  /** Draws a hairline divider along the bottom edge. Defaults to on — pass `false` for the last row in a list. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A transparent row for open, divided lists — not a boxed card. */
export const ListRow = ({
  children,
  divider = true,
  style,
  ...props
}: ListRowProps) => (
  <View
    {...props}
    style={[styles.listRow, divider && styles.listRowDivider, style]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.lg,
    borderWidth: 0,
    ...appElevation.card,
  },
  plain: {
    ...appElevation.none,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  surface: {
    padding: appSpacing.md,
  },
  standard: {
    padding: appSpacing.md,
  },
  compact: {
    borderRadius: appRadius.sm,
    ...appElevation.metric,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.sm,
  },
  subtle: {
    ...appElevation.none,
    padding: appSpacing.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: 0,
  },
  soft: {
    ...appElevation.none,
    padding: appSpacing.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: 0,
  },
  spotlight: {
    borderRadius: appRadius.xl,
    ...appElevation.hero,
    padding: appSpacing.xl,
    backgroundColor: appSurfaces.raised,
  },
  hero: {
    borderRadius: appRadius.xl,
    ...appElevation.hero,
    padding: appSpacing.xl,
    backgroundColor: appSurfaces.raised,
  },
  outlined: {
    ...appElevation.none,
    borderWidth: appBorders.width,
    padding: appSpacing.md,
    borderColor: appBorders.strong,
  },
  selected: {
    backgroundColor: appStates.selectedFill,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  listRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: appSpacing.sm,
  },
  listRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
});
