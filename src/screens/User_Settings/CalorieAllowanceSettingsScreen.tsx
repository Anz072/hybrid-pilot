import React from "react";
import {
  Alert,
  StyleSheet,
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
import { AppButton, AppCard, AppText, ErrorState, IconButton, LoadingState, NumericText } from "../../components/ui";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import { appTypography } from "../../theme/typography";
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
  const [contextLoading, setContextLoading] = React.useState(true);
  const [contextError, setContextError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setInputValue(user?.calorieAllowance != null ? String(user.calorieAllowance) : "");
  }, [user?.calorieAllowance]);

  const loadContext = React.useCallback(async () => {
    if (!user) {
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    setContextError(null);

    try {
      const [nextSettings, nextAutoPlan] = await Promise.all([
        DB.getUserSettings(user.externalId),
        buildAutomaticFuelPlanSnapshot(user),
      ]);

      setSettings(nextSettings);
      setAutoPlanCalories(nextAutoPlan?.calories ?? null);
    } catch {
      setContextError("Could not build the calorie preview. Check your connection and try again.");
    } finally {
      setContextLoading(false);
    }
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
      navigation.navigate("MoreMainScreen");
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
      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not reset calories", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
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
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing nutrition settings.
            </AppText>
          </AppCard>
        ) : (
          <>
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">Daily target</AppText>
              <AppText color="secondary" variant="bodySmall">
                Manual changes also rescale your macro targets to stay aligned with the new calorie budget.
              </AppText>

              <View style={styles.inputRow}>
                <IconButton
                  accessibilityLabel="Decrease calorie target"
                  onPress={() => applyInputDelta(-CALORIE_TARGET_STEP)}
                >
                  <MinusIcon
                    size={18}
                    color={appColors.brand700}
                    weight="bold"
                  />
                </IconButton>

                <View style={styles.inputCard}>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setInputValue}
                    style={styles.input}
                    value={inputValue}
                  />
                  <AppText color="muted" variant="eyebrow">kcal / day</AppText>
                </View>

                <IconButton
                  accessibilityLabel="Increase calorie target"
                  onPress={() => applyInputDelta(CALORIE_TARGET_STEP)}
                >
                  <PlusIcon
                    size={18}
                    color={appColors.brand700}
                    weight="bold"
                  />
                </IconButton>
              </View>

              {contextError ? (
                <ErrorState
                  title="Could not build preview"
                  message={contextError}
                  action={
                    <AppButton label="Try again" onPress={() => void loadContext()} size="sm" />
                  }
                  style={styles.previewState}
                />
              ) : contextLoading ? (
                <LoadingState
                  title="Building preview"
                  message="Loading your settings and automatic target."
                  style={styles.previewState}
                />
              ) : (
                <View style={styles.statRow}>
                  <AppCard style={styles.statCard} variant="soft">
                    <AppText color="secondary" variant="eyebrow">Current base</AppText>
                    <NumericText variant="numberMacroSummary">
                      {user.calorieAllowance != null
                        ? `${user.calorieAllowance} kcal`
                        : "--"}
                    </NumericText>
                  </AppCard>
                  <AppCard style={styles.statCard} variant="soft">
                    <AppText color="secondary" variant="eyebrow">Automatic target</AppText>
                    <NumericText variant="numberMacroSummary">
                      {autoPlanCalories != null ? `${autoPlanCalories} kcal` : "--"}
                    </NumericText>
                  </AppCard>
                </View>
              )}

              <View style={styles.actionRow}>
                <AppButton
                  onPress={() => void handleSave()}
                  disabled={saving}
                  label={saving ? "Saving..." : "Save manual target"}
                  style={styles.actionButton}
                />

                <AppButton
                  onPress={() => void handleResetAutomatic()}
                  disabled={saving}
                  label="Use automatic"
                  variant="secondary"
                />
              </View>
            </AppCard>

            {!contextLoading && !contextError ? (
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
            ) : null}
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
    paddingHorizontal: appSpacing.gutter,
  },
  card: {
    marginBottom: appSpacing.md,
  },
  inputRow: {
    marginTop: appSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
  },
  inputCard: {
    flex: 1,
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: "transparent",
    paddingHorizontal: appSpacing.md,
    paddingVertical: appSpacing.sm,
  },
  input: {
    color: appColors.textPrimary,
    padding: 0,
    ...appTypography.numberCalorieHero,
    fontVariant: ["tabular-nums"],
  },
  statRow: {
    marginTop: appSpacing.md,
    flexDirection: "row",
    gap: appSpacing.sm,
  },
  previewState: {
    marginTop: appSpacing.md,
  },
  statCard: {
    flex: 1,
    gap: appSpacing.xs,
  },
  actionRow: {
    marginTop: appSpacing.md,
    flexDirection: "row",
    flex: 1,
    gap: appSpacing.xs,
  },
  actionButton: {
    flex: 1,
  }
});

export default CalorieAllowanceSettingsScreen;
