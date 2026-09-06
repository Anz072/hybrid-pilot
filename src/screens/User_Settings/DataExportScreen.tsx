import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { Disclosure } from "../../components/ui";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DownloadSimpleIcon,
  ForkKnifeIcon,
  ScalesIcon,
  UploadSimpleIcon,
} from "phosphor-react-native";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import type { DBUserFoodLogEntry, DBWeightEntry } from "../../store/DB_TYPES";
import { formatFoodDateKey } from "../Food/foodUtils";
import { appColors } from "../../theme/colors";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  InteractiveCard,
} from "../../components/ui";
import {
  appBorders,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../../theme/tokens";
import SettingsStackHeader from "./SettingsStackHeader";
import {
  loadFoodLogForExport,
  buildBackup,
  buildFoodLogCsv,
  buildWeightsCsv,
  parseBackup,
  serializeBackup,
} from "./dataExportUtils";

type Props = NativeStackScreenProps<MoreParamList, "DataExportScreen">;

const FOOD_LOG_START = "1970-01-01";

const DataExportScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [importText, setImportText] = React.useState("");

  const loadAll = React.useCallback(async () => {
    if (!user) {
      throw new Error("no-user");
    }

    const today = formatFoodDateKey(new Date());
    const [settings, weightGoal, weights, foodLog] = await Promise.all([
      DB.getUserSettings(user.externalId),
      DB.getWeightGoal(user.externalId),
      DB.listWeightEntries(user.externalId),
      loadFoodLogForExport(
        (from, to) =>
          DB.getUserFoodLogEntriesBetween(user.externalId, from, to),
        FOOD_LOG_START,
        today,
      ),
    ]);

    return { settings, weightGoal, weights, foodLog };
  }, [user]);

  const share = React.useCallback(
    async (key: string, title: string, build: () => Promise<string>) => {
      if (busy) {
        return;
      }
      if (!user) {
        Alert.alert("No account found", "Sign in before exporting your data.");
        return;
      }

      setBusy(key);
      try {
        const content = await build();
        if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
          await Share.share({ title, message: content });
        } else {
          const extension = key.endsWith("csv") ? "csv" : "json";
          const file = new File(Paths.cache, `nouri-${key}.${extension}`);
          file.create({ overwrite: true });
          file.write(content);
          await Sharing.shareAsync(file.uri, {
            dialogTitle: title,
            mimeType: extension === "csv" ? "text/csv" : "application/json",
            UTI:
              extension === "csv"
                ? "public.comma-separated-values-text"
                : "public.json",
          });
        }
      } catch (error) {
        if ((error as Error)?.message !== "no-user") {
          Alert.alert(
            "Export failed",
            "Could not prepare your data. Please try again.",
          );
        }
      } finally {
        setBusy(null);
      }
    },
    [busy, user],
  );

  const exportWeightsCsv = () =>
    share("weights-csv", "Nouri weights (CSV)", async () => {
      const weights = await DB.listWeightEntries(user!.externalId);
      return buildWeightsCsv(weights);
    });

  const exportFoodCsv = () =>
    share("food-csv", "Nouri food log (CSV)", async () => {
      const foodLog = await loadFoodLogForExport(
        (from, to) =>
          DB.getUserFoodLogEntriesBetween(user!.externalId, from, to),
        FOOD_LOG_START,
        formatFoodDateKey(new Date()),
      );
      return buildFoodLogCsv(foodLog);
    });

  const exportBackup = () =>
    share("backup-json", "Nouri backup (JSON)", async () => {
      const { settings, weightGoal, weights, foodLog } = await loadAll();
      return serializeBackup(
        buildBackup({
          user: user ?? null,
          settings,
          weightGoal,
          weights,
          foodLog,
          exportedAt: new Date().toISOString(),
        }),
      );
    });

  const restoreWeights = React.useCallback(
    async (weights: DBWeightEntry[]) => {
      if (!user) {
        return;
      }
      let restored = 0;
      for (const entry of weights) {
        if (!Number.isFinite(entry.valueKg)) {
          continue;
        }
        await DB.saveWeightEntry({
          id: entry.id,
          userExternalId: user.externalId,
          measuredAt: entry.measuredAt,
          measuredAtLocalIso: entry.measuredAtLocalIso,
          zoneOffsetMinutes: entry.zoneOffsetMinutes ?? 0,
          valueKg: entry.valueKg,
          valueOriginal: entry.valueOriginal ?? entry.valueKg,
          unitOriginal: "kg",
          source: entry.source ?? "import",
          notes: entry.notes ?? null,
          clientGeneratedId: entry.clientGeneratedId ?? entry.id,
        });
        restored += 1;
      }
      return restored;
    },
    [user],
  );

  const onImport = React.useCallback(
    (raw = importText) => {
      if (!raw.trim()) {
        return;
      }
      if (!user) {
        Alert.alert("No account found", "Sign in before restoring a backup.");
        return;
      }

      const result = parseBackup(raw);
      if (!result.ok) {
        Alert.alert("Could not read backup", result.error);
        return;
      }

      const { backup } = result;
      const summary = `This backup has ${backup.weights.length} weight entries and ${backup.foodLog.length} food entries${backup.exportedAt ? ` (exported ${new Date(backup.exportedAt).toLocaleDateString()})` : ""}.\n\nRestoring will re-add the weight entries. Food entries and profile are not restored automatically.`;

      Alert.alert("Restore this backup?", summary, [
        { text: "Cancel", style: "cancel" },
        {
          text: `Restore ${backup.weights.length} weights`,
          onPress: () => {
            void (async () => {
              setBusy("import");
              try {
                const restored = await restoreWeights(backup.weights);
                setImportText("");
                Alert.alert(
                  "Backup restored",
                  `${restored ?? 0} weight entries were restored.`,
                );
              } catch {
                Alert.alert("Restore failed", "Please try again.");
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ]);
    },
    [busy, importText, restoreWeights, user],
  );

  const chooseBackup = async () => {
    if (busy) return;
    setBusy("choose");
    let cachedFile: File | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || (asset.size ?? 0) > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      if (Platform.OS !== "web") cachedFile = new File(asset.uri);
      if (cachedFile && cachedFile.size > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      const raw = asset.file
        ? await asset.file.text()
        : await cachedFile!.text();
      onImport(raw);
    } catch (error) {
      Alert.alert(
        "Could not open backup",
        error instanceof Error
          ? error.message
          : "Choose a Nouri JSON backup and try again.",
      );
    } finally {
      // Only the picker-created cache copy is removed; the selected original stays untouched.
      if (cachedFile?.uri.startsWith(Paths.cache.uri) && cachedFile.exists)
        cachedFile.delete();
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SettingsStackHeader
          onBack={() => navigation.goBack()}
          title="Export & backup"
        />

        <AppText style={styles.sectionTitle} variant="sectionTitle">
          Export
        </AppText>
        <AppCard style={styles.card} variant="plain">
          <ExportRow
            icon={
              <ScalesIcon size={20} color={appColors.brand700} weight="fill" />
            }
            title="Weights (CSV)"
            description="Every weigh-in with date, value, and source."
            busy={busy === "weights-csv"}
            onPress={exportWeightsCsv}
          />
          <ExportRow
            icon={
              <ForkKnifeIcon
                size={20}
                color={appColors.brand700}
                weight="fill"
              />
            }
            title="Food log (CSV)"
            description="Every logged item with meal, calories, and macros."
            busy={busy === "food-csv"}
            onPress={exportFoodCsv}
          />
          <ExportRow
            icon={
              <DownloadSimpleIcon
                size={20}
                color={appColors.brand700}
                weight="fill"
              />
            }
            title="Full backup (JSON)"
            description="Profile, settings, weights, and food log in one file."
            busy={busy === "backup-json"}
            onPress={exportBackup}
            last
          />
        </AppCard>

        <AppText style={styles.sectionTitle} variant="sectionTitle">
          Restore weight history
        </AppText>
        <AppCard style={styles.card} variant="plain">
          <AppText
            color="secondary"
            style={styles.restoreHint}
            variant="bodySmall"
          >
            Choose a Nouri JSON backup. This restores weight entries only.
          </AppText>
          <AppButton
            label={busy === "choose" ? "Opening..." : "Choose backup file"}
            onPress={() => void chooseBackup()}
            disabled={busy != null}
          />
          <Disclosure title="Paste JSON instead">
            <AppInput
              containerStyle={styles.importInputWrap}
              label="Backup JSON"
              multiline
              numberOfLines={5}
              style={styles.importInput}
              value={importText}
              onChangeText={setImportText}
              placeholder="Paste backup JSON here"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppButton
              onPress={() => onImport()}
              disabled={busy != null || !importText.trim()}
              icon={
                busy === "import" ? (
                  <ActivityIndicator color={appColors.white} size="small" />
                ) : (
                  <UploadSimpleIcon
                    size={18}
                    color={appColors.white}
                    weight="bold"
                  />
                )
              }
              label={busy === "import" ? "Restoring..." : "Review backup"}
              style={styles.importButton}
            />
          </Disclosure>
        </AppCard>
      </ScrollView>
    </View>
  );
};

type ExportRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  busy: boolean;
  onPress: () => void;
  last?: boolean;
};

const ExportRow = ({
  icon,
  title,
  description,
  busy,
  onPress,
  last,
}: ExportRowProps) => (
  <InteractiveCard
    onPress={onPress}
    disabled={busy}
    style={[styles.exportRow, !last && styles.exportRowDivider]}
    variant="plain"
  >
    <View style={styles.exportIcon}>{icon}</View>
    <View style={styles.exportCopy}>
      <AppText variant="bodySmallStrong">{title}</AppText>
      <AppText
        color="secondary"
        style={styles.exportDescription}
        variant="metadata"
      >
        {description}
      </AppText>
    </View>
    {busy ? (
      <ActivityIndicator color={appColors.actionPrimary} size="small" />
    ) : (
      <DownloadSimpleIcon size={18} color={appColors.textMuted} />
    )}
  </InteractiveCard>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
  },
  sectionTitle: {
    marginTop: appSpacing.xs,
    marginBottom: appSpacing.xs,
  },
  card: {
    gap: appSpacing.xs,
    marginBottom: appSpacing.gutter,
  },
  exportRow: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
  },
  exportRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  exportCopy: {
    flex: 1,
  },
  exportDescription: {
    marginTop: appSpacing.xxs,
  },
  restoreHint: {
    marginBottom: appSpacing.xs,
  },
  importInputWrap: {
    marginHorizontal: appSpacing.xxs,
  },
  importInput: {
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: appSurfaces.soft,
  },
  importButton: {
    marginTop: appSpacing.sm,
    marginHorizontal: appSpacing.xxs,
  },
});

export default DataExportScreen;
