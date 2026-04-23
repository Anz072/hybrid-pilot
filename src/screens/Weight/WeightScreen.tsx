import React from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowsClockwiseIcon,
  CalendarIcon,
  CaretDownIcon,
  CaretUpIcon,
  ChartLineIcon,
  PencilSimpleIcon,
  TargetIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "phosphor-react-native";
import type {
  DBWeightEntry,
  SaveWeightEntryInput,
  WeightEntryGoal,
} from "../../store/DB_TYPES";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import OnboardingPrimaryButton from "../Onboarding/OnboardingPrimaryButton";
import WeightEntryModal, { type WeightEntryDraft } from "./WeightEntryModal";
import { refreshAdaptiveRecommendationForUser } from "../User_Settings/adaptiveCaloriesActions";
import WeightTrendChart from "./WeightTrendChart";
import {
  DEFAULT_GOAL_BAND_KG,
  type WeightRangeKey,
  collapseEntriesByLocalDate,
  computeGoalProgress,
  computeMovingAverage,
  computeWeeklyPaceToGoal,
  filterEntriesByRange,
  formatDateOnly,
  formatLocalDateLabel,
  formatWeightKg,
  generateUuid,
  getLocalDateKey,
  parseDateOnly,
  parseLocalizedWeight,
  roundWeightKg,
} from "./weightUtils";
import { appColors } from "../../theme/colors";

const SOFT_MIN_WEIGHT_KG = 20;
const SOFT_MAX_WEIGHT_KG = 300;
const FUTURE_GRACE_MINUTES = 5;

type SnackbarState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type InsightCardProps = {
  title: string;
  value: string;
  detail: string;
  explanation: string;
};

const confirmAsync = (
  title: string,
  message: string,
  confirmText = "Confirm",
): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]);
  });

const toSaveWeightEntryInput = (
  entry: DBWeightEntry,
): SaveWeightEntryInput => ({
  id: entry.id,
  userExternalId: entry.userExternalId,
  measuredAt: entry.measuredAt,
  measuredAtLocalIso: entry.measuredAtLocalIso,
  zoneOffsetMinutes: entry.zoneOffsetMinutes,
  valueKg: entry.valueKg,
  valueOriginal: entry.valueOriginal,
  unitOriginal: "kg",
  source: entry.source,
  notes: entry.notes,
  clientGeneratedId: entry.clientGeneratedId,
  deviceId: entry.deviceId,
});

const sortEntriesDesc = (entries: DBWeightEntry[]): DBWeightEntry[] =>
  [...entries].sort(
    (left, right) =>
      new Date(right.measuredAt).getTime() -
      new Date(left.measuredAt).getTime(),
  );

const upsertEntry = (
  entries: DBWeightEntry[],
  nextEntry: DBWeightEntry,
): DBWeightEntry[] =>
  sortEntriesDesc([
    nextEntry,
    ...entries.filter((entry) => entry.id !== nextEntry.id),
  ]);

const toTitleCase = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());

const formatHeaderDateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatHistoryTimeLabel = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

type WeightScreenProps = {
  externalRefreshToken?: number;
};

