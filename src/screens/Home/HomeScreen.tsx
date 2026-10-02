import React from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BowlFoodIcon,
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
import { appContentLayout, appMetricSurface, appSpacing } from "../../theme/tokens";
import {
  AppButton,
  CalorieRing,
  CardFooter,
  InteractiveCard,
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
  loadHomeDashboardSummary,
  type HomeDashboardSummary,
} from "./homeDashboardSummary";
import ProtocolHomeCard from "../Protocols/ProtocolHomeCard";

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

type MacroSummaryItemProps = {
  accent: AppColorValue;
  compactHeader: boolean;
  consumed: number;
  icon: React.ReactNode;
  label: string;
  target: number | null;
};

const MacroSummaryItem = ({
  accent,
  compactHeader,
  consumed,
  icon,
  label,
  target,
}: MacroSummaryItemProps) => {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget =
    target != null && Number.isFinite(target) && target > 0 ? target : null;

  return (
    <View style={styles.macroItem}>
      <View style={[styles.macroItemHeader, compactHeader && styles.macroItemHeaderCompact]}>
        {icon}
        <AppText variant="bodySmallStrong">
          {label}
        </AppText>
      </View>
      <NumericText
        style={styles.macroItemValue}
        variant="numberMacroSummary"
      >
        {formatWholeNumber(safeConsumed)} g
      </NumericText>
      <AppText variant="label" color="muted">
        {safeTarget ? `of ${formatWholeNumber(safeTarget)} g` : "No target"}
      </AppText>
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
  const { fontScale, width } = useWindowDimensions();
  const { weightUnit } = useDisplayPreferences();
  const formatWeightValue = (value: number | null) =>
    value != null ? formatWeight(value, weightUnit) : "--";
  const navigation = useNavigation<HomeNavigation>();
  const user = useAppSelector((state) => state.user.currentUser);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [todayTotals, setTodayTotals] =
    React.useState<FoodNutritionTotals>(EMPTY_TOTALS);
  const [todayMicros, setTodayMicros] =
    React.useState<MicronutrientTotals>(INITIAL_MICROS);
  const [trackedMicronutrientCount, setTrackedMicronutrientCount] =
    React.useState(0);
  const [calorieTarget, setCalorieTarget] = React.useState<number | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = React.useState<number | null>(
    null,
  );
  const [sevenDayAverageWeightKg, setSevenDayAverageWeightKg] = React.useState<
    number | null
  >(null);
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
      if (event.kind !== "food_log" && event.kind !== "weight") return;
      if (event.userExternalId && event.userExternalId !== user.externalId) {
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

  const microsPreview = React.useMemo(
    () => getMicronutrientPreviewItems(todayMicros, 4),
    [todayMicros],
  );
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 24, paddingBottom: insets.bottom + 34 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText accessibilityRole="header" variant="screenTitle">
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
            <CalorieRing
              consumed={todayTotals.calories}
              target={calorieTarget}
            />
        )}
        <ProtocolHomeCard />
        {!isLoading && !error ? (
          <>
            <View style={[styles.macroSummaryRow, fontScale > 1.3 && styles.macroSummaryStacked]}>
              <MacroSummaryItem
                accent={appColors.protein}
                compactHeader={width < 360 && fontScale <= 1.3}
                consumed={todayTotals.proteinG}
                icon={
                  <DnaIcon
                    size={18}
                    color={appColors.protein}
                    weight="regular"
                  />
                }
                label="Protein"
                target={user?.proteinG ?? null}
              />
              <MacroSummaryItem
                accent={appColors.carbs}
                compactHeader={width < 360 && fontScale <= 1.3}
                consumed={todayTotals.carbsG}
                icon={
                  <BowlFoodIcon
                    size={18}
                    color={appColors.carbs}
                    weight="regular"
                  />
                }
                label="Carbs"
                target={user?.carbsG ?? null}
              />
              <MacroSummaryItem
                accent={appColors.fat}
                compactHeader={width < 360 && fontScale <= 1.3}
                consumed={todayTotals.fatG}
                icon={
                  <DropIcon size={18} color={appColors.fat} weight="regular" />
                }
                label="Fat"
                target={user?.fatG ?? null}
              />
            </View>
          </>
        ) : null}

        <InteractiveCard
          accessibilityLabel="Open weekly review"
          accessibilityRole="button"
          onPress={() => navigation.navigate("WeeklyReviewScreen")}
          style={styles.section}
        >
          <View style={styles.sectionContent}>
            <SectionHeader
              title="Weekly check-in"
            />
            <View style={styles.insightList}>
              <MetricLine
                divider
                icon={
                  <ScalesIcon
                    size={16}
                    color={appColors.textMuted}
                    weight="regular"
                  />
                }
                label="Latest weight"
                value={
                  <NumericText variant="numberWeightEntry">
                    {formatWeightValue(currentWeightKg)}
                  </NumericText>
                }
              />
              <MetricLine
                divider
                icon={
                  <TrendUpIcon
                    size={16}
                    color={appColors.textMuted}
                    weight="regular"
                  />
                }
                label="7-day average"
                value={
                  <NumericText variant="numberWeightEntry">
                    {formatWeightValue(sevenDayAverageWeightKg)}
                  </NumericText>
                }
              />
              {goalProgressPercent != null ? (
                <MetricLine
                  icon={
                    <TargetIcon
                      size={16}
                      color={appColors.textMuted}
                      weight="regular"
                    />
                  }
                  label="To goal"
                  value={
                    <NumericText variant="numberWeightEntry">
                      {goalProgressPercent != null
                        ? `${goalProgressPercent}%`
                        : "--"}
                    </NumericText>
                  }
                />
              ) : null}
            </View>
          </View>
          <CardFooter label="View weekly check-in" />
        </InteractiveCard>

        <InteractiveCard
          accessibilityLabel="Open micronutrients overview"
          accessibilityRole="button"
          onPress={() => navigation.navigate("MicrosOverview")}
          style={styles.section}
        >
          <View style={styles.sectionContent}>
            <SectionHeader
              subtitle={
                trackedMicronutrientCount
                  ? `${trackedMicronutrientCount} nutrients tracked`
                  : "No nutrient data logged today"
              }
              title="Micronutrients"
            />
            <View style={styles.microList}>
              {(trackedMicronutrientCount > 0 ? microsPreview : []).map(
                (item, index) => (
                  <MetricLine
                    divider={index < microsPreview.length - 1}
                    icon={
                      <LeafIcon
                        size={16}
                        color={appColors.protein}
                        weight="regular"
                      />
                    }
                    key={item.key}
                    label={item.label}
                    value={
                      <NumericText variant="numberMacroRow">
                        {formatMicronutrientValue(item.value, item.unit)}
                      </NumericText>
                    }
                  />
                ),
              )}
            </View>
          </View>
          <CardFooter label="View micronutrients" />
        </InteractiveCard>
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
  macroSummaryRow: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginBottom: appSpacing.md,
  },
  macroSummaryStacked: { flexDirection: "column" },
  macroItem: {
    ...appMetricSurface,
    padding: appSpacing.sm,
    flex: 1,
    minWidth: 0,
  },
  macroItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xxs,
    flexWrap: "wrap",
    marginBottom: appSpacing.xs,
  },
  macroItemValue: {
    textAlign: "left",
    marginBottom: appSpacing.xxs,
  },
  macroItemHeaderCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  macroItemRail: {
    marginTop: appSpacing.sm,
  },
  section: {
    padding: 0,
    marginBottom: appSpacing.md,
  },
  sectionContent: {
    padding: appSpacing.md,
  },
  insightList: {
    marginTop: appSpacing.md,
  },
  microList: {
    marginTop: appSpacing.xs,
  },
});

export default HomeScreen;
