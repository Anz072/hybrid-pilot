import React from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BowlFoodIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  ChartBarIcon,
  DnaIcon,
  DropIcon,
  FileTextIcon,
  FlameIcon,
  LeafIcon,
  ScalesIcon,
  TargetIcon,
  TrendUpIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { formatFoodDateKey, type FoodNutritionTotals } from "../Food/foodUtils";
import { formatWeight } from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { subscribeToAppDataChanges } from "../../store/dataChangeEvents";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import {
  AppButton,
  AppCard,
  AppText,
  ErrorState,
  InteractiveCard,
  LoadingState,
  NumericText,
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

const dashboardColors = {
  background: appColors.surfaceCanvas,
  ink: appColors.textPrimary,
  muted: appColors.textMuted,
  track: appColors.borderSoft,
  coral: appColors.calories,
  protein: appColors.protein,
  proteinSoft: appColors.surfaceField,
  carbs: appColors.carbs,
  carbsSoft: appColors.warningSurface,
  fat: appColors.fat,
  fatSoft: appColors.surfaceField,
} as const;

const formatHeroDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const formatSummaryUpdatedAt = (loadedAt: string | null) => {
  if (!loadedAt) {
    return null;
  }

  const timestamp = new Date(loadedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) {
    return "Updated just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `Updated ${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Updated ${elapsedHours}h ago`;
  }

  return `Updated ${new Date(loadedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const clampRatio = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
};

const formatWholeNumber = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }

  return Math.round(value).toLocaleString();
};

type CalorieRingsProps = {
  consumed: number;
  proteinProgress: number;
  remaining: number | null;
  size: number;
  target: number | null;
};

const CalorieRings = ({
  consumed,
  proteinProgress,
  remaining,
  size,
  target,
}: CalorieRingsProps) => {
  const center = size / 2;
  const outerStroke = 13;
  const innerStroke = 13;
  const outerRadius = center - 19;
  const innerRadius = center - 42;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const safeTarget = target != null && target > 0 ? target : null;
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const calorieProgress = safeTarget ? clampRatio(safeConsumed / safeTarget) : 0;
  const clampedProteinProgress = clampRatio(proteinProgress);
  const centerValue = Math.round(safeConsumed).toLocaleString();
  const targetValue = safeTarget ? Math.round(safeTarget).toLocaleString() : "--";
  const remainingValue =
    remaining != null ? Math.abs(Math.round(remaining)).toLocaleString() : null;
  const remainingLabel =
    remaining == null
      ? "Set a calorie target"
      : remaining < 0
        ? `${remainingValue} kcal over`
        : `${remainingValue} kcal left`;

  return (
    <View style={[styles.ringShell, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          stroke={dashboardColors.track}
          strokeWidth={outerStroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          stroke={dashboardColors.coral}
          strokeWidth={outerStroke}
          strokeLinecap="round"
          strokeDasharray={`${outerCircumference} ${outerCircumference}`}
          strokeDashoffset={outerCircumference * (1 - calorieProgress)}
          fill="none"
          transform={`rotate(-92 ${center} ${center})`}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          stroke={dashboardColors.track}
          strokeWidth={innerStroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          stroke={dashboardColors.protein}
          strokeWidth={innerStroke}
          strokeLinecap="round"
          strokeDasharray={`${innerCircumference} ${innerCircumference}`}
          strokeDashoffset={innerCircumference * (1 - clampedProteinProgress)}
          fill="none"
          transform={`rotate(-92 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.ringCenter}>
        <View style={styles.ringValueRow}>
          <NumericText
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.ringValue}
            variant="numberCalorieHero"
          >
            {centerValue}
          </NumericText>
          <AppText color="secondary" style={styles.ringTarget} variant="label">
            / {targetValue} kcal
          </AppText>
        </View>
        <AppText align="center" color="muted" style={styles.ringCaption} variant="bodySmall">
          {remainingLabel}
        </AppText>
      </View>
    </View>
  );
};

