import React from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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
import { DB } from "../../store/DB";
import OnboardingPrimaryButton from "../Onboarding/OnboardingPrimaryButton";
import WeightEntryModal, { type WeightEntryDraft } from "./WeightEntryModal";
import WeightTrendChart from "./WeightTrendChart";
import {
  DEFAULT_GOAL_BAND_KG,
  TIME_OF_DAY_OPTIONS,
  type WeightRangeKey,
  type WeightTimeOfDay,
  computeGoalProgress,
  computeMovingAverage,
  computeWeeklyPaceToGoal,
  deriveTimeOfDay,
  filterEntriesByRange,
  formatDateOnly,
  formatLocalDateTimeLabel,
  formatWeightKg,
  generateUuid,
  getMinutesBetween,
  groupEntriesByLocalDate,
  parseDateOnly,
  parseLocalizedWeight,
  roundWeightKg,
} from "./weightUtils";

const FALLBACK_USER_ID = "guest-local";
const SOFT_MIN_WEIGHT_KG = 20;
const SOFT_MAX_WEIGHT_KG = 300;
const FUTURE_GRACE_MINUTES = 5;
const DUPLICATE_WINDOW_MINUTES = 5;
const DUPLICATE_DELTA_KG = 0.05;

type SnackbarState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type FilterState = {
  source: "all" | "manual";
  tag: string | "all";
  timeOfDay: WeightTimeOfDay;
};

type InsightCardProps = {
  title: string;
  value: string;
  detail: string;
  explanation: string;
};

type HistorySection = {
  title: string;
  key: string;
  data: DBWeightEntry[];
};

const SOURCE_OPTIONS: Array<FilterState["source"]> = ["all", "manual"];

