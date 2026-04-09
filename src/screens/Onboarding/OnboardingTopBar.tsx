import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";

type OnboardingTopBarProps = {
  onBack?: () => void;
  stepLabel?: string;
};

const OnboardingTopBar = ({
  onBack,
  stepLabel,
}: OnboardingTopBarProps) => {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <ArrowLeftIcon size={16} color={appColors.slate900} weight="bold" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : (
        <View />
      )}
      {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate300,
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  backText: {
    color: appColors.slate900,
    fontSize: 13,
    fontWeight: "800",
  },
  stepLabel: {
    color: appColors.slate500,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});

export default OnboardingTopBar;
