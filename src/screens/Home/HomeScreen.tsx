import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  BarcodeIcon,
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
import { formatWeightKg } from "../Weight/weightUtils";
import FoodBarcodeScannerModal from "../Food/FoodBarcodeScannerModal";
import type { ScannedFoodLookupResult } from "../Food/FoodBarcodeScannerShared";
import {
  resolveFoodLogContext,
  toFoodLogRouteParams,
} from "../Food/foodLogContext";
import { subscribeToAppDataChanges } from "../../store/dataChangeEvents";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
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
  text: appColors.textSecondary,
  muted: appColors.textMuted,
  glass: appColors.surfaceCard,
  glassBorder: appColors.borderSoft,
  track: appColors.borderSoft,
  shadow: appColors.slate400,
  coral: appColors.calories,
  coralSoft: appColors.brand300,
  sage: appColors.protein,
  sageSoft: appColors.surfaceField,
  gold: appColors.carbs,
  goldSoft: appColors.warningSurface,
  clay: appColors.fat,
  claySoft: appColors.dangerSoftBg,
} as const;

const formatHeroDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const formatWeightValue = (value: number | null) => {
  if (value == null) {
    return "--";
  }

  return `${formatWeightKg(value)} kg`;
};

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
          stroke={dashboardColors.sage}
          strokeWidth={innerStroke}
          strokeLinecap="round"
          strokeDasharray={`${innerCircumference} ${innerCircumference}`}
          strokeDashoffset={innerCircumference * (1 - clampedProteinProgress)}
          fill="none"
          transform={`rotate(-92 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.ringCenter}>
        <Text style={styles.ringValue} adjustsFontSizeToFit numberOfLines={1}>
          {centerValue}
          <Text style={styles.ringTarget}> / {targetValue} kcal</Text>
        </Text>
        <Text style={styles.ringCaption}>{remainingLabel}</Text>
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
    <View style={styles.macroTile}>
      <View style={styles.macroIconRow}>{icons}</View>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue} adjustsFontSizeToFit numberOfLines={1}>
        {formatWholeNumber(safeConsumed)} /{" "}
        {hasTarget ? formatWholeNumber(safeTarget) : "--"} g
      </Text>
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
    </View>
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
    <Text style={styles.insightMetricValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.insightMetricLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
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
  const [scannerVisible, setScannerVisible] = React.useState(false);
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

  const openScanner = React.useCallback(() => {
    setScannerVisible(true);
  }, []);

  const handleScannedFoodResolved = React.useCallback(
    (result: ScannedFoodLookupResult) => {
      const today = new Date();
      const foodLogContext = resolveFoodLogContext({
        date: formatFoodDateKey(today),
      });

      setScannerVisible(false);
      navigation.navigate("ScannedFood", {
        ...toFoodLogRouteParams(foodLogContext),
        foodId: result.foodId,
        barcode: result.barcode,
        scanStatus: result.status,
      });
    },
    [navigation],
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
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>
          Daily Summary
        </Text>
        <Text style={styles.dateText}>{formatHeroDate(new Date())}</Text>
        {updatedLabel ? (
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        ) : null}

        <Pressable
          onPress={openScanner}
          style={({ pressed }) => [
            styles.scanCta,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
        >
          <View style={styles.scanCtaIcon}>
            <BarcodeIcon
              size={26}
              color={appColors.white}
              weight="bold"
            />
          </View>
          <View style={styles.scanCtaCopy}>
            <Text style={styles.scanCtaTitle}>Scan barcode</Text>
            <Text style={styles.scanCtaText}>
              Add packaged food to today's diary.
            </Text>
          </View>
          <CaretRightIcon
            size={22}
            color={dashboardColors.muted}
            weight="bold"
          />
        </Pressable>

        {isLoading ? (
          <View style={[styles.loadingState, { height: ringSize + 52 }]}>
            <ActivityIndicator color={dashboardColors.coral} />
          </View>
        ) : error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void refreshSummary()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading home summary"
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
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
                accent={dashboardColors.sage}
                consumed={todayTotals.proteinG}
                icons={[
                  <DnaIcon
                    key="dna"
                    size={25}
                    color={dashboardColors.sage}
                    weight="regular"
                  />,
                  <FileTextIcon
                    key="file"
                    size={24}
                    color={dashboardColors.sage}
                    weight="regular"
                  />,
                ]}
                label="Protein"
                softAccent={dashboardColors.sageSoft}
                target={user?.proteinG ?? null}
              />
              <MacroTile
                accent={dashboardColors.gold}
                consumed={todayTotals.carbsG}
                icons={[
                  <BowlFoodIcon
                    key="bowl"
                    size={25}
                    color={dashboardColors.gold}
                    weight="regular"
                  />,
                  <ChartBarIcon
                    key="chart"
                    size={24}
                    color={dashboardColors.gold}
                    weight="regular"
                  />,
                ]}
                label="Carbs"
                softAccent={dashboardColors.goldSoft}
                target={user?.carbsG ?? null}
              />
              <MacroTile
                accent={dashboardColors.clay}
                consumed={todayTotals.fatG}
                icons={[
                  <DropIcon
                    key="drop"
                    size={25}
                    color={dashboardColors.clay}
                    weight="regular"
                  />,
                  <FlameIcon
                    key="flame"
                    size={24}
                    color={dashboardColors.clay}
                    weight="regular"
                  />,
                ]}
                label="Fat"
                softAccent={dashboardColors.claySoft}
                target={user?.fatG ?? null}
              />
            </View>
          </>
        )}

        <Pressable
          onPress={() =>
            navigation.navigate("More", {
              screen: "WeeklyReviewScreen",
            })
          }
          style={({ pressed }) => [
            styles.weeklySection,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <View style={[styles.inlineIcon, styles.weeklyIcon]}>
              <CalendarBlankIcon
                size={24}
                color={dashboardColors.clay}
                weight="regular"
              />
            </View>
            <Text
              style={styles.sectionTitle}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              Weekly Insights
            </Text>
            <CaretRightIcon
              size={22}
              color={appColors.textMuted}
              weight="bold"
            />
          </View>
          <Text style={styles.weeklyCopy}>
            Progress, calorie targets, weight trend, and repeated foods.
          </Text>

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
              value={
                currentWeightKg != null
                  ? `${formatWeightKg(currentWeightKg)} kg`
                  : "--"
              }
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
        </Pressable>

        <View style={styles.microsSection}>
          <Pressable
            onPress={() => navigation.navigate("MicrosOverview")}
            style={({ pressed }) => [
              styles.microsHeaderButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.inlineIcon, styles.microsIcon]}>
                <LeafIcon
                  size={24}
                  color={dashboardColors.sage}
                  weight="regular"
                />
              </View>
              <Text
                style={styles.sectionTitle}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                Micronutrients
              </Text>
            </View>
            <CaretRightIcon
              size={27}
              color="rgba(7, 7, 7, 0.34)"
              weight="regular"
            />
          </Pressable>

          <Text style={styles.microCount}>
            {trackedMicronutrientCount} tracked nutrients today
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.microTileRow}
          >
            {microsPreview.map((item) => (
              <View key={item.key} style={styles.microTile}>
                <Text style={styles.microLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.microValue}>
                  {formatMicronutrientValue(item.value, item.unit)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
      <FoodBarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onFoodResolved={handleScannedFoodResolved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dashboardColors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    ...appTypography.title,
    color: dashboardColors.ink,
  },
  dateText: {
    ...appTypography.bodySmall,
    color: dashboardColors.muted,
    marginTop: 4,
  },
  updatedText: {
    color: dashboardColors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 3,
  },
  scanCta: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: dashboardColors.glass,
    borderWidth: 1,
    borderColor: dashboardColors.glassBorder,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  scanCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.coral,
  },
  scanCtaCopy: {
    flex: 1,
    minWidth: 0,
  },
  scanCtaTitle: {
    color: dashboardColors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  scanCtaText: {
    color: dashboardColors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 2,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorPanel: {
    marginTop: 32,
    borderRadius: 8,
    backgroundColor: dashboardColors.glass,
    borderWidth: 1,
    borderColor: dashboardColors.glassBorder,
    padding: 16,
  },
  errorText: {
    color: appColors.dangerText,
    fontSize: 15,
    lineHeight: 21,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: appColors.dangerSoftBg,
    borderWidth: 1,
    borderColor: appColors.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },
  retryButtonText: {
    color: appColors.danger700,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  ringWrap: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 22,
  },
  ringShell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "68%",
  },
  ringValue: {
    color: dashboardColors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  ringTarget: {
    color: dashboardColors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  ringCaption: {
    color: dashboardColors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: 5,
    textAlign: "center",
  },
  macroGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  macroTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: dashboardColors.glass,
    borderWidth: 1,
    borderColor: dashboardColors.glassBorder,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  macroIconRow: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  macroLabel: {
    color: dashboardColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  macroValue: {
    color: dashboardColors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  macroTrack: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: 999,
  },
  weeklySection: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  weeklyIcon: {
    backgroundColor: dashboardColors.claySoft,
  },
  microsIcon: {
    backgroundColor: appColors.surfaceField,
  },
  sectionTitle: {
    flex: 1,
    color: dashboardColors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  weeklyCopy: {
    color: dashboardColors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 10,
  },
  insightMetricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  insightMetric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  insightMetricIcon: {
    marginBottom: 8,
  },
  insightMetricValue: {
    color: dashboardColors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "600",
    letterSpacing: 0,
  },
  insightMetricLabel: {
    color: dashboardColors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
    marginTop: 2,
  },
  microsSection: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  microsHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  microCount: {
    color: dashboardColors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: 0,
    marginTop: 6,
    marginLeft: 50,
  },
  microTileRow: {
    gap: 10,
    paddingTop: 14,
    paddingBottom: 2,
    paddingRight: 8,
  },
  microTile: {
    width: 154,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  microLabel: {
    color: dashboardColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  microValue: {
    color: dashboardColors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  pressed: {
    opacity: 0.86,
  },
});

export default HomeScreen;
