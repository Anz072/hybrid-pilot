import React from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BarbellIcon,
  CaretRightIcon,
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
import { isDeveloperAccountEmail } from "../../dev/developerAccount";
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
  description?: string;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
  value: string;
};

const MoreActionRow = ({
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
      </View>
      <View style={styles.actionMeta}>
        <Text style={styles.actionValue}>{value}</Text>
        <CaretRightIcon
          size={18}
          color={appColors.textMuted}
          weight="bold"
        />
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
  const isDeveloperAccount = isDeveloperAccountEmail(user?.email);

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

        <Text style={styles.sectionTitle}>Reviews / Automation</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
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
          <MoreActionRow
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
                  ? "Review ready"
                  : "On"
                : "Off"
            }
          />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
            icon={
              <UserCircleIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("ProfileSettingsScreen")}
            title="Profile & account"
            value={user?.displayName ?? "Manage"}
          />
        </View>

        <Text style={styles.sectionTitle}>Targets</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
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
                ? "Custom"
                : "Base only"
            }
          />
        </View>

        <Text style={styles.sectionTitle}>Diary</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
            icon={
              <SlidersHorizontalIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("PreferencesScreen")}
            title="Diary settings"
            value={diaryHoursLabel}
          />
        </View>

        <Text style={styles.sectionTitle}>Food Library</Text>
        <View style={styles.sectionCard}>
          <MoreActionRow
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
        </View>

        {isDeveloperAccount ? (
          <>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.sectionCard}>
              <MoreActionRow
                icon={
                  <SlidersHorizontalIcon
                    size={18}
                    color={appColors.brand700}
                    weight="fill"
                  />
                }
                onPress={() => navigation.navigate("SettingsScreen")}
                title="Debug tools"
                value="Dev only"
              />
            </View>
          </>
        ) : null}
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
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  },
  actionMeta: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
    maxWidth: "38%",
  },
  actionValue: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
});

export default MoreScreen;

