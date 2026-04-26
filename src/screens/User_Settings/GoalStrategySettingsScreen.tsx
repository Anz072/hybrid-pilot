import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CheckIcon,
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

  React.useEffect(() => {
    setSelectedStrategy(
      resolveGoalStrategy(user?.goal, user?.goalStrategy) ?? "maintain",
    );
  }, [user?.goal, user?.goalStrategy]);

  const loadContext = React.useCallback(async () => {
    if (!user) {
      return;
    }

    const [nextWeightKg, nextSettings] = await Promise.all([
      getLatestUserWeightKg(user.externalId),
      DB.getUserSettings(user.externalId),
    ]);

    setLatestWeightKg(nextWeightKg);
    setSettings(nextSettings);
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
          subtitle="Pick how hard calories should sit below or above maintenance. Saving updates goal direction when needed and rebuilds your automatic fuel plan."
          title="Goal Strategy"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to your account first before editing your goal strategy.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCopy}>
                  <Text style={styles.cardTitle}>Current strategy</Text>
                  <Text style={styles.cardText}>
                    {formatGoalStrategyMeta(
                      user.goal,
                      resolveGoalStrategy(user.goal, user.goalStrategy),
                    )}
                  </Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillText}>
                    {previewPlan?.calories ?? user.calorieAllowance ?? "--"}{" "}
                    kcal
                  </Text>
                </View>
              </View>

              <View style={styles.previewGrid}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewLabel}>Goal</Text>
                  <Text style={styles.previewValue}>
                    {formatGoalLabel(previewGoal)}
                  </Text>
                </View>
                <View style={styles.previewStat}>
                  <Text style={styles.previewLabel}>Strategy</Text>
                  <Text style={styles.previewValue}>
                    {formatGoalStrategyLabel(selectedStrategy)}
                  </Text>
                </View>
                <View style={styles.previewStat}>
                  <Text style={styles.previewLabel}>Offset</Text>
                  <Text style={styles.previewValue}>
                    {formatSignedCalories(selectedOption.dailyCalorieDelta)}
                  </Text>
                </View>
              </View>
            </View>

            {GOAL_STRATEGY_SECTIONS.map((section) => {
              const options = listGoalStrategyOptions().filter((option) =>
                section.optionValues.includes(option.value),
              );

              return (
                <View key={section.key} style={styles.card}>
                  <View style={styles.sectionHeader}>
                    {section.icon}
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>

                  <View style={styles.optionStack}>
                    {options.map((option) => {
                      const selected = selectedStrategy === option.value;

                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setSelectedStrategy(option.value)}
                          style={({ pressed }) => [
                            styles.optionCard,
                            selected && styles.optionCardSelected,
                            pressed && styles.optionCardPressed,
                          ]}
                        >
                          <View style={styles.optionCopy}>
                            <Text
                              style={[
                                styles.optionTitle,
                                selected && styles.optionTitleSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text style={[styles.optionText, selected && styles.optionRateSelected]}>
                              {option.description}
                            </Text>
                          </View>
                          <View style={styles.optionMeta}>
                            <Text style={styles.optionCalories}>
                              {formatSignedCalories(option.dailyCalorieDelta)}
                            </Text>
                            <Text style={[styles.optionRate, selected && styles.optionRateSelected]}>
                              {option.approxWeeklyRateKg != null
                                ? `${option.goal === "lose_fat" ? "Lose" : "Gain"} ${option.approxWeeklyRateKg.toFixed(2)} kg/week`
                                : "Hold body weight"}
                            </Text>
                            <View
                              style={[
                                styles.checkBadge,
                                selected && styles.checkBadgeSelected,
                              ]}
                            >
                              {selected ? (
                                <CheckIcon
                                  size={14}
                                  color={appColors.slate800}
                                  weight="bold"
                                />
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={styles.card}>
              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !saving && styles.optionCardPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Saving..." : "Save goal strategy"}
                </Text>
              </Pressable>
            </View>

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
    right: -52,
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
  summaryCopy: {
    flex: 1,
  },
  cardTitle: {
    color: appColors.slate800,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: appColors.slate600,
    fontSize: 13,
    lineHeight: 18,
  },
  metricPill: {
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  metricPillText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  previewGrid: {
    flexDirection: "row",
    gap: 12,
  },
  previewStat: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 14,
  },
  previewLabel: {
    color: appColors.slate200,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  previewValue: {
    color: appColors.slate800,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.slate800,
    fontSize: 18,
    fontWeight: "800",
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceRaised,
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
  optionTitleSelected: {
    color: appColors.white,
  },
  optionText: {
    color: appColors.slate600,
    fontSize: 13,
    lineHeight: 18,
  },
  optionMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  optionCalories: {
    color: appColors.brand700,
    fontSize: 13,
    fontWeight: "800",
  },
  optionRateSelected: {
    color: appColors.slate200,
  },
  optionRate: {
    color: appColors.slate600,
    fontSize: 11,
    fontWeight: "700",
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

export default GoalStrategySettingsScreen;
