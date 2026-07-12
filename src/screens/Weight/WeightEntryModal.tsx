import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon, ClockIcon, PencilSimpleIcon } from "phosphor-react-native";
import type { DBWeightEntry } from "../../store/DB_TYPES";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import {
  getZoneOffsetMinutes,
  parseLocalizedWeight,
  toLocalIsoWithOffset,
} from "./weightUtils";
import {
  displayNumberToWeightKg,
  formatTimeOfDay,
  formatWeightValue,
  weightUnitLabel,
} from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  IconButton,
  InteractiveCard,
} from "../../components/ui";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import { appTypography } from "../../theme/typography";

export type WeightEntryDraft = {
  valueOriginal: number;
  measuredAt: string;
  measuredAtLocalIso: string;
  zoneOffsetMinutes: number;
  notes: string | null;
  source: "manual";
};

type WeightEntryModalProps = {
  visible: boolean;
  mode: "create" | "edit";
  initialEntry?: DBWeightEntry | null;
  onClose: () => void;
  onSave: (draft: WeightEntryDraft) => void;
  onDelete?: () => void;
};

const serializeDraft = (draft: {
  value: string;
  measuredAt: string;
  notes: string;
}) =>
  JSON.stringify({
    value: draft.value,
    measuredAt: draft.measuredAt,
    notes: draft.notes.trim(),
  });

