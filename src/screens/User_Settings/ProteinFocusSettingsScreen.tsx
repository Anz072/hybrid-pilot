import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarbellIcon, CheckIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProteinFocus } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import SettingsStackHeader from "./SettingsStackHeader";
import { formatProteinFocusSummary } from "../../engine/proteinFocus";
import { saveProteinFocusForUser } from "./userSettingsActions";
import { PROTEIN_FOCUS_OPTIONS } from "../../engine/proteinFocus";

type Props = NativeStackScreenProps<MoreParamList, "ProteinFocusSettingsScreen">;

const ProteinFocusSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [selectedProteinFocus, setSelectedProteinFocus] =
    React.useState<ProteinFocus>(
      (user?.proteinFocus as ProteinFocus | null) ?? "focused",
    );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setSelectedProteinFocus(
      (user?.proteinFocus as ProteinFocus | null) ?? "focused",
    );
  }, [user?.proteinFocus]);

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      await saveProteinFocusForUser({
        dispatch,
        proteinFocus: selectedProteinFocus,
        user,
      });
      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not save protein focus", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsStackHeader
          eyebrow="User Settings"
          onBack={() => navigation.goBack()}
          subtitle="Choose how aggressively your macro targets should bias toward protein."
          title="Protein Focus"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to your account first before editing protein settings.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.cardTitle}>Current focus</Text>
                <Text style={styles.cardText}>
                  {formatProteinFocusSummary(user.proteinFocus)}
                </Text>
              </View>
              <View style={styles.metricPill}>
                <BarbellIcon
                  size={16}
                  color={appColors.brand700}
                  weight="fill"
                />
                <Text style={styles.metricPillText}>
                  {formatProteinFocusSummary(selectedProteinFocus)}
                </Text>
              </View>
            </View>

            <View style={styles.optionStack}>
              {PROTEIN_FOCUS_OPTIONS.map((option) => {
                const selected = selectedProteinFocus === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSelectedProteinFocus(option.value)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      selected && styles.optionCardSelected,
                      pressed && styles.optionCardPressed,
                    ]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>
                        {option.label} ({option.gramsPerKg} g/kg)
                      </Text>
                      <Text style={styles.optionText}>{option.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.checkBadge,
                        selected && styles.checkBadgeSelected,
                      ]}
                    >
                      {selected ? (
                        <CheckIcon size={14} color={appColors.white} weight="bold" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => void handleSave()}
              disabled={saving}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !saving && styles.optionCardPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save protein focus"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -82,
    right: -54,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    left: -74,
    bottom: -88,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.slate200,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    color: appColors.white,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: appColors.white,
    fontSize: 13,
    lineHeight: 18,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 190,
  },
  metricPillText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: appColors.slate100,
  },
  optionCardSelected: {
    borderColor: appColors.brand500,
    backgroundColor: appColors.foodEyebrowBg,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: appColors.white,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  optionText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 18,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate300,
  },
  checkBadgeSelected: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
});

export default ProteinFocusSettingsScreen;
