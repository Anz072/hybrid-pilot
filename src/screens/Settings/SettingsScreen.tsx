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
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import {
  generateUuid,
  getZoneOffsetMinutes,
  roundWeightKg,
  toLocalIsoWithOffset,
} from "../Weight/weightUtils";
import { refreshAdaptiveRecommendationForUser } from "../User_Settings/adaptiveCaloriesActions";
import { appColors } from "../../theme/colors";

type WeightSeedPreset = "down" | "up" | "maintain";
const WEIGHT_PRESET_ENTRY_COUNT = 180;
const WEIGHT_PRESET_HISTORY_LABEL = "about 6 months";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const createWeightPresetValues = (preset: WeightSeedPreset): number[] =>
  Array.from({ length: WEIGHT_PRESET_ENTRY_COUNT }, (_, index) => {
    const progress =
      WEIGHT_PRESET_ENTRY_COUNT > 1
        ? index / (WEIGHT_PRESET_ENTRY_COUNT - 1)
        : 0;

    if (preset === "down") {
      const base = 74.7 - progress * 9.1;
      const drift = Math.sin(progress * 8) * 0.18;
      const noise = (Math.random() - 0.5) * 0.34;
      return roundWeightKg(clamp(base + drift + noise, 65, 75));
    }

    if (preset === "up") {
      const base = 65.3 + progress * 9.0;
      const drift = Math.cos(progress * 7) * 0.16;
      const noise = (Math.random() - 0.5) * 0.34;
      return roundWeightKg(clamp(base + drift + noise, 65, 75));
    }

    const base = 70 + Math.sin(progress * 11) * 0.45;
    const drift = Math.cos(progress * 5) * 0.18;
    const noise = (Math.random() - 0.5) * 0.52;
    return roundWeightKg(clamp(base + drift + noise, 65, 75));
  });

const getPresetLabel = (preset: WeightSeedPreset): string => {
  switch (preset) {
    case "down":
      return "trend down";
    case "up":
      return "trend up";
    case "maintain":
      return "maintain-ish";
    default:
      return preset;
  }
};

