import React from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarIcon,
  CaretDownIcon,
  CaretUpIcon,
  ChartLineIcon,
  PencilSimpleIcon,
  PlusIcon,
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
  generateUuid,
  getLocalDateKey,
  parseDateOnly,
  parseLocalizedWeight,
  roundWeightKg,
} from "./weightUtils";
import { appColors } from "../../theme/colors";
import {
  displayNumberToWeightKg,
  formatWeight,
  formatWeightValue,
  weightUnitLabel,
} from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  EmptyState,
  IconButton,
  InteractiveCard,
  LoadingState,
  NumericText,
} from "../../components/ui";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
import { appTypography } from "../../theme/typography";

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
  confirmStyle: "default" | "destructive" = "default",
): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: confirmStyle,
        onPress: () => resolve(true),
      },
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
  const { weightUnit } = useDisplayPreferences();
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
      nextGoal ? formatWeightValue(nextGoal.targetWeightKg, weightUnit) : "",
    );
    setTargetDate(
      nextGoal?.targetDate ? parseDateOnly(nextGoal.targetDate) : null,
    );
  }, [weightUnit]);

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
  const parsedTargetNumber = parseLocalizedWeight(targetWeightValue);
  const parsedTargetWeight =
    parsedTargetNumber != null
      ? displayNumberToWeightKg(parsedTargetNumber, weightUnit)
      : null;
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
    ? formatWeightValue(currentEntry.valueKg, weightUnit)
    : "--";
  const deltaText = currentEntry
    ? deltaVsTrend != null
      ? `${deltaVsTrend > 0 ? "+" : ""}${formatWeight(deltaVsTrend, weightUnit)} vs 7d avg`
      : "Need more recent entries for a 7d average"
    : "Log your first weight to start your trend";
  const goalChipText = goal
    ? goalProgress != null
      ? goalProgress >= 100
        ? "Goal reached"
        : `${goalProgress}% to goal`
      : `Target ${formatWeight(goal.targetWeightKg, weightUnit)}`
    : "Set a target";
  const goalSummaryText = goal
    ? goal.targetDate
      ? `Target ${formatWeight(goal.targetWeightKg, weightUnit)} by ${parseDateOnly(
          goal.targetDate,
        ).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : `Target ${formatWeight(goal.targetWeightKg, weightUnit)} with a +/- ${formatWeight(
          goal.goalBandKg ?? DEFAULT_GOAL_BAND_KG,
          weightUnit,
        )} band`
    : "Set a target to add a goal line and progress band to the chart.";
  const goalLauncherLabel = goal ? "Edit goal" : "Set goal";
  const chartOldestEntry = chartEntries[chartEntries.length - 1] ?? null;
  const chartNewestEntry = chartEntries[0] ?? null;
  const visibleDifference = React.useMemo(() => {
    if (!chartOldestEntry || !chartNewestEntry) {
      return null;
    }

    return roundWeightKg(chartNewestEntry.valueKg - chartOldestEntry.valueKg);
  }, [chartNewestEntry, chartOldestEntry]);
  const visibleDifferenceText =
    visibleDifference != null
      ? `${visibleDifference > 0 ? "+" : ""}${formatWeightValue(visibleDifference, weightUnit)}`
      : "--";
  const chartPeriodText =
    chartOldestEntry && chartNewestEntry
      ? `${formatHeaderDateLabel(chartOldestEntry.measuredAt)} - ${formatHeaderDateLabel(
          chartNewestEntry.measuredAt,
        )}`
      : "Log your first entry to build a trend";
  const trendConfidenceText =
    chartEntries.length >= 8
      ? `High confidence from ${chartEntries.length} check-ins`
      : chartEntries.length >= 4
        ? `Building confidence from ${chartEntries.length} check-ins`
        : chartEntries.length > 0
          ? `Early signal from ${chartEntries.length} check-ins`
          : "No trend confidence yet";

  const openEditModal = (entry: DBWeightEntry) => {
    setEditingEntry(entry);
    setModalMode("edit");
    setSelectedEntryId(entry.id);
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingEntry(null);
    setModalMode("create");
    setSelectedEntryId(null);
    setModalVisible(true);
  };

  const resetGoalDraftFromGoal = React.useCallback(() => {
    setTargetWeightValue(
      goal ? formatWeightValue(goal.targetWeightKg, weightUnit) : "",
    );
    setTargetDate(goal?.targetDate ? parseDateOnly(goal.targetDate) : null);
    setShowGoalDatePicker(false);
  }, [goal, weightUnit]);

  const openGoalModal = () => {
    resetGoalDraftFromGoal();
    setGoalModalVisible(true);
  };

  const closeGoalModal = () => {
    setGoalModalVisible(false);
    resetGoalDraftFromGoal();
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
      Alert.alert("Session expired", "Please sign in with email again.");
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
          ? "Daily entry updated - same-day save replaced the earlier entry"
          : baseEntry
            ? "Entry updated locally"
            : "Saved locally",
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
      setSnackbar({
        message:
          saved.syncStatus === "synced"
            ? "Synced"
            : sameDayEntries.length > 0
              ? "Saved locally - same-day entry replaced"
              : "Saved locally",
      });
      try {
        await refreshAdaptiveRecommendationForUser({
          userExternalId: userId,
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
    const confirmed = await confirmAsync(
      "Delete weight entry?",
      "This removes the check-in from your trend. You can undo it right after deleting.",
      "Delete",
      "destructive",
    );

    if (!confirmed) {
      return;
    }

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
      Alert.alert("Session expired", "Please sign in with email again.");
      return;
    }

    const parsedTargetInput = parseLocalizedWeight(targetWeightValue);
    if (parsedTargetInput == null || parsedTargetInput <= 0) {
      Alert.alert("Invalid target", "Enter a valid goal weight.");
      return;
    }

    const parsedTarget = displayNumberToWeightKg(parsedTargetInput, weightUnit);

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
      setTargetWeightValue(formatWeightValue(saved.targetWeightKg, weightUnit));
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

  const handleClearGoal = async () => {
    if (!goal || !userId) {
      return;
    }

    const confirmed = await confirmAsync(
      "Clear goal?",
      "This removes the target and goal band from your chart.",
      "Clear",
      "destructive",
    );

    if (!confirmed) {
      return;
    }

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

  const handleDataStatusPress = () => {
    Alert.alert(
      "Weight data",
      "Weight entries are saved locally first, then marked Synced when they are stored in your signed-in account.",
    );
  };

  const insightCards: InsightCardProps[] = [
    {
      title: "Trend",
      value:
        deltaVsTrend != null
          ? `${deltaVsTrend > 0 ? "+" : ""}${formatWeight(deltaVsTrend, weightUnit)}`
          : "Need more data",
      detail:
        monthlyAverage != null
          ? `30d avg ${formatWeight(monthlyAverage, weightUnit)} · ${trendConfidenceText}`
          : "We need more recent check-ins to compare your pace.",
      explanation:
        `The trend compares your latest weigh-in against your recent 7-day average so day-to-day fluctuations feel less noisy. ${trendConfidenceText}.`,
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
          ? `+/- ${formatWeight(volatility, weightUnit)}`
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
        <InteractiveCard
          key={title}
          onPress={() => toggleInsightCard(title)}
          accessibilityState={{ expanded }}
          style={[
            styles.insightCard,
            expanded && styles.insightCardExpanded,
          ]}
          variant="compact"
        >
          <View style={styles.insightTopRow}>
            <View style={styles.insightHeaderCopy}>
              <AppText color="secondary" style={styles.insightTitle} variant="eyebrow">
                {title}
              </AppText>
              <AppText color="secondary" style={styles.insightDetail} variant="metadata">
                {detail}
              </AppText>
            </View>
            <View style={styles.insightMetaSide}>
              <NumericText style={styles.insightValue} variant="numberWeightEntry">
                {value}
              </NumericText>
              <View
                style={[
                  styles.insightToggleChip,
                  expanded && styles.insightToggleChipExpanded,
                ]}
              >
                <AppText
                  style={[
                    styles.insightToggleText,
                    expanded && styles.insightToggleTextExpanded,
                  ]}
                  variant="label"
                >
                  {expanded ? "Hide" : "Open"}
                </AppText>
                {expanded ? (
                  <CaretUpIcon size={14} color={appColors.textSecondary} weight="bold" />
                ) : (
                  <CaretDownIcon size={14} color={appColors.textMuted} weight="bold" />
                )}
              </View>
            </View>
          </View>

          <View style={styles.insightAccentLine} />

          {expanded ? (
            <View style={styles.insightExpandedBody}>
              <AppText color="muted" style={styles.insightExpandedLabel} variant="eyebrow">
                How calculated
              </AppText>
              <AppText color="secondary" style={styles.insightExpandedText} variant="metadata">
                {explanation}
              </AppText>
            </View>
          ) : null}
        </InteractiveCard>
      );
    })();

  const listHeader = (
    <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.title} variant="screenTitle">Weight</AppText>
          <AppText color="secondary" style={styles.headerSubtitle} variant="metadata">
            {currentEntry
              ? `Latest ${formatHeaderDateLabel(currentEntry.measuredAt)}`
              : "Log your first check-in"}
          </AppText>
        </View>
        <AppButton
          onPress={openCreateModal}
          label="Log"
          icon={<PlusIcon size={17} color={appColors.white} weight="bold" />}
          style={styles.logWeightButton}
        />
      </View>
      <AppCard variant="hero" style={styles.heroCard}>
        <View style={styles.heroCurrentBlock}>
          <AppText color="muted" style={styles.heroStatLabel} variant="eyebrow">
            Current
          </AppText>
          <View style={styles.heroWeightLine}>
            <NumericText style={styles.heroStatValue} variant="numberWeightHero">
              {currentWeightText}
            </NumericText>
            <AppText color="secondary" style={styles.heroStatUnit} variant="body">
              {weightUnitLabel(weightUnit)}
            </AppText>
          </View>
          <AppText color="secondary" style={styles.heroStatCaption} variant="bodySmall">
            {currentEntry
              ? formatHeaderDateLabel(currentEntry.measuredAt)
              : "Need at least one entry"}
          </AppText>
        </View>

        <View style={styles.heroSupportRow}>
          <View style={styles.heroSupportPanel}>
            <AppText color="muted" style={styles.heroStatLabel} variant="eyebrow">
              Trend
            </AppText>
            <View style={styles.heroSupportValueRow}>
              <NumericText style={styles.heroTrendValue} variant="numberWeightEntry">
              {visibleDifferenceText}
              </NumericText>
              <AppText color="secondary" style={styles.heroSupportUnit} variant="metadata">
                {weightUnitLabel(weightUnit)}
              </AppText>
            </View>
            <AppText color="secondary" style={styles.heroStatCaption} variant="metadata">
              {chartPeriodText}
            </AppText>
          </View>
          <View style={styles.heroSupportPanel}>
            <AppText color="muted" style={styles.heroStatLabel} variant="eyebrow">
              Goal
            </AppText>
            <View style={styles.heroGoalLine}>
              <TargetIcon size={14} color={appColors.actionPrimaryPressed} weight="bold" />
              <AppText color={appColors.actionPrimaryPressed} style={styles.heroInfoGoalText} variant="bodySmallStrong">
                {goalChipText}
              </AppText>
            </View>
            <AppText color="secondary" style={styles.heroStatCaption} variant="metadata">
              {goal ? goalSummaryText : "Add a target when you are ready."}
            </AppText>
          </View>
        </View>

        <WeightTrendChart
          entries={chartEntries}
          goal={goal}
          range={range}
          onChangeRange={setRange}
        />
      </AppCard>

      <InteractiveCard
        onPress={openGoalModal}
        style={[styles.card, styles.goalCard]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.flexOne}>
            <AppText style={styles.dashboardSectionTitle} variant="sectionTitle">
              Goal & Target
            </AppText>
            <AppText color="secondary" style={styles.subtleText} variant="bodySmall">
              {goalSummaryText}
            </AppText>
          </View>
          <View style={[styles.pill, styles.goalLauncherPill]}>
            <TargetIcon size={14} color={appColors.textPrimary} weight="bold" />
            <AppText style={styles.pillText} variant="label">{goalLauncherLabel}</AppText>
          </View>
        </View>

        {goal ? (
          <View style={[styles.twoUp, styles.goalPreviewPanels]}>
            <AppCard variant="soft" style={styles.softPanel}>
              <AppText color="muted" style={styles.panelLabel} variant="eyebrow">
                Target
              </AppText>
              <NumericText style={styles.panelValue} variant="numberWeightEntry">
                {formatWeight(goal.targetWeightKg, weightUnit)}
              </NumericText>
            </AppCard>
            <AppCard variant="soft" style={styles.softPanel}>
              <AppText color="muted" style={styles.panelLabel} variant="eyebrow">
                Pace helper
              </AppText>
              <AppText style={styles.panelText} variant="bodySmallStrong">
                {currentEntry != null
                  ? (computeWeeklyPaceToGoal(
                      currentEntry.valueKg,
                      startEntry?.valueKg ?? currentEntry.valueKg,
                      goal,
                    ) ?? "Add a date to estimate weekly pace.")
                  : "Add a current entry to estimate weekly pace."}
              </AppText>
            </AppCard>
          </View>
        ) : null}
      </InteractiveCard>

      <InteractiveCard
        onPress={() => setHideInsights((current) => !current)}
        style={[styles.card, styles.sectionCard]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={styles.flexOne}>
            <AppText style={styles.dashboardSectionTitle} variant="sectionTitle">
              Insights & Data
            </AppText>
            <AppText color="muted" style={styles.sectionCaption} variant="metadata">
              Trend, consistency, and volatility. Tap to expand.
            </AppText>
          </View>
          <View style={styles.sectionToggle}>
            {hideInsights ? (
              <CaretDownIcon size={18} color={appColors.textMuted} weight="bold" />
            ) : (
              <CaretUpIcon size={18} color={appColors.textMuted} weight="bold" />
            )}
          </View>
        </View>
        {!hideInsights && (
          <View style={styles.stack}>
            {insightCards.map((item) => renderInsightCard(item))}
          </View>
        )}
      </InteractiveCard>

      <AppCard style={styles.card}>
        <InteractiveCard
          onPress={() => {
            animateQuickLayout();
            setHideHistory((current) => !current);
          }}
          style={styles.historyHeaderButton}
          variant="compact"
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexOne}>
              <AppText style={styles.dashboardSectionTitle} variant="sectionTitle">
                History
              </AppText>
              <AppText color="muted" style={styles.sectionCaption} variant="metadata">
                {historyEntries.length > 0
                  ? `${historyEntries.length} daily check-ins. New saves on the same day replace the earlier entry.`
                  : "Your weight history will appear here once you log an entry."}
              </AppText>
            </View>
            <View style={styles.sectionToggle}>
              {hideHistory ? (
                <CaretDownIcon size={18} color={appColors.textMuted} weight="bold" />
              ) : (
                <CaretUpIcon size={18} color={appColors.textMuted} weight="bold" />
              )}
            </View>
          </View>
        </InteractiveCard>

        {hideHistory ? (
          <AppText color="muted" style={styles.collapsedSectionText} variant="metadata">
            {collapsedHistoryText}
          </AppText>
        ) : null}
      </AppCard>
    </View>
  );

  if (loading) {
    return (
      <LoadingState
        title="Loading weight"
        message="Reading your recent check-ins and goal."
        style={styles.centerState}
      />
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
            <EmptyState
              icon={<ChartLineIcon size={28} color={appColors.statusSuccess} weight="bold" />}
              title="Log your first weigh-in"
              message="Add your first weight entry to unlock trend lines, goal progress, and history."
              style={[styles.card, styles.emptyCard]}
            />
          )
        }
        renderSectionHeader={() => (
          <View style={styles.historyTableHeader}>
            <View style={[styles.historyHeaderCell, styles.historyDateColumn]}>
              <AppText color="secondary" style={styles.historyHeaderLabel} variant="eyebrow">
                Date
              </AppText>
            </View>
            <View style={[styles.historyHeaderCell, styles.historyWeightColumn]}>
              <AppText color="secondary" style={styles.historyHeaderLabel} variant="eyebrow">
                Weight
              </AppText>
            </View>
            <View style={[styles.historyHeaderCell, styles.historySourceColumn]}>
              <AppText color="secondary" style={styles.historyHeaderLabel} variant="eyebrow">
                Source
              </AppText>
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
              ? "Needs review"
              : item.syncStatus === "pending"
                ? "Saved locally"
                : "Synced";
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
                  accessibilityLabel={`Delete ${formatWeight(item.valueKg, weightUnit)} entry`}
                >
                  <TrashIcon size={18} color={appColors.white} weight="bold" />
                  <AppText style={styles.deleteSwipeText} variant="label">
                    Delete
                  </AppText>
                </Pressable>
              )}
            >
              <InteractiveCard
                onPress={() => openEditModal(item)}
                style={[
                  styles.historyRow,
                  isFirst && styles.historyRowFirst,
                  isLast && styles.historyRowLast,
                  selected && styles.historyRowActive,
                ]}
                selected={selected}
                variant="compact"
              >
                <View style={styles.historyRowMain}>
                  <View style={[styles.historyCell, styles.historyDateColumn]}>
                    <AppText style={styles.historyDateText} numberOfLines={1} variant="bodySmallStrong">
                      {formatLocalDateLabel(item.measuredAtLocalIso)}
                    </AppText>
                    <AppText color="secondary" style={styles.historyTimeText} numberOfLines={1} variant="label">
                      {formatHistoryTimeLabel(item.measuredAtLocalIso)}
                    </AppText>
                  </View>

                  <View style={[styles.historyCell, styles.historyWeightColumn]}>
                    <NumericText style={styles.historyWeightText} numberOfLines={1} variant="numberWeightEntry">
                      {formatWeightValue(item.valueKg, weightUnit)}
                    </NumericText>
                    <AppText color="secondary" style={styles.historyWeightUnit} variant="micro">
                      {weightUnitLabel(weightUnit)}
                    </AppText>
                  </View>

                  <View style={[styles.historyCell, styles.historySourceColumn]}>
                    <AppText style={styles.historySourceText} numberOfLines={1} variant="label">
                      {sourceLabel}
                    </AppText>
                    <View
                      style={[
                        styles.statusChip,
                        item.syncStatus === "error" && styles.statusChipWarning,
                        item.syncStatus === "synced" && styles.statusChipSynced,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.statusChipText,
                          item.syncStatus === "error" &&
                            styles.statusChipTextWarning,
                          item.syncStatus === "synced" &&
                            styles.statusChipTextSynced,
                        ]}
                        variant="micro"
                      >
                        {statusLabel}
                      </AppText>
                    </View>
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
                      <AppText color="secondary" style={styles.historyNoteText} numberOfLines={2} variant="label">
                        {item.notes}
                      </AppText>
                    ) : null}
                    {item.syncError ? (
                      <View style={styles.historyInlineWarning}>
                        <WarningCircleIcon
                          size={12}
                          color={appColors.warning600}
                          weight="fill"
                        />
                        <AppText color={appColors.warning700} style={styles.historyInlineWarningText} variant="micro">
                          Edit and try saving again
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </InteractiveCard>
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
              <AppText color="secondary" style={styles.eyebrow} variant="eyebrow">
                Goal
              </AppText>
              <AppText style={styles.goalModalTitle} variant="sectionTitleLarge">
                {goal ? "Edit weight goal" : "Set weight goal"}
              </AppText>
            </View>
            <IconButton
              accessibilityLabel="Close goal editor"
              onPress={closeGoalModal}
            >
              <XIcon size={18} color={appColors.textPrimary} weight="bold" />
            </IconButton>
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={[
              styles.goalModalContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            <AppCard style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexOne}>
                  <AppText style={styles.sectionTitle} variant="sectionTitle">
                    Goal details
                  </AppText>
                  <AppText color="secondary" style={styles.subtleText} variant="bodySmall">
                    Set a target to add a goal line and progress band to the
                    chart.
                  </AppText>
                </View>
                {goal ? (
                  <View style={[styles.pill, styles.goalBandPill]}>
                    <NumericText color={appColors.actionPrimaryPressed} style={styles.goalBandText} variant="numberTrendDelta">
                      Band +/-{" "}
                      {formatWeight(
                        goal.goalBandKg ?? DEFAULT_GOAL_BAND_KG,
                        weightUnit,
                      )}
                    </NumericText>
                  </View>
                ) : null}
              </View>

              <View style={styles.inputRow}>
                <AppInput
                  label="Target weight"
                  value={targetWeightValue}
                  onChangeText={setTargetWeightValue}
                  keyboardType="decimal-pad"
                  placeholder="78.0"
                  style={styles.input}
                  containerStyle={styles.goalWeightInput}
                  accessibilityLabel={`Target weight in ${weightUnitLabel(weightUnit)}`}
                />
                <View style={styles.unitPill}>
                  <AppText style={styles.unitText} variant="bodyStrong">
                    {weightUnitLabel(weightUnit)}
                  </AppText>
                </View>
              </View>

              <View style={styles.inlineRow}>
                <InteractiveCard
                  onPress={() => setShowGoalDatePicker((current) => !current)}
                  style={styles.inlineButton}
                  variant="compact"
                >
                  <CalendarIcon
                    size={16}
                    color={appColors.textPrimary}
                    weight="bold"
                  />
                  <AppText style={styles.inlineButtonText} variant="bodySmallStrong">
                    {targetDate
                      ? targetDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Add target date"}
                  </AppText>
                </InteractiveCard>
                {targetDate ? (
                  <AppButton
                    onPress={() => setTargetDate(null)}
                    label="Clear date"
                    variant="ghost"
                    size="sm"
                    style={styles.textButton}
                  />
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
                <AppCard variant="soft" style={styles.softPanel}>
                  <AppText color="muted" style={styles.panelLabel} variant="eyebrow">
                    Target
                  </AppText>
                  <NumericText style={styles.panelValue} variant="numberWeightEntry">
                    {parsedTargetWeight != null
                      ? formatWeight(parsedTargetWeight, weightUnit)
                      : "--"}
                  </NumericText>
                </AppCard>
                <AppCard variant="soft" style={styles.softPanel}>
                  <AppText color="muted" style={styles.panelLabel} variant="eyebrow">
                    Pace helper
                  </AppText>
                  <AppText style={styles.panelText} variant="bodySmallStrong">
                    {goalPaceText ?? "Add a date to estimate weekly pace."}
                  </AppText>
                </AppCard>
              </View>

              <AppButton
                label={goalSaving ? "Saving goal..." : "Save goal"}
                onPress={() => void handleSaveGoal()}
                disabled={goalSaving}
              />
              {goal ? (
                <AppButton
                  onPress={() => void handleClearGoal()}
                  label="Clear goal"
                  variant="danger"
                  size="sm"
                  style={styles.textButton}
                />
              ) : null}
            </AppCard>
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
          <AppText style={styles.snackbarText} variant="bodySmall">
            {snackbar.message}
          </AppText>
          {snackbar.actionLabel && snackbar.onAction ? (
            <AppButton
              onPress={snackbar.onAction}
              label={snackbar.actionLabel}
              size="sm"
              variant="secondary"
              style={styles.snackbarAction}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.canvas,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
  },
  card: {
    marginBottom: appSpacing.lg,
  },
  cardPressed: {
    opacity: appStates.pressedOpacity,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  heroCard: {
    marginBottom: appSpacing.lg,
    padding: appSpacing.lg,
  },
  heroStatLabel: {
    marginBottom: appSpacing.xxs,
  },
  heroStatValue: {
    color: appColors.textPrimary,
    textAlign: "left",
  },
  heroStatUnit: {
    marginLeft: appSpacing.xs,
  },
  heroInfoGoalText: {
    flexShrink: 1,
  },
  heroCurrentBlock: {
    marginBottom: appSpacing.lg,
  },
  heroWeightLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    flexWrap: "wrap",
  },
  heroStatCaption: {
    flexShrink: 1,
  },
  heroSupportRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
    flexWrap: "wrap",
    marginBottom: appSpacing.md,
  },
  heroSupportPanel: {
    flex: 1,
    minWidth: 132,
    borderRadius: appRadius.lg,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.soft,
    padding: appSpacing.md,
  },
  heroSupportValueRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "baseline",
    gap: appSpacing.xxs,
  },
  heroTrendValue: {
    color: appColors.textPrimary,
    textAlign: "left",
  },
  heroSupportUnit: {
    textTransform: "uppercase",
  },
  heroGoalLine: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  flexOne: {
    flex: 1,
  },
  eyebrow: {
    alignSelf: "flex-start",
    color: appColors.statusSuccess,
    backgroundColor: appColors.statusSuccessSoft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 6,
    borderRadius: appRadius.pill,
    marginBottom: appSpacing.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 9,
  },
  pillText: {
    flexShrink: 1,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.md,
    marginBottom: appSpacing.lg,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  headerSubtitle: {
    flexShrink: 1,
  },
  logWeightButton: {
    minHeight: 44,
    paddingHorizontal: appSpacing.md,
  },
  subtleText: {
    marginTop: appSpacing.xxs,
  },
  sectionCaption: {
    marginTop: appSpacing.xxs,
  },
  goalBandPill: {
    backgroundColor: appColors.actionPrimarySoft,
  },
  goalLauncherPill: {
    alignSelf: "flex-start",
  },
  goalBandText: {
    textAlign: "left",
  },
  sectionTitle: {
    marginBottom: 2,
  },
  dashboardSectionTitle: {
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
    alignItems: "flex-end",
    marginBottom: appSpacing.md,
  },
  input: {
    ...appTypography.numberWeightEntry,
    minHeight: 50,
    textAlign: "left",
  },
  goalWeightInput: {
    flex: 1,
  },
  unitPill: {
    minHeight: 50,
    minWidth: 58,
    paddingHorizontal: appSpacing.md,
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  unitText: {
    textTransform: "uppercase",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
    flexWrap: "wrap",
    marginBottom: appSpacing.md,
  },
  inlineButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    paddingHorizontal: appSpacing.sm,
  },
  inlineButtonText: {
    flexShrink: 1,
  },
  goalPreviewPanels: {
    marginTop: appSpacing.sm,
    marginBottom: 0,
  },
  textButton: {
    alignSelf: "center",
    marginTop: appSpacing.xs,
  },
  twoUp: {
    flexDirection: "row",
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  softPanel: {
    flex: 1,
  },
  panelLabel: {
    marginBottom: appSpacing.xs,
  },
  panelValue: {
    color: appColors.textPrimary,
    textAlign: "left",
  },
  panelText: {
    flexShrink: 1,
  },
  stack: {
    gap: appSpacing.sm,
  },
  emptyCard: {
    marginHorizontal: appSpacing.gutter,
    marginTop: appSpacing.xs,
  },
  deleteSwipe: {
    width: 108,
    marginRight: appSpacing.gutter,
    marginBottom: 0,
    borderRadius: appRadius.md,
    backgroundColor: appColors.danger700,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteSwipeText: {
    color: appColors.white,
  },
  historyTableHeader: {
    marginHorizontal: appSpacing.gutter,
    marginTop: appSpacing.xs,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderBottomWidth: 0,
    borderColor: appBorders.soft,
    borderTopLeftRadius: appRadius.lg,
    borderTopRightRadius: appRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
  },
  historyHeaderCell: {
    justifyContent: "center",
  },
  historyHeaderLabel: {
    flexShrink: 1,
  },
  historyRow: {
    marginHorizontal: appSpacing.gutter,
    borderRadius: appRadius.none,
    backgroundColor: appSurfaces.card,
    borderLeftWidth: appBorders.width,
    borderRightWidth: appBorders.width,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: appBorders.soft,
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
  },
  historyRowFirst: {
    borderTopWidth: appBorders.width,
  },
  historyRowLast: {
    borderBottomWidth: appBorders.width,
    borderBottomLeftRadius: appRadius.lg,
    borderBottomRightRadius: appRadius.lg,
  },
  historyRowActive: {
    backgroundColor: appStates.selectedFill,
    borderColor: appStates.selectedBorder,
  },
  historyRowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
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
    flexShrink: 1,
  },
  historyTimeText: {
    flexShrink: 1,
  },
  historyWeightText: {
    color: appColors.textPrimary,
  },
  historyWeightUnit: {
    textTransform: "uppercase",
  },
  historySourceText: {
    textAlign: "right",
  },
  historySupplementalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: appSpacing.xs,
    marginTop: appSpacing.xs,
    paddingTop: appSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: appBorders.soft,
  },
  historyNoteText: {
    flex: 1,
  },
  statusChip: {
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.ghost,
    paddingHorizontal: appSpacing.xs,
    paddingVertical: appSpacing.xxs,
  },
  statusChipWarning: {
    backgroundColor: appColors.warningSurfaceStrong,
  },
  statusChipSynced: {
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  statusChipText: {
    color: appColors.textSecondary,
  },
  statusChipTextWarning: {
    color: appColors.warning700,
  },
  statusChipTextSynced: {
    color: appColors.success700,
  },
  historyInlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xxs,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.warningSurfaceStrong,
    paddingHorizontal: appSpacing.xs,
    paddingVertical: appSpacing.xxs,
  },
  historyInlineWarningText: {
    flexShrink: 1,
  },
  goalModalScreen: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  goalModalHeader: {
    paddingHorizontal: appSpacing.gutter,
    paddingBottom: appSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  goalModalTitle: {
    marginTop: appSpacing.xs,
  },
  goalModalContent: {
    paddingHorizontal: appSpacing.gutter,
    paddingTop: appSpacing.xs,
  },
  snackbar: {
    position: "absolute",
    left: appSpacing.gutter,
    right: appSpacing.gutter,
    borderRadius: appRadius.md,
    backgroundColor: appColors.surfaceRaised,
    paddingHorizontal: appSpacing.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  snackbarText: {
    flex: 1,
    color: appColors.white,
  },
  snackbarAction: {
    minHeight: 44,
  },
  insightCard: {
    backgroundColor: appSurfaces.soft,
  },
  insightCardExpanded: {
    backgroundColor: appStates.selectedFill,
    borderColor: appStates.selectedBorder,
  },
  insightTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  insightHeaderCopy: {
    flex: 1,
  },
  insightMetaSide: {
    alignItems: "flex-end",
    gap: appSpacing.xs,
  },
  insightTitle: {
    marginBottom: appSpacing.xxs,
  },
  insightValue: {
    color: appColors.textPrimary,
  },
  insightDetail: {
    flexShrink: 1,
  },
  insightAccentLine: {
    width: 38,
    height: 3,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.brand400,
    marginTop: appSpacing.sm,
    marginBottom: 2,
  },
  insightToggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: appRadius.pill,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 6,
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
  },
  insightToggleChipExpanded: {
    backgroundColor: appSurfaces.card,
    borderColor: appBorders.soft,
  },
  insightToggleText: {
    color: appColors.textMuted,
  },
  insightToggleTextExpanded: {
    color: appColors.textSecondary,
  },
  insightExpandedBody: {
    marginTop: appSpacing.sm,
    paddingTop: appSpacing.sm,
    borderTopWidth: appBorders.width,
    borderTopColor: appBorders.soft,
    gap: 6,
  },
  insightExpandedLabel: {
    flexShrink: 1,
  },
  insightExpandedText: {
    flexShrink: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appSpacing.sm,
    marginBottom: appSpacing.xs,
  },
  sectionToggle: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.ghost,
  },
  collapsedSectionText: {
    marginTop: appSpacing.xs,
  },
  goalCard: {},
  sectionCard: {},
  historyHeaderButton: {
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: appSpacing.none,
    paddingVertical: appSpacing.none,
  },
});

export default WeightScreen;
