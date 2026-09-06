import { useReducedMotion } from "../../theme/useReducedMotion";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";
import { AppText } from "./AppText";
import { IconButton } from "./AppButton";
import { appColors } from "../../theme/colors";
import { appSurfaces } from "../../theme/tokens";

export const AppSheet = ({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.header}>
            <AppText variant="cardTitle" style={styles.title}>
              {title}
            </AppText>
            <IconButton
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.close}
            >
              <XIcon size={20} color={appColors.textPrimary} />
            </IconButton>
          </View>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: appColors.surfaceOverlay,
  },
  sheet: {
    maxHeight: "85%",
    paddingHorizontal: 16,
    backgroundColor: appSurfaces.canvas,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  title: { flex: 1 },
  close: { backgroundColor: "transparent", borderWidth: 0 },
});
