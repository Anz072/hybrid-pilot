import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarbellIcon, PlusCircleIcon } from "phosphor-react-native";
import {
  addWeightLog,
  getRecentWeightLogs,
} from "../../store/weightRepository";
import { DB } from "../../store/DB";

const FALLBACK_USER_ID = "guest-local";

const WeightScreen = () => {
  const [value, setValue] = React.useState("");
  const [logs, setLogs] = React.useState<
    import("../../store/DB_TYPES").DBWeightLog[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [userId, setUserId] = React.useState<string>(FALLBACK_USER_ID);

  const loadLogs = React.useCallback(async (currentUserId: string) => {
    setLoading(true);

    try {
      const data = await DB.getRecentWeightLogs(currentUserId, 50);
      setLogs(data);
    } catch {
      Alert.alert("Could not load logs", "Please restart and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const hydrate = async () => {
      const dbUser = await DB.getUser();
      const resolvedUserId = dbUser?.externalId ?? FALLBACK_USER_ID;
      setUserId(resolvedUserId);
      await loadLogs(resolvedUserId);
    };

    void hydrate();
  }, [loadLogs]);

  const handleSave = async () => {
    const parsed = Number(value.replace(",", "."));
    const MIN_WEIGHT = 20;
    const MAX_WEIGHT = 500;

    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_WEIGHT ||
      parsed > MAX_WEIGHT
    ) {
      Alert.alert(
        "Invalid weight",
        `Enter a valid number between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg.`,
      );
      return;
    }

    setSaving(true);

    try {
      await DB.addWeightLog({ userExternalId: userId, weightKg: parsed });
      setValue("");
      await loadLogs(userId);
    } catch {
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <BarbellIcon size={26} color="#0f172a" weight="fill" />
        <Text style={styles.title}>Weight Tracking</Text>
      </View>

      <Text style={styles.subtitle}>
        Log your bodyweight and watch your consistency climb.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="e.g. 84.2"
          style={styles.input}
        />
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <PlusCircleIcon size={20} color="#ffffff" weight="fill" />
          <Text style={styles.saveText}>{saving ? "Saving" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#0f172a" />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>
            No weight logs yet. Add your first one today.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.logItem}>
              <Text style={styles.logWeight}>
                {item.weightKg.toFixed(1)} kg
              </Text>
              <Text style={styles.logDate}>
                {new Date(item.loggedAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: "#475569",
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 92,
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#64748b",
  },
  listContent: {
    paddingBottom: 18,
  },
  logItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  logWeight: {
    fontWeight: "800",
    color: "#0f172a",
    fontSize: 16,
  },
  logDate: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },
});

export default WeightScreen;
