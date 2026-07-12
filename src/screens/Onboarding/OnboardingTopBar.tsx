import React from "react";
import { StyleSheet, View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";
import { AppText, IconButton } from "../../components/ui";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing, appSurfaces } from "../../theme/tokens";

type OnboardingTopBarProps = {
  onBack?: () => void;
  progress?: number;
  stepLabel?: string;
};

const OnboardingTopBar = ({
  onBack,
  progress,
  stepLabel,
}: OnboardingTopBarProps) => {
  const clampedProgress =
    typeof progress === "number" ? Math.min(1, Math.max(0, progress)) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <IconButton accessibilityLabel="Go back" onPress={onBack}>
            <ArrowLeftIcon size={20} color={appColors.textPrimary} weight="bold" />
          </IconButton>
        ) : (
          <View style={styles.placeholder} />
        )}
        {stepLabel ? (
          <AppText color="secondary" variant="eyebrow">
            {stepLabel}
          </AppText>
        ) : null}
      </View>
      {clampedProgress !== null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            max: 100,
            min: 0,
            now: Math.round(clampedProgress * 100),
          }}
          style={styles.progressTrack}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(clampedProgress * 100)}%` },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: appSpacing.sm,
    marginBottom: appSpacing.xl,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.md,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  progressTrack: {
    height: 6,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.soft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: appRadius.pill,
    backgroundColor: appColors.actionPrimary,
  },
});

export default OnboardingTopBar;
