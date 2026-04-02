import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BugIcon,
  DatabaseIcon,
  BroomIcon,
  PlantIcon,
} from "phosphor-react-native";
import {
  getDebugTableCounts,
  resetDb,
  seedDebugData,
  type TableCount,
} from "../../storage/sqlite";

const SettingsScreen = () => {
  const [counts, setCounts] = React.useState<TableCount[]>([]);
  const [busy, setBusy] = React.useState(false);

  const handleRefresh = async () => {
    setBusy(true);

    try {
      const next = await getDebugTableCounts();
      setCounts(next);
    } catch {
      Alert.alert("Could not read DB", "Try restarting the app.");
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    setBusy(true);

    try {
      await seedDebugData();
      await handleRefresh();
      Alert.alert("Done", "Sample user and weight logs added.");
    } catch (error) {
      Alert.alert(
        "Seed failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    Alert.alert("Reset database?", "This removes all local tables and data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setBusy(true);

          try {
            await resetDb();
            await handleRefresh();
            Alert.alert("Database reset", "Migrations reapplied successfully.");
          } catch (error) {
            Alert.alert(
              "Reset failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  React.useEffect(() => {
    void handleRefresh();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <BugIcon size={24} color="#0f172a" weight="fill" />
        <Text style={styles.title}>Debug Tools</Text>
      </View>

      <Text style={styles.subtitle}>
        Inspect local SQLite data while developing.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => void handleRefresh()}
          disabled={busy}
        >
          <DatabaseIcon size={18} color="#ffffff" weight="fill" />
          <Text style={styles.buttonText}>Refresh Counts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.seedButton]}
          onPress={() => void handleSeed()}
          disabled={busy}
        >
          <PlantIcon size={18} color="#ffffff" weight="fill" />
          <Text style={styles.buttonText}>Seed Sample</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
          disabled={busy}
        >
          <BroomIcon size={18} color="#ffffff" weight="fill" />
          <Text style={styles.buttonText}>Reset DB</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Table Row Counts</Text>
        {counts.length === 0 ? (
          <Text style={styles.empty}>No data yet.</Text>
        ) : (
          counts.map((item) => (
            <View key={item.table} style={styles.row}>
              <Text style={styles.table}>{item.table}</Text>
              <Text style={styles.count}>{item.count}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  buttonRow: {
    gap: 10,
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 12,
  },
  seedButton: {
    backgroundColor: "#166534",
  },
  resetButton: {
    backgroundColor: "#991b1b",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  empty: {
    color: "#64748b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingVertical: 8,
  },
  table: {
    color: "#334155",
    fontWeight: "600",
  },
  count: {
    color: "#0f172a",
    fontWeight: "800",
  },
});

export default SettingsScreen;