const WeightScreen = ({
  externalRefreshToken = 0,
}: WeightScreenProps) => {
  const insets = useSafeAreaInsets();
  const hasHydratedOnceRef = React.useRef(false);
  const lastExternalRefreshTokenRef = React.useRef(externalRefreshToken);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [allEntries, setAllEntries] = React.useState<DBWeightEntry[]>([]);
  const [goal, setGoal] = React.useState<WeightEntryGoal | null>(null);
  const [range, setRange] = React.useState<WeightRangeKey>("1M");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(
    null,
  );
  const [modalVisible, setModalVisible] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
  const [editingEntry, setEditingEntry] = React.useState<DBWeightEntry | null>(
    null,
  );
  const [snackbar, setSnackbar] = React.useState<SnackbarState | null>(null);
  const [expandedInsightTitle, setExpandedInsightTitle] = React.useState<
    string | null
  >(null);
  const [targetWeightValue, setTargetWeightValue] = React.useState("");
  const [targetDate, setTargetDate] = React.useState<Date | null>(null);
  const [showGoalDatePicker, setShowGoalDatePicker] = React.useState(false);
  const [goalSaving, setGoalSaving] = React.useState(false);
  const [goalModalVisible, setGoalModalVisible] = React.useState(false);
  const [hideInsights, setHideInsights] = React.useState(true);
  const [hideHistory, setHideHistory] = React.useState(true);

  const loadWeightState = React.useCallback(async (currentUserId: string) => {
    const [entries, nextGoal] = await Promise.all([
      DB.listWeightEntries(currentUserId, { includeDeleted: true }),
      DB.getWeightGoal(currentUserId),
    ]);

    setAllEntries(sortEntriesDesc(entries));
    setGoal(nextGoal);
    setTargetWeightValue(
      nextGoal ? formatWeightKg(nextGoal.targetWeightKg) : "",
    );
    setTargetDate(
      nextGoal?.targetDate ? parseDateOnly(nextGoal.targetDate) : null,
    );
  }, []);

  const clearWeightState = React.useCallback(() => {
    setAllEntries([]);
    setGoal(null);
    setTargetWeightValue("");
    setTargetDate(null);
  }, []);

  const hydrate = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const dbUser = await DB.getUser();
        const resolvedUserId = dbUser?.externalId ?? null;

        if (!resolvedUserId) {
          setUserId(null);
          clearWeightState();
          return;
        }

        setUserId(resolvedUserId);
        await loadWeightState(resolvedUserId);
      } catch {
        Alert.alert(
          "Could not load weight history",
          "Please restart and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clearWeightState, loadWeightState],
  );

  useFocusEffect(
    React.useCallback(() => {
      const nextOptions = hasHydratedOnceRef.current
        ? { silent: true }
        : undefined;

      hasHydratedOnceRef.current = true;
      void hydrate(nextOptions);
    }, [hydrate]),
  );

  React.useEffect(() => {
    if (!hasHydratedOnceRef.current) {
      lastExternalRefreshTokenRef.current = externalRefreshToken;
      return;
    }

    if (externalRefreshToken === lastExternalRefreshTokenRef.current) {
      return;
    }

    lastExternalRefreshTokenRef.current = externalRefreshToken;
    void hydrate({ silent: true });
  }, [externalRefreshToken, hydrate]);

  React.useEffect(() => {
    if (!snackbar) {
      return;
    }

    const timeout = setTimeout(() => setSnackbar(null), 7000);
    return () => clearTimeout(timeout);
  }, [snackbar]);

  const activeEntries = React.useMemo(
    () =>
      collapseEntriesByLocalDate(
        allEntries.filter((entry) => entry.deletedAt == null),
      ),
    [allEntries],
  );

  const pendingCount = React.useMemo(
    () => allEntries.filter((entry) => entry.syncStatus !== "synced").length,
    [allEntries],
  );

  const syncErrorCount = React.useMemo(
    () => allEntries.filter((entry) => entry.syncStatus === "error").length,
    [allEntries],
  );

  const historyEntries = activeEntries;

  const chartEntries = React.useMemo(
    () => filterEntriesByRange(activeEntries, range),
    [activeEntries, range],
  );

  const currentEntry = activeEntries[0] ?? null;
  const startEntry = activeEntries[activeEntries.length - 1] ?? null;
  const weeklyAverage = computeMovingAverage(activeEntries, 7);
  const monthlyAverage = computeMovingAverage(activeEntries, 30);
  const deltaVsTrend =
    currentEntry && weeklyAverage != null
      ? roundWeightKg(currentEntry.valueKg - weeklyAverage)
      : null;
  const goalProgress =
    currentEntry && startEntry
      ? computeGoalProgress(currentEntry.valueKg, startEntry.valueKg, goal)
      : null;
  const parsedTargetWeight = parseLocalizedWeight(targetWeightValue);
  const previewGoal: WeightEntryGoal | null =
    parsedTargetWeight != null
      ? {
          userExternalId: userId ?? "",
          targetWeightKg: parsedTargetWeight,
          targetDate: targetDate ? formatDateOnly(targetDate) : null,
          goalBandKg: goal?.goalBandKg ?? DEFAULT_GOAL_BAND_KG,
          createdAt: goal?.createdAt ?? "",
          updatedAt: goal?.updatedAt ?? "",
        }
      : goal;
  const goalPaceText =
    currentEntry != null
      ? computeWeeklyPaceToGoal(
          currentEntry.valueKg,
          startEntry?.valueKg ?? currentEntry.valueKg,
          previewGoal,
        )
      : null;
  const visibleHistorySections = React.useMemo(
    () =>
      hideHistory
        ? []
        : [{ title: "", key: "history", data: historyEntries }],
    [hideHistory, historyEntries],
  );
  const collapsedHistoryText =
    historyEntries.length > 0
      ? `History is hidden. Expand to browse ${historyEntries.length} daily check-ins. Saving again on the same day replaces the earlier entry.`
      : "History is hidden. Log your first weight entry to build a timeline.";

  const consistencyPerWeek = React.useMemo(() => {
    const recent = filterEntriesByRange(activeEntries, "1M");
    if (recent.length === 0) {
      return null;
    }

    return roundWeightKg(recent.length / 4.3);
  }, [activeEntries]);

  const volatility = React.useMemo(() => {
    const recent = filterEntriesByRange(activeEntries, "1M");
    if (recent.length < 3) {
      return null;
    }

    const mean =
      recent.reduce((sum, entry) => sum + entry.valueKg, 0) / recent.length;
    const variance =
      recent.reduce((sum, entry) => sum + (entry.valueKg - mean) ** 2, 0) /
      recent.length;
    return roundWeightKg(Math.sqrt(variance));
  }, [activeEntries]);

  const currentWeightText = currentEntry
    ? formatWeightKg(currentEntry.valueKg)
    : "--";
  const deltaText = currentEntry
    ? deltaVsTrend != null
      ? `${deltaVsTrend > 0 ? "+" : ""}${formatWeightKg(deltaVsTrend)} kg vs 7d avg`
      : "Need more recent entries for a 7d average"
    : "Log your first weight to start your trend";
  const goalChipText = goal
    ? goalProgress != null
      ? goalProgress >= 100
        ? "Goal reached"
        : `${goalProgress}% to goal`
      : `Target ${formatWeightKg(goal.targetWeightKg)} kg`
    : "Set a target";
  const goalSummaryText = goal
    ? goal.targetDate
      ? `Target ${formatWeightKg(goal.targetWeightKg)} kg by ${parseDateOnly(
          goal.targetDate,
        ).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : `Target ${formatWeightKg(goal.targetWeightKg)} kg with a +/- ${formatWeightKg(
          goal.goalBandKg ?? DEFAULT_GOAL_BAND_KG,
        )} kg band`
    : "Set a target to add a goal line and progress band to the chart.";
  const goalLauncherLabel = goal ? "Edit goal" : "Set goal";
  const syncPillText =
    pendingCount > 0
      ? `Offline | ${pendingCount} pending`
      : "Offline | Local only";
  const chartOldestEntry = chartEntries[chartEntries.length - 1] ?? null;
  const chartNewestEntry = chartEntries[0] ?? null;
  const averageWeightText =
    chartEntries.length > 0
      ? formatWeightKg(
          roundWeightKg(
            chartEntries.reduce((sum, entry) => sum + entry.valueKg, 0) /
              chartEntries.length,
          ),
        )
      : "--";
  const visibleDifference = React.useMemo(() => {
    if (!chartOldestEntry || !chartNewestEntry) {
      return null;
    }

    return roundWeightKg(chartNewestEntry.valueKg - chartOldestEntry.valueKg);
  }, [chartNewestEntry, chartOldestEntry]);
  const visibleDifferenceText =
    visibleDifference != null
      ? `${visibleDifference > 0 ? "+" : ""}${formatWeightKg(visibleDifference)}`
      : "--";
  const chartPeriodText =
    chartOldestEntry && chartNewestEntry
      ? `${formatHeaderDateLabel(chartOldestEntry.measuredAt)} - ${formatHeaderDateLabel(
          chartNewestEntry.measuredAt,
        )}`
      : "Log your first entry to build a trend";

  const openEditModal = (entry: DBWeightEntry) => {
    setEditingEntry(entry);
    setModalMode("edit");
    setSelectedEntryId(entry.id);
    setModalVisible(true);
  };

  const syncGoalDraftFromGoal = React.useCallback(() => {
    setTargetWeightValue(goal ? formatWeightKg(goal.targetWeightKg) : "");
    setTargetDate(goal?.targetDate ? parseDateOnly(goal.targetDate) : null);
    setShowGoalDatePicker(false);
  }, [goal]);

  const openGoalModal = () => {
    syncGoalDraftFromGoal();
    setGoalModalVisible(true);
  };

  const closeGoalModal = () => {
    setGoalModalVisible(false);
    syncGoalDraftFromGoal();
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingEntry(null);
  };

  const replaceLocalEntry = (entry: DBWeightEntry) => {
    setAllEntries((current) => upsertEntry(current, entry));
  };

  const replaceLocalEntries = (entries: DBWeightEntry[]) => {
    setAllEntries((current) => {
      const nextIds = new Set(entries.map((entry) => entry.id));
      return sortEntriesDesc([
        ...entries,
        ...current.filter((entry) => !nextIds.has(entry.id)),
      ]);
    });
  };

  const showUndoSnackbar = (
    message: string,
    onAction: () => void | Promise<void>,
  ) => {
    setSnackbar({
      message,
      actionLabel: "Undo",
      onAction: () => {
        setSnackbar(null);
        void onAction();
      },
    });
  };

  const finalizeSave = async (draft: WeightEntryDraft) => {
    if (!userId) {
      Alert.alert("Session expired", "Please sign in with Google again.");
      return;
    }

    const measuredAtMs = new Date(draft.measuredAt).getTime();
    if (measuredAtMs > Date.now() + FUTURE_GRACE_MINUTES * 60 * 1000) {
      const confirmed = await confirmAsync(
        "Measurement is in the future",
        "This timestamp is more than 5 minutes ahead. Save anyway?",
        "Save anyway",
      );
      if (!confirmed) {
        return;
      }
    }

    if (
      draft.valueOriginal < SOFT_MIN_WEIGHT_KG ||
      draft.valueOriginal > SOFT_MAX_WEIGHT_KG
    ) {
      const confirmed = await confirmAsync(
        "Weight looks unusual",
        `This is outside the usual ${SOFT_MIN_WEIGHT_KG}-${SOFT_MAX_WEIGHT_KG} kg range. Confirm anyway?`,
        "Confirm anyway",
      );
      if (!confirmed) {
        return;
      }
    }

    const baseEntry = editingEntry ?? null;
    const localDateKey = getLocalDateKey(draft.measuredAtLocalIso);
    const sameDayEntries = activeEntries.filter(
      (entry) =>
        entry.id !== baseEntry?.id &&
        getLocalDateKey(entry.measuredAtLocalIso) === localDateKey,
    );
    const targetEntry = baseEntry ?? sameDayEntries[0] ?? null;
    const overwrittenEntries = baseEntry
      ? sameDayEntries
      : sameDayEntries.filter((entry) => entry.id !== targetEntry?.id);
    const now = new Date().toISOString();
    const optimisticEntry: DBWeightEntry = {
      id: targetEntry?.id ?? generateUuid(),
      userExternalId: userId,
      measuredAt: draft.measuredAt,
      measuredAtLocalIso: draft.measuredAtLocalIso,
      zoneOffsetMinutes: draft.zoneOffsetMinutes,
      valueKg: draft.valueOriginal,
      valueOriginal: draft.valueOriginal,
      unitOriginal: "kg",
      source: draft.source,
      notes: draft.notes ?? null,
      clientGeneratedId: targetEntry?.clientGeneratedId ?? generateUuid(),
      deviceId: targetEntry?.deviceId ?? null,
      createdAt: targetEntry?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      version: (targetEntry?.version ?? 0) + 1,
      syncStatus: "pending",
      syncError: null,
    };

    const optimisticDeletedEntries = overwrittenEntries.map((entry) => ({
      ...entry,
      deletedAt: now,
      updatedAt: now,
      version: entry.version + 1,
      syncStatus: "pending" as const,
      syncError: null,
    }));

    replaceLocalEntries([optimisticEntry, ...optimisticDeletedEntries]);
    setSelectedEntryId(optimisticEntry.id);
    closeModal();
    setSnackbar({
      message:
        sameDayEntries.length > 0
          ? "Daily entry updated"
          : baseEntry
            ? "Entry updated"
            : "Saved",
    });

    try {
      const saved = await DB.saveWeightEntry({
        id: optimisticEntry.id,
        userExternalId: userId,
        measuredAt: optimisticEntry.measuredAt,
        measuredAtLocalIso: optimisticEntry.measuredAtLocalIso,
        zoneOffsetMinutes: optimisticEntry.zoneOffsetMinutes,
        valueKg: optimisticEntry.valueKg,
        valueOriginal: optimisticEntry.valueOriginal,
        unitOriginal: "kg",
        source: optimisticEntry.source,
        notes: optimisticEntry.notes,
        clientGeneratedId: optimisticEntry.clientGeneratedId,
        deviceId: optimisticEntry.deviceId,
      });
      replaceLocalEntries([saved, ...optimisticDeletedEntries]);
      setSelectedEntryId(saved.id);
      try {
        await refreshAdaptiveRecommendationForUser({
          userExternalId: userId,
          force: true,
        });
      } catch {
        // Keep the weight save successful even if adaptive refresh fails.
      }
    } catch {
      setSnackbar(null);
      await hydrate({ silent: true });
      Alert.alert("Could not save entry", "Please try again.");
    }
  };

  const handleDeleteEntry = async (entry: DBWeightEntry) => {
    const optimisticDeleted: DBWeightEntry = {
      ...entry,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: entry.version + 1,
      syncStatus: "pending",
    };

    replaceLocalEntry(optimisticDeleted);
    if (editingEntry?.id === entry.id) {
      closeModal();
    }

    showUndoSnackbar("Deleted", async () => {
      try {
        const restored = await DB.saveWeightEntry(
          toSaveWeightEntryInput(entry),
        );
        replaceLocalEntry(restored);
        setSelectedEntryId(restored.id);
        try {
          await refreshAdaptiveRecommendationForUser({
            userExternalId: entry.userExternalId,
            force: true,
          });
        } catch {
          // Undo should still succeed even if adaptive refresh fails.
        }
      } catch {
        Alert.alert("Undo failed", "Please try editing the entry again.");
      }
    });

    try {
      const deleted = await DB.softDeleteWeightEntry({
        id: entry.id,
        userExternalId: entry.userExternalId,
      });

      if (deleted) {
        replaceLocalEntry(deleted);
      }

      try {
        await refreshAdaptiveRecommendationForUser({
          userExternalId: entry.userExternalId,
          force: true,
        });
      } catch {
        // Keep the delete successful even if adaptive refresh fails.
      }
    } catch {
      setSnackbar(null);
      replaceLocalEntry(entry);
      Alert.alert("Could not delete entry", "Please try again.");
    }
  };

  const handleSaveGoal = async () => {
    if (!userId) {
      Alert.alert("Session expired", "Please sign in with Google again.");
      return;
    }

    const parsedTarget = parseLocalizedWeight(targetWeightValue);
    if (parsedTarget == null || parsedTarget <= 0) {
      Alert.alert("Invalid target", "Enter a valid goal weight in kilograms.");
      return;
    }

    if (activeEntries.length === 0) {
      Alert.alert(
        "Log your first entry first",
        "Add at least one weight entry so goal progress has a meaningful starting point.",
      );
      return;
    }

    if (currentEntry && Math.abs(currentEntry.valueKg - parsedTarget) > 30) {
      const confirmed = await confirmAsync(
        "Large goal change",
        "This target is far from your current weight. Save anyway?",
        "Save",
      );
      if (!confirmed) {
        return;
      }
    }

    setGoalSaving(true);
    try {
      const saved = await DB.saveWeightGoal({
        userExternalId: userId,
        targetWeightKg: parsedTarget,
        targetDate: targetDate ? formatDateOnly(targetDate) : null,
        goalBandKg: DEFAULT_GOAL_BAND_KG,
      });
      setGoal(saved);
      setTargetWeightValue(formatWeightKg(saved.targetWeightKg));
      setTargetDate(saved.targetDate ? parseDateOnly(saved.targetDate) : null);
      setShowGoalDatePicker(false);
      setGoalModalVisible(false);
      setSnackbar({ message: "Goal updated" });
    } catch {
      Alert.alert("Could not save goal", "Please try again.");
    } finally {
      setGoalSaving(false);
    }
  };

  const handleClearGoal = () => {
    if (!goal || !userId) {
      return;
    }

    Alert.alert("Clear goal?", "This removes the target and goal band.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await DB.clearWeightGoal(userId);
            setGoal(null);
            setTargetWeightValue("");
            setTargetDate(null);
            setShowGoalDatePicker(false);
            setGoalModalVisible(false);
            setSnackbar({ message: "Goal cleared" });
          } catch {
            Alert.alert("Could not clear goal", "Please try again.");
          }
        },
      },
    ]);
  };

  const handleGoalDateChange = (
    event: DateTimePickerEvent,
    nextDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowGoalDatePicker(false);
    }

    if (event.type !== "set" || !nextDate) {
      return;
    }

    const normalized = new Date(nextDate);
    normalized.setHours(12, 0, 0, 0);
    setTargetDate(normalized);
  };

  const handleSyncPillPress = () => {
    const message =
      pendingCount > 0
        ? `${pendingCount} changes are stored locally and marked pending. They stay editable while offline.`
        : "All visible entries are stored locally. Sync support can reconcile them when connected.";
    Alert.alert("Sync status", message);
  };

  const insightCards: InsightCardProps[] = [
    {
      title: "Trend",
      value:
        deltaVsTrend != null
          ? `${deltaVsTrend > 0 ? "+" : ""}${formatWeightKg(deltaVsTrend)} kg`
          : "Need more data",
      detail:
        monthlyAverage != null
          ? `30d avg ${formatWeightKg(monthlyAverage)} kg`
          : "We need more recent check-ins to compare your pace.",
      explanation:
        "The trend compares your latest weigh-in against your recent 7-day average so day-to-day fluctuations feel less noisy.",
    },
    {
      title: "Consistency",
      value:
        consistencyPerWeek != null
          ? `${consistencyPerWeek.toFixed(1)}/week`
          : "Need more data",
      detail: "Entries per week over the last month.",
      explanation:
        "Consistency is calculated from the number of active entries logged in the last month, scaled to entries per week.",
    },
    {
      title: "Volatility",
      value:
        volatility != null
          ? `+/- ${formatWeightKg(volatility)} kg`
          : "Need more data",
      detail: "Lower is steadier. Daily fluctuations are still normal.",
      explanation:
        "Volatility uses the spread of your recent weigh-ins. It helps separate normal noise from a more stable trend.",
    },
  ];

  const animateQuickLayout = () => {
    LayoutAnimation.configureNext({
      duration: 180,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  };

  const toggleInsightCard = (title: string) => {
    animateQuickLayout();

    setExpandedInsightTitle((current) => (current === title ? null : title));
  };

  const renderInsightCard = ({
    title,
    value,
    detail,
    explanation,
  }: InsightCardProps) =>
    (() => {
      const expanded = expandedInsightTitle === title;

      return (
        <Pressable
          key={title}
          onPress={() => toggleInsightCard(title)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={({ pressed }) => [
            styles.insightCard,
            expanded && styles.insightCardExpanded,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.insightTopRow}>
            <View style={styles.insightHeaderCopy}>
              <Text style={styles.insightTitle}>{title}</Text>
              <Text style={styles.insightDetail}>{detail}</Text>
            </View>
            <View style={styles.insightMetaSide}>
              <Text style={styles.insightValue}>{value}</Text>
              <View
                style={[
                  styles.insightToggleChip,
                  expanded && styles.insightToggleChipExpanded,
                ]}
              >
                <Text
                  style={[
                    styles.insightToggleText,
                    expanded && styles.insightToggleTextExpanded,
                  ]}
                >
                  {expanded ? "Hide" : "Open"}
                </Text>
                {expanded ? (
                  <CaretUpIcon size={14} color={appColors.plumMutedAlt} weight="bold" />
                ) : (
                  <CaretDownIcon size={14} color={appColors.textMuted} weight="bold" />
                )}
              </View>
            </View>
          </View>

          <View style={styles.insightAccentLine} />

          {expanded ? (
            <View style={styles.insightExpandedBody}>
              <Text style={styles.insightExpandedLabel}>How calculated</Text>
              <Text style={[styles.insightExpandedText]}>{explanation}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    })();

  const listHeader = (
    <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Weight Diary</Text>
        <Pressable
          onPress={handleSyncPillPress}
          style={({ pressed }) => [
            styles.heroSyncButton,
            pressed && styles.cardPressed,
          ]}
          accessibilityLabel="Open sync status"
        >
          <ArrowsClockwiseIcon size={18} color={appColors.plumMuted} weight="bold" />
        </Pressable>
      </View>
      <View style={styles.heroCard}>
        <View style={styles.heroStatRow}>
          <View style={styles.heroStatBlock}>
            <Text style={styles.heroStatLabel}>Average</Text>
            <Text style={styles.heroStatValue}>
              {averageWeightText}
              <Text style={styles.heroStatUnit}> kg</Text>
            </Text>
            <Text style={styles.heroStatCaption}>{chartPeriodText}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatBlock}>
            <Text style={styles.heroStatLabel}>Difference</Text>
            <Text style={styles.heroStatValue}>
              {visibleDifferenceText}
              <Text style={styles.heroStatUnit}> kg</Text>
            </Text>
            <Text style={styles.heroStatCaption}>
              {currentEntry
                ? `Latest ${formatHeaderDateLabel(currentEntry.measuredAt)}`
                : "Need at least one entry"}
            </Text>
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroInfoPill}>
            <Text style={styles.heroInfoLabel}>Current</Text>
            <Text style={styles.heroInfoValue}>{currentWeightText} kg</Text>
          </View>
          <View style={styles.heroInfoPill}>
            <TargetIcon size={13} color={appColors.brand700} weight="bold" />
            <Text style={styles.heroInfoGoalText}>{goalChipText}</Text>
          </View>
        </View>

        <WeightTrendChart
          entries={chartEntries}
          goal={goal}
          range={range}
          onChangeRange={setRange}
        />
      </View>

      <Pressable
        onPress={openGoalModal}
        style={({ pressed }) => [
          styles.card,
          styles.goalCard,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.dashboardSectionTitle}>Goal & Target</Text>
            <Text style={styles.subtleText}>{goalSummaryText}</Text>
          </View>
          <View style={[styles.pill, styles.goalLauncherPill]}>
            <TargetIcon size={14} color={appColors.textPrimary} weight="bold" />
            <Text style={styles.pillText}>{goalLauncherLabel}</Text>
          </View>
        </View>

        {goal ? (
          <View style={[styles.twoUp, styles.goalPreviewPanels]}>
            <View style={styles.softPanel}>
              <Text style={styles.panelLabel}>Target</Text>
              <Text style={styles.panelValue}>
                {formatWeightKg(goal.targetWeightKg)} kg
              </Text>
            </View>
            <View style={styles.softPanel}>
              <Text style={styles.panelLabel}>Pace helper</Text>
              <Text style={styles.panelText}>
                {currentEntry != null
                  ? (computeWeeklyPaceToGoal(
                      currentEntry.valueKg,
                      startEntry?.valueKg ?? currentEntry.valueKg,
                      goal,
                    ) ?? "Add a date to estimate weekly pace.")
                  : "Add a current entry to estimate weekly pace."}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => setHideInsights((current) => !current)}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <View style={[styles.card, styles.sectionCard]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.dashboardSectionTitle}>Insights & Data</Text>
              <Text style={styles.sectionCaption}>
                Trend and logging quality, in a calmer summary layout.
              </Text>
            </View>
            <View style={styles.sectionToggle}>
              {hideInsights ? (
                <CaretDownIcon size={18} color={appColors.slate300} weight="bold" />
              ) : (
                <CaretUpIcon size={18} color={appColors.slate300} weight="bold" />
              )}
            </View>
          </View>
          {!hideInsights && (
            <View style={styles.stack}>
              {insightCards.map((item) => renderInsightCard(item))}
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.card}>
        <Pressable
          onPress={() => {
            animateQuickLayout();
            setHideHistory((current) => !current);
          }}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexOne}>
              <Text style={styles.dashboardSectionTitle}>History</Text>
              <Text style={styles.sectionCaption}>
                {historyEntries.length > 0
                  ? `${historyEntries.length} daily check-ins. New saves on the same day replace the earlier entry.`
                  : "Your weight history will appear here once you log an entry."}
              </Text>
            </View>
            <View style={styles.sectionToggle}>
              {hideHistory ? (
                <CaretDownIcon size={18} color={appColors.slate300} weight="bold" />
              ) : (
                <CaretUpIcon size={18} color={appColors.slate300} weight="bold" />
              )}
            </View>
          </View>
        </Pressable>

        {hideHistory ? (
          <Text style={styles.collapsedSectionText}>
            {collapsedHistoryText}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="small" color={appColors.brand500} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={visibleHistorySections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void hydrate({ silent: true })}
            tintColor={appColors.slate900}
          />
        }
        contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          hideHistory ? null : (
            <View style={[styles.card, styles.emptyCard]}>
              <ChartLineIcon size={28} color={appColors.green700} weight="bold" />
              <Text style={styles.sectionTitle}>Log your first weigh-in</Text>
              <Text style={styles.subtleText}>
                Add your first weight entry to unlock trend lines, goal
                progress, and history.
              </Text>
            </View>
          )
        }
        renderSectionHeader={() => (
          <View style={styles.historyTableHeader}>
            <View style={[styles.historyHeaderCell, styles.historyDateColumn]}>
              <Text style={styles.historyHeaderLabel}>Date</Text>
            </View>
            <View style={[styles.historyHeaderCell, styles.historyWeightColumn]}>
              <Text style={styles.historyHeaderLabel}>Weight</Text>
            </View>
            <View style={[styles.historyHeaderCell, styles.historySourceColumn]}>
              <Text style={styles.historyHeaderLabel}>Source</Text>
            </View>
            <View style={styles.historyActionColumn} />
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const selected = item.id === selectedEntryId;
          const isFirst = index === 0;
          const isLast = index === section.data.length - 1;
          const statusLabel =
            item.syncStatus === "error"
              ? "Sync issue"
              : item.syncStatus === "pending"
                ? "Pending"
                : null;
          const sourceLabel = toTitleCase(item.source);
          const hasSecondaryRow = Boolean(item.notes || item.syncError);

          return (
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <Pressable
                  onPress={() => void handleDeleteEntry(item)}
                  style={({ pressed }) => [
                    styles.deleteSwipe,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityLabel={`Delete ${formatWeightKg(item.valueKg)} kilogram entry`}
                >
                  <TrashIcon size={18} color={appColors.white} weight="bold" />
                  <Text style={styles.deleteSwipeText}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => openEditModal(item)}
                style={({ pressed }) => [
                  styles.historyRow,
                  isFirst && styles.historyRowFirst,
                  isLast && styles.historyRowLast,
                  selected && styles.historyRowActive,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.historyRowMain}>
                  <View style={[styles.historyCell, styles.historyDateColumn]}>
                    <Text style={styles.historyDateText} numberOfLines={1}>
                      {formatLocalDateLabel(item.measuredAtLocalIso)}
                    </Text>
                    <Text style={styles.historyTimeText} numberOfLines={1}>
                      {formatHistoryTimeLabel(item.measuredAtLocalIso)}
                    </Text>
                  </View>

                  <View style={[styles.historyCell, styles.historyWeightColumn]}>
                    <Text style={styles.historyWeightText} numberOfLines={1}>
                      {formatWeightKg(item.valueKg)}
                    </Text>
                    <Text style={styles.historyWeightUnit}>kg</Text>
                  </View>

                  <View style={[styles.historyCell, styles.historySourceColumn]}>
                    <Text style={styles.historySourceText} numberOfLines={1}>
                      {sourceLabel}
                    </Text>
                    {statusLabel ? (
                      <View
                        style={[
                          styles.statusChip,
                          item.syncStatus === "error" &&
                            styles.statusChipWarning,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            item.syncStatus === "error" &&
                              styles.statusChipTextWarning,
                          ]}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.historyTimeText} numberOfLines={1}>
                        Synced
                      </Text>
                    )}
                  </View>

                  <View style={styles.historyActionColumn}>
                    <PencilSimpleIcon
                      size={17}
                      color={appColors.textSecondary}
                      weight="bold"
                    />
                  </View>
                </View>

                {hasSecondaryRow ? (
                  <View style={styles.historySupplementalRow}>
                    {item.notes ? (
                      <Text style={styles.historyNoteText} numberOfLines={2}>
                        {item.notes}
                      </Text>
                    ) : null}
                    {item.syncError ? (
                      <View style={styles.historyInlineWarning}>
                        <WarningCircleIcon
                          size={12}
                          color={appColors.amber600}
                          weight="fill"
                        />
                        <Text style={styles.historyInlineWarningText}>
                          Edit and retry sync
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            </Swipeable>
          );
        }}
      />

      <Modal
        visible={goalModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeGoalModal}
      >
        <View style={styles.goalModalScreen}>
          <View
            style={[styles.goalModalHeader, { paddingTop: insets.top + 12 }]}
          >
            <View>
              <Text style={styles.eyebrow}>Goal</Text>
              <Text style={styles.goalModalTitle}>
                {goal ? "Edit weight goal" : "Set weight goal"}
              </Text>
            </View>
            <Pressable
              onPress={closeGoalModal}
              style={({ pressed }) => [
                styles.goalModalCloseButton,
                pressed && styles.cardPressed,
              ]}
              accessibilityLabel="Close goal editor"
            >
              <XIcon size={18} color={appColors.textPrimary} weight="bold" />
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={[
              styles.goalModalContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexOne}>
                  <Text style={styles.sectionTitle}>Goal details</Text>
                  <Text style={styles.subtleText}>
                    Set a target to add a goal line and progress band to the
                    chart.
                  </Text>
                </View>
                {goal ? (
                  <View style={[styles.pill, styles.goalBandPill]}>
                    <Text style={styles.goalBandText}>
                      Band +/-{" "}
                      {formatWeightKg(goal.goalBandKg ?? DEFAULT_GOAL_BAND_KG)}{" "}
                      kg
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.label}>Target weight</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={targetWeightValue}
                  onChangeText={setTargetWeightValue}
                  keyboardType="decimal-pad"
                  placeholder="78.0"
                  placeholderTextColor={appColors.slate400}
                  style={styles.input}
                  accessibilityLabel="Target weight in kilograms"
                />
                <View style={styles.unitPill}>
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>

              <View style={styles.inlineRow}>
                <Pressable
                  onPress={() => setShowGoalDatePicker((current) => !current)}
                  style={({ pressed }) => [
                    styles.inlineButton,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <CalendarIcon
                    size={16}
                    color={appColors.textPrimary}
                    weight="bold"
                  />
                  <Text style={styles.inlineButtonText}>
                    {targetDate
                      ? targetDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Add target date"}
                  </Text>
                </Pressable>
                {targetDate ? (
                  <Pressable
                    onPress={() => setTargetDate(null)}
                    style={({ pressed }) => [
                      styles.textButton,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text style={styles.textButtonText}>Clear date</Text>
                  </Pressable>
                ) : null}
              </View>

              {showGoalDatePicker ? (
                <DateTimePicker
                  value={targetDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleGoalDateChange}
                />
              ) : null}

              <View style={styles.twoUp}>
                <View style={styles.softPanel}>
                  <Text style={styles.panelLabel}>Target</Text>
                  <Text style={styles.panelValue}>
                    {parsedTargetWeight != null
                      ? `${formatWeightKg(parsedTargetWeight)} kg`
                      : "--"}
                  </Text>
                </View>
                <View style={styles.softPanel}>
                  <Text style={styles.panelLabel}>Pace helper</Text>
                  <Text style={styles.panelText}>
                    {goalPaceText ?? "Add a date to estimate weekly pace."}
                  </Text>
                </View>
              </View>

              <OnboardingPrimaryButton
                label={goalSaving ? "Saving goal..." : "Save goal"}
                onPress={() => void handleSaveGoal()}
                disabled={goalSaving}
              />
              {goal ? (
                <Pressable
                  onPress={handleClearGoal}
                  style={({ pressed }) => [
                    styles.textButton,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <Text style={styles.destructiveText}>Clear goal</Text>
                </Pressable>
              ) : null}
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      <WeightEntryModal
        visible={modalVisible}
        mode={modalMode}
        initialEntry={editingEntry}
        onClose={closeModal}
        onSave={(draft) => {
          void finalizeSave(draft);
        }}
        onDelete={
          editingEntry
            ? () => {
                void handleDeleteEntry(editingEntry);
              }
            : undefined
        }
      />

      {snackbar ? (
        <View style={[styles.snackbar, { bottom: insets.bottom + 98 }]}>
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
          {snackbar.actionLabel && snackbar.onAction ? (
            <Pressable
              onPress={snackbar.onAction}
              style={({ pressed }) => [
                styles.pillDark,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.pillDarkText}>{snackbar.actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: appColors.revolutLight,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: appColors.borderSoft,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    color: appColors.revolutDark,
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginBottom: 18,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardPressed: {
    opacity: 0.92,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingVertical: 20,
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  heroTopBar: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginBottom: 18,
  },
  heroSyncButton: {
    position: "absolute",
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  heroStatRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  heroStatBlock: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    marginHorizontal: 14,
    backgroundColor: appColors.borderSoft,
  },
  heroStatLabel: {
    color: appColors.plumSoftText,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  heroStatValue: {
    color: appColors.plum,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroStatUnit: {
    color: appColors.slate300,
    fontSize: 16,
    fontWeight: "700",
  },
  heroStatCaption: {
    color: appColors.slate600,
    fontSize: 12,
    lineHeight: 17,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
    paddingLeft: 8,
  },
  heroInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.surfaceFieldAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroInfoLabel: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  heroInfoValue: {
    color: appColors.plum,
    fontSize: 13,
    fontWeight: "800",
  },
  heroInfoGoalText: {
    color: appColors.brand700,
    fontSize: 13,
    fontWeight: "800",
  },
  heroStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  heroStatusText: {
    color: appColors.plumPlaceholderAlt,
    fontSize: 12,
    lineHeight: 17,
  },
  heroHeaderRow: {
    flexWrap: "wrap",
  },
  flexOne: {
    flex: 1,
  },
  flexOne1: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.green700,
    backgroundColor: appColors.tealSoftBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroTitle: {
    color: appColors.plum,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
    textAlign: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.surfaceFieldAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  syncPill: {
    flexShrink: 1,
    maxWidth: "100%",
  },
  expandInsightLike: {},
  pillText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  pillDark: {
    borderRadius: 999,
    backgroundColor: appColors.slate800,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillDarkText: {
    color: appColors.slate200,
    fontSize: 13,
    fontWeight: "800",
  },
  metric: {
    color: appColors.textPrimary,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    marginBottom: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: appColors.plum,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 6,
  },
  metricUnit: {
    fontSize: 20,
    color: appColors.textSecondary,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  subtleText: {
    color: appColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCaption: {
    color: appColors.plumSoft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.surfaceCardAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  goalChipText: {
    color: appColors.brand700,
    fontSize: 13,
    fontWeight: "800",
  },
  goalBandPill: {
    backgroundColor: appColors.surfaceFieldAlt,
  },
  goalLauncherPill: {
    alignSelf: "flex-start",
  },
  goalBandText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  warningCard: {
    backgroundColor: appColors.amberSoftStrong,
    borderColor: appColors.amber300,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningTitle: {
    color: appColors.amber800,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  warningText: {
    color: appColors.amber700,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: appColors.plum,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  dashboardSectionTitle: {
    color: appColors.plum,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 2,
  },
  label: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "800",
    color: appColors.textPrimary,
    backgroundColor: appColors.surfaceField,
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  unitText: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  inlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inlineButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  goalPreviewPanels: {
    marginTop: 14,
    marginBottom: 0,
  },
  textButton: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  textButtonText: {
    color: appColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  destructiveText: {
    color: appColors.danger700,
    fontSize: 15,
    fontWeight: "800",
  },
  twoUp: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  softPanel: {
    flex: 1,
    backgroundColor: appColors.surfaceCardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
  },
  panelLabel: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  panelValue: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  panelText: {
    color: appColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  stack: {
    gap: 12,
  },
  stickyHeader: {
    backgroundColor: appColors.surfaceCanvas,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stickyHeaderText: {
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyCard: {
    alignItems: "flex-start",
    gap: 12,
  },
  deleteSwipe: {
    width: 108,
    marginRight: 20,
    marginBottom: 0,
    borderRadius: 8,
    backgroundColor: appColors.danger700,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteSwipeText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  historyTableHeader: {
    marginHorizontal: 20,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: appColors.borderSoft,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyHeaderCell: {
    justifyContent: "center",
  },
  historyHeaderLabel: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historyRow: {
    marginHorizontal: 20,
    backgroundColor: appColors.surfaceCardAlt,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyRowFirst: {
    borderTopWidth: 1,
  },
  historyRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  historyRowActive: {
    backgroundColor: appColors.surfaceRaised,
  },
  historyRowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyCell: {
    justifyContent: "center",
  },
  historyDateColumn: {
    flex: 1.2,
  },
  historyWeightColumn: {
    flex: 0.78,
    alignItems: "center",
  },
  historySourceColumn: {
    flex: 0.92,
    alignItems: "flex-end",
  },
  historyActionColumn: {
    width: 26,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  historyDateText: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  historyTimeText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  historyWeightText: {
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  historyWeightUnit: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historySourceText: {
    color: appColors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  historySupplementalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.borderSoft,
  },
  historyNoteText: {
    flex: 1,
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  statusChip: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusChipWarning: {
    backgroundColor: appColors.amberSoftStrong,
  },
  statusChipText: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },
  statusChipTextWarning: {
    color: appColors.amber700,
  },
  historyInlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: appColors.amberSoftStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyInlineWarningText: {
    color: appColors.amber700,
    fontSize: 11,
    fontWeight: "700",
  },
  fabWrap: {
    position: "absolute",
    right: 20,
    alignItems: "flex-end",
  },
  fabHalo: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: appColors.brandOverlay18,
  },
  goalModalScreen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  goalModalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  goalModalTitle: {
    color: appColors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },
  goalModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  goalModalContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 8,
    backgroundColor: appColors.surfaceRaised,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  snackbarText: {
    flex: 1,
    color: appColors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  insightCard: {
    backgroundColor: appColors.surfaceCardAlt,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  insightCardExpanded: {
    backgroundColor: appColors.surfaceRaised,
    borderColor: appColors.borderStrong,
  },
  insightTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  insightHeaderCopy: {
    flex: 1,
  },
  insightMetaSide: {
    alignItems: "flex-end",
    gap: 10,
  },
  insightTitle: {
    color: appColors.plum2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  insightValue: {
    color: appColors.tabFocused,
    fontSize: 22,
    fontWeight: "900",
  },
  insightDetail: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  insightAccentLine: {
    width: 38,
    height: 3,
    borderRadius: 999,
    backgroundColor: appColors.brand400,
    marginTop: 12,
    marginBottom: 2,
  },
  insightToggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  insightToggleChipExpanded: {
    backgroundColor: appColors.surfaceRaised,
    borderColor: appColors.borderSoft,
  },
  insightToggleText: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  insightToggleTextExpanded: {
    color: appColors.plum2,
  },
  insightExpandedBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
    gap: 6,
  },
  insightExpandedLabel: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  insightExpandedText: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  goalCard: {
    backgroundColor: appColors.surfaceCard,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  sectionToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  collapsedSectionText: {
    color: appColors.plumSoft,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default WeightScreen;
