import React from "react";
import {
  Alert,
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
import {
  buildEffectiveCalorieTargetsForDates,
  CALORIE_SCHEDULE_DAY_NAMES,
  CALORIE_TARGET_STEP,
  clampCalorieTarget,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import CalorieBudgetChart from "./CalorieBudgetChart";
import SettingsStackHeader from "./SettingsStackHeader";
import { supersedeOpenAdaptiveRecommendationForUser } from "./adaptiveCaloriesActions";

type Props = NativeStackScreenProps<MoreParamList, "CalorieScheduleScreen">;

const EMPTY_OVERRIDES = Array.from({ length: 7 }, () => null) as Array<
  number | null
>;

const buildCurrentWeekDates = (reference: Date): Date[] => {
  const weekStart = new Date(reference);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return next;
  });
};

const coerceOverrides = (
  value: Array<number | null> | null | undefined,
): Array<number | null> =>
  Array.from({ length: 7 }, (_, index) => value?.[index] ?? null);

const CalorieScheduleScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [overrides, setOverrides] = React.useState<Array<number | null>>(
    EMPTY_OVERRIDES,
  );
  const [saving, setSaving] = React.useState(false);

  const loadSettings = React.useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const settings = await DB.getUserSettings(user.externalId);
      setOverrides(coerceOverrides(settings?.dailyCalorieOverrides));
    } catch {
      setOverrides(EMPTY_OVERRIDES);
    }
  }, [user]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const baseCalories = user?.calorieAllowance ?? null;
  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);
  const previewSettings = React.useMemo(
    () => ({ dailyCalorieOverrides: overrides }),
    [overrides],
  );
  const weeklyValues = React.useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: weekDates,
        baseCalories,
        settings: previewSettings,
      }),
    [baseCalories, previewSettings, weekDates],
  );
  const weeklyBudget = React.useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: weekDates,
        baseCalories,
        settings: previewSettings,
      }),
    [baseCalories, previewSettings, weekDates],
  );

  const setOverrideAtIndex = (index: number, value: number | null) => {
    setOverrides((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const adjustOverride = (index: number, delta: number) => {
    const currentValue = overrides[index] ?? baseCalories ?? 2000;
    setOverrideAtIndex(index, clampCalorieTarget(currentValue + delta));
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      await DB.saveUserSettings({
        userExternalId: user.externalId,
        dailyCalorieOverrides: overrides,
        adaptiveLastCalculatedAt: new Date().toISOString(),
      });
      await supersedeOpenAdaptiveRecommendationForUser(user.externalId);
      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not save schedule", "Please try again.");
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
          onBack={() => navigation.goBack()}
          title="Calorie Schedule"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to your account first before editing the calorie schedule.
            </Text>
          </View>
        ) : (
          <>
            <View style={{marginBottom: 8}}>
              <Text style={styles.cardTitle}>Base daily target</Text>
              <Text style={styles.baseValue}>
                {baseCalories != null ? `${baseCalories} kcal` : "--"}
              </Text>
            </View>

            <CalorieBudgetChart
              highlightDate={new Date()}
              subtitle={
                weeklyBudget != null
                  ? `Weekly budget: ${Math.round(weeklyBudget)} kcal`
                  : "Weekly budget preview"
              }
              title="Weekly budget"
              values={weeklyValues}
            />

            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.cardTitle}>Overrides</Text>
                  <Text style={styles.cardText}>
                    Raise or lower a specific day by 50 kcal
                  </Text>
                </View>
                <Pressable
                  onPress={() => setOverrides(EMPTY_OVERRIDES)}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.clearButtonText}>Clear all</Text>
                </Pressable>
              </View>

              <View style={styles.dayStack}>
                {CALORIE_SCHEDULE_DAY_NAMES.map((dayName, index) => {
                  const override = overrides[index];
                  const effectiveCalories = override ?? baseCalories ?? null;

                  return (
                    <View key={dayName} style={styles.dayCard}>
                      <View style={styles.dayCopy}>
                        <Text style={styles.dayTitle}>{dayName}</Text>
                        <Text style={styles.daySubtitle}>
                          {override != null ? "Override" : "Using base target"}
                        </Text>
                      </View>

                      <View style={styles.dayControls}>
                        <Pressable
                          onPress={() => adjustOverride(index, -CALORIE_TARGET_STEP)}
                          style={({ pressed }) => [
                            styles.adjustButton,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <MinusIcon
                            size={16}
                            color={appColors.brand700}
                            weight="bold"
                          />
                        </Pressable>

                        <View style={styles.dayValueWrap}>
                          <Text style={styles.dayValue}>
                            {effectiveCalories != null
                              ? `${effectiveCalories}`
                              : "--"}
                          </Text>
                          <Text style={styles.dayUnit}>kcal</Text>
                        </View>

                        <Pressable
                          onPress={() => adjustOverride(index, CALORIE_TARGET_STEP)}
                          style={({ pressed }) => [
                            styles.adjustButton,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <PlusIcon
                            size={16}
                            color={appColors.brand700}
                            weight="bold"
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => setOverrideAtIndex(index, null)}
                        style={({ pressed }) => [
                          styles.resetDayButton,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.resetDayButtonText}>Reset day</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !saving && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Saving..." : "Save daily schedule"}
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
    marginTop: 14,
  },
  cardTitle: {
    color: appColors.slate200,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 19,
  },
  baseValue: {
    color: appColors.brand700,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  clearButton: {
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  clearButtonText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  dayStack: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 14,
    gap: 12,
  },
  dayCopy: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  dayTitle: {
    color: appColors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  daySubtitle: {
    color: appColors.slate200,
    fontSize: 12,
    fontWeight: "700",
  },
  dayControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  adjustButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  dayValueWrap: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceRaised,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayValue: {
    color: appColors.white,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  dayUnit: {
    color: appColors.slate200,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  resetDayButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: appColors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  resetDayButtonText: {
    color: appColors.slate700,
    fontSize: 12,
    fontWeight: "800",
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
  buttonPressed: {
    opacity: 0.92,
  },
});

export default CalorieScheduleScreen;