const TIME_OF_DAY_LABELS: Record<WeightTimeOfDay, string> = {
  all: "All day",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
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
  tags: entry.tags,
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

const WeightScreen = () => {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = React.useState(FALLBACK_USER_ID);
  const [allEntries, setAllEntries] = React.useState<DBWeightEntry[]>([]);
  const [goal, setGoal] = React.useState<WeightEntryGoal | null>(null);
  const [range, setRange] = React.useState<WeightRangeKey>("1M");
  const [filters, setFilters] = React.useState<FilterState>({
    source: "all",
    tag: "all",
    timeOfDay: "all",
  });
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
  const [hideFilters, setHideFilters] = React.useState(true);

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

  const hydrate = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const dbUser = await DB.getUser();
        const resolvedUserId = dbUser?.externalId ?? FALLBACK_USER_ID;
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
    [loadWeightState],
  );

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  React.useEffect(() => {
    if (!snackbar) {
      return;
    }

    const timeout = setTimeout(() => setSnackbar(null), 7000);
    return () => clearTimeout(timeout);
  }, [snackbar]);

  const activeEntries = React.useMemo(
    () => allEntries.filter((entry) => entry.deletedAt == null),
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

  const availableTags = React.useMemo(
    () =>
      Array.from(
        new Set(
          activeEntries.flatMap((entry) =>
            entry.tags.map((tag) => tag.toLowerCase()),
          ),
        ),
      ).sort(),
    [activeEntries],
  );

  const filteredEntries = React.useMemo(() => {
    const ranged = filterEntriesByRange(activeEntries, range);

    return ranged.filter((entry) => {
      if (filters.source !== "all" && entry.source !== filters.source) {
        return false;
      }

      if (filters.tag !== "all" && !entry.tags.includes(filters.tag)) {
        return false;
      }

      if (
        filters.timeOfDay !== "all" &&
        deriveTimeOfDay(entry.measuredAtLocalIso) !== filters.timeOfDay
      ) {
        return false;
      }

      return true;
    });
  }, [activeEntries, filters, range]);

  const chartEntries = React.useMemo(() => {
    if (range === "1W") {
      return filteredEntries;
    }

    return filterEntriesByRange(filteredEntries, "1M");
  }, [filteredEntries, range]);

  React.useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (
      !selectedEntryId ||
      !filteredEntries.some((entry) => entry.id === selectedEntryId)
    ) {
      setSelectedEntryId(filteredEntries[0]?.id ?? null);
    }
  }, [filteredEntries, selectedEntryId]);

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
          userExternalId: userId,
          targetWeightKg: parsedTargetWeight,
          targetDate: targetDate ? formatDateOnly(targetDate) : null,
          goalBandKg: goal?.goalBandKg ?? DEFAULT_GOAL_BAND_KG,
          createdAt: goal?.createdAt ?? "",
          updatedAt: goal?.updatedAt ?? "",
        }
      : goal;
  const goalPaceText =
    currentEntry != null
      ? computeWeeklyPaceToGoal(currentEntry.valueKg, previewGoal)
      : null;
  const historySections = React.useMemo<HistorySection[]>(
    () => groupEntriesByLocalDate(filteredEntries),
    [filteredEntries],
  );

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
  const isViewFiltered =
    range !== "1M" ||
    filters.source !== "all" ||
    filters.tag !== "all" ||
    filters.timeOfDay !== "all";

  const openCreateModal = () => {
    setEditingEntry(null);
    setModalMode("create");
    setModalVisible(true);
  };

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

  const finalizeSave = async (
    draft: WeightEntryDraft,
    options?: {
      replaceEntry?: DBWeightEntry | null;
      existingEntry?: DBWeightEntry | null;
      skipDuplicatePrompt?: boolean;
    },
  ) => {
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

    const entryToReplace = options?.skipDuplicatePrompt
      ? (options?.replaceEntry ?? null)
      : (options?.replaceEntry ??
        activeEntries.find((entry) => {
          if (entry.id === options?.existingEntry?.id) {
            return false;
          }

          return (
            getMinutesBetween(entry.measuredAt, draft.measuredAt) <=
              DUPLICATE_WINDOW_MINUTES &&
            Math.abs(entry.valueKg - draft.valueOriginal) <= DUPLICATE_DELTA_KG
          );
        }) ??
        null);

    if (
      !options?.skipDuplicatePrompt &&
      entryToReplace &&
      entryToReplace.id !== options?.existingEntry?.id
    ) {
      Alert.alert(
        "Possible duplicate",
        "A similar entry already exists nearby in time. Replace it or keep both?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Keep both",
            onPress: () => {
              void finalizeSave(draft, {
                replaceEntry: null,
                existingEntry: options?.existingEntry ?? null,
                skipDuplicatePrompt: true,
              });
            },
          },
          {
            text: "Replace",
            onPress: () => {
              void finalizeSave(draft, {
                replaceEntry: entryToReplace,
                existingEntry: entryToReplace,
                skipDuplicatePrompt: true,
              });
            },
          },
        ],
      );
      return;
    }

    const baseEntry = options?.existingEntry ?? editingEntry ?? null;
    const targetEntry = options?.replaceEntry ?? baseEntry;
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
      tags: draft.tags,
      clientGeneratedId: targetEntry?.clientGeneratedId ?? generateUuid(),
      deviceId: targetEntry?.deviceId ?? null,
      createdAt: targetEntry?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      version: (targetEntry?.version ?? 0) + 1,
      syncStatus: "pending",
      syncError: null,
    };

    const previousEntry = targetEntry;
    replaceLocalEntry(optimisticEntry);
    setSelectedEntryId(optimisticEntry.id);
    closeModal();

    showUndoSnackbar("Saved", async () => {
      try {
        if (!previousEntry) {
          const deleted = await DB.softDeleteWeightEntry({
            id: optimisticEntry.id,
            userExternalId: userId,
          });
          if (deleted) {
            replaceLocalEntry(deleted);
          }
          return;
        }

        const restored = await DB.saveWeightEntry(
          toSaveWeightEntryInput(previousEntry),
        );
        replaceLocalEntry(restored);
        setSelectedEntryId(restored.id);
      } catch {
        Alert.alert("Undo failed", "Please try editing the entry again.");
      }
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
        tags: optimisticEntry.tags,
        clientGeneratedId: optimisticEntry.clientGeneratedId,
        deviceId: optimisticEntry.deviceId,
      });
      replaceLocalEntry(saved);
    } catch {
      setSnackbar(null);
      if (previousEntry) {
        replaceLocalEntry(previousEntry);
      } else {
        setAllEntries((current) =>
          current.filter((entry) => entry.id !== optimisticEntry.id),
        );
      }
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
      } catch {
        Alert.alert("Undo failed", "Please try editing the entry again.");
      }
    });

    try {
      const deleted = await DB.softDeleteWeightEntry({
        id: entry.id,
        userExternalId: userId,
      });

      if (deleted) {
        replaceLocalEntry(deleted);
      }
    } catch {
      setSnackbar(null);
      replaceLocalEntry(entry);
      Alert.alert("Could not delete entry", "Please try again.");
    }
  };

  const handleSaveGoal = async () => {
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
    if (!goal) {
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

  const resetView = () => {
    setRange("1M");
    setFilters({
      source: "all",
      tag: "all",
      timeOfDay: "all",
    });
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
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.insightTitle}>{title}</Text>
              <Text style={styles.insightValue}>{value}</Text>
            </View>

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
                {expanded ? "Hide" : "More"}
              </Text>
              {expanded ? (
                <CaretUpIcon size={14} color="#0F172A" weight="bold" />
              ) : (
                <CaretDownIcon size={14} color="#64748B" weight="bold" />
              )}
            </View>
          </View>

          <Text style={styles.insightDetail}>{detail}</Text>

          {expanded ? (
            <View style={styles.insightExpandedBody}>
              <Text style={styles.insightExpandedLabel}>How calculated</Text>
              <Text style={styles.insightExpandedText}>{explanation}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    })();

  const listHeader = (
    <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
      <View style={styles.card}>
        <View style={[styles.rowBetween, styles.heroHeaderRow]}>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrow}>Weight</Text>
          </View>
          <Pressable
            onPress={handleSyncPillPress}
            style={({ pressed }) => [
              styles.pill,
              styles.syncPill,
              pressed && styles.cardPressed,
            ]}
          >
            <ArrowsClockwiseIcon size={16} color="#0F172A" weight="bold" />
            <Text style={styles.pillText}>{syncPillText}</Text>
          </Pressable>
        </View>
        <Text style={{ ...styles.metric, marginTop: 12 }}>
          {currentWeightText}
          <Text style={styles.metricUnit}> kg</Text>
        </Text>
        <View style={styles.metricRow}>
          <Text style={styles.subtleText}>{deltaText}</Text>
          <View style={styles.goalChip}>
            <TargetIcon size={14} color="#0F172A" weight="bold" />
            <Text style={styles.goalChipText}>{goalChipText}</Text>
          </View>
        </View>
      </View>

      {pendingCount > 0 || syncErrorCount > 0 ? (
        <View style={[styles.card, styles.warningCard]}>
          <View style={styles.warningRow}>
            <WarningCircleIcon size={18} color="#92400E" weight="fill" />
            <View style={styles.flexOne}>
              <Text style={styles.warningTitle}>
                Some history is not synced yet
              </Text>
              <Text style={styles.warningText}>
                {syncErrorCount > 0
                  ? `${syncErrorCount} entries need attention. Edit them and retry.`
                  : `${pendingCount} local changes are waiting and still fully usable offline.`}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <WeightTrendChart
        entries={chartEntries}
        goal={goal}
        range={range}
        selectedEntryId={selectedEntryId}
        onChangeRange={setRange}
        onSelectEntry={(entry) => setSelectedEntryId(entry.id)}
      />

      <Pressable
        onPress={openGoalModal}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>Goal</Text>
            <Text style={styles.subtleText}>{goalSummaryText}</Text>
          </View>
          <View style={[styles.pill, styles.goalLauncherPill]}>
            <TargetIcon size={14} color="#0F172A" weight="bold" />
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
                  ? (computeWeeklyPaceToGoal(currentEntry.valueKg, goal) ??
                    "Add a date to estimate weekly pace.")
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
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flexOne1}>
              <View style={{ maxWidth: "80%", marginBottom: 6 }}>
                <Text style={styles.sectionTitle}>Insights</Text>
              </View>
              <View style={styles.expandInsightLike}>
                {hideInsights ? (
                  <CaretDownIcon size={32} />
                ) : (
                  <CaretUpIcon size={32} />
                )}
              </View>
            </View>
          </View>
          {hideInsights ? (
            <Text style={{ ...styles.subtleText, fontSize: 10 }}>
              Insights are hidden. You can turn them back on at any time.
            </Text>
          ) : (
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
            setHideFilters((current) => !current);
          }}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          <View style={styles.rowBetween}>
            <View style={styles.flexOne1}>
              <View style={{ maxWidth: "80%", marginBottom: 6 }}>
                <Text style={styles.sectionTitle}>Filters</Text>
              </View>
              <View style={styles.expandInsightLike}>
                {hideFilters ? (
                  <CaretDownIcon size={32} />
                ) : (
                  <CaretUpIcon size={32} />
                )}
              </View>
            </View>
          </View>
          <Text style={{ ...styles.subtleText, fontSize: 10 }}>
            {isViewFiltered
              ? "Filters are hidden. The current view still uses your active filter selections."
              : "Filters are hidden. Expand this card any time to narrow the view."}
          </Text>
        </Pressable>

        {hideFilters ? (
          <></>
        ) : (
          <>
            {isViewFiltered ? (
              <Pressable
                onPress={resetView}
                style={({ pressed }) => [
                  styles.pill,
                  styles.resetViewPill,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.pillText}>Reset view</Text>
              </Pressable>
            ) : null}

            <Text style={styles.label}>Source</Text>
            <View style={styles.wrapRow}>
              {SOURCE_OPTIONS.map((source) => {
                const selected = filters.source === source;
                return (
                  <Pressable
                    key={source}
                    onPress={() =>
                      setFilters((current) => ({ ...current, source }))
                    }
                    style={({ pressed }) => [
                      styles.filterChip,
                      selected && styles.filterChipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextActive,
                      ]}
                    >
                      {source === "all" ? "All" : "Manual"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Tags</Text>
            <View style={styles.wrapRow}>
              <Pressable
                onPress={() =>
                  setFilters((current) => ({ ...current, tag: "all" }))
                }
                style={({ pressed }) => [
                  styles.filterChip,
                  filters.tag === "all" && styles.filterChipActive,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filters.tag === "all" && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {availableTags.map((tag) => {
                const selected = filters.tag === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() =>
                      setFilters((current) => ({ ...current, tag }))
                    }
                    style={({ pressed }) => [
                      styles.filterChip,
                      selected && styles.filterChipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextActive,
                      ]}
                    >
                      {toTitleCase(tag)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Time of day</Text>
            <View style={styles.wrapRow}>
              {TIME_OF_DAY_OPTIONS.map((timeOfDay) => {
                const selected = filters.timeOfDay === timeOfDay;
                return (
                  <Pressable
                    key={timeOfDay}
                    onPress={() =>
                      setFilters((current) => ({ ...current, timeOfDay }))
                    }
                    style={({ pressed }) => [
                      styles.filterChip,
                      selected && styles.filterChipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextActive,
                      ]}
                    >
                      {TIME_OF_DAY_LABELS[timeOfDay]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.historyIntro}>
        <Text style={styles.sectionTitle}>History</Text>
        <Text style={styles.subtleText}>
          {filteredEntries.length > 0
            ? `${filteredEntries.length} entries in this view. Tap a row to edit or swipe to delete.`
            : activeEntries.length > 0
              ? "No entries match the current range or filters."
              : "Your weight history will appear here once you log an entry."}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="small" color="#0F172A" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={historySections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void hydrate({ silent: true })}
            tintColor="#0F172A"
          />
        }
        contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={[styles.card, styles.emptyCard]}>
            <ChartLineIcon size={28} color="#0F766E" weight="bold" />
            <Text style={styles.sectionTitle}>
              {activeEntries.length === 0
                ? "Log your first weigh-in"
                : "No entries match this view"}
            </Text>
            <Text style={styles.subtleText}>
              {activeEntries.length === 0
                ? "Add your first weight entry to unlock trend lines, goal progress, and history."
                : "Try a wider range or reset the filters to bring entries back into view."}
            </Text>
            {activeEntries.length > 0 && isViewFiltered ? (
              <Pressable
                onPress={resetView}
                style={({ pressed }) => [
                  styles.pill,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.pillText}>Reset view</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.stickyHeader}>
            <Text style={styles.stickyHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const selected = item.id === selectedEntryId;
          const statusLabel =
            item.syncStatus === "error"
              ? "Sync issue"
              : item.syncStatus === "pending"
                ? "Pending"
                : null;

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
                  <TrashIcon size={18} color="#FFFFFF" weight="bold" />
                  <Text style={styles.deleteSwipeText}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => openEditModal(item)}
                style={({ pressed }) => [
                  styles.historyRow,
                  selected && styles.historyRowActive,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.historyValue}>
                      {formatWeightKg(item.valueKg)} kg
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatLocalDateTimeLabel(item.measuredAtLocalIso)} |{" "}
                      {toTitleCase(item.source)}
                    </Text>
                  </View>
                  <View style={styles.rowAction}>
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
                    ) : null}
                    <PencilSimpleIcon size={18} color="#475569" weight="bold" />
                  </View>
                </View>

                {item.tags.length > 0 ? (
                  <View style={styles.wrapRow}>
                    {item.tags.map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>
                          {toTitleCase(tag)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {item.notes ? (
                  <Text style={styles.noteText}>{item.notes}</Text>
                ) : null}

                {item.syncError ? (
                  <View style={styles.warningRow}>
                    <WarningCircleIcon
                      size={14}
                      color="#B45309"
                      weight="fill"
                    />
                    <Text style={styles.warningText}>
                      Sync error. Edit and retry.
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </Swipeable>
          );
        }}
      />

      <View style={[styles.fabWrap, { bottom: insets.bottom + 20 }]}>
        <View style={styles.fabHalo}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={openCreateModal}
            accessibilityRole="button"
            accessibilityLabel="Add weight entry"
          >
            <Text style={styles.buttonText}>+</Text>
          </Pressable>
        </View>
      </View>

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
              <XIcon size={18} color="#0F172A" weight="bold" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.goalModalContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
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
                  placeholderTextColor="#94A3B8"
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
                  <CalendarIcon size={16} color="#0F172A" weight="bold" />
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
          </ScrollView>
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
    backgroundColor: "#0F172A",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  cardPressed: {
    opacity: 0.92,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
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
    color: "#0F766E",
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: "#0F172A",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  syncPill: {
    flexShrink: 1,
    maxWidth: "100%",
  },
  expandInsightLike: {},
  resetViewPill: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  pillText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  pillDark: {
    borderRadius: 999,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillDarkText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "800",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 11,
  },
  segmentActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  segmentText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  metric: {
    color: "#0F172A",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    marginBottom: 12,
  },
  metricUnit: {
    fontSize: 24,
    fontWeight: "800",
    color: "#334155",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  subtleText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  goalChipText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  goalBandPill: {
    backgroundColor: "#EFF6FF",
  },
  goalLauncherPill: {
    alignSelf: "flex-start",
  },
  goalBandText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
  },
  warningCard: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningTitle: {
    color: "#78350F",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  warningText: {
    color: "#92400E",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  label: {
    color: "#64748B",
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
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  unitText: {
    color: "#0F172A",
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
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inlineButtonText: {
    color: "#0F172A",
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
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  destructiveText: {
    color: "#B91C1C",
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
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  panelLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  panelValue: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  panelText: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  stack: {
    gap: 10,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  historyIntro: {
    marginBottom: 8,
  },
  stickyHeader: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stickyHeaderText: {
    color: "#334155",
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
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteSwipeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  historyRow: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
  },
  historyRowActive: {
    borderColor: "#0F766E",
  },
  historyValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  historyMeta: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  rowAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipWarning: {
    backgroundColor: "#FEF3C7",
  },
  statusChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  statusChipTextWarning: {
    color: "#92400E",
  },
  tagPill: {
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagPillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  noteText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  fabWrap: {
    position: "absolute",
    right: 20,
    alignItems: "flex-end",
  },
  fabHalo: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.16)",
  },
  goalModalScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },
  goalModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  goalModalContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  snackbarText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  insightCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  insightCardExpanded: {
    backgroundColor: "#FDFEFF",
    borderColor: "#CBD5E1",
  },
  insightTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  insightValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  insightDetail: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
  insightToggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  insightToggleChipExpanded: {
    backgroundColor: "#E2E8F0",
    borderColor: "#CBD5E1",
  },
  insightToggleText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  insightToggleTextExpanded: {
    color: "#0F172A",
  },
  insightExpandedBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 6,
  },
  insightExpandedLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  insightExpandedText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
});

export default WeightScreen;
