import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { appColors } from "../../theme/colors";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
import { AppText } from "./AppText";

type ChipProps = Omit<PressableProps, "children" | "style"> & {
  icon?: React.ReactNode;
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Chip = ({
  disabled,
  icon,
  label,
  selected,
  style,
  ...props
}: ChipProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
    disabled={disabled}
    {...props}
    style={({ pressed }) => [
      styles.chip,
      selected && styles.chipSelected,
      Boolean(disabled) && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
  >
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <AppText
      color={selected ? appColors.actionPrimaryPressed : appColors.textSecondary}
      variant="label"
    >
      {label}
    </AppText>
  </Pressable>
);

type SegmentedOption<T extends string> = {
  hint?: string;
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  style?: StyleProp<ViewStyle>;
  value: T;
};

export const SegmentedControl = <T extends string>({
  disabled,
  onChange,
  options,
  style,
  value,
}: SegmentedControlProps<T>) => (
  <View style={[styles.segmented, style]}>
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(disabled), selected }}
          key={option.value}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [
            styles.segment,
            selected && styles.segmentSelected,
            Boolean(disabled) && styles.disabled,
            pressed && !selected && !disabled && styles.pressed,
          ]}
        >
          <AppText
            color={selected ? appColors.white : appColors.textSecondary}
            variant="label"
          >
            {option.label}
          </AppText>
          {option.hint ? (
            <AppText
              color={selected ? appColors.white : appColors.textMuted}
              variant="micro"
            >
              {option.hint}
            </AppText>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderRadius: appRadius.pill,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.card,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipSelected: {
    backgroundColor: appColors.actionPrimarySoft,
    borderColor: appColors.actionPrimaryBorder,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  segmented: {
    flexDirection: "row",
    gap: 6,
    borderRadius: appRadius.pill,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.soft,
    padding: appSpacing.xxs,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  segmentSelected: {
    backgroundColor: appColors.actionPrimary,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
});
