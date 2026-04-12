import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClockIcon, PencilSimpleIcon, XIcon } from "phosphor-react-native";
import type { DBWeightEntry } from "../../store/DB_TYPES";
import OnboardingPrimaryButton from "../Onboarding/OnboardingPrimaryButton";
import {
  formatWeightKg,
  getZoneOffsetMinutes,
  parseLocalizedWeight,
  toLocalIsoWithOffset,
} from "./weightUtils";
import { appColors } from "../../theme/colors";

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
  const initialDate = React.useMemo(
    () =>
      initialEntry ? new Date(initialEntry.measuredAtLocalIso) : new Date(),
    [initialEntry],
  );
  const [value, setValue] = React.useState(
    initialEntry ? formatWeightKg(initialEntry.valueOriginal) : "",
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
    setValue(initialEntry ? formatWeightKg(initialEntry.valueOriginal) : "");
    setMeasuredAtDate(nextDate);
    setNotes(initialEntry?.notes ?? "");
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [initialEntry, visible]);

  const initialSnapshot = React.useMemo(
    () =>
      serializeDraft({
        value: initialEntry ? formatWeightKg(initialEntry.valueOriginal) : "",
        measuredAt: initialDate.toISOString(),
        notes: initialEntry?.notes ?? "",
      }),
    [initialDate, initialEntry],
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
      const parsed = parseLocalizedWeight(value);
      if (parsed == null) {
        Alert.alert("Invalid weight", "Enter a valid number in kilograms.");
        return;
      }

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
          <View />
          <Pressable
            onPress={handleRequestClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityLabel="Close weight entry"
          >
            <XIcon size={24} color={appColors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View>
              <Text style={styles.heroTitle}>
                {mode === "create" ? "Log weight" : "Update weight entry"}
              </Text>
            </View>
            <Text style={styles.label}>Weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                placeholder="82.4"
                placeholderTextColor={appColors.slate400}
                style={styles.weightInput}
                accessibilityLabel="Weight in kilograms"
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>kg</Text>
              </View>
            </View>

            <Text style={styles.label}>Measured at</Text>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => setShowDatePicker((current) => !current)}
                style={({ pressed }) => [
                  styles.dateButton,
                  pressed && styles.dateButtonPressed,
                ]}
                accessibilityLabel="Select measurement date"
              >
                <ClockIcon
                  size={16}
                  color={appColors.textPrimary}
                  weight="bold"
                />
                <Text style={styles.dateButtonText}>
                  {measuredAtDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTimePicker((current) => !current)}
                style={({ pressed }) => [
                  styles.dateButton,
                  pressed && styles.dateButtonPressed,
                ]}
                accessibilityLabel="Select measurement time"
              >
                <ClockIcon
                  size={16}
                  color={appColors.textPrimary}
                  weight="bold"
                />
                <Text style={styles.dateButtonText}>
                  {measuredAtDate.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>
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

            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor={appColors.slate400}
              style={styles.notesInput}
              multiline
              accessibilityLabel="Entry notes"
            />
          </View>

          {/* <OnboardingPrimaryButton label="Save" onPress={handleSave} /> */}
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabled,
              pressed && !saving && styles.cardPressed,
            ]}
          >
            <PencilSimpleIcon size={16} color={appColors.white} weight="bold" />
            <Text style={styles.primaryButtonText}>
              Log Weight
            </Text>
          </Pressable>
          {mode === "edit" && onDelete ? (
            <Pressable
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
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Text style={styles.deleteText}>Delete entry</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: appColors.revolutDark,
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.teal700,
    backgroundColor: appColors.tealSoftBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  closeButtonPressed: {
    opacity: 0.9,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
  },
  label: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 12,
  },
  weightRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "800",
    color: appColors.textPrimary,
    backgroundColor: appColors.surfaceField,
  },
  unitPill: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  unitText: {
    fontSize: 20,
    fontWeight: "600",
    color: appColors.textPrimary,
  },
  dateRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 16,
  },
  dateButtonPressed: {
    opacity: 0.9,
  },
  dateButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
    color: appColors.textPrimary,
    fontSize: 15,
    backgroundColor: appColors.surfaceField,
  },
  deleteButton: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 14,
  },
  deleteButtonPressed: {
    opacity: 0.85,
  },
  deleteText: {
    color: appColors.danger700,
    fontSize: 15,
    fontWeight: "800",
  },
});

export default WeightEntryModal;
