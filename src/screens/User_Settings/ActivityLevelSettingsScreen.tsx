import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CheckIcon, GaugeIcon, TargetIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildAutomaticFuelPlanForUser,
  buildEffectiveCalorieTargetsForDates,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import type {
  ActivityLevel,
  GoalType,
} from "../../navigation/onboardingTypes";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
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
  const [latestWeightKg, setLatestWeightKg] = React.useState<number | null>(null);
  const [settings, setSettings] = React.useState<Awaited<
    ReturnType<typeof DB.getUserSettings>
  > | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setSelectedActivity((user?.activityLevel as ActivityLevel | null) ?? null);
    setSelectedGoal((user?.goal as GoalType | null) ?? null);
  }, [user?.activityLevel, user?.goal]);

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

      navigation.goBack();
    } catch {
      Alert.alert("Could not update goal", "Please try again.");
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
          subtitle="Adjust the body-change goal and the activity baseline together. Saving rebuilds your automatic fuel plan from the latest logged body weight."
          title="Adjust Goal"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in to your account first before editing your goal settings.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCopy}>
                  <Text style={styles.cardTitle}>Current plan</Text>
                  <Text style={styles.cardText}>
                    {formatGoalLabel(user.goal)} /{" "}
                    {formatActivityLevelLabel(user.activityLevel)}
                  </Text>
                </View>
                <View style={styles.metricPill}>
                  <GaugeIcon
                    size={16}
                    color={appColors.brand700}
                    weight="fill"
                  />
                  <Text style={styles.metricPillText}>
                    {previewPlan?.calories ?? user.calorieAllowance ?? "--"} kcal
                  </Text>
                </View>
              </View>

              <View style={styles.previewGrid}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewLabel}>Goal</Text>
                  <Text style={styles.previewValue}>
                    {formatGoalLabel(selectedGoal)}
                  </Text>
                </View>
                <View style={styles.previewStat}>
                  <Text style={styles.previewLabel}>Activity</Text>
                  <Text style={styles.previewValue}>
                    {formatActivityLevelLabel(selectedActivity)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <TargetIcon
                  size={18}
                  color={appColors.brand700}
                  weight="fill"
                />
                <Text style={styles.sectionTitle}>Goal</Text>
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
                    <Pressable
                      key={option.value}
                      onPress={() => setSelectedGoal(option.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{option.label}</Text>
                        <Text style={styles.optionText}>{option.description}</Text>
                      </View>
                      <View style={styles.optionMeta}>
                        <Text style={styles.optionCalories}>
                          {optionPlan?.calories ?? "--"} kcal
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
                              color={appColors.white}
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

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <GaugeIcon
                  size={18}
                  color={appColors.brand700}
                  weight="fill"
                />
                <Text style={styles.sectionTitle}>Activity baseline</Text>
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
                    <Pressable
                      key={option.value}
                      onPress={() => setSelectedActivity(option.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{option.label}</Text>
                        <Text style={styles.optionText}>{option.description}</Text>
                      </View>
                      <View style={styles.optionMeta}>
                        <Text style={styles.optionCalories}>
                          {optionPlan?.calories ?? "--"} kcal
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
                              color={appColors.white}
                              weight="bold"
                            />
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => void handleSave()}
                disabled={saving || !selectedActivity || !selectedGoal}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !saving && styles.optionCardPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Saving..." : "Save goal + activity"}
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
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    left: -74,
    bottom: -88,
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
    color: appColors.white,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 18,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.foodEyebrowBg,
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
    backgroundColor: appColors.foodFieldBg,
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
    color: appColors.white,
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
    color: appColors.white,
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
    backgroundColor: appColors.foodEyebrowBg,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: appColors.white,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  optionText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 18,
  },
  optionMeta: {
    alignItems: "flex-end",
    gap: 8,
  },
  optionCalories: {
    color: appColors.brand700,
    fontSize: 13,
    fontWeight: "800",
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

export default ActivityLevelSettingsScreen;
