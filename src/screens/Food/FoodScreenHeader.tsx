import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";

type FoodScreenHeaderProps = {
  eyebrow: string;
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
            <ArrowLeftIcon size={16} color={appColors.foodInk} weight="bold" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: appColors.whiteOverlay90,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  backButtonPressed: {
    opacity: 0.88,
  },
  backText: {
    color: appColors.foodInk,
    fontSize: 13,
    fontWeight: "800",
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.foodPrimary,
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    color: appColors.plum950,
    marginBottom: 6,
  },
  subtitle: {
    color: appColors.foodMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});

export default FoodScreenHeader;
