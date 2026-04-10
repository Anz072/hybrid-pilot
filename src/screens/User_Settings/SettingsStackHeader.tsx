import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";

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
        <CaretLeftIcon size={18} color={appColors.slate900} weight="bold" />
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
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate200,
    marginBottom: 18,
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  eyebrow: {
    alignSelf: "flex-start",
    color: appColors.foodPrimaryDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    color: appColors.slate900,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: appColors.slate600,
    fontSize: 15,
    lineHeight: 22,
  },
});

export default SettingsStackHeader;
