import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BowlFoodIcon,
  CaretRightIcon,
  DnaIcon,
  DropIcon,
  LeafIcon,
  ScalesIcon,
  TargetIcon,
  TrendUpIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { formatFoodDateKey, type FoodNutritionTotals } from "../Food/foodUtils";
import { formatWeight } from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { subscribeToAppDataChanges } from "../../store/dataChangeEvents";
import { useAppSelector } from "../../store/hooks";
import { appColors, type AppColorValue } from "../../theme/colors";
import { appSpacing, appStates } from "../../theme/tokens";
import {
  AppButton,
  AppText,
  ErrorState,
  LoadingState,
  MetricLine,
  NumericText,
  ProgressRail,
  SectionHeader,
} from "../../components/ui";
import {
  createEmptyMicronutrientTotals,
  formatMicronutrientValue,
  getMicronutrientPreviewItems,
  type MicronutrientTotals,
} from "./homeNutrition";
import {
  clearCachedHomeDashboardSummary,
  getCachedHomeDashboardSummary,
  getPersistedHomeDashboardSummary,
  loadHomeDashboardSummary,
  type HomeDashboardSummary,
} from "./homeDashboardSummary";

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

const EMPTY_TOTALS: FoodNutritionTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

const INITIAL_MICROS = createEmptyMicronutrientTotals();

const formatHeroDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const formatWholeNumber = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }

  return Math.round(value).toLocaleString();
};

const formatRemainingLabel = (remaining: number | null) => {
  if (remaining == null) {
    return "Set a calorie target";
  }

  const remainingValue = Math.abs(Math.round(remaining)).toLocaleString();
  return remaining < 0 ? `${remainingValue} kcal over` : `${remainingValue} kcal left`;
};

type CalorieHeroProps = {
  consumed: number;
  remaining: number | null;
  remainingLabel: string;
  target: number | null;
};

const CalorieHero = ({ consumed, remainingLabel, target }: CalorieHeroProps) => {
  const safeTarget = target != null && target > 0 ? target : null;
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;

  return (
    <View style={styles.heroSection}>
      <View style={styles.heroValueRow}>
        <NumericText adjustsFontSizeToFit numberOfLines={1} variant="numberDisplay">
          {formatWholeNumber(safeConsumed)}
        </NumericText>
        <AppText color="secondary" style={styles.heroTarget} variant="label">
          / {safeTarget ? formatWholeNumber(safeTarget) : "--"} kcal
        </AppText>
      </View>
      <AppText color="muted" variant="bodySmall">
        {remainingLabel}
      </AppText>
      <ProgressRail
        color={appColors.calories}
        height={6}
        max={safeTarget ?? 0}
        style={styles.heroRail}
        value={safeConsumed}
      />
    </View>
  );
};

type MacroSummaryItemProps = {
  accent: AppColorValue;
  consumed: number;
  icon: React.ReactNode;
  label: string;
  target: number | null;
};

