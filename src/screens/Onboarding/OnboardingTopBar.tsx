import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";

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
          <ArrowLeftIcon size={16} color="#0F172A" weight="bold" />
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  backText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  stepLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});

export default OnboardingTopBar;