const SettingsScreen = () => {
  const user = useAppSelector((state) => state.user.currentUser);
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

  const runWeightPreset = async (preset: WeightSeedPreset) => {
    if (!user?.externalId) {
      Alert.alert(
        "No active user",
        "Sign in to your account first so the seeded weight history has somewhere to go.",
      );
      return;
    }

    setBusy(true);

    try {
      await DB.clearAllWeightData(user.externalId);

      const values = createWeightPresetValues(preset);
      const now = new Date();

      for (let index = 0; index < values.length; index += 1) {
        const measuredAtDate = new Date(now);
        measuredAtDate.setDate(now.getDate() - (values.length - 1 - index));
        measuredAtDate.setHours(7 + (index % 3), 10 + ((index * 7) % 45), 0, 0);

        const entryId = `debug-weight-${preset}-${index}-${generateUuid()}`;

        await DB.saveWeightEntry({
          id: entryId,
          userExternalId: user.externalId,
          measuredAt: measuredAtDate.toISOString(),
          measuredAtLocalIso: toLocalIsoWithOffset(measuredAtDate),
          zoneOffsetMinutes: getZoneOffsetMinutes(measuredAtDate),
          valueKg: values[index],
          valueOriginal: values[index],
          unitOriginal: "kg",
          source: "manual",
          notes: `Debug preset: ${getPresetLabel(preset)}`,
          clientGeneratedId: entryId,
        });
      }

      try {
        await refreshAdaptiveRecommendationForUser({
          userExternalId: user.externalId,
          force: true,
        });
      } catch {
        // Keep debug preset generation usable even if adaptive refresh fails.
      }

      await handleRefresh();
      Alert.alert(
        "Weight history ready",
        `Added ${WEIGHT_PRESET_ENTRY_COUNT} ${getPresetLabel(
          preset,
        )} entries and cleared previous weight data.`,
      );
    } catch (error) {
      Alert.alert(
        "Could not seed weight history",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSeedWeightPreset = (preset: WeightSeedPreset) => {
    Alert.alert(
      `Generate ${getPresetLabel(preset)} history?`,
      `This will remove current weight entries and weight goal for the active user, then add ${WEIGHT_PRESET_HISTORY_LABEL} of fresh debug entries.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          style: "destructive",
          onPress: () => {
            void runWeightPreset(preset);
          },
        },
      ],
    );
  };

  React.useEffect(() => {
    void handleRefresh();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <BugIcon size={24} color={appColors.slate900} weight="fill" />
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
          <DatabaseIcon size={18} color={appColors.white} weight="fill" />
          <Text style={styles.buttonText}>Refresh Counts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.seedButton]}
          onPress={() => void handleSeed()}
          disabled={busy}
        >
          <PlantIcon size={18} color={appColors.white} weight="fill" />
          <Text style={styles.buttonText}>Seed Sample</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
          disabled={busy}
        >
          <BroomIcon size={18} color={appColors.white} weight="fill" />
          <Text style={styles.buttonText}>Reset DB</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Debug Presets</Text>
        <Text style={styles.empty}>
          Each preset clears the current user&apos;s weight entries and goal,
          then adds {WEIGHT_PRESET_HISTORY_LABEL} of fresh kg entries for chart
          testing.
        </Text>

        <View style={styles.seedGroup}>
          <TouchableOpacity
            style={[styles.button, styles.weightDownButton]}
            onPress={() => handleSeedWeightPreset("down")}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Generate Trend Down</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.weightUpButton]}
            onPress={() => handleSeedWeightPreset("up")}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Generate Trend Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.weightMaintainButton]}
            onPress={() => handleSeedWeightPreset("maintain")}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Generate Maintain-ish</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ ...styles.card, marginTop: 16 }}>
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

      {/* 
          id: number;
          externalId: string;
          provider: DBUserProvider | string;
          displayName: string | null;
          createdAt: DBIsoDateString;
          email: string | null;
          birthdate: DBIsoDateString | null;
          gender: DBUserGender;
          heightCm: number | null;
          activityLevel: string | null;
          goal: string | null;
        */}

      <View style={{ ...styles.card, marginTop: 16 }}>
        <Text style={styles.cardTitle}>User Info</Text>
        {user ? (
          <View>
            <View style={styles.row}>
              <Text style={styles.count}>ID: {user.id}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Provider: {user.provider}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Display Name: {user.displayName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Email: {user.email}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Birthdate: {user.birthdate}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Gender: {user.gender}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Height: {user.heightCm} cm</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>
                Activity Level: {user.activityLevel}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>Goal: {user.goal}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>
                Training: {user.trainingTypes?.join(", ") || "None"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.count}>
                Calorie Allowance: {user.calorieAllowance}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>No user data.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: appColors.white,
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
    color: appColors.slate900,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: appColors.slate600,
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
    backgroundColor: appColors.slate900,
    borderRadius: 8,
    paddingVertical: 12,
  },
  seedButton: {
    backgroundColor: appColors.success700,
  },
  weightDownButton: {
    backgroundColor: appColors.success700,
  },
  weightUpButton: {
    backgroundColor: appColors.brand700,
  },
  weightMaintainButton: {
    backgroundColor: appColors.brand700,
  },
  resetButton: {
    backgroundColor: appColors.danger800,
  },
  buttonText: {
    color: appColors.white,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderColor: appColors.slate200,
    borderRadius: 8,
    padding: 12,
    backgroundColor: appColors.slate50,
  },
  seedGroup: {
    marginTop: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: appColors.slate900,
    marginBottom: 8,
  },
  empty: {
    color: appColors.textMuted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: appColors.slate200,
    paddingVertical: 8,
  },
  table: {
    color: appColors.slate700,
    fontWeight: "600",
  },
  count: {
    color: appColors.slate900,
    fontWeight: "800",
  },
});

export default SettingsScreen;
