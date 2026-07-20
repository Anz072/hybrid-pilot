import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CaretDownIcon, CheckIcon } from "phosphor-react-native";
import { AppText } from "../../components/ui";
import { appColors } from "../../theme/colors";
import {
  appBorders,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../../theme/tokens";
import {
  getDefaultMealSlotForNow,
  getMealSlotFromLabel,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  type MealSlot,
} from "./foodUtils";

type MealBucketSelectProps = {
  disabled?: boolean;
  onChange: (value: MealSlot) => void;
  style?: StyleProp<ViewStyle>;
  value: MealSlot;
};

export const getInitialMealBucket = (
  mealType: string | null | undefined,
): MealSlot => getMealSlotFromLabel(mealType) ?? getDefaultMealSlotForNow();

const MealBucketSelect = ({
  disabled = false,
  onChange,
  style,
  value,
}: MealBucketSelectProps) => {
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (disabled) {
      setExpanded(false);
    }
  }, [disabled]);

  return (
    <View style={[styles.container, style]}>
      <Pressable
        accessibilityLabel={`Add food to ${MEAL_SLOT_LABELS[value]}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <AppText color="secondary" variant="label">
          Add to
        </AppText>
        <AppText style={styles.value} variant="bodySmallStrong">
          {MEAL_SLOT_LABELS[value]}
        </AppText>
        <CaretDownIcon
          color={appColors.textMuted}
          size={16}
          weight="bold"
        />
      </Pressable>

      {expanded ? (
        <View style={styles.menu}>
          {MEAL_SLOTS.map((slot, index) => {
            const selected = slot === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={slot}
                onPress={() => {
                  onChange(slot);
                  setExpanded(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  index < MEAL_SLOTS.length - 1 && styles.optionDivider,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  color={selected ? "primary" : "secondary"}
                  variant={selected ? "bodySmallStrong" : "bodySmall"}
                >
                  {MEAL_SLOT_LABELS[slot]}
                </AppText>
                {selected ? (
                  <CheckIcon
                    color={appColors.actionPrimary}
                    size={16}
                    weight="bold"
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    minWidth: 180,
  },
  trigger: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    borderRadius: appRadius.sm,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: appSpacing.sm,
  },
  value: {
    flex: 1,
  },
  menu: {
    marginTop: appSpacing.xxs,
    borderRadius: appRadius.sm,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.card,
    overflow: "hidden",
  },
  option: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
    paddingHorizontal: appSpacing.sm,
  },
  optionDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  optionSelected: {
    backgroundColor: appColors.actionPrimarySoft,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
});

export default MealBucketSelect;