const WeightEntryModal = ({
  visible,
  mode,
  initialEntry,
  onClose,
  onSave,
  onDelete,
}: WeightEntryModalProps) => {
  const insets = useSafeAreaInsets();
  const { weightUnit, timeFormat } = useDisplayPreferences();
  const initialDate = React.useMemo(
    () =>
      initialEntry ? new Date(initialEntry.measuredAtLocalIso) : new Date(),
    [initialEntry],
  );
  const [value, setValue] = React.useState(
    initialEntry ? formatWeightValue(initialEntry.valueKg, weightUnit) : "",
  );
  const [measuredAtDate, setMeasuredAtDate] = React.useState(initialDate);
  const [notes, setNotes] = React.useState(initialEntry?.notes ?? "");
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    const nextDate = initialEntry
      ? new Date(initialEntry.measuredAtLocalIso)
      : new Date();
    setValue(
      initialEntry ? formatWeightValue(initialEntry.valueKg, weightUnit) : "",
    );
    setMeasuredAtDate(nextDate);
    setNotes(initialEntry?.notes ?? "");
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [initialEntry, visible]);

  const initialSnapshot = React.useMemo(
    () =>
      serializeDraft({
        value: initialEntry
          ? formatWeightValue(initialEntry.valueKg, weightUnit)
          : "",
        measuredAt: initialDate.toISOString(),
        notes: initialEntry?.notes ?? "",
      }),
    [initialDate, initialEntry, weightUnit],
  );

  const currentSnapshot = serializeDraft({
    value,
    measuredAt: measuredAtDate.toISOString(),
    notes,
  });
  const isDirty = currentSnapshot !== initialSnapshot;

  const handleRequestClose = () => {
    if (!isDirty) {
      onClose();
      return;
    }

    Alert.alert("Discard changes?", "You have unsaved changes.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };

  const handleDateChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type !== "set" || !nextDate) {
      return;
    }

    const merged = new Date(measuredAtDate);
    merged.setFullYear(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate(),
    );
    setMeasuredAtDate(merged);
  };

  const handleTimeChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (event.type !== "set" || !nextDate) {
      return;
    }

    const merged = new Date(measuredAtDate);
    merged.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);
    setMeasuredAtDate(merged);
  };

  const handleSave = () => {
    try {
      setSaving(true);
      const parsedDisplay = parseLocalizedWeight(value);
      if (parsedDisplay == null) {
        Alert.alert(
          "Invalid weight",
          `Enter a valid number in ${weightUnit === "lb" ? "pounds" : "kilograms"}.`,
        );
        return;
      }

      const parsed = displayNumberToWeightKg(parsedDisplay, weightUnit);

      onSave({
        valueOriginal: parsed,
        measuredAt: measuredAtDate.toISOString(),
        measuredAtLocalIso: toLocalIsoWithOffset(measuredAtDate),
        zoneOffsetMinutes: getZoneOffsetMinutes(measuredAtDate),
        notes: notes.trim().length > 0 ? notes.trim() : null,
        source: "manual",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <IconButton
            onPress={handleRequestClose}
            accessibilityLabel="Go back"
          >
            <ArrowLeftIcon size={18} color={appColors.textPrimary} weight="bold" />
          </IconButton>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          focusedInputBottomOffset={132}
        >
          <AppCard style={styles.card}>
            <View>
              <AppText style={styles.heroTitle} variant="sectionTitleLarge">
                {mode === "create" ? "Log weight" : "Update weight entry"}
              </AppText>
            </View>
            <View style={styles.weightRow}>
              <AppInput
                label="Weight"
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                placeholder={weightUnit === "lb" ? "181.5" : "82.4"}
                style={styles.weightInput}
                containerStyle={styles.weightInputContainer}
                accessibilityLabel={`Weight in ${weightUnit === "lb" ? "pounds" : "kilograms"}`}
              />
              <View style={styles.unitPill}>
                <AppText style={styles.unitText} variant="bodyStrong">{weightUnitLabel(weightUnit)}</AppText>
              </View>
            </View>

            <AppText color="muted" style={styles.label} variant="eyebrow">Measured at</AppText>
            <View style={styles.dateRow}>
              <InteractiveCard
                onPress={() => setShowDatePicker((current) => !current)}
                style={styles.dateButton}
                accessibilityLabel="Select measurement date"
                variant="compact"
              >
                <ClockIcon
                  size={16}
                  color={appColors.textPrimary}
                  weight="bold"
                />
                <AppText style={styles.dateButtonText} variant="bodySmallStrong">
                  {measuredAtDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </AppText>
              </InteractiveCard>
              <InteractiveCard
                onPress={() => setShowTimePicker((current) => !current)}
                style={styles.dateButton}
                accessibilityLabel="Select measurement time"
                variant="compact"
              >
                <ClockIcon
                  size={16}
                  color={appColors.textPrimary}
                  weight="bold"
                />
                <AppText style={styles.dateButtonText} variant="bodySmallStrong">
                  {formatTimeOfDay(measuredAtDate, timeFormat)}
                </AppText>
              </InteractiveCard>
            </View>
            {showDatePicker ? (
              <DateTimePicker
                value={measuredAtDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker
                value={measuredAtDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
              />
            ) : null}

            <AppInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              style={styles.notesInput}
              multiline
              accessibilityLabel="Entry notes"
            />
          </AppCard>

          <AppButton
            onPress={() => void handleSave()}
            disabled={saving}
            icon={<PencilSimpleIcon size={16} color={appColors.white} weight="bold" />}
            label={
              saving
                ? mode === "edit"
                  ? "Saving..."
                  : "Logging..."
                : mode === "edit"
                  ? "Save changes"
                  : "Log weight"
            }
          />
          {mode === "edit" && onDelete ? (
            <AppButton
              onPress={() =>
                Alert.alert(
                  "Delete entry?",
                  "This will remove the entry locally. You can undo right after.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: onDelete },
                  ],
                )
              }
              label="Delete entry"
              variant="danger"
              style={styles.deleteButton}
            />
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  header: {
    paddingHorizontal: appSpacing.gutter,
    paddingBottom: appSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    marginBottom: appSpacing.xs,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
    gap: appSpacing.md,
  },
  card: {
    gap: appSpacing.sm,
  },
  label: {
    marginTop: appSpacing.xs,
  },
  weightRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
    alignItems: "flex-end",
  },
  weightInputContainer: {
    flex: 1,
  },
  weightInput: {
    ...appTypography.numberWeightEntry,
    minHeight: 50,
    textAlign: "left",
  },
  unitPill: {
    minHeight: 50,
    minWidth: 60,
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
  dateRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
    flexWrap: "wrap",
  },
  dateButton: {
    flex: 1,
    minWidth: 130,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    paddingHorizontal: appSpacing.sm,
  },
  dateButtonText: {
    flexShrink: 1,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  deleteButton: {
    alignSelf: "center",
    marginTop: appSpacing.xs,
  },
});

export default WeightEntryModal;
