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
import { ClockIcon, XIcon } from "phosphor-react-native";
import type { DBWeightEntry } from "../../store/DB_TYPES";
import OnboardingPrimaryButton from "../Onboarding/OnboardingPrimaryButton";
import {
  formatWeightKg,
  getZoneOffsetMinutes,
  parseLocalizedWeight,
  toLocalIsoWithOffset,
} from "./weightUtils";

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
    () => (initialEntry ? new Date(initialEntry.measuredAtLocalIso) : new Date()),
    [initialEntry],
  );
  const [value, setValue] = React.useState(
    initialEntry ? formatWeightKg(initialEntry.valueOriginal) : "",
  );
  const [measuredAtDate, setMeasuredAtDate] = React.useState(initialDate);
  const [notes, setNotes] = React.useState(initialEntry?.notes ?? "");
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    const nextDate = initialEntry ? new Date(initialEntry.measuredAtLocalIso) : new Date();
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
    merged.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
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
    Keyboard.dismiss();
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
          <View>
            <Text style={styles.eyebrow}>
              {mode === "create" ? "Add Entry" : "Edit Entry"}
            </Text>
            <Text style={styles.title}>
              {mode === "create" ? "Log weight" : "Update weight entry"}
            </Text>
          </View>
          <Pressable
            onPress={handleRequestClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            accessibilityLabel="Close weight entry"
          >
            <XIcon size={18} color="#0F172A" weight="bold" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
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
                placeholderTextColor="#94A3B8"
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
                <ClockIcon size={16} color="#0F172A" weight="bold" />
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
                <ClockIcon size={16} color="#0F172A" weight="bold" />
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
              placeholderTextColor="#94A3B8"
              style={styles.notesInput}
              multiline
              accessibilityLabel="Entry notes"
            />
          </View>

          <OnboardingPrimaryButton label="Save" onPress={handleSave} />
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
    backgroundColor: "#F8FAFC",
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
    color: "#0F766E",
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.9,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  label: {
    color: "#64748B",
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
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  unitText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
  },
  dateButtonPressed: {
    opacity: 0.9,
  },
  dateButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
    color: "#0F172A",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
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
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default WeightEntryModal;
