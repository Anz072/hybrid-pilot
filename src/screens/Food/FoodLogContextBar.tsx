import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PencilSimpleIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appSpacing, appStates } from "../../theme/tokens";
import type { FoodLogContext } from "./foodLogContext";

type FoodLogContextBarProps = {
  context: FoodLogContext;
  onTimePress?: () => void;
};

/** Logging context as one quiet metadata line — passive facts, not badges. */
const FoodLogContextBar = ({ context, onTimePress }: FoodLogContextBarProps) => {
  return (
    <View style={styles.wrap}>
      <Text style={styles.metaText}>{context.dateLabel}</Text>
      {onTimePress ? (
        <>
          <Text style={styles.metaDot}>·</Text>
          <Pressable
            accessibilityLabel={`Change time, currently ${context.timeLabel}`}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onTimePress}
            style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
          >
            <Text style={styles.metaTextStrong}>{context.timeLabel}</Text>
            <PencilSimpleIcon
              size={13}
              color={appColors.textSecondary}
              weight="bold"
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: appSpacing.sm,
  },
  metaText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  metaTextStrong: {
    color: appColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  metaDot: {
    color: appColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
});

export default FoodLogContextBar;
