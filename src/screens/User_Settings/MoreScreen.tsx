import React from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BarbellIcon,
  CaretRightIcon,
  ChartLineUpIcon,
  CookingPotIcon,
  ExportIcon,
  ForkKnifeIcon,
  LightningIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  UserCircleIcon,
} from "phosphor-react-native";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { isDeveloperAccountEmail } from "../../dev/developerAccount";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { weightUnitLabel } from "../../preferences/displayPreferences";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
import { AppButton, ErrorState, LoadingState } from "../../components/ui";
import CalorieBudgetChart from "./CalorieBudgetChart";
import { seedDeveloperTestData } from "./testDataSeeder";
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
  const preferences = useDisplayPreferences();
  const isDeveloperAccount = isDeveloperAccountEmail(user?.email);
  const [settings, setSettings] = React.useState<Awaited<
    ReturnType<typeof DB.getUserSettings>
  > | null>(null);
  const [adaptiveRecommendationReady, setAdaptiveRecommendationReady] =
    React.useState(false);
  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [isSeedingTestData, setIsSeedingTestData] = React.useState(false);
  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);

  const loadSettings = React.useCallback(async () => {
    if (!user) {
      setSettings(null);
      setAdaptiveRecommendationReady(false);
      setSettingsLoading(false);
      return;
    }

    setSettingsLoading(true);
    setSettingsError(null);

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
      setSettingsError("Could not load settings context. Check your connection and try again.");
    } finally {
      setSettingsLoading(false);
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
  const preferencesLabel = React.useMemo(() => {
    const timeLabel = preferences.timeFormat === "12h" ? "12h" : "24h";
    const heightLabel = preferences.heightUnit === "ft_in" ? "ft/in" : "cm";
    return `${weightUnitLabel(preferences.weightUnit)} · ${heightLabel} · ${timeLabel}`;
  }, [preferences]);
  const runSeedDeveloperTestData = React.useCallback(async () => {
    if (isSeedingTestData) {
      return;
    }

    if (!user?.externalId) {
      Alert.alert("No user found", "Sign in before generating test data.");
      return;
    }

    setIsSeedingTestData(true);
    try {
      const result = await seedDeveloperTestData(user.externalId);
      Alert.alert(
        "Test data created",
        `${result.foodEntries} food entries and ${result.weightEntries} weight entries were added for ${result.startDate} to ${result.endDate}.`,
      );
    } catch {
      Alert.alert("Could not create test data", "Please try again.");
    } finally {
      setIsSeedingTestData(false);
    }
  }, [isSeedingTestData, user?.externalId]);

  const confirmSeedDeveloperTestData = React.useCallback(() => {
    if (isSeedingTestData) {
      return;
    }

    Alert.alert(
      "Generate test history?",
      "This adds 28 days of sample diary entries and weights. Previous [Test] diary entries in that range are replaced, and weight entries for those dates are updated.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => {
            void runSeedDeveloperTestData();
          },
        },
      ],
    );
  }, [isSeedingTestData, runSeedDeveloperTestData]);

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
                {settingsLoading
                  ? "..."
                  : weeklyBudget != null
                    ? `${Math.round(weeklyBudget / 7)} kcal`
                    : "--"}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Weekly Budget</Text>
              <Text style={styles.metricValue}>
                {settingsLoading
                  ? "..."
                  : weeklyBudget != null
                    ? `${Math.round(weeklyBudget)} kcal`
                    : "--"}
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

        {settingsError ? (
          <ErrorState
            title="Could not load settings"
            message={settingsError}
            action={
              <AppButton label="Try again" onPress={() => void loadSettings()} size="sm" />
            }
            style={styles.stateBlock}
          />
        ) : settingsLoading ? (
          <LoadingState
            title="Loading settings"
            message="Fetching calorie schedule and review state."
            style={styles.stateBlock}
          />
        ) : (
          <CalorieBudgetChart
            highlightDate={new Date()}
            title="Weekly budget preview"
            values={weeklyValues}
          />
        )}

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
            title="Weekly check-in"
            value={adaptiveRecommendationReady ? "Review ready" : "Open"}
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
              settingsLoading
                ? "..."
                : settings?.adaptiveCaloriesEnabled
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
              settingsLoading
                ? "..."
                : settings?.dailyCalorieOverrides?.some((item) => item != null)
                ? "Custom"
                : "Base only"
            }
          />
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
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
            title="Units & display"
            value={preferencesLabel}
          />
          <MoreActionRow
            icon={
              <ExportIcon
                size={18}
                color={appColors.brand700}
                weight="fill"
              />
            }
            onPress={() => navigation.navigate("DataExportScreen")}
            title="Export & backup"
            value="Open"
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
                onPress={confirmSeedDeveloperTestData}
                title="Generate test history"
                value={isSeedingTestData ? "Working..." : "28 days"}
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
    paddingHorizontal: appSpacing.gutter,
  },
  heroCard: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    padding: appSpacing.lg,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    marginBottom: appSpacing.md,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.label,
    color: appColors.textSecondary,
    backgroundColor: appSurfaces.ghost,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 7,
    borderRadius: appRadius.pill,
    marginBottom: appSpacing.sm,
  },
  heroTitle: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  heroMetrics: {
    marginTop: appSpacing.gutter,
    flexDirection: "row",
    gap: appSpacing.xs,
  },
  metricCard: {
    flex: 1,
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
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
    ...appTypography.bodySmallStrong,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
    marginTop: appSpacing.gutter,
    marginBottom: appSpacing.xs,
  },
  stateBlock: {
    marginBottom: appSpacing.md,
  },
  sectionCard: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    minHeight: 64,
    paddingHorizontal: appSpacing.md,
    paddingVertical: 14,
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  actionRowPressed: {
    opacity: appStates.pressedOpacity,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.actionPrimarySoft,
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
    color: appColors.actionPrimary,
    ...appTypography.label,
    textAlign: "right",
    flexShrink: 1,
  },
});

export default MoreScreen;