const MacroSummaryItem = ({
  accent,
  consumed,
  icon,
  label,
  target,
}: MacroSummaryItemProps) => {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = target != null && Number.isFinite(target) && target > 0 ? target : null;

  return (
    <View style={styles.macroItem}>
      <View style={styles.macroItemHeader}>
        {icon}
        <AppText numberOfLines={1} variant="bodySmallStrong">
          {label}
        </AppText>
      </View>
      <NumericText
        adjustsFontSizeToFit
        numberOfLines={1}
        style={styles.macroItemValue}
        variant="numberMacroSummary"
      >
        {safeTarget
          ? `${formatWholeNumber(safeConsumed)} / ${formatWholeNumber(safeTarget)} g`
          : `${formatWholeNumber(safeConsumed)} g`}
      </NumericText>
      <ProgressRail
        color={accent}
        height={6}
        max={safeTarget ?? 0}
        style={styles.macroItemRail}
        value={safeConsumed}
      />
    </View>
  );
};

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { weightUnit } = useDisplayPreferences();
  const formatWeightValue = (value: number | null) =>
    value != null ? formatWeight(value, weightUnit) : "--";
  const navigation = useNavigation<HomeNavigation>();
  const user = useAppSelector((state) => state.user.currentUser);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [todayTotals, setTodayTotals] = React.useState<FoodNutritionTotals>(
    EMPTY_TOTALS,
  );
  const [todayMicros, setTodayMicros] =
    React.useState<MicronutrientTotals>(INITIAL_MICROS);
  const [trackedMicronutrientCount, setTrackedMicronutrientCount] =
    React.useState(0);
  const [calorieTarget, setCalorieTarget] = React.useState<number | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = React.useState<number | null>(
    null,
  );
  const [sevenDayAverageWeightKg, setSevenDayAverageWeightKg] =
    React.useState<number | null>(null);
  const [goalProgressPercent, setGoalProgressPercent] = React.useState<
    number | null
  >(null);
  const hasLoadedSummaryRef = React.useRef(false);
  const refreshSequenceRef = React.useRef(0);

  const applySummary = React.useCallback((summary: HomeDashboardSummary) => {
    setTodayTotals(summary.todayTotals);
    setTodayMicros(summary.todayMicros);
    setTrackedMicronutrientCount(summary.trackedMicronutrientCount);
    setCalorieTarget(summary.calorieTarget);
    setCurrentWeightKg(summary.currentWeightKg);
    setSevenDayAverageWeightKg(summary.sevenDayAverageWeightKg);
    setGoalProgressPercent(summary.goalProgressPercent);
    hasLoadedSummaryRef.current = true;
  }, []);

  const resetSummary = React.useCallback(() => {
    setTodayTotals(EMPTY_TOTALS);
    setTodayMicros(INITIAL_MICROS);
    setTrackedMicronutrientCount(0);
    setCalorieTarget(null);
    setCurrentWeightKg(null);
    setSevenDayAverageWeightKg(null);
    setGoalProgressPercent(null);
    hasLoadedSummaryRef.current = false;
  }, []);

  const refreshSummary = React.useCallback(
    async ({
      preferCache = false,
      silent = false,
    }: {
      preferCache?: boolean;
      silent?: boolean;
    } = {}) => {
      if (!user?.externalId) {
        resetSummary();
        setIsLoading(false);
        return;
      }

      const cachedSummary = getCachedHomeDashboardSummary(user.externalId);
      if (preferCache && cachedSummary) {
        applySummary(cachedSummary);
        setIsLoading(false);
      } else if (!silent && !hasLoadedSummaryRef.current) {
        setIsLoading(true);
      }

      setError(null);
      const sequence = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = sequence;

      if (preferCache && !cachedSummary) {
        const persistedSummary = await getPersistedHomeDashboardSummary(
          user.externalId,
        ).catch(() => null);

        if (persistedSummary && refreshSequenceRef.current === sequence) {
          applySummary(persistedSummary);
          setIsLoading(false);
        }
      }

      try {
        const summary = await loadHomeDashboardSummary(user);

        if (refreshSequenceRef.current !== sequence) {
          return;
        }

        applySummary(summary);
      } catch (loadError) {
        if (refreshSequenceRef.current !== sequence) {
          return;
        }

        if (!hasLoadedSummaryRef.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your home summary.",
          );
        }
      } finally {
        if (refreshSequenceRef.current === sequence) {
          setIsLoading(false);
        }
      }
    },
    [applySummary, resetSummary, user],
  );

  useFocusEffect(
    React.useCallback(() => {
      void refreshSummary({
        preferCache: true,
        silent: hasLoadedSummaryRef.current,
      });
    }, [refreshSummary]),
  );

  React.useEffect(() => {
    if (!user?.externalId) {
      return undefined;
    }

    return subscribeToAppDataChanges((event) => {
      if (
        event.userExternalId &&
        event.userExternalId !== user.externalId
      ) {
        return;
      }

      if (event.kind === "food_log" && event.date) {
        const todayKey = formatFoodDateKey(new Date());
        if (event.date !== todayKey) {
          return;
        }
      }

      clearCachedHomeDashboardSummary(user.externalId);
      void refreshSummary({ silent: true });
    });
  }, [refreshSummary, user?.externalId]);

  const caloriesRemaining =
    calorieTarget != null ? Math.round(calorieTarget - todayTotals.calories) : null;
  const remainingLabel = formatRemainingLabel(caloriesRemaining);
  const microsPreview = React.useMemo(
    () => getMicronutrientPreviewItems(todayMicros, 4),
    [todayMicros],
  );
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 34 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText adjustsFontSizeToFit numberOfLines={1} variant="screenTitle">
          Daily Summary
        </AppText>
        <AppText color="muted" style={styles.dateText} variant="bodySmall">
          {formatHeroDate(new Date())}
        </AppText>
        {isLoading ? (
          <LoadingState
            message="Checking today's logged food and targets."
            style={styles.loadingState}
            title="Loading daily summary"
          />
        ) : error ? (
          <ErrorState
            message={error}
            style={styles.errorPanel}
            title="Could not load summary"
            action={
              <AppButton
                label="Try again"
                variant="danger"
                size="sm"
                onPress={() => void refreshSummary()}
                accessibilityLabel="Retry loading home summary"
              />
            }
          />
        ) : (
          <>
            <CalorieHero
              consumed={todayTotals.calories}
              remaining={caloriesRemaining}
              remainingLabel={remainingLabel}
              target={calorieTarget}
            />

            <View style={styles.macroSummaryRow}>
              <MacroSummaryItem
                accent={appColors.protein}
                consumed={todayTotals.proteinG}
                icon={<DnaIcon size={18} color={appColors.protein} weight="regular" />}
                label="Protein"
                target={user?.proteinG ?? null}
              />
              <MacroSummaryItem
                accent={appColors.carbs}
                consumed={todayTotals.carbsG}
                icon={<BowlFoodIcon size={18} color={appColors.carbs} weight="regular" />}
                label="Carbs"
                target={user?.carbsG ?? null}
              />
              <MacroSummaryItem
                accent={appColors.fat}
                consumed={todayTotals.fatG}
                icon={<DropIcon size={18} color={appColors.fat} weight="regular" />}
                label="Fat"
                target={user?.fatG ?? null}
              />
            </View>
          </>
        )}

        <Pressable
          accessibilityLabel="Open weekly review"
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate("More", {
              screen: "WeeklyReviewScreen",
            })
          }
          style={({ pressed }) => [styles.section, pressed && styles.sectionPressed]}
        >
          <SectionHeader
            action={
              <View style={styles.weeklyAction}>
                <AppText style={styles.weeklyActionText} variant="label">
                  Review
                </AppText>
                <CaretRightIcon
                  size={18}
                  color={appColors.actionPrimary}
                  weight="bold"
                />
              </View>
            }
            subtitle="Trend, average, and goal progress"
            title="Weekly check-in"
          />
          <View style={styles.insightList}>
            <MetricLine
              divider
              icon={<ScalesIcon size={16} color={appColors.textMuted} weight="regular" />}
              label="Latest weight"
              value={
                <NumericText variant="numberWeightEntry">
                  {formatWeightValue(currentWeightKg)}
                </NumericText>
              }
            />
            <MetricLine
              divider
              icon={<TrendUpIcon size={16} color={appColors.textMuted} weight="regular" />}
              label="7-day average"
              value={
                <NumericText variant="numberWeightEntry">
                  {formatWeightValue(sevenDayAverageWeightKg)}
                </NumericText>
              }
            />
            <MetricLine
              icon={<TargetIcon size={16} color={appColors.textMuted} weight="regular" />}
              label="To goal"
              value={
                <NumericText variant="numberWeightEntry">
                  {goalProgressPercent != null ? `${goalProgressPercent}%` : "--"}
                </NumericText>
              }
            />
          </View>
        </Pressable>

        <Pressable
          accessibilityLabel="Open micronutrients overview"
          accessibilityRole="button"
          onPress={() => navigation.navigate("MicrosOverview")}
          style={({ pressed }) => [styles.section, pressed && styles.sectionPressed]}
        >
          <SectionHeader
            action={<CaretRightIcon size={18} color={appColors.textMuted} weight="bold" />}
            subtitle={`${trackedMicronutrientCount} tracked nutrients today`}
            title="Micronutrients"
          />
          <View style={styles.microList}>
            {microsPreview.map((item, index) => (
              <MetricLine
                divider={index < microsPreview.length - 1}
                icon={<LeafIcon size={16} color={appColors.protein} weight="regular" />}
                key={item.key}
                label={item.label}
                value={
                  <NumericText variant="numberMacroRow">
                    {formatMicronutrientValue(item.value, item.unit)}
                  </NumericText>
                }
              />
            ))}
          </View>
        </Pressable>
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
  dateText: {
    marginTop: 4,
  },
  loadingState: {
    marginTop: appSpacing.xl,
    marginBottom: appSpacing.md,
  },
  errorPanel: {
    marginTop: appSpacing.xl,
    marginBottom: appSpacing.md,
  },
  heroSection: {
    marginTop: appSpacing.xl,
    marginBottom: appSpacing.lg,
  },
  heroValueRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  heroTarget: {
    marginLeft: appSpacing.xxs,
  },
  heroRail: {
    marginTop: appSpacing.sm,
  },
  macroSummaryRow: {
    flexDirection: "row",
    gap: appSpacing.lg,
    marginBottom: appSpacing.xl,
  },
  macroItem: {
    flex: 1,
    minWidth: 0,
  },
  macroItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xxs,
    marginBottom: appSpacing.xxs,
  },
  macroItemValue: {
    textAlign: "left",
    marginBottom: appSpacing.xs,
  },
  macroItemRail: {
    marginTop: 0,
  },
  section: {
    marginTop: appSpacing.xxl,
  },
  sectionPressed: {
    opacity: appStates.pressedOpacity,
  },
  weeklyAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xxs,
  },
  weeklyActionText: {
    color: appColors.actionPrimary,
  },
  insightList: {
    marginTop: appSpacing.md,
  },
  microList: {
    marginTop: appSpacing.xs,
  },
});

export default HomeScreen;
