import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";

type PublicVisibilityCheckboxProps = {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
};

const PublicVisibilityCheckbox = ({
  checked,
  onChange,
}: PublicVisibilityCheckboxProps) => {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="Make this item public"
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.card,
        checked && styles.cardChecked,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? (
          <CheckIcon size={14} color={appColors.white} weight="bold" />
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, checked && styles.titleChecked]}>Make this public</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceField,
    padding: 16,
  },
  cardChecked: {
    borderColor: appColors.brand500,
    backgroundColor: appColors.brand800,
  },
  cardPressed: {
    opacity: 0.9,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceCardAlt,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: appColors.brand500,
    backgroundColor: appColors.brand500,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  titleChecked:{
    color: appColors.slate100
  },
});

export default PublicVisibilityCheckbox;
