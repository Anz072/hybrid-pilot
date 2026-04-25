import React from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BarbellIcon,
  ChartLineUpIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  LightningIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  UserCircleIcon,
} from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildEffectiveCalorieTargetsForDates,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import {
  resolveGoalStrategy,
} from "../../engine/goalStrategy";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { formatFoodHourLabel } from "../Food/foodUtils";
import CalorieBudgetChart from "./CalorieBudgetChart";
import {
  formatActivityLevelLabel,
  formatGoalLabel,
  formatProteinFocusLabel,
  formatGoalStrategyLabel,
  formatTrainingSummary,
} from "./userProfileOptions";

type MoreScreenNav = NativeStackNavigationProp<MoreParamList, "MoreMainScreen">;

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

type MoreActionRowProps = {
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
  value: string;
};

const MoreActionRow = ({
  description,
  icon,
  onPress,
  title,
  value,
}: MoreActionRowProps) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && styles.actionRowPressed,
      ]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <View style={styles.actionMeta}>
        <Text style={styles.actionValue}>{value}</Text>
        <Text style={styles.actionArrow}>{">"}</Text>
      </View>
    </Pressable>
  );
};

const MoreScreen = () => {
  const user = useAppSelector((state) => state.user.currentUser);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MoreScreenNav>();
  const [settings, setSettings] = React.useState<Awaited<
    ReturnType<typeof DB.getUserSettings>
  > | null>(null);
  const [adaptiveRecommendationReady, setAdaptiveRecommendationReady] =
    React.useState(false);
  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);

  const loadSettings = React.useCallback(async () => {
    if (!user) {
      setSettings(null);
      setAdaptiveRecommendationReady(false);
      return;
    }

    try {
      const [nextSettings, nextRecommendation] = await Promise.all([
        DB.getUserSettings(user.externalId),
        DB.getLatestAdaptiveCalorieRecommendation(user.externalId, "proposed"),
      ]);
      setSettings(nextSettings);
      setAdaptiveRecommendationReady(nextRecommendation != null);
    } catch {
      setSettings(null);
      setAdaptiveRecommendationReady(false);
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const weeklyValues = React.useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: weekDates,
        baseCalories: user?.calorieAllowance ?? null,
        settings,
      }),
    [settings, user?.calorieAllowance, weekDates],
  );
  const weeklyBudget = React.useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: weekDates,
        baseCalories: user?.calorieAllowance ?? null,
        settings,
      }),
    [settings, user?.calorieAllowance, weekDates],
  );
  const diaryHoursLabel = React.useMemo(() => {
    if (!settings) {
      return "07:00 - 22:00";
    }

    return `${formatFoodHourLabel(settings.foodDiaryStartHour)} - ${formatFoodHourLabel(settings.foodDiaryEndHour)}`;
  }, [settings]);

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
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Settings</Text>
          <Text style={styles.heroTitle}>
            {user?.displayName ? `Hello, ${user.displayName}` : "Settings"}
          </Text>

          <View style={styles.heroMetrics}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg Daily Target</Text>
              <Text style={styles.metricValue}>
                {weeklyBudget != null ? `${Math.round(weeklyBudget / 7)} kcal` : "--"}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Weekly Budget</Text>
              <Text style={styles.metricValue}>
                {weeklyBudget != null ? `${Math.round(weeklyBudget)} kcal` : "--"}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Goal</Text>
              <Text style={styles.metricValueSmall}>
                {formatGoalLabel(user?.goal)}
              </Text>
            </View>
          </View>
        </View>

        <CalorieBudgetChart
          highlightDate={new Date()}
          title="Weekly budget preview"
          values={weeklyValues}
        />

        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
            description="Review average calories vs target, completed diary days, weight movement, adaptive status, and repeated foods."
            icon={
              <ChartLineUpIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("WeeklyReviewScreen")}
            title="Weekly review"
            value="Open"
          />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
            description="Review your synced account, update profile details, and sign out when needed."
            icon={
              <UserCircleIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("ProfileSettingsScreen")}
            title="Profile & account"
            value={user?.email ?? user?.displayName ?? "Manage"}
          />
          <MoreActionRow
            description="Tune the Food Diary timeline and other app-level preferences."
            icon={
              <SlidersHorizontalIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("PreferencesScreen")}
            title="Preferences"
            value={diaryHoursLabel}
          />
        </View>

        <Text style={styles.sectionTitle}>User Settings</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
            description="Manually change the base daily energy target and reset it back to automatic when needed."
            icon={
              <ForkKnifeIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("CalorieAllowanceSettingsScreen")}
            title="Calorie allowance"
            value={
              user?.calorieAllowance != null
                ? `${user.calorieAllowance} kcal`
                : "Not set"
            }
          />
          <MoreActionRow
            description="Update weight loss, maintain, or gain together with your activity baseline and rebuild the automatic fuel plan."
            icon={
              <TargetIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("AdjustGoalSettingsScreen")}
            title="Adjust goal"
            value={`${formatGoalLabel(user?.goal)} / ${formatActivityLevelLabel(
              user?.activityLevel,
            )}`}
          />
          <MoreActionRow
            description="Choose whether calories should run at a light, normal, or aggressive deficit or surplus, or stay at maintenance."
            icon={
              <TargetIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("GoalStrategySettingsScreen")}
            title="Goal strategy"
            value={formatGoalStrategyLabel(
              resolveGoalStrategy(user?.goal, user?.goalStrategy),
            )}
          />
          <MoreActionRow
            description="Set how strongly your macro targets should bias toward protein grams per kilogram."
            icon={
              <BarbellIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("ProteinFocusSettingsScreen")}
            title="Protein focus"
            value={formatProteinFocusLabel(user?.proteinFocus)}
          />
          <MoreActionRow
            description="Keep your training profile aligned with what you actually do week to week."
            icon={
              <BarbellIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("TrainingTypesSettingsScreen")}
            title="Training types"
            value={formatTrainingSummary(user?.trainingTypes)}
          />
          <MoreActionRow
            description="Review every recipe you created in one compact list and open any of them straight in the editor."
            icon={
              <CookingPotIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("UserCreatedRecipesScreen")}
            title="Your recipes"
            value="Manage"
          />
          <MoreActionRow
            description="Review every custom meal you created and jump straight into editing macros, serving size, or visibility."
            icon={
              <ForkKnifeIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("UserCreatedCustomMealsScreen")}
            title="Your custom meals"
            value="Manage"
          />
          <MoreActionRow
            description="Let completed diary days and your recent weight trend generate quiet calorie-target recommendations that you can review manually."
            icon={
              <LightningIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("AdaptiveCaloriesSettingsScreen")}
            title="Adaptive calories"
            value={
              settings?.adaptiveCaloriesEnabled
                ? adaptiveRecommendationReady
                  ? "On / Review ready"
                  : "On"
                : "Off"
            }
          />
          <MoreActionRow
            description="Set different calorie targets for different weekdays while keeping the weekly budget visible."
            icon={
              <ForkKnifeIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("CalorieScheduleScreen")}
            title="Daily calorie schedule"
            value={
              settings?.dailyCalorieOverrides?.some((item) => item != null)
                ? "Custom schedule"
                : "Base target only"
            }
          />
        </View>
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
    top: -78,
    right: -54,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    left: -70,
    bottom: -92,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 14,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.label,
    color: appColors.textSecondary,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 12,
  },
  heroTitle: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  heroMetrics: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    padding: 14,
  },
  metricLabel: {
    ...appTypography.label,
    color: appColors.textMuted,
    marginBottom: 8,
  },
  metricValue: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  metricValueSmall: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: appColors.borderSoft,
  },
  actionRowPressed: {
    opacity: 0.94,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand800,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  actionDescription: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  actionMeta: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 8,
  },
  actionValue: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  actionArrow: {
    color: appColors.textMuted,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "400",
  },
});

export default MoreScreen;

