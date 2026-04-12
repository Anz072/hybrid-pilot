import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";

type SettingsStackHeaderProps = {
  eyebrow?: string;
  onBack: () => void;
  subtitle?: string;
  title: string;
};

const SettingsStackHeader = ({
  eyebrow,
  onBack,
  subtitle,
  title,
}: SettingsStackHeaderProps) => {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
      >
        <CaretLeftIcon size={18} color={appColors.textPrimary} weight="bold" />
      </Pressable>

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 18,
  },
  backButtonPressed: {
    opacity: 0.9,
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

export default SettingsStackHeader;
