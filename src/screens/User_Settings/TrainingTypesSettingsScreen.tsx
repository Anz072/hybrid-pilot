import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BarbellIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TrainingType } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppText, NumericText, OptionCard } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
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
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing training settings.
            </AppText>
          </AppCard>
        ) : (
          <>
            <AppCard style={styles.card}>
              <View style={styles.summaryRow}>
                <View>
                  <AppText variant="cardTitle">Current profile</AppText>
                  <AppText color="secondary" variant="bodySmall">
                    {formatTrainingSummary(user.trainingTypes)}
                  </AppText>
                </View>
                <View style={styles.metricPill}>
                  <BarbellIcon
                    size={16}
                    color={appColors.brand700}
                    weight="fill"
                  />
                  <NumericText color="coral" variant="numberTrendDelta">
                    {selectedTraining.length} selected
                  </NumericText>
                </View>
              </View>

              <View style={styles.optionStack}>
                {TRAINING_TYPE_OPTIONS.map((option) => {
                  const selected = selectedTraining.includes(option.value);

                  return (
                    <OptionCard
                      key={option.value}
                      onPress={() => toggleTraining(option.value)}
                      selected={selected}
                      subtitle={option.description}
                      title={option.label}
                    />
                  );
                })}
              </View>

              <AppButton
                onPress={() => void handleSave()}
                disabled={saving}
                label={saving ? "Saving..." : "Save training mix"}
                style={styles.saveButton}
              />
            </AppCard>
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
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xxs,
    borderRadius: 999,
    backgroundColor: appColors.actionPrimarySoft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  optionStack: {
    gap: appSpacing.xs,
  },
  saveButton: {
    marginTop: appSpacing.md,
  },
});

export default TrainingTypesSettingsScreen;
