import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MinusIcon, PlusIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { formatFoodHourLabel } from "../Food/foodUtils";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import {
  DEFAULT_FOOD_DIARY_END_HOUR,
  DEFAULT_FOOD_DIARY_START_HOUR,
} from "../../store/userSettingsRepository";
import { appColors } from "../../theme/colors";
import SettingsStackHeader from "./SettingsStackHeader";

type Props = NativeStackScreenProps<MoreParamList, "DiaryHoursDebugScreen">;

const normalizeVisibleHours = (startHour: number, endHour: number) => {
  const boundedEnd = Math.max(1, Math.min(23, Math.round(endHour)));
  const boundedStart = Math.max(
    0,
    Math.min(Math.round(startHour), boundedEnd - 1),
  );

  return {
    startHour: boundedStart,
    endHour: boundedEnd,
  };
};

const DiaryHoursDebugScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [startHour, setStartHour] = React.useState(DEFAULT_FOOD_DIARY_START_HOUR);
  const [endHour, setEndHour] = React.useState(DEFAULT_FOOD_DIARY_END_HOUR);
  const [message, setMessage] = React.useState("Saved automatically.");

  const loadSettings = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const settings = await DB.getUserSettings(user.externalId);
      setStartHour(settings?.foodDiaryStartHour ?? DEFAULT_FOOD_DIARY_START_HOUR);
      setEndHour(settings?.foodDiaryEndHour ?? DEFAULT_FOOD_DIARY_END_HOUR);
      setMessage("Saved automatically.");
    } catch {
      setMessage("Could not load saved diary hours.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveHours = React.useCallback(
    async (nextStartHour: number, nextEndHour: number) => {
      if (!user) {
        return;
      }

      const normalized = normalizeVisibleHours(nextStartHour, nextEndHour);
      setStartHour(normalized.startHour);
      setEndHour(normalized.endHour);
      setSaving(true);
      setMessage("Saving...");

      try {
        await DB.saveUserSettings({
          userExternalId: user.externalId,
          foodDiaryStartHour: normalized.startHour,
          foodDiaryEndHour: normalized.endHour,
        });
        setMessage("Saved automatically.");
      } catch {
        setMessage("Could not save diary hours.");
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

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
          eyebrow="Debug Menu"
          onBack={() => navigation.goBack()}
          subtitle="This controls the visible timeline range inside Food Diary and now lives here instead of inside the diary screen."
          title="Diary Timeline Hours"
        />

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={appColors.brand500} />
          </View>
        ) : !user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Create or load a local profile first before editing diary hours.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.cardTitle}>Visible Range</Text>
                  <Text style={styles.cardText}>
                    The timeline will open between these hours each time.
                  </Text>
                </View>
              </View>

              <View style={styles.rangeRow}>
                <View style={styles.rangeCard}>
                  <Text style={styles.rangeLabel}>From</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => void saveHours(startHour - 1, endHour)}
                      disabled={startHour <= 0 || saving}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        (startHour <= 0 || saving) && styles.stepperButtonDisabled,
                        pressed &&
                          startHour > 0 &&
                          !saving &&
                          styles.stepperButtonPressed,
                      ]}
                    >
                      <MinusIcon
                        size={16}
                        color={appColors.brand700}
                        weight="bold"
                      />
                    </Pressable>
                    <Text style={styles.rangeValue}>
                      {formatFoodHourLabel(startHour)}
                    </Text>
                    <Pressable
                      onPress={() => void saveHours(startHour + 1, endHour)}
                      disabled={startHour >= endHour - 1 || saving}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        (startHour >= endHour - 1 || saving) &&
                          styles.stepperButtonDisabled,
                        pressed &&
                          startHour < endHour - 1 &&
                          !saving &&
                          styles.stepperButtonPressed,
                      ]}
                    >
                      <PlusIcon
                        size={16}
                        color={appColors.brand700}
                        weight="bold"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.rangeCard}>
                  <Text style={styles.rangeLabel}>To</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => void saveHours(startHour, endHour - 1)}
                      disabled={endHour <= startHour + 1 || saving}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        (endHour <= startHour + 1 || saving) &&
                          styles.stepperButtonDisabled,
                        pressed &&
                          endHour > startHour + 1 &&
                          !saving &&
                          styles.stepperButtonPressed,
                      ]}
                    >
                      <MinusIcon
                        size={16}
                        color={appColors.brand700}
                        weight="bold"
                      />
                    </Pressable>
                    <Text style={styles.rangeValue}>
                      {formatFoodHourLabel(endHour)}
                    </Text>
                    <Pressable
                      onPress={() => void saveHours(startHour, endHour + 1)}
                      disabled={endHour >= 23 || saving}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        (endHour >= 23 || saving) && styles.stepperButtonDisabled,
                        pressed &&
                          endHour < 23 &&
                          !saving &&
                          styles.stepperButtonPressed,
                      ]}
                    >
                      <PlusIcon
                        size={16}
                        color={appColors.brand700}
                        weight="bold"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() =>
                  void saveHours(
                    DEFAULT_FOOD_DIARY_START_HOUR,
                    DEFAULT_FOOD_DIARY_END_HOUR,
                  )
                }
                disabled={saving}
                style={({ pressed }) => [
                  styles.resetButton,
                  pressed && !saving && styles.stepperButtonPressed,
                ]}
              >
                <Text style={styles.resetButtonText}>Reset to default</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current setting</Text>
              <Text style={styles.currentValue}>
                {formatFoodHourLabel(startHour)} to {formatFoodHourLabel(endHour)}
              </Text>
              <Text style={styles.helperText}>{message}</Text>
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
    top: -74,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    left: -70,
    bottom: -92,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  loadingCard: {
    borderRadius: 8,
    backgroundColor: appColors.white,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.slate200,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  cardTitle: {
    color: appColors.white,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 19,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 12,
  },
  rangeCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    padding: 14,
  },
  rangeLabel: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonPressed: {
    opacity: 0.9,
  },
  rangeValue: {
    color: appColors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  resetButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  currentValue: {
    color: appColors.brand700,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  helperText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 19,
  },
});

export default DiaryHoursDebugScreen;
