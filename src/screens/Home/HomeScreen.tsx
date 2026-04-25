import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CalendarCheckIcon,
  CaretRightIcon,
  ChartLineIcon,
  ScalesIcon,
  SparkleIcon,
  TargetIcon,
  TrendUpIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { getEffectiveCalorieTargetForDate } from "../../engine/calorieTargets";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import AnimatedSwapImage from "../../components/AnimatedSwapImage";
import { MacroBar } from "../Food/FoodDiaryHeroCard";
import type { FoodNutritionTotals } from "../Food/foodUtils";
import {
  computeGoalProgress,
  computeMovingAverage,
  collapseEntriesByLocalDate,
  formatWeightKg,
  roundWeightKg,
} from "../Weight/weightUtils";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  buildRecentDateKeys,
  createEmptyMicronutrientTotals,
  formatMicronutrientValue,
  getMicronutrientPreviewItems,
  loadNutritionSnapshot,
  type MicronutrientTotals,
} from "./homeNutrition";

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
const catOneImage = require("../../../assets/images/cat-1.png");
const catTwoImage = require("../../../assets/images/cat-2.png");

const formatHeroDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const formatTrendValue = (value: number | null) => {
  if (value == null) {
    return "--";
  }

  const rounded = roundWeightKg(value);
  return `${rounded > 0 ? "+" : ""}${formatWeightKg(rounded)} kg`;
};

type CalorieGaugeProps = {
  consumed: number;
  remaining: number | null;
  target: number | null;
};

