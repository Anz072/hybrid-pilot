import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldCheckIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";

const LoginScreen = () => {
  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={styles.card}>
        <View style={styles.badge}>
          <ShieldCheckIcon
            size={18}
            color={appColors.revolutDark}
            weight="fill"
          />
        </View>
        <Text style={styles.eyebrow}>Hybrid Pilot</Text>
        <Text style={styles.title}>Nutrition, rebuilt with a darker shell.</Text>
        <Text style={styles.body}>
          Bigger type, pill actions, flatter surfaces, and a calmer neutral
          system are now the default.
        </Text>

        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: appColors.surfaceCanvas,
  },
  orbTop: {
    position: "absolute",
    top: -70,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    bottom: -110,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 24,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.revolutLight,
    marginBottom: 16,
  },
  eyebrow: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 10,
  },
  title: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    marginBottom: 10,
  },
  body: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 22,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonText: {
    ...appTypography.button,
    color: appColors.revolutDark,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default LoginScreen;
