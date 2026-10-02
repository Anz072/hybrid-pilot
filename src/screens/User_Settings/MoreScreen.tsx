import React from "react";
import appConfig from "../../../app.json";
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
  CirclesThreeIcon,
} from "phosphor-react-native";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildEffectiveCalorieTargetsForDates,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import { resolveGoalStrategy } from "../../engine/goalStrategy";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { isDeveloperAccountEmail } from "../../dev/developerAccount";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { weightUnitLabel } from "../../preferences/displayPreferences";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  appBorders,
  appCardSurface,
  appContentLayout,
  appRadius,
  appSpacing,
  appStates,
} from "../../theme/tokens";
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
  /** Bottom hairline; pass false on the last row of a section. */
  divider?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
  value: string;
};

const MoreActionRow = ({
  divider = true,
  icon,
  onPress,
  title,
  value,
}: MoreActionRowProps) => {
  const { fontScale } = useWindowDimensions();
  const stackedValue = fontScale > 1.3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        divider && styles.actionRowDivider,
        pressed && styles.actionRowPressed,
      ]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        {stackedValue && value ? (
          <Text style={styles.actionStackedValue}>{value}</Text>
        ) : null}
      </View>
      <View style={styles.actionMeta}>
        {!stackedValue && value ? (
          <Text style={styles.actionValue}>{value}</Text>
        ) : null}
        <CaretRightIcon size={18} color={appColors.textMuted} weight="bold" />
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
      setSettingsError(
        "Could not load settings context. Check your connection and try again.",
      );
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 16,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroTitle} accessibilityRole="header">Settings</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Profile and account, ${user?.displayName ?? "Your account"}`}
          onPress={() => navigation.navigate("ProfileSettingsScreen")}
          style={({ pressed }) => [styles.accountCard, pressed && styles.actionRowPressed]}
        >
          <View style={styles.accountIcon}>
            <UserCircleIcon size={40} color={appColors.actionPrimary} weight="regular" />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.accountName}>{user?.displayName || "Your account"}</Text>
            <Text style={styles.accountLink}>Profile & account</Text>
          </View>
          <CaretRightIcon size={20} color={appColors.textMuted} />
        </Pressable>

        {settingsError ? (
          <ErrorState
            title="Could not load settings"
            message={settingsError}
            action={
              <AppButton
                label="Try again"
                onPress={() => void loadSettings()}
                size="sm"
              />
            }
            style={styles.stateBlock}
          />
        ) : settingsLoading ? (
          <LoadingState
            title="Loading settings"
            message="Fetching calorie schedule and review state."
            style={styles.stateBlock}
          />
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Review</Text>
          <MoreActionRow
            icon={
              <ChartLineUpIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("WeeklyReviewScreen")}
            title="Weekly check-in"
            value={adaptiveRecommendationReady ? "Review ready" : ""}
          />
          <MoreActionRow
            icon={
              <LightningIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() =>
              navigation.navigate("AdaptiveCaloriesSettingsScreen")
            }
            divider={false}
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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Tracking</Text>
          <MoreActionRow icon={<CirclesThreeIcon size={18} color={appColors.textSecondary} />} title="Protocol tracking"
            value={settingsError ? "Unavailable" : settingsLoading ? "Loading…" : settings?.protocolsEnabled ? "On" : "Off"}
            divider={false} onPress={() => navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate("ProtocolSettings")} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Targets</Text>
          <MoreActionRow
            icon={
              <ForkKnifeIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() =>
              navigation.navigate("CalorieAllowanceSettingsScreen")
            }
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
                color={appColors.textSecondary}
                weight="regular"
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
                color={appColors.textSecondary}
                weight="regular"
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
                color={appColors.textSecondary}
                weight="regular"
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
                color={appColors.textSecondary}
                weight="regular"
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
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("CalorieScheduleScreen")}
            divider={false}
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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Preferences</Text>
          <MoreActionRow
            icon={
              <SlidersHorizontalIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("PreferencesScreen")}
            divider={false}
            title="Units & display"
            value={preferencesLabel}
          />
        </View>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Data</Text>
          <MoreActionRow
            icon={
              <ExportIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("DataExportScreen")}
            divider={false}
            title="Export & backup"
            value=""
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Food Library</Text>
          <MoreActionRow
            icon={
              <CookingPotIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("UserCreatedRecipesScreen")}
            title="Your recipes"
            value=""
          />
          <MoreActionRow
            icon={
              <ForkKnifeIcon
                size={18}
                color={appColors.textSecondary}
                weight="regular"
              />
            }
            onPress={() => navigation.navigate("UserCreatedCustomMealsScreen")}
            divider={false}
            title="Your custom meals"
            value=""
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
                    color={appColors.textSecondary}
                    weight="regular"
                  />
                }
                onPress={() => navigation.navigate("SettingsScreen")}
                title="Debug tools"
                value=""
              />
              <MoreActionRow
                icon={
                  <LightningIcon
                    size={18}
                    color={appColors.textSecondary}
                    weight="regular"
                  />
                }
                onPress={confirmSeedDeveloperTestData}
                divider={false}
                title="Generate test history"
                value={isSeedingTestData ? "Working..." : "28 days"}
              />
            </View>
          </>
        ) : null}
        <Text
          style={styles.appVersion}
          accessibilityLabel={`App version ${appConfig.expo.version}`}
        >
          {appConfig.expo.version}
        </Text>
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
    ...appContentLayout,
    paddingHorizontal: appSpacing.gutter,
  },
  appVersion: {
    ...appTypography.label,
    color: appColors.textSecondary,
    textAlign: "center",
    marginTop: appSpacing.xxl,
  },
  heroCard: {
    marginBottom: appSpacing.md,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: appSpacing.xs,
  },
  heroTitle: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  heroMetrics: {
    marginTop: appSpacing.gutter,
    flexDirection: "row",
    gap: appSpacing.lg,
  },
  metricCard: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    ...appTypography.metadata,
    color: appColors.textSecondary,
    marginBottom: appSpacing.xs,
  },
  stateBlock: {
    marginBottom: appSpacing.md,
  },
  sectionCard: {
    ...appCardSurface,
    padding: appSpacing.md,
    marginBottom: appSpacing.md,
  },
  accountCard: {
    ...appCardSurface,
    flexDirection: "row",
    alignItems: "center",
    padding: appSpacing.md,
    gap: appSpacing.md,
    marginTop: appSpacing.md,
    marginBottom: appSpacing.xl,
  },
  accountIcon: {
    width: 64,
    height: 64,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.actionPrimarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { ...appTypography.sectionTitle, color: appColors.textPrimary },
  accountLink: { ...appTypography.bodySmall, color: appColors.textSecondary, marginTop: appSpacing.xxs },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    minHeight: 64,
    paddingVertical: appSpacing.sm,
  },
  actionRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  actionRowPressed: {
    opacity: appStates.pressedOpacity,
  },
  actionIcon: {
    width: 24,
    height: 24,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: appColors.textPrimary,
    ...appTypography.bodyStrong,
  },
  actionMeta: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
    maxWidth: "38%",
  },
  actionValue: {
    color: appColors.textSecondary,
    ...appTypography.label,
    textAlign: "right",
    flexShrink: 1,
  },
  actionStackedValue: {
    color: appColors.textSecondary,
    ...appTypography.metadata,
    marginTop: appSpacing.xxs,
  },
});

export default MoreScreen;