const CalorieGauge = ({
  consumed,
  remaining,
  target,
}: CalorieGaugeProps) => {
  const width = 220;
  const height = 128;
  const strokeWidth = 14;
  const radius = 90;
  const centerX = width / 2;
  const centerY = height - 16;
  const arcLength = Math.PI * radius;
  const safeTarget = target != null && target > 0 ? target : null;
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const clampedRatio = safeTarget
    ? Math.min(Math.max(safeConsumed / safeTarget, 0), 1)
    : 0;
  const gaugePath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;
  const primaryValue = safeTarget
    ? Math.abs(Math.round(remaining ?? 0)).toString()
    : Math.round(safeConsumed).toString();
  const primaryLabel = safeTarget
    ? remaining != null && remaining < 0
      ? "kcal over"
      : "kcal left"
    : "kcal consumed";
  const progressLabel = safeTarget
    ? `${Math.round(safeConsumed)} of ${Math.round(safeTarget)} kcal`
    : "Target not set yet";

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={width} height={height}>
        <Path
          d={gaugePath}
          stroke={appColors.surfaceGhostStrong}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={gaugePath}
          stroke={appColors.brand500}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={arcLength * (1 - clampedRatio)}
          fill="none"
        />
      </Svg>

      <View style={styles.gaugeCenter}>
        <Text style={styles.gaugeValue}>{primaryValue}</Text>
        <Text style={styles.gaugeLabel}>{primaryLabel}</Text>
        <Text style={styles.gaugeProgressText}>{progressLabel}</Text>
      </View>
    </View>
  );
};

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
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
  const [sevenDayTrendKg, setSevenDayTrendKg] = React.useState<number | null>(
    null,
  );
  const [goalProgressPercent, setGoalProgressPercent] = React.useState<
    number | null
  >(null);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      const load = async () => {
        if (!user?.externalId) {
          if (active) {
            setTodayTotals(EMPTY_TOTALS);
            setTodayMicros(INITIAL_MICROS);
            setTrackedMicronutrientCount(0);
            setCalorieTarget(null);
            setCurrentWeightKg(null);
            setSevenDayTrendKg(null);
            setGoalProgressPercent(null);
            setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const todayDate = new Date();
          const [settings, todaySnapshot, weightEntries, goal] = await Promise.all([
            DB.getUserSettings(user.externalId),
            loadNutritionSnapshot(user.externalId, buildRecentDateKeys(1, todayDate)),
            DB.listWeightEntries(user.externalId, { includeDeleted: true }),
            DB.getWeightGoal(user.externalId),
          ]);

          if (!active) {
            return;
          }

          const resolvedTarget = getEffectiveCalorieTargetForDate({
            date: todayDate,
            baseCalories: user.calorieAllowance,
            settings,
          });
          const activeWeightEntries = collapseEntriesByLocalDate(
            weightEntries.filter((entry) => entry.deletedAt == null),
          );
          const currentEntry = activeWeightEntries[0] ?? null;
          const startingEntry =
            activeWeightEntries[activeWeightEntries.length - 1] ?? null;
          const sevenDayAverage = computeMovingAverage(activeWeightEntries, 7);
          const trendValue =
            currentEntry && sevenDayAverage != null
              ? roundWeightKg(currentEntry.valueKg - sevenDayAverage)
              : null;
          const goalProgress =
            currentEntry && startingEntry
              ? computeGoalProgress(
                  currentEntry.valueKg,
                  startingEntry.valueKg,
                  goal,
                )
              : null;

          setTodayTotals(todaySnapshot.totals);
          setTodayMicros(todaySnapshot.micronutrients);
          setTrackedMicronutrientCount(todaySnapshot.trackedMicronutrientCount);
          setCalorieTarget(resolvedTarget);
          setCurrentWeightKg(currentEntry?.valueKg ?? null);
          setSevenDayTrendKg(trendValue);
          setGoalProgressPercent(goalProgress);
        } catch (loadError) {
          if (!active) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your home summary.",
          );
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [
      user?.calorieAllowance,
      user?.carbsG,
      user?.externalId,
      user?.fatG,
      user?.proteinG,
    ]),
  );

  const caloriesRemaining =
    calorieTarget != null ? Math.round(calorieTarget - todayTotals.calories) : null;
  const microsPreview = React.useMemo(
    () => getMicronutrientPreviewItems(todayMicros, 4),
    [todayMicros],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.title}>Your day at a glance.</Text>
          <Text style={styles.subtitle}>{formatHeroDate(new Date())}</Text>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={appColors.brand500} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <CalorieGauge
                consumed={todayTotals.calories}
                remaining={caloriesRemaining}
                target={calorieTarget}
              />

              <View style={styles.heroMetricRow}>
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillLabel}>Consumed</Text>
                  <Text style={styles.metricPillText}>
                    {Math.round(todayTotals.calories)} kcal
                  </Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillLabel}>Target</Text>
                  <Text style={styles.metricPillText}>
                    {calorieTarget != null
                      ? `${Math.round(calorieTarget)} kcal`
                      : "Set in onboarding"}
                  </Text>
                </View>
              </View>

              <View style={styles.macroStack}>
                <MacroBar
                  accent={appColors.success500}
                  consumed={todayTotals.proteinG}
                  label="Protein"
                  target={user?.proteinG ?? null}
                  unit="g"
                />
                <MacroBar
                  accent={appColors.brand400}
                  consumed={todayTotals.carbsG}
                  label="Carbs"
                  target={user?.carbsG ?? null}
                  unit="g"
                />
                <MacroBar
                  accent={appColors.warning600}
                  consumed={todayTotals.fatG}
                  label="Fat"
                  target={user?.fatG ?? null}
                  unit="g"
                />
              </View>
            </>
          )}
        </View>

        <Pressable
          onPress={() =>
            navigation.navigate("More", {
              screen: "WeeklyReviewScreen",
            })
          }
          style={({ pressed }) => [
            styles.sectionCard,
            styles.weeklyReviewCard,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.weeklyReviewCopy}>
              <Text style={styles.sectionEyebrow}>Insights</Text>
              <Text style={styles.cardTitle}>Weekly review</Text>
              <Text style={styles.cardText}>
                Calories vs target, completed days, weight trend, adaptive status,
                and repeated foods.
              </Text>
            </View>
            <View style={[styles.cardIcon, styles.weeklyReviewIcon]}>
              <CalendarCheckIcon
                size={18}
                color={appColors.textPrimary}
                weight="fill"
              />
            </View>
          </View>

          <View style={styles.weeklyReviewFooter}>
            <Text style={styles.weeklyReviewFooterText}>Open review</Text>
            <CaretRightIcon
              size={14}
              color={appColors.textPrimary}
              weight="bold"
            />
          </View>
        </Pressable>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Progress</Text>
              <Text style={styles.cardTitle}>Weight snapshot</Text>
            </View>
            <View style={styles.cardIcon}>
              <ChartLineIcon
                size={18}
                color={appColors.textPrimary}
                weight="bold"
              />
            </View>
          </View>

          <View style={styles.progressGrid}>
            <View style={styles.progressMetric}>
              <View style={styles.progressMetricHeader}>
                <ScalesIcon
                  size={14}
                  color={appColors.textSecondary}
                  weight="bold"
                />
                <Text style={styles.progressMetricLabel}>Current weight</Text>
              </View>
              <Text style={styles.progressMetricValue}>
                {currentWeightKg != null
                  ? `${formatWeightKg(currentWeightKg)} kg`
                  : "--"}
              </Text>
              <Text style={styles.progressMetricCaption}>
                Most recent logged check-in.
              </Text>
            </View>

            <View style={styles.progressMetric}>
              <View style={styles.progressMetricHeader}>
                <TrendUpIcon
                  size={14}
                  color={appColors.textSecondary}
                  weight="bold"
                />
                <Text style={styles.progressMetricLabel}>7 day trend</Text>
              </View>
              <Text style={styles.progressMetricValue}>
                {formatTrendValue(sevenDayTrendKg)}
              </Text>
              <Text style={styles.progressMetricCaption}>Versus 7 day average.</Text>
            </View>

            <View style={styles.progressMetric}>
              <View style={styles.progressMetricHeader}>
                <TargetIcon
                  size={14}
                  color={appColors.textSecondary}
                  weight="bold"
                />
                <Text style={styles.progressMetricLabel}>Percent to goal</Text>
              </View>
              <Text style={styles.progressMetricValue}>
                {goalProgressPercent != null ? `${goalProgressPercent}%` : "--"}
              </Text>
              <Text style={styles.progressMetricCaption}>
                Based on your current weight goal.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate("MicrosOverview")}
          style={({ pressed }) => [
            styles.sectionCard,
            styles.microsCard,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Micros</Text>
              <Text style={styles.cardTitle}>Micronutrients today</Text>
            </View>
            <View style={[styles.cardIcon, styles.cardIconAlt]}>
              <SparkleIcon
                size={18}
                color={appColors.textPrimary}
                weight="fill"
              />
            </View>
          </View>

          <View style={styles.microsHeaderRow}>
            <Text style={styles.microsHeadline}>
              {trackedMicronutrientCount} tracked nutrients
            </Text>
            <View style={styles.openPill}>
              <Text style={styles.openPillText}>Open</Text>
              <CaretRightIcon
                size={14}
                color={appColors.textPrimary}
                weight="bold"
              />
            </View>
          </View>
          <Text style={styles.cardText}>
            Review today or switch to a 7 day average in the full micronutrient
            view.
          </Text>

          <View style={styles.microsBodyRow}>
            <View style={styles.microsPreviewGrid}>
              {microsPreview.map((item) => (
                <View key={item.key} style={styles.microsPreviewTile}>
                  <Text style={styles.microsPreviewLabel}>{item.label}</Text>
                  <Text style={styles.microsPreviewValue}>
                    {formatMicronutrientValue(item.value, item.unit)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.microsMascotCard}>
              <AnimatedSwapImage
                firstSource={catOneImage}
                secondSource={catTwoImage}
                containerStyle={styles.microsMascotInner}
                imageStyle={styles.microsMascotImage}
                frameDurationMs={650}
                firstHoldMs={600}
                secondHoldMs={450}
                bobDurationMs={1500}
                bobDistance={5}
              />
            </View>
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
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    ...appTypography.label,
    alignSelf: "flex-start",
    color: appColors.textSecondary,
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  title: {
    ...appTypography.displayHero,
    color: appColors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 18,
  },
  heroMetricRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  metricPill: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  metricPillLabel: {
    ...appTypography.label,
    color: appColors.textMuted,
    marginBottom: 6,
  },
  metricPillText: {
    ...appTypography.bodyStrong,
    color: appColors.textPrimary,
  },
  gaugeWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  gaugeCenter: {
    position: "absolute",
    top: 50,
    alignItems: "center",
  },
  gaugeValue: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
  },
  gaugeLabel: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginTop: -2,
    marginBottom: 6,
  },
  gaugeProgressText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  macroStack: {
    gap: 10,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  errorText: {
    ...appTypography.bodySmall,
    color: appColors.dangerText,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 4,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand700,
  },
  cardIconAlt: {
    backgroundColor: appColors.success600,
  },
  weeklyReviewCard: {
    backgroundColor: appColors.surfaceCardAlt,
  },
  weeklyReviewCopy: {
    flex: 1,
  },
  weeklyReviewIcon: {
    backgroundColor: appColors.success700,
  },
  weeklyReviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  weeklyReviewFooterText: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
    fontWeight: "700",
  },
  cardTitle: {
    ...appTypography.title,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  cardText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  progressGrid: {
    gap: 12,
  },
  progressMetric: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
  },
  progressMetricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  progressMetricLabel: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  progressMetricValue: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  progressMetricCaption: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  microsCard: {
    marginBottom: 20,
  },
  microsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  microsHeadline: {
    ...appTypography.title,
    color: appColors.textPrimary,
    flex: 1,
  },
  openPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openPillText: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
    fontWeight: "700",
  },
  microsPreviewGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  microsBodyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    marginTop: 16,
  },
  microsPreviewTile: {
    width: "47%",
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 10,
  },
  microsPreviewLabel: {
    ...appTypography.label,
    fontSize: 10,
    color: appColors.textMuted,
    marginBottom: 6,
  },
  microsPreviewValue: {
    ...appTypography.bodyStrong,
    color: appColors.brand300,
  },
  microsMascotCard: {
    width: 100,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  microsMascotInner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 116,
  },
  microsMascotImage: {
    width: 96,
    height: 96,
  },
  microsMascotCaption: {
    ...appTypography.bodySmall,
    color: appColors.textMuted,
    textAlign: "center",
  },
  emptyMicrosText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    marginTop: 14,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default HomeScreen;


