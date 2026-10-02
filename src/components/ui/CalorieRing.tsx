import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { FlameIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import { AppText, NumericText } from "./AppText";
import { getProgressRingState } from "./progressRingModel";

export const CalorieRing = ({ consumed, target }: { consumed: number; target: number | null }) => {
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const state = getProgressRingState(consumed, target);
  const value = Math.round(state.value).toLocaleString();
  const targetLabel = state.target == null ? "Set a calorie target" : `of ${Math.round(state.target).toLocaleString()} kcal`;
  const remainingLabel = state.remaining == null ? null : `${Math.abs(state.remaining).toLocaleString()} kcal ${state.remaining < 0 ? "over" : "left"}`;
  const diameter = 216;
  const stroke = 14;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const numbers = (
    <View style={styles.numbers}>
      <NumericText variant="numberDisplay" align="center">{value}</NumericText>
      <AppText variant="bodySmall" color="secondary" align="center">{targetLabel}</AppText>
    </View>
  );

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Calories consumed today"
      accessibilityValue={{ text: `${value} kcal consumed, ${targetLabel}${remainingLabel ? `, ${remainingLabel}` : ""}` }}
      style={styles.hero}
    >
      <View style={styles.ring}>
        <Svg width={diameter} height={diameter} accessible={false}>
          <Circle cx={108} cy={108} r={radius} fill={appColors.surfaceCard} stroke={appColors.actionPrimarySoft} strokeWidth={stroke} />
          {state.progress > 0 ? (
            <Circle cx={108} cy={108} r={radius} fill="none" stroke={appColors.accent} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - state.progress)} rotation={-90} origin="108, 108" />
          ) : null}
        </Svg>
        <View pointerEvents="none" style={styles.center}>
          <FlameIcon color={appColors.accent} size={largeText ? 40 : 24} weight="regular" />
          {!largeText ? numbers : null}
        </View>
      </View>
      {largeText ? numbers : null}
      {remainingLabel ? <AppText variant="bodySmallStrong" color="secondary" align="center">{remainingLabel}</AppText> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: appSpacing.sm, paddingVertical: appSpacing.xl },
  ring: { width: 216, height: 216 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: appSpacing.xs, padding: appSpacing.xl },
  numbers: { alignItems: "center", gap: appSpacing.xxs, maxWidth: "100%" },
});
