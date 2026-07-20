import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  FireIcon,
  ShieldCheckIcon,
  TrendUpIcon,
} from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildAutomaticFuelPlanForUser,
  buildEffectiveCalorieTargetsForDates,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import {
  formatGoalStrategyMeta,
  formatSignedCalories,
  getGoalStrategyOption,
  getGoalTypeForStrategy,
  listGoalStrategyOptions,
  resolveGoalStrategy,
} from "../../engine/goalStrategy";
import type { GoalStrategy } from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppText, ErrorState, LoadingState, NumericText, OptionCard } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
import CalorieBudgetChart from "./CalorieBudgetChart";
import SettingsStackHeader from "./SettingsStackHeader";
import { formatGoalLabel, formatGoalStrategyLabel } from "./userProfileOptions";
import {
  getLatestUserWeightKg,
  saveAutomaticFuelPlanForUser,
} from "./userSettingsActions";

type Props = NativeStackScreenProps<
  MoreParamList,
  "GoalStrategySettingsScreen"
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

const GOAL_STRATEGY_SECTIONS = [
  {
    key: "deficit",
    title: "Deficit",
    icon: <FireIcon size={18} color={appColors.danger700} weight="fill" />,
    optionValues: [
      "deficit_light",
      "deficit_normal",
      "deficit_aggressive",
    ] as GoalStrategy[],
  },
  {
    key: "maintain",
    title: "Maintain",
    icon: (
      <ShieldCheckIcon size={18} color={appColors.brand700} weight="fill" />
    ),
    optionValues: ["maintain"] as GoalStrategy[],
  },
  {
    key: "surplus",
    title: "Surplus",
    icon: <TrendUpIcon size={18} color={appColors.success700} weight="fill" />,
    optionValues: [
      "surplus_light",
      "surplus_normal",
      "surplus_aggressive",
    ] as GoalStrategy[],
  },
] as const;

const GoalStrategySettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [selectedStrategy, setSelectedStrategy] =
    React.useState<GoalStrategy>("maintain");
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
    setSelectedStrategy(
      resolveGoalStrategy(user?.goal, user?.goalStrategy) ?? "maintain",
    );
  }, [user?.goal, user?.goalStrategy]);

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
      setContextError("Could not build the strategy preview. Check your connection and try again.");
    } finally {
      setContextLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const previewGoal = React.useMemo(
    () => getGoalTypeForStrategy(selectedStrategy),
    [selectedStrategy],
  );
  const selectedOption = React.useMemo(
    () => getGoalStrategyOption(selectedStrategy),
    [selectedStrategy],
  );

  const previewPlan = React.useMemo(() => {
    if (!user || latestWeightKg == null) {
      return null;
    }

    return buildAutomaticFuelPlanForUser({
      user: {
        ...user,
        goal: previewGoal,
        goalStrategy: selectedStrategy,
      },
      weightKg: latestWeightKg,
    });
  }, [latestWeightKg, previewGoal, selectedStrategy, user]);

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
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      const savedUser = await saveAutomaticFuelPlanForUser({
        dispatch,
        goal: previewGoal,
        goalStrategy: selectedStrategy,
        user,
      });

      if (!savedUser) {
        Alert.alert(
          "Could not update goal strategy",
          "Make sure you have a valid birthdate, height, and at least one logged body weight.",
        );
        return;
      }

      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not update goal strategy", "Please try again.");
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
          subtitle="Pick how hard calories should sit below or above maintenance. Saving updates goal direction when needed and rebuilds your automatic fuel plan."
          title="Goal Strategy"
        />

        {!user ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing your goal strategy.
            </AppText>
          </AppCard>
        ) : (
          <>
            <AppCard style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCopy}>
                  <AppText variant="cardTitle">Current strategy</AppText>
                  <AppText color="secondary" variant="bodySmall">
                    {formatGoalStrategyMeta(
                      user.goal,
                      resolveGoalStrategy(user.goal, user.goalStrategy),
                    )}
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
                    {formatGoalLabel(previewGoal)}
                  </AppText>
                </AppCard>
                <AppCard style={styles.previewStat} variant="soft">
                  <AppText color="secondary" variant="eyebrow">Strategy</AppText>
                  <AppText variant="bodySmallStrong">
                    {formatGoalStrategyLabel(selectedStrategy)}
                  </AppText>
                </AppCard>
                <AppCard style={styles.previewStat} variant="soft">
                  <AppText color="secondary" variant="eyebrow">Offset</AppText>
                  <NumericText color="primary" variant="numberTrendDelta">
                    {formatSignedCalories(selectedOption.dailyCalorieDelta)}
                  </NumericText>
                </AppCard>
              </View>
            </AppCard>

            {GOAL_STRATEGY_SECTIONS.map((section) => {
              const options = listGoalStrategyOptions().filter((option) =>
                section.optionValues.includes(option.value),
              );

              return (
                <AppCard key={section.key} style={styles.card}>
                  <View style={styles.sectionHeader}>
                    {section.icon}
                    <AppText variant="cardTitle">{section.title}</AppText>
                  </View>

                  <View style={styles.optionStack}>
                    {options.map((option) => {
                      const selected = selectedStrategy === option.value;

                      return (
                        <OptionCard
                          key={option.value}
                          onPress={() => setSelectedStrategy(option.value)}
                          selected={selected}
                          subtitle={option.description}
                          title={option.label}
                          trailing={
                            <View style={styles.optionMeta}>
                              <NumericText color="coral" variant="numberTrendDelta">
                              {formatSignedCalories(option.dailyCalorieDelta)}
                              </NumericText>
                              <NumericText
                                align="right"
                                color="secondary"
                                variant="numberChartAxis"
                              >
                                {option.approxWeeklyRateKg != null
                                  ? `${option.goal === "lose_fat" ? "Lose" : "Gain"} ${option.approxWeeklyRateKg.toFixed(2)} kg/week`
                                  : "Hold body weight"}
                              </NumericText>
                            </View>
                          }
                        />
                      );
                    })}
                  </View>
                </AppCard>
              );
            })}

            <AppCard style={styles.card}>
              <AppButton
                onPress={() => void handleSave()}
                disabled={saving}
                label={saving ? "Saving..." : "Save goal strategy"}
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
  optionMeta: {
    alignItems: "flex-end",
    gap: appSpacing.xxs,
  },
});

export default GoalStrategySettingsScreen;
