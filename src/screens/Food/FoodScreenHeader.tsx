import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";

type FoodScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

const FoodScreenHeader = ({
  eyebrow,
  title,
  subtitle,
  onBack,
}: FoodScreenHeaderProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <ArrowLeftIcon size={16} color={appColors.textPrimary} weight="bold" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceGhost,
    borderColor: appColors.surfaceGhostStrong,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backText: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.label,
    color: appColors.textSecondary,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 12,
  },
  title: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...appTypography.body,
    color: appColors.textSecondary,
  },
});

export default FoodScreenHeader;

