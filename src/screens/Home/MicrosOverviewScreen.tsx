import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { XIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { MacroBar } from "../Food/FoodDiaryHeroCard";
import type { DBUser } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import {
  MICRONUTRIENT_TARGETS,
  getMicronutrientBasis,
  getMicronutrientProgress,
  getMicronutrientTargets,
  type OpenFoodMapMicronutrientKey,
  type UserMicronutrientProfile,
} from "../../engine/micronutrients";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  averageMicronutrientTotals,
  buildRecentDateKeys,
  countTrackedMicronutrients,
  createEmptyMicronutrientTotals,
  formatMicronutrientValue,
  getMicronutrientRows,
  loadNutritionSnapshot,
} from "./homeNutrition";

type MicrosRangeMode = "today" | "average_7d";
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type MicronutrientRow = ReturnType<typeof getMicronutrientRows>[number];
type MicronutrientRowWithTarget = MicronutrientRow & {
  basis: string;
  target: number;
  progressPercent: number;
  statusText: string;
};

const formatRangeLabel = (dates: string[]) => {
  if (dates.length === 0) {
    return "";
  }

  const sortedDates = [...dates].sort();
  const oldest = new Date(`${sortedDates[0]}T12:00:00`);
  const newest = new Date(`${sortedDates[sortedDates.length - 1]}T12:00:00`);

  if (sortedDates.length === 1) {
    return newest.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  return `${oldest.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${newest.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const computeAge = (birthdate: string | null | undefined): number | null => {
  if (!birthdate) {
    return null;
  }

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const birthdayHasPassed =
    now.getMonth() > parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() &&
      now.getDate() >= parsed.getDate());

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const getMicronutrientProfileFromUser = (
  user: DBUser | null | undefined,
): UserMicronutrientProfile | null => {
  const age = computeAge(user?.birthdate);

  if ((user?.gender !== "male" && user?.gender !== "female") || age == null) {
    return null;
  }

  if (age < 19) {
    return null;
  }

  return {
    sex: user.gender,
    age,
  };
};

const buildStatusText = ({
  consumed,
  target,
  basis,
  progressPercent,
  unit,
}: {
  consumed: number;
  target: number;
  basis: string;
  progressPercent: number;
  unit: "mg" | "ug";
}) => {
  const delta = Math.abs(target - consumed);

  if (consumed <= 0.001) {
    return `Needs ${formatMicronutrientValue(target, unit)} to reach ${basis}`;
  }

  if (progressPercent >= 110) {
    return `${formatMicronutrientValue(delta, unit)} above ${basis}`;
  }

  if (progressPercent >= 90) {
    return `On target for ${basis}`;
  }

  return `${formatMicronutrientValue(delta, unit)} left to reach ${basis}`;
};

const MicrosOverviewScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [selectedMode, setSelectedMode] = React.useState<MicrosRangeMode>(
    "today",
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [todaySnapshot, setTodaySnapshot] = React.useState<Awaited<
    ReturnType<typeof loadNutritionSnapshot>
  > | null>(null);
  const [weekSnapshot, setWeekSnapshot] = React.useState<Awaited<
    ReturnType<typeof loadNutritionSnapshot>
  > | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      const load = async () => {
        if (!user?.externalId) {
          if (active) {
            setTodaySnapshot(null);
            setWeekSnapshot(null);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const [today, week] = await Promise.all([
            loadNutritionSnapshot(user.externalId, buildRecentDateKeys(1)),
            loadNutritionSnapshot(user.externalId, buildRecentDateKeys(7)),
          ]);

          if (!active) {
            return;
          }

          setTodaySnapshot(today);
          setWeekSnapshot(week);
        } catch (loadError) {
          if (!active) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load micronutrients.",
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [user?.externalId]),
  );

  const selectedMicros = React.useMemo(() => {
    if (selectedMode === "today") {
      return todaySnapshot?.micronutrients ?? createEmptyMicronutrientTotals();
    }

    return averageMicronutrientTotals(
      weekSnapshot?.micronutrients ?? createEmptyMicronutrientTotals(),
      7,
    );
  }, [selectedMode, todaySnapshot?.micronutrients, weekSnapshot?.micronutrients]);

  const trackedCount = React.useMemo(
    () => countTrackedMicronutrients(selectedMicros),
    [selectedMicros],
  );

  const micronutrientProfile = React.useMemo(
    () => getMicronutrientProfileFromUser(user),
    [user],
  );

  const referenceTargets = React.useMemo(() => {
    if (micronutrientProfile) {
      return getMicronutrientTargets(micronutrientProfile);
    }

    return MICRONUTRIENT_TARGETS.generic;
  }, [micronutrientProfile]);

  const visibleRows = React.useMemo<MicronutrientRowWithTarget[]>(
    () =>
      getMicronutrientRows(selectedMicros).map((row) => {
        const micronutrientKey = row.key as OpenFoodMapMicronutrientKey;
        const target =
          referenceTargets[micronutrientKey] ??
          MICRONUTRIENT_TARGETS.generic[micronutrientKey];
        const progressPercent = getMicronutrientProgress({
          consumed: row.value,
          target,
        });

        return {
          ...row,
          basis: getMicronutrientBasis(micronutrientKey),
          target,
          progressPercent,
          statusText: buildStatusText({
            consumed: row.value,
            target,
            basis: getMicronutrientBasis(micronutrientKey),
            progressPercent,
            unit: row.unit,
          }),
        };
      }),
    [referenceTargets, selectedMicros],
  );

  const vitamins = React.useMemo(
    () => visibleRows.filter((row) => row.group === "Vitamins"),
    [visibleRows],
  );
  const minerals = React.useMemo(
    () => visibleRows.filter((row) => row.group === "Minerals"),
    [visibleRows],
  );

  const rangeLabel =
    selectedMode === "today"
      ? formatRangeLabel(todaySnapshot?.dates ?? [])
      : formatRangeLabel(weekSnapshot?.dates ?? []);
  const headlineText =
    selectedMode === "today"
      ? `${trackedCount} micronutrients logged today`
      : `${trackedCount} micronutrients averaged per day`;
  const referenceCopy = micronutrientProfile
    ? "Targets are matched to your age and sex profile."
    : "Using general adult RDA and AI targets until your profile is complete.";

  const getMacroBarAccent = (item: MicronutrientRowWithTarget) =>
    item.group === "Vitamins" ? appColors.foodPrimary : appColors.teal600;

  const getMacroBarPlaces = (item: MicronutrientRowWithTarget) => {
    if (item.unit === "mg") {
      return item.target < 10 ? 1 : 0;
    }

    return 0;
  };

  const renderNutrientRow = (item: MicronutrientRowWithTarget) => {
    return (
      <View key={item.key} style={styles.nutrientRow}>
        <MacroBar
          accent={getMacroBarAccent(item)}
          consumed={item.value}
          label={item.label}
          places={getMacroBarPlaces(item)}
          target={item.target}
          unit={item.unit}
        />
        <View style={styles.nutrientMetaRow}>
          <Text style={styles.nutrientMetaText}>
            {item.basis} target: {formatMicronutrientValue(item.target, item.unit)}
          </Text>
          <Text style={styles.nutrientMetaText}>{item.statusText}</Text>
        </View>
        <View style={styles.nutrientMetaRow}>
          <Text style={styles.nutrientMetaText}>
            {item.progressPercent.toLocaleString(undefined, {
              maximumFractionDigits: item.progressPercent >= 100 ? 0 : 1,
            })}
            % reached
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Micros</Text>
            <Text style={styles.title}>Micronutrients</Text>
            <Text style={styles.subtitle}>
              Totals come from foods with micronutrient data. Quick adds do not
              contribute here.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.cardPressed,
            ]}
          >
            <XIcon size={18} color={appColors.textPrimary} weight="bold" />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setSelectedMode("today")}
              style={({ pressed }) => [
                styles.togglePill,
                selectedMode === "today" && styles.togglePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedMode === "today" && styles.toggleTextActive,
                ]}
              >
                Today
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedMode("average_7d")}
              style={({ pressed }) => [
                styles.togglePill,
                selectedMode === "average_7d" && styles.togglePillActive,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedMode === "average_7d" && styles.toggleTextActive,
                ]}
              >
                7 day avg
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={appColors.foodPrimary} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <Text style={styles.heroHeadline}>{headlineText}</Text>
              <Text style={styles.heroRangeLabel}>
                {selectedMode === "today"
                  ? rangeLabel
                  : `${rangeLabel} per-day average`}
              </Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileLabel}>Tracked</Text>
                  <Text style={styles.summaryTileValue}>{trackedCount}</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileLabel}>Food logs</Text>
                  <Text style={styles.summaryTileValue}>
                    {selectedMode === "today"
                      ? todaySnapshot?.entries.length ?? 0
                      : weekSnapshot?.entries.length ?? 0}
                  </Text>
                </View>
              </View>

              <View style={styles.referenceNote}>
                <Text style={styles.referenceNoteText}>{referenceCopy}</Text>
              </View>
            </>
          )}
        </View>

        {!loading && !error ? (
          <>
            {trackedCount === 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Everything is at zero so far</Text>
                <Text style={styles.infoText}>
                  The targets are still shown below so users can see what daily
                  intake they are aiming for even before richer micronutrient
                  foods are logged.
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Vitamins</Text>
              <Text style={styles.sectionSubtitle}>
                Daily intake compared against {micronutrientProfile ? "your" : "general"}{" "}
                RDA.
              </Text>
              <View style={styles.sectionStack}>
                {vitamins.map(renderNutrientRow)}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Minerals</Text>
              <Text style={styles.sectionSubtitle}>
                A quick visual read on what is covered, what is low, and what is
                already above target.
              </Text>
              <View style={styles.sectionStack}>
                {minerals.map(renderNutrientRow)}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  headerRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  eyebrow: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 8,
  },
  title: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 18,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  togglePill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingVertical: 12,
  },
  togglePillActive: {
    backgroundColor: appColors.foodPrimaryDark,
    borderColor: appColors.foodPrimaryDark,
  },
  toggleText: {
    ...appTypography.bodySmall,
    color: appColors.foodAccentText,
    fontWeight: "800",
  },
  toggleTextActive: {
    color: appColors.textPrimary,
  },
  heroHeadline: {
    ...appTypography.title,
    color: appColors.textPrimary,
    marginBottom: 4,
  },
  heroRangeLabel: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: appColors.surfaceCardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  summaryTileLabel: {
    ...appTypography.label,
    color: appColors.textMuted,
    marginBottom: 6,
  },
  summaryTileValue: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
  },
  referenceNote: {
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  referenceNoteText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  infoCard: {
    backgroundColor: appColors.surfaceCardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    ...appTypography.bodyStrong,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  infoText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  sectionCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    ...appTypography.title,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  sectionSubtitle: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    marginBottom: 14,
  },
  sectionStack: {
    gap: 12,
  },
  nutrientRow: {
    gap: 6,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nutrientMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nutrientMetaText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  errorText: {
    ...appTypography.bodySmall,
    color: appColors.dangerText,
  },
  cardPressed: {
    opacity: 0.88,
  },
});

export default MicrosOverviewScreen;
