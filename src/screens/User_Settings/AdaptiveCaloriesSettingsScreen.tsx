import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import type {
  AdaptiveRecommendationOutcome,
  DBAdaptiveCalorieRecommendation,
  DBUserSettings,
} from "../../store/DB_TYPES";
import { appColors } from "../../theme/colors";
import { markAdaptiveRecommendationSeen } from "../../storage/localStore";
import SettingsStackHeader from "./SettingsStackHeader";
import {
  applyAdaptiveRecommendationForUser,
  getNextAdaptiveReviewDate,
  refreshAdaptiveRecommendationForUser,
  rejectAdaptiveRecommendationForUser,
} from "./adaptiveCaloriesActions";

type Props = NativeStackScreenProps<
  MoreParamList,
  "AdaptiveCaloriesSettingsScreen"
>;

const formatRecommendationStatus = (
  status: DBAdaptiveCalorieRecommendation["status"],
) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatWindowLabel = (startDate: string, endDate: string) =>
  `${new Date(`${startDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${new Date(`${endDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

const formatSignedWeightChange = (value: number | null) =>
  value == null ? "Not enough weigh-ins" : `${value > 0 ? "+" : ""}${value.toFixed(2)} kg/week`;

const formatNextReviewValue = (settings: DBUserSettings | null) => {
  const nextReviewDate = getNextAdaptiveReviewDate(settings);

  if (!settings?.adaptiveCaloriesEnabled) {
    return "Turn on adaptive calories";
  }

  if (!nextReviewDate) {
    return "Ready when enough data is available";
  }

  return nextReviewDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const AdaptiveCaloriesSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [settings, setSettings] = React.useState<DBUserSettings | null>(null);
  const [latestRecommendation, setLatestRecommendation] =
    React.useState<DBAdaptiveCalorieRecommendation | null>(null);
  const [history, setHistory] = React.useState<DBAdaptiveCalorieRecommendation[]>(
    [],
  );
  const [analysis, setAnalysis] = React.useState<AdaptiveRecommendationOutcome | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [savingToggle, setSavingToggle] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState(false);

  const loadScreen = React.useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (!user) {
        setSettings(null);
        setLatestRecommendation(null);
        setHistory([]);
        setAnalysis(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const baseSettings = await DB.getUserSettings(user.externalId);

        if (baseSettings?.adaptiveCaloriesEnabled) {
          const refreshResult = await refreshAdaptiveRecommendationForUser({
            userExternalId: user.externalId,
            force: options?.force ?? false,
          });
          const nextHistory = await DB.listAdaptiveCalorieRecommendations({
            userExternalId: user.externalId,
            limit: 12,
          });

          setSettings(refreshResult.settings ?? baseSettings);
          setLatestRecommendation(refreshResult.latestRecommendation);
          setHistory(nextHistory);
          setAnalysis(refreshResult.analysis);
        } else {
          const nextHistory = await DB.listAdaptiveCalorieRecommendations({
            userExternalId: user.externalId,
            limit: 12,
          });

          setSettings(baseSettings);
          setLatestRecommendation(null);
          setHistory(nextHistory);
          setAnalysis({
            status: "disabled",
            reason:
              "Adaptive calories is off. Turn it on to analyze complete diary days against your weight trend.",
            confidence: null,
            estimatedTdee: null,
            recommendedBaseCalories: null,
            summary: null,
          });
        }
      } catch {
        Alert.alert(
          "Could not load adaptive calories",
          "Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadScreen();
    }, [loadScreen]),
  );

  React.useEffect(() => {
    if (!user || !latestRecommendation) {
      return;
    }

    void markAdaptiveRecommendationSeen(user.externalId, latestRecommendation.id);
  }, [latestRecommendation, user]);

  const handleToggleAdaptive = async () => {
    if (!user) {
      return;
    }

    setSavingToggle(true);

    try {
      const nextEnabled = !(settings?.adaptiveCaloriesEnabled ?? false);
      await DB.saveUserSettings({
        userExternalId: user.externalId,
        adaptiveCaloriesEnabled: nextEnabled,
        adaptiveMode: "recommend",
        adaptiveLastCalculatedAt: nextEnabled ? null : new Date().toISOString(),
      });
      await loadScreen({ force: nextEnabled });
    } catch {
      Alert.alert("Could not update adaptive calories", "Please try again.");
    } finally {
      setSavingToggle(false);
    }
  };

  const handleRefreshNow = async () => {
    if (!user) {
      return;
    }

    await loadScreen({ force: true, silent: true });
  };

  const handleApply = async () => {
    if (!user || !latestRecommendation) {
      return;
    }

    setActionBusy(true);

    try {
      await applyAdaptiveRecommendationForUser({
        dispatch,
        recommendation: latestRecommendation,
        user,
        settings,
      });
      await loadScreen({ force: false });
    } catch {
      Alert.alert("Could not apply recommendation", "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async () => {
    if (!latestRecommendation) {
      return;
    }

    setActionBusy(true);

    try {
      await rejectAdaptiveRecommendationForUser({
        recommendation: latestRecommendation,
      });
      await loadScreen({ force: false });
    } catch {
      Alert.alert("Could not dismiss recommendation", "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

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
        <SettingsStackHeader
          eyebrow="User Settings"
          onBack={() => navigation.goBack()}
          subtitle="Use fully completed diary days and recent weight trend to review quieter calorie-target suggestions. V1 only recommends changes and never auto-applies them."
          title="Adaptive Calories"
        />

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active user</Text>
            <Text style={styles.cardText}>
              Sign in with Google to use adaptive calories.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={appColors.brand700} />
            <Text style={styles.cardText}>Loading adaptive calorie state...</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.copyColumn}>
                  <Text style={styles.cardTitle}>Adaptive calories</Text>
                  <Text style={styles.cardText}>
                    Inputs used: complete diary days, logged calorie intake, and recent weight trend.
                  </Text>
                  <Text style={styles.cardText}>
                    Ignored in v1: exercise calories, push notifications, and silent auto-apply.
                  </Text>
                </View>
                <Pressable
                  onPress={handleToggleAdaptive}
                  disabled={savingToggle}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    settings?.adaptiveCaloriesEnabled && styles.toggleButtonActive,
                    pressed && !savingToggle && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      settings?.adaptiveCaloriesEnabled &&
                        styles.toggleButtonTextActive,
                    ]}
                  >
                    {savingToggle
                      ? "Saving..."
                      : settings?.adaptiveCaloriesEnabled
                        ? "On"
                        : "Off"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Mode</Text>
                <Text style={styles.metaValue}>Recommend only</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Last calculation</Text>
                <Text style={styles.metaValue}>
                  {settings?.adaptiveLastCalculatedAt
                    ? new Date(settings.adaptiveLastCalculatedAt).toLocaleString()
                    : "Not calculated yet"}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Next review</Text>
                <Text style={styles.metaValue}>
                  {formatNextReviewValue(settings)}
                </Text>
              </View>

              <Pressable
                onPress={() => void handleRefreshNow()}
                disabled={
                  refreshing ||
                  actionBusy ||
                  !settings?.adaptiveCaloriesEnabled
                }
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && !refreshing && styles.buttonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {refreshing ? "Refreshing..." : "Recalculate now"}
                </Text>
              </Pressable>
            </View>

            {latestRecommendation ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Latest proposal</Text>
                <Text style={styles.bigValue}>
                  {latestRecommendation.currentBaseCalories != null
                    ? `${latestRecommendation.currentBaseCalories} -> ${latestRecommendation.recommendedBaseCalories} kcal/day`
                    : `${latestRecommendation.recommendedBaseCalories} kcal/day`}
                </Text>
                <Text style={styles.cardText}>{latestRecommendation.reason}</Text>

                <View style={styles.metricGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Confidence</Text>
                    <Text style={styles.metricValue}>
                      {latestRecommendation.confidence.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Estimated TDEE</Text>
                    <Text style={styles.metricValue}>
                      {latestRecommendation.estimatedTdee} kcal
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Window</Text>
                    <Text style={styles.metricValueSmall}>
                      {formatWindowLabel(
                        latestRecommendation.windowStart,
                        latestRecommendation.windowEnd,
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.whyPanel}>
                  <Text style={styles.whyTitle}>Why this changed</Text>
                  <Text style={styles.whyText}>
                    Logged intake averaged{" "}
                    {Math.round(latestRecommendation.avgLoggedCalories)} kcal/day
                    across {latestRecommendation.completeDaysUsed} complete days.
                  </Text>
                  <Text style={styles.whyText}>
                    Your smoothed weight trend moved{" "}
                    {formatSignedWeightChange(
                      latestRecommendation.observedWeeklyChangeKg,
                    )}, based on {latestRecommendation.weighInsUsed} weigh-ins.
                  </Text>
                  <Text style={styles.whyText}>
                    Estimated maintenance is{" "}
                    {Math.round(latestRecommendation.estimatedTdee)} kcal/day;
                    the proposed base target is{" "}
                    {latestRecommendation.recommendedBaseCalories} kcal/day.
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void handleApply()}
                    disabled={actionBusy}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && !actionBusy && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {actionBusy ? "Working..." : "Apply recommendation"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleReject()}
                    disabled={actionBusy}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && !actionBusy && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Keep current target</Text>
                  </Pressable>
                </View>
              </View>
            ) : analysis ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {analysis.status === "insufficient"
                    ? "Need more signal"
                    : analysis.status === "unchanged"
                      ? "No adjustment needed"
                      : "Adaptive calories is off"}
                </Text>
                <Text style={styles.cardText}>{analysis.reason}</Text>

                {analysis.summary ? (
                  <View style={styles.metricGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Complete days</Text>
                      <Text style={styles.metricValue}>
                        {analysis.summary.completeDaysUsed}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Weigh-ins</Text>
                      <Text style={styles.metricValue}>
                        {analysis.summary.weighInsUsed}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Day span</Text>
                      <Text style={styles.metricValue}>
                        {analysis.summary.daySpan}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recommendation history</Text>
              {history.length === 0 ? (
                <Text style={styles.cardText}>
                  No adaptive recommendations have been saved yet.
                </Text>
              ) : (
                <View style={styles.historyStack}>
                  {history.map((item) => (
                    <View key={item.id} style={styles.historyRow}>
                      <View style={styles.copyColumn}>
                        <Text style={styles.historyTitle}>
                          {formatRecommendationStatus(item.status)}
                        </Text>
                        <Text style={styles.historyText}>
                          {formatWindowLabel(item.windowStart, item.windowEnd)}
                        </Text>
                        <Text style={styles.historyText}>
                          {item.currentBaseCalories != null
                            ? `${item.currentBaseCalories} -> ${item.recommendedBaseCalories} kcal/day`
                            : `${item.recommendedBaseCalories} kcal/day`}
                        </Text>
                      </View>
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyConfidence}>
                          {item.confidence.toUpperCase()}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
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
    top: -80,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    bottom: -90,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 18,
    marginBottom: 16,
  },
  loadingCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  copyColumn: {
    flex: 1,
  },
  cardTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  cardText: {
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  toggleButton: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceGhost,
  },
  toggleButtonActive: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  toggleButtonText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleButtonTextActive: {
    color: appColors.white,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  metaLabel: {
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  metaValue: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  bigValue: {
    color: appColors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  metricCard: {
    minWidth: 96,
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    padding: 12,
  },
  metricLabel: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  metricValue: {
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  metricValueSmall: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  whyPanel: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginBottom: 14,
  },
  whyTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  whyText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    borderRadius: 9999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  historyStack: {
    gap: 10,
  },
  historyRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    padding: 14,
  },
  historyTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  historyText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  historyMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  historyConfidence: {
    color: appColors.brand700,
    fontSize: 11,
    fontWeight: "900",
  },
  historyDate: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
});

export default AdaptiveCaloriesSettingsScreen;

