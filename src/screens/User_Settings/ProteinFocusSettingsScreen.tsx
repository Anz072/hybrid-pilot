import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProteinFocus } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppText, NumericText, OptionCard } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
import SettingsStackHeader from "./SettingsStackHeader";
import { formatProteinFocusSummary } from "../../engine/proteinFocus";
import { saveProteinFocusForUser } from "./userSettingsActions";
import { PROTEIN_FOCUS_OPTIONS } from "../../engine/proteinFocus";

type Props = NativeStackScreenProps<
  MoreParamList,
  "ProteinFocusSettingsScreen"
>;

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
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing protein settings.
            </AppText>
          </AppCard>
        ) : (
          <AppCard style={styles.card}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCopy}>
                <AppText variant="cardTitle">Current focus</AppText>
                <AppText color="secondary" variant="bodySmall">
                  {formatProteinFocusSummary(user.proteinFocus)}
                </AppText>
              </View>
              <NumericText
                align="right"
                numberOfLines={2}
                style={styles.metricValue}
                variant="numberTrendDelta"
              >
                {formatProteinFocusSummary(selectedProteinFocus)}
              </NumericText>
            </View>

            <View style={styles.optionStack}>
              {PROTEIN_FOCUS_OPTIONS.map((option) => {
                const selected = selectedProteinFocus === option.value;

                return (
                  <OptionCard
                    key={option.value}
                    onPress={() => setSelectedProteinFocus(option.value)}
                    selected={selected}
                    subtitle={option.description}
                    title={`${option.label} (${option.gramsPerKg} g/kg)`}
                  />
                );
              })}
            </View>

            <AppButton
              onPress={() => void handleSave()}
              disabled={saving}
              label={saving ? "Saving..." : "Save protein focus"}
              style={styles.saveButton}
            />
          </AppCard>
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
    paddingHorizontal: appSpacing.gutter,
  },
  card: {
    marginBottom: appSpacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricValue: {
    flexShrink: 1,
    maxWidth: "42%",
  },
  optionStack: {
    gap: appSpacing.xs,
  },
  saveButton: {
    marginTop: appSpacing.md,
  },
});

export default ProteinFocusSettingsScreen;
