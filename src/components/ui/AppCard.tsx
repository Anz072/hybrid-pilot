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

/**
 * Bright Editorial card tones. A contained panel is never naked white on the
 * porcelain canvas — `surface` carries a hairline boundary, `subtle` a soft
 * fill, and `spotlight` opens with a short ink rule. Truly open content
 * belongs directly on the canvas, not in a card at all.
 * `standard`/`compact`/`soft`/`hero` remain as call-site aliases for
 * screens that haven't migrated to the new tone names yet.
 */
type CardVariant =
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

const isSpotlight = (variant: CardVariant) =>
  variant === "spotlight" || variant === "hero";

export const AppCard = ({
  children,
  style,
  variant = "surface",
  ...props
}: AppCardProps) => (
  <View {...props} style={[styles.card, styles[variant], style]}>
    {isSpotlight(variant) ? <View style={styles.openingRule} /> : null}
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
    {isSpotlight(variant) ? <View style={styles.openingRule} /> : null}
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
  <View {...props} style={[styles.listRow, divider && styles.listRowDivider, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.lg,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  surface: {
    padding: appSpacing.md,
  },
  standard: {
    padding: appSpacing.md,
  },
  compact: {
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.sm,
  },
  subtle: {
    padding: appSpacing.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: 0,
  },
  soft: {
    padding: appSpacing.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: 0,
  },
  spotlight: {
    padding: appSpacing.xl,
    backgroundColor: appSurfaces.raised,
  },
  hero: {
    padding: appSpacing.xl,
    backgroundColor: appSurfaces.raised,
  },
  outlined: {
    padding: appSpacing.md,
    borderColor: appBorders.strong,
  },
  /** Short ink rule that opens a spotlight/hero panel — the editorial anchor. */
  openingRule: {
    width: 44,
    height: appBorders.ruleWidth,
    backgroundColor: appBorders.rule,
    marginBottom: appSpacing.sm,
  },
  selected: {
    backgroundColor: appStates.selectedFill,
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: appSpacing.sm,
  },
  listRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
});
