import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { appColors, type AppColorValue } from "../../theme/colors";
import { appRadius } from "../../theme/tokens";

type ProgressRailProps = {
  /** Fill color once at or under `max`. */
  color?: AppColorValue;
  height?: number;
  /** Fill color once `value` exceeds `max`. */
  overColor?: AppColorValue;
  style?: StyleProp<ViewStyle>;
  value: number;
  max: number;
};

/** The slim progress indicator behind "Daily Signal" — a rail, not a ring or a card. */
export const ProgressRail = ({
  color = appColors.actionPrimary,
  height = 6,
  overColor = appColors.statusWarning,
  style,
  value,
  max,
}: ProgressRailProps) => {
  const ratio = max > 0 ? value / max : 0;
  const isOver = ratio > 1;
  const fillRatio = Math.min(Math.max(ratio, 0), 1);
  // Anything thinner than 6px disappears against the light track.
  const railHeight = Math.max(height, 6);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: Math.min(Math.max(value, 0), max) }}
      style={[
        styles.track,
        { height: railHeight, borderRadius: railHeight / 2 },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${fillRatio * 100}%`,
            height: railHeight,
            borderRadius: railHeight / 2,
            backgroundColor: isOver ? overColor : color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: appColors.surfaceFieldAlt,
    overflow: "hidden",
    borderRadius: appRadius.pill,
  },
  fill: {
    borderRadius: appRadius.pill,
  },
});
