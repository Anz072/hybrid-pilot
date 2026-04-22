import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MinusIcon, PlusIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildEffectiveCalorieTargetsForDates,
  CALORIE_TARGET_STEP,
  clampCalorieTarget,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import CalorieBudgetChart from "./CalorieBudgetChart";
import SettingsStackHeader from "./SettingsStackHeader";
import {
  buildAutomaticFuelPlanSnapshot,
  saveAutomaticFuelPlanForUser,
  saveManualCalorieTarget,
} from "./userSettingsActions";

type Props = NativeStackScreenProps<
  MoreParamList,
  "CalorieAllowanceSettingsScreen"
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

const CalorieAllowanceSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [inputValue, setInputValue] = React.useState(
    user?.calorieAllowance != null ? String(user.calorieAllowance) : "",
  );
  const [saving, setSaving] = React.useState(false);
  const [autoPlanCalories, setAutoPlanCalories] = React.useState<number | null>(
    null,
  );
  const [settings, setSettings] = React.useState<Awaited<
    ReturnType<typeof DB.getUserSettings>
  > | null>(null);

  React.useEffect(() => {
    setInputValue(user?.calorieAllowance != null ? String(user.calorieAllowance) : "");
  }, [user?.calorieAllowance]);

  const loadContext = React.useCallback(async () => {
    if (!user) {
      return;
    }

    const [nextSettings, nextAutoPlan] = await Promise.all([
      DB.getUserSettings(user.externalId),
      buildAutomaticFuelPlanSnapshot(user),
    ]);

    setSettings(nextSettings);
    setAutoPlanCalories(nextAutoPlan?.calories ?? null);
  }, [user]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const parsedInput = Number.parseInt(inputValue, 10);
  const previewCalories =
    Number.isFinite(parsedInput) && parsedInput > 0
      ? clampCalorieTarget(parsedInput)
      : user?.calorieAllowance ?? null;
  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);
  const weeklyValues = React.useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: weekDates,
        baseCalories: previewCalories,
        settings,
      }),
    [previewCalories, settings, weekDates],
  );
  const weeklyBudget = React.useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: weekDates,
        baseCalories: previewCalories,
        settings,
      }),
    [previewCalories, settings, weekDates],
  );

  const applyInputDelta = (delta: number) => {
    const nextValue = clampCalorieTarget((previewCalories ?? 2000) + delta);
    setInputValue(String(nextValue));
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    const nextCalories = Number.parseInt(inputValue, 10);
    if (!Number.isFinite(nextCalories) || nextCalories <= 0) {
      Alert.alert("Invalid calorie target", "Enter a valid daily calorie target.");
      return;
    }

    setSaving(true);

    try {
      const savedUser = await saveManualCalorieTarget({
        calories: clampCalorieTarget(nextCalories),
        dispatch,
        user,
      });
      const nextAutoPlan = await buildAutomaticFuelPlanSnapshot(savedUser);
      setAutoPlanCalories(nextAutoPlan?.calories ?? null);
      setInputValue(String(savedUser.calorieAllowance ?? clampCalorieTarget(nextCalories)));
    } catch {
      Alert.alert("Could not save calories", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAutomatic = async () => {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      const savedUser = await saveAutomaticFuelPlanForUser({
        dispatch,
        user,
      });

      if (!savedUser) {
        Alert.alert(
          "Could not build automatic target",
          "Make sure you have a valid birthdate, height, goal, activity level, and at least one logged body weight.",
        );
        return;
      }

      const nextAutoPlan = await buildAutomaticFuelPlanSnapshot(savedUser);
      setAutoPlanCalories(nextAutoPlan?.calories ?? savedUser.calorieAllowance ?? null);
      setInputValue(savedUser.calorieAllowance != null ? String(savedUser.calorieAllowance) : "");
    } catch {
      Alert.alert("Could not reset calories", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <KeyboardAwareScrollView
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
          subtitle="Change the base daily energy target. Day-specific overrides stay on top of this value."
          title="Calorie Allowance"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Load a local account first before editing nutrition settings.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily target</Text>
              <Text style={styles.cardText}>
                Manual changes also rescale your macro targets to stay aligned with the new calorie budget.
              </Text>

              <View style={styles.inputRow}>
                <Pressable
                  onPress={() => applyInputDelta(-CALORIE_TARGET_STEP)}
                  style={({ pressed }) => [
                    styles.adjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                >
                  <MinusIcon
                    size={18}
                    color={appColors.foodPrimaryDark}
                    weight="bold"
                  />
                </Pressable>

                <View style={styles.inputCard}>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setInputValue}
                    style={styles.input}
                    value={inputValue}
                  />
                  <Text style={styles.inputUnit}>kcal / day</Text>
                </View>

                <Pressable
                  onPress={() => applyInputDelta(CALORIE_TARGET_STEP)}
                  style={({ pressed }) => [
                    styles.adjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                >
                  <PlusIcon
                    size={18}
                    color={appColors.foodPrimaryDark}
                    weight="bold"
                  />
                </Pressable>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Current base</Text>
                  <Text style={styles.statValue}>
                    {user.calorieAllowance != null
                      ? `${user.calorieAllowance} kcal`
                      : "--"}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Automatic target</Text>
                  <Text style={styles.statValue}>
                    {autoPlanCalories != null ? `${autoPlanCalories} kcal` : "--"}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleSave()}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !saving && styles.adjustButtonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? "Saving..." : "Save manual target"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleResetAutomatic()}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && !saving && styles.adjustButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Use automatic</Text>
                </Pressable>
              </View>
            </View>

            <CalorieBudgetChart
              highlightDate={new Date()}
              subtitle={
                weeklyBudget != null
                  ? `Weekly budget: ${Math.round(weeklyBudget)} kcal`
                  : "Weekly budget preview"
              }
              title="Weekly preview"
              values={weeklyValues}
            />
          </>
        )}
      </KeyboardAwareScrollView>
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
    top: -78,
    right: -54,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    left: -68,
    bottom: -94,
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
  inputRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adjustButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate200,
  },
  adjustButtonPressed: {
    opacity: 0.9,
  },
  inputCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    color: appColors.white,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    padding: 0,
  },
  inputUnit: {
    marginTop: 6,
    color: appColors.slate500,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    padding: 14,
  },
  statLabel: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statValue: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  actionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: appColors.foodPrimaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
});

export default CalorieAllowanceSettingsScreen;