type MacroTileProps = {
  accent: string;
  consumed: number;
  icons: React.ReactNode[];
  label: string;
  softAccent: string;
  target: number | null;
};

const MacroTile = ({
  accent,
  consumed,
  icons,
  label,
  softAccent,
  target,
}: MacroTileProps) => {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = target != null && Number.isFinite(target) ? target : null;
  const hasTarget = safeTarget != null && safeTarget > 0;
  const progress = hasTarget ? clampRatio(safeConsumed / safeTarget) : 0;

  return (
    <AppCard variant="compact" style={styles.macroTile}>
      <View style={styles.macroIconRow}>{icons}</View>
      <AppText style={styles.macroLabel} variant="bodySmallStrong">
        {label}
      </AppText>
      <NumericText
        color="secondary"
        style={styles.macroValue}
        adjustsFontSizeToFit
        numberOfLines={1}
        variant="numberMacroRow"
      >
        {formatWholeNumber(safeConsumed)} /{" "}
        {hasTarget ? formatWholeNumber(safeTarget) : "--"} g
      </NumericText>
      <View style={[styles.macroTrack, { backgroundColor: softAccent }]}>
        <View
          style={[
            styles.macroFill,
            {
              backgroundColor: accent,
              width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%`,
            },
          ]}
        />
      </View>
    </AppCard>
  );
};

type InsightMetricProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

const InsightMetric = ({ icon, label, value }: InsightMetricProps) => (
  <View style={styles.insightMetric}>
    <View style={styles.insightMetricIcon}>{icon}</View>
    <NumericText style={styles.insightMetricValue} numberOfLines={1} variant="numberWeightEntry">
      {value}
    </NumericText>
    <AppText color="muted" style={styles.insightMetricLabel} numberOfLines={1} variant="label">
      {label}
    </AppText>
  </View>
);

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { weightUnit } = useDisplayPreferences();
  const formatWeightValue = (value: number | null) =>
    value != null ? formatWeight(value, weightUnit) : "--";
  const navigation = useNavigation<HomeNavigation>();
  const { width } = useWindowDimensions();
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
  const [summaryLoadedAt, setSummaryLoadedAt] = React.useState<string | null>(
    null,
  );
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
    setSummaryLoadedAt(summary.loadedAt);
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
    setSummaryLoadedAt(null);
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
  const proteinProgress =
    user?.proteinG != null && user.proteinG > 0
      ? todayTotals.proteinG / user.proteinG
      : 0;
  const ringSize = Math.min(Math.max(width - 126, 220), 280);
  const microsPreview = React.useMemo(
    () => getMicronutrientPreviewItems(todayMicros, 4),
    [todayMicros],
  );
  const updatedLabel = formatSummaryUpdatedAt(summaryLoadedAt);

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
        <AppText style={styles.title} adjustsFontSizeToFit numberOfLines={1} variant="sectionTitle">
          Daily Summary
        </AppText>
        <AppText color="muted" style={styles.dateText} variant="bodySmall">
          {formatHeroDate(new Date())}
        </AppText>
        {updatedLabel ? (
          <AppText color="muted" style={styles.updatedText} variant="metadata">
            {updatedLabel}
          </AppText>
        ) : null}

        {isLoading ? (
          <LoadingState
            message="Checking today's logged food and targets."
            style={[styles.loadingState, { minHeight: ringSize + 52 }]}
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
            <View style={styles.ringWrap}>
              <CalorieRings
                consumed={todayTotals.calories}
                proteinProgress={proteinProgress}
                remaining={caloriesRemaining}
                size={ringSize}
                target={calorieTarget}
              />
            </View>

            <View style={styles.macroGrid}>
              <MacroTile
                accent={dashboardColors.protein}
                consumed={todayTotals.proteinG}
                icons={[
                  <DnaIcon
                    key="dna"
                    size={25}
                    color={dashboardColors.protein}
                    weight="regular"
                  />,
                  <FileTextIcon
                    key="file"
                    size={24}
                    color={dashboardColors.protein}
                    weight="regular"
                  />,
                ]}
                label="Protein"
                softAccent={dashboardColors.proteinSoft}
                target={user?.proteinG ?? null}
              />
              <MacroTile
                accent={dashboardColors.carbs}
                consumed={todayTotals.carbsG}
                icons={[
                  <BowlFoodIcon
                    key="bowl"
                    size={25}
                    color={dashboardColors.carbs}
                    weight="regular"
                  />,
                  <ChartBarIcon
                    key="chart"
                    size={24}
                    color={dashboardColors.carbs}
                    weight="regular"
                  />,
                ]}
                label="Carbs"
                softAccent={dashboardColors.carbsSoft}
                target={user?.carbsG ?? null}
              />
              <MacroTile
                accent={dashboardColors.fat}
                consumed={todayTotals.fatG}
                icons={[
                  <DropIcon
                    key="drop"
                    size={25}
                    color={dashboardColors.fat}
                    weight="regular"
                  />,
                  <FlameIcon
                    key="flame"
                    size={24}
                    color={dashboardColors.fat}
                    weight="regular"
                  />,
                ]}
                label="Fat"
                softAccent={dashboardColors.fatSoft}
                target={user?.fatG ?? null}
              />
            </View>
          </>
        )}

        <InteractiveCard
          onPress={() =>
            navigation.navigate("More", {
              screen: "WeeklyReviewScreen",
            })
          }
          style={styles.weeklySection}
          variant="standard"
        >
          <View style={styles.sectionTitleRow}>
            <View style={[styles.inlineIcon, styles.weeklyIcon]}>
              <CalendarBlankIcon
                size={24}
                color={dashboardColors.fat}
                weight="regular"
              />
            </View>
            <AppText
              style={styles.sectionTitle}
              adjustsFontSizeToFit
              numberOfLines={1}
              variant="sectionTitle"
            >
              Weekly Insights
            </AppText>
            <CaretRightIcon
              size={22}
              color={appColors.textMuted}
              weight="bold"
            />
          </View>
          <AppText color="secondary" style={styles.weeklyCopy} variant="bodySmall">
            Progress, calorie targets, weight trend, and repeated foods.
          </AppText>

          <View style={styles.insightMetricRow}>
            <InsightMetric
              icon={
                <ScalesIcon
                  size={15}
                  color={dashboardColors.muted}
                  weight="regular"
                />
              }
              label="Latest"
              value={formatWeightValue(currentWeightKg)}
            />
            <InsightMetric
              icon={
                <TrendUpIcon
                  size={15}
                  color={dashboardColors.muted}
                  weight="regular"
                />
              }
              label="7-day avg"
              value={formatWeightValue(sevenDayAverageWeightKg)}
            />
            <InsightMetric
              icon={
                <TargetIcon
                  size={15}
                  color={dashboardColors.muted}
                  weight="regular"
                />
              }
              label="To goal"
              value={
                goalProgressPercent != null ? `${goalProgressPercent}%` : "--"
              }
            />
          </View>
        </InteractiveCard>

        <InteractiveCard
          onPress={() => navigation.navigate("MicrosOverview")}
          accessibilityLabel="Open micronutrients overview"
          style={styles.microsSection}
          variant="standard"
        >
          <View style={styles.microsHeaderButton}>
            <View
              style={[styles.sectionTitleRow, styles.microsHeaderTitleRow]}
            >
              <View style={[styles.inlineIcon, styles.microsIcon]}>
                <LeafIcon
                  size={24}
                  color={appColors.protein}
                  weight="regular"
                />
              </View>
              <AppText
                style={styles.sectionTitle}
                adjustsFontSizeToFit
                numberOfLines={1}
                variant="sectionTitle"
              >
                Micronutrients
              </AppText>
            </View>
            <View style={styles.microsChevron}>
              <CaretRightIcon
                size={22}
                color={appColors.textMuted}
                weight="regular"
              />
            </View>
          </View>

          <AppText color="muted" style={styles.microCount} variant="bodySmall">
            {trackedMicronutrientCount} tracked nutrients today
          </AppText>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.microTileRow}
          >
            {microsPreview.map((item) => (
              <AppCard key={item.key} variant="compact" style={styles.microTile}>
                <AppText style={styles.microLabel} numberOfLines={1} variant="bodySmallStrong">
                  {item.label}
                </AppText>
                <NumericText color="secondary" style={styles.microValue} variant="numberMacroRow">
                  {formatMicronutrientValue(item.value, item.unit)}
                </NumericText>
              </AppCard>
            ))}
          </ScrollView>
        </InteractiveCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dashboardColors.background,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
  },
  title: {
    color: dashboardColors.ink,
  },
  dateText: {
    marginTop: 4,
  },
  updatedText: {
    marginTop: 3,
  },
  loadingState: {
    marginTop: appSpacing.xl,
    marginBottom: appSpacing.md,
  },
  errorPanel: {
    marginTop: appSpacing.xl,
    marginBottom: appSpacing.md,
  },
  ringWrap: {
    alignItems: "center",
    marginTop: appSpacing.md,
    marginBottom: appSpacing.xl,
  },
  ringShell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.pill,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 0,
    borderColor: appColors.borderSoft,
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "68%",
  },
  ringValueRow: {
    alignItems: "baseline",
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  ringValue: {
    color: dashboardColors.ink,
    textAlign: "center",
  },
  ringTarget: {
    marginLeft: appSpacing.xxs,
  },
  ringCaption: {
    marginTop: appSpacing.xxs,
  },
  macroGrid: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginBottom: appSpacing.md,
  },
  macroTile: {
    borderWidth: 0,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: appSpacing.sm,
    paddingTop: appSpacing.sm,
    paddingBottom: appSpacing.sm,
  },
  macroIconRow: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: appSpacing.sm,
  },
  macroLabel: {
    color: dashboardColors.ink,
    marginBottom: appSpacing.xxs,
  },
  macroValue: {
    textAlign: "left",
    marginBottom: appSpacing.sm,
  },
  macroTrack: {
    height: 9,
    borderRadius: appRadius.pill,
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: appRadius.pill,
  },
  weeklySection: {
    borderWidth: 0,
    marginBottom: appSpacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  inlineIcon: {
    width: 38,
    height: 38,
    borderRadius: appRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  weeklyIcon: {
    backgroundColor: appSurfaces.soft,
  },
  microsIcon: {
    backgroundColor: appColors.surfaceField,
  },
  sectionTitle: {
    flex: 1,
    color: dashboardColors.ink,
  },
  weeklyCopy: {
    marginTop: appSpacing.xs,
  },
  insightMetricRow: {
    flexDirection: "row",
    gap: appSpacing.xs,
    marginTop: appSpacing.sm,
  },
  insightMetric: {
    flex: 1,
    minWidth: 0,
    borderRadius: appRadius.md,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: appSpacing.xs,
    paddingVertical: appSpacing.sm,
  },
  insightMetricIcon: {
    marginBottom: appSpacing.xs,
  },
  insightMetricValue: {
    textAlign: "left",
  },
  insightMetricLabel: {
    marginTop: appSpacing.xxs,
  },
  microsSection: {
    borderWidth: 0,
    marginBottom: appSpacing.md,
  },
  microsHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  microsHeaderTitleRow: {
    flex: 1,
    minWidth: 0,
  },
  microsChevron: {
    width: 28,
    minHeight: 38,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  microCount: {
    marginTop: appSpacing.xs,
    marginLeft: 46,
  },
  microTileRow: {
    gap: appSpacing.xs,
    paddingTop: appSpacing.sm,
    paddingBottom: appSpacing.xxs,
    paddingRight: appSpacing.xs,
  },
  microTile: {
    width: 154,
    backgroundColor: appSurfaces.soft,
  },
  microLabel: {
    color: dashboardColors.ink,
  },
  microValue: {
    textAlign: "left",
    marginTop: appSpacing.xs,
  },
});

export default HomeScreen;
