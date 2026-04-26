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
import type { TrainingType } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import SettingsStackHeader from "./SettingsStackHeader";
import { formatTrainingSummary, TRAINING_TYPE_OPTIONS } from "./userProfileOptions";
import { saveUserProfileChanges } from "./userSettingsActions";

type Props = NativeStackScreenProps<MoreParamList, "TrainingTypesSettingsScreen">;

const TrainingTypesSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [selectedTraining, setSelectedTraining] = React.useState<TrainingType[]>(
    (user?.trainingTypes as TrainingType[] | null) ?? [],
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setSelectedTraining((user?.trainingTypes as TrainingType[] | null) ?? []);
  }, [user?.trainingTypes]);

  const toggleTraining = (value: TrainingType) => {
    setSelectedTraining((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      await saveUserProfileChanges({
        dispatch,
        user,
        patch: {
          trainingTypes: selectedTraining,
        },
      });
      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not save training", "Please try again.");
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
          subtitle="Choose the training modes that best match your current week. You can select multiple."
          title="Training Types"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to your account first before editing training settings.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.cardTitle}>Current profile</Text>
                  <Text style={styles.cardText}>
                    {formatTrainingSummary(user.trainingTypes)}
                  </Text>
                </View>
                <View style={styles.metricPill}>
                  <BarbellIcon
                    size={16}
                    color={appColors.brand700}
                    weight="fill"
                  />
                  <Text style={styles.metricPillText}>
                    {selectedTraining.length} selected
                  </Text>
                </View>
              </View>

              <View style={styles.optionStack}>
                {TRAINING_TYPE_OPTIONS.map((option) => {
                  const selected = selectedTraining.includes(option.value);

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => toggleTraining(option.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.label}</Text>
                        <Text style={[styles.optionText, selected && styles.optionTitleSelected]}>{option.description}</Text>
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
                  {saving ? "Saving..." : "Save training mix"}
                </Text>
              </Pressable>
            </View>
          </>
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
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    left: -74,
    bottom: -88,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.success700,
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
    color: appColors.slate800,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: appColors.slate800,
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
  },
  metricPillText: {
    color: appColors.slate800,
    fontSize: 12,
    fontWeight: "800",
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: appColors.slate100,
  },
  optionCardSelected: {
    borderColor: appColors.brand500,
    backgroundColor: appColors.brand800,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: appColors.slate800,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  optionText: {
    color: appColors.slate600,
    fontSize: 13,
    lineHeight: 18,
  },
  optionTitleSelected: {
    color: appColors.white,
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

export default TrainingTypesSettingsScreen;

