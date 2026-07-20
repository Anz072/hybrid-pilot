import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { GaugeIcon, TargetIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildAutomaticFuelPlanForUser,
  buildEffectiveCalorieTargetsForDates,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import {
  formatGoalStrategyMeta,
  resolveGoalStrategy,
} from "../../engine/goalStrategy";
import type { ActivityLevel, GoalType } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppText, ErrorState, LoadingState, NumericText, OptionCard } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
import CalorieBudgetChart from "./CalorieBudgetChart";
import SettingsStackHeader from "./SettingsStackHeader";
import {
  ACTIVITY_LEVEL_OPTIONS,
  formatActivityLevelLabel,
  formatGoalLabel,
  GOAL_OPTIONS,
} from "./userProfileOptions";
import {
  getLatestUserWeightKg,
  saveAutomaticFuelPlanForUser,
} from "./userSettingsActions";

type Props = NativeStackScreenProps<MoreParamList, "AdjustGoalSettingsScreen">;

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

const ActivityLevelSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [selectedActivity, setSelectedActivity] =
    React.useState<ActivityLevel | null>(
      (user?.activityLevel as ActivityLevel | null) ?? null,
    );
  const [selectedGoal, setSelectedGoal] = React.useState<GoalType | null>(
    (user?.goal as GoalType | null) ?? null,
  );
  const [latestWeightKg, setLatestWeightKg] = React.useState<number | null>(
    null,
  );
  const [settings, setSettings] = React.useState<Awaited<
    ReturnType<typeof DB.getUserSettings>
  > | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [contextLoading, setContextLoading] = React.useState(true);
  const [contextError, setContextError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedActivity((user?.activityLevel as ActivityLevel | null) ?? null);
    setSelectedGoal((user?.goal as GoalType | null) ?? null);
  }, [user?.activityLevel, user?.goal]);

  const loadContext = React.useCallback(async () => {
    if (!user) {
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    setContextError(null);

    try {
      const [nextWeightKg, nextSettings] = await Promise.all([
        getLatestUserWeightKg(user.externalId),
        DB.getUserSettings(user.externalId),
      ]);

      setLatestWeightKg(nextWeightKg);
      setSettings(nextSettings);
    } catch {
      setContextError("Could not build the goal preview. Check your connection and try again.");
    } finally {
      setContextLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const previewPlan = React.useMemo(() => {
    if (!user || !selectedActivity || !selectedGoal || latestWeightKg == null) {
      return null;
    }

    return buildAutomaticFuelPlanForUser({
      user: {
        ...user,
        activityLevel: selectedActivity,
        goal: selectedGoal,
      },
      weightKg: latestWeightKg,
    });
  }, [latestWeightKg, selectedActivity, selectedGoal, user]);

  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);
  const weeklyValues = React.useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: weekDates,
        baseCalories: previewPlan?.calories ?? user?.calorieAllowance ?? null,
        settings,
      }),
    [previewPlan?.calories, settings, user?.calorieAllowance, weekDates],
  );
  const weeklyBudget = React.useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: weekDates,
        baseCalories: previewPlan?.calories ?? user?.calorieAllowance ?? null,
        settings,
      }),
    [previewPlan?.calories, settings, user?.calorieAllowance, weekDates],
  );

  const handleSave = async () => {
    if (!user || !selectedActivity || !selectedGoal) {
      return;
    }

    setSaving(true);

    try {
      const savedUser = await saveAutomaticFuelPlanForUser({
        activityLevel: selectedActivity,
        dispatch,
        goal: selectedGoal,
        user,
      });

      if (!savedUser) {
        Alert.alert(
          "Could not update goal",
          "Make sure you have a valid birthdate, height, goal, activity level, and at least one logged body weight.",
        );
        return;
      }

      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not update goal", "Please try again.");
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
          subtitle="Adjust the body-change goal and the activity baseline together. Deficit or surplus intensity is managed separately in Goal strategy. Saving rebuilds your automatic fuel plan from the latest logged body weight."
          title="Adjust Goal"
        />

        {!user ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing your goal settings.
            </AppText>
          </AppCard>
        ) : (
          <>
            <AppCard style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCopy}>
                  <AppText variant="cardTitle">Current plan</AppText>
                  <AppText color="secondary" variant="bodySmall">
                    {formatGoalLabel(user.goal)} /{" "}
                    {formatGoalStrategyMeta(
                      user.goal,
                      resolveGoalStrategy(user.goal, user.goalStrategy),
                    )}{" "}
                    / {formatActivityLevelLabel(user.activityLevel)}
                  </AppText>
                </View>
                <NumericText
                  align="right"
                  numberOfLines={1}
                  style={styles.metricValue}
                  variant="numberTrendDelta"
                >
                  {contextLoading ? "..." : previewPlan?.calories ?? user.calorieAllowance ?? "--"}{" "}
                  kcal
                </NumericText>
              </View>

              <View style={styles.previewGrid}>
                <AppCard style={styles.previewStat} variant="soft">
                  <AppText color="secondary" variant="eyebrow">Goal</AppText>
                  <AppText variant="bodySmallStrong">
                    {formatGoalLabel(selectedGoal)}
                  </AppText>
                </AppCard>
                <AppCard style={styles.previewStat} variant="soft">
                  <AppText color="secondary" variant="eyebrow">Activity</AppText>
                  <AppText variant="bodySmallStrong">
                    {formatActivityLevelLabel(selectedActivity)}
                  </AppText>
                </AppCard>
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <TargetIcon
                  size={18}
                  color={appColors.brand700}
                  weight="fill"
                />
                <AppText variant="cardTitle">Goal</AppText>
              </View>

              <View style={styles.optionStack}>
                {GOAL_OPTIONS.map((option) => {
                  const selected = selectedGoal === option.value;
                  const optionPlan =
                    user && latestWeightKg != null && selectedActivity
                      ? buildAutomaticFuelPlanForUser({
                          user: {
                            ...user,
                            activityLevel: selectedActivity,
                            goal: option.value,
                          },
                          weightKg: latestWeightKg,
                        })
                      : null;

                  return (
                    <OptionCard
                      key={option.value}
                      onPress={() => setSelectedGoal(option.value)}
                      selected={selected}
                      subtitle={option.description}
                      title={option.label}
                      trailing={
                        <NumericText color="coral" variant="numberTrendDelta">
                          {contextLoading ? "..." : optionPlan?.calories ?? "--"} kcal
                        </NumericText>
                      }
                    />
                  );
                })}
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <GaugeIcon size={18} color={appColors.brand700} weight="fill" />
                <AppText variant="cardTitle">Activity baseline</AppText>
              </View>

              <View style={styles.optionStack}>
                {ACTIVITY_LEVEL_OPTIONS.map((option) => {
                  const selected = selectedActivity === option.value;
                  const optionPlan =
                    user && latestWeightKg != null && selectedGoal
                      ? buildAutomaticFuelPlanForUser({
                          user: {
                            ...user,
                            activityLevel: option.value,
                            goal: selectedGoal,
                          },
                          weightKg: latestWeightKg,
                        })
                      : null;

                  return (
                    <OptionCard
                      key={option.value}
                      onPress={() => setSelectedActivity(option.value)}
                      selected={selected}
                      subtitle={option.description}
                      title={option.label}
                      trailing={
                        <NumericText color="coral" variant="numberTrendDelta">
                          {contextLoading ? "..." : optionPlan?.calories ?? "--"} kcal
                        </NumericText>
                      }
                    />
                  );
                })}
              </View>

              <AppButton
                onPress={() => void handleSave()}
                disabled={saving || !selectedActivity || !selectedGoal}
                label={saving ? "Saving..." : "Save goal + activity"}
                style={styles.saveButton}
              />
            </AppCard>

            {contextError ? (
              <ErrorState
                title="Could not build preview"
                message={contextError}
                action={
                  <AppButton label="Try again" onPress={() => void loadContext()} size="sm" />
                }
                style={styles.card}
              />
            ) : contextLoading ? (
              <LoadingState
                title="Building preview"
                message="Loading your latest weight and settings."
                style={styles.card}
              />
            ) : (
              <CalorieBudgetChart
                highlightDate={new Date()}
                subtitle={
                  weeklyBudget != null
                    ? `Projected weekly budget: ${Math.round(weeklyBudget)} kcal`
                    : "Projected weekly budget"
                }
                title="Automatic plan preview"
                values={weeklyValues}
              />
            )}
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
  summaryCopy: {
    flex: 1,
  },
  metricValue: {
    flexShrink: 0,
  },
  previewGrid: {
    flexDirection: "row",
    gap: appSpacing.sm,
  },
  previewStat: {
    flex: 1,
    gap: appSpacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    marginBottom: appSpacing.md,
  },
  optionStack: {
    gap: appSpacing.xs,
  },
  saveButton: {
    marginTop: appSpacing.md,
  },
});

export default ActivityLevelSettingsScreen;
