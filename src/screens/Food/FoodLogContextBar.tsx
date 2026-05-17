import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CalendarIcon,
  ClockIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
} from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { sharedStyleValues } from "../../theme/sharedStyles";
import type { FoodLogContext } from "./foodLogContext";

type FoodLogContextBarProps = {
  context: FoodLogContext;
  onTimePress?: () => void;
};

const FoodLogContextBar = ({ context, onTimePress }: FoodLogContextBarProps) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <CalendarIcon size={15} color={appColors.brand500} weight="bold" />
        <Text style={styles.pillText}>{context.dateLabel}</Text>
      </View>
      {onTimePress ? (
        <Pressable
          onPress={onTimePress}
          style={({ pressed }) => [
            styles.pill,
            styles.pressablePill,
            pressed && styles.pressed,
          ]}
        >
          <ClockIcon size={15} color={appColors.brand500} weight="bold" />
          <Text style={styles.pillText}>{context.contextLabel}</Text>
          <PencilSimpleIcon size={15} color={appColors.slate900} />
        </Pressable>
      ) : (
        <View style={styles.pill}>
          <ClockIcon size={15} color={appColors.brand500} weight="bold" />
          <Text style={styles.pillText}>{context.contextLabel}</Text>
        </View>
      )}
      {context.mealType ? (
        <View style={styles.pill}>
          <ForkKnifeIcon size={15} color={appColors.brand500} weight="bold" />
          <Text style={styles.pillText}>{context.mealType}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    ...sharedStyleValues.pill,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  pressablePill: {
    backgroundColor: appColors.surfaceCard,
  },
  pillText: sharedStyleValues.pillText,
  pressed: sharedStyleValues.pressed,
});

export default FoodLogContextBar;
