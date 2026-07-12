import React from "react";
import {
  ScrollView,
  StyleSheet,
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
import { appSpacing, appSurfaces } from "../../theme/tokens";
import {
  AppCard,
  AppText,
  ErrorState,
  IconButton,
  LoadingState,
  NumericText,
  SegmentedControl,
} from "../../components/ui";
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
    item.group === "Vitamins" ? appColors.brand500 : appColors.success600;

  const getMacroBarPlaces = (item: MicronutrientRowWithTarget) => {
    if (item.unit === "mg") {
      return item.target < 10 ? 1 : 0;
    }

    return 0;
  };

  const renderNutrientRow = (item: MicronutrientRowWithTarget) => {
    return (
      <AppCard key={item.key} variant="compact" style={styles.nutrientRow}>
        <MacroBar
          accent={getMacroBarAccent(item)}
          consumed={item.value}
          label={item.label}
          places={getMacroBarPlaces(item)}
          target={item.target}
          unit={item.unit}
        />
        <View style={styles.nutrientMetaRow}>
          <AppText color="secondary" style={styles.nutrientMetaText} variant="bodySmall">
            {item.basis} target: {formatMicronutrientValue(item.target, item.unit)}
          </AppText>
          <AppText color="secondary" style={styles.nutrientMetaText} variant="bodySmall">
            {item.statusText}
          </AppText>
        </View>
        <View style={styles.nutrientMetaRow}>
          <NumericText color="secondary" style={styles.nutrientMetaText} variant="numberMacroRow">
            {item.progressPercent.toLocaleString(undefined, {
              maximumFractionDigits: item.progressPercent >= 100 ? 0 : 1,
            })}
            % reached
          </NumericText>
        </View>
      </AppCard>
    );
  };

  return (
    <View style={styles.screen}>
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
            <AppText color="secondary" style={styles.eyebrow} variant="eyebrow">
              Micros
            </AppText>
            <AppText style={styles.title} variant="sectionTitleLarge">
              Micronutrients
            </AppText>
            <AppText color="secondary" style={styles.subtitle} variant="bodySmall">
              Totals come from foods with micronutrient data. Quick adds do not
              contribute here.
            </AppText>
          </View>
          <IconButton
            accessibilityLabel="Close micronutrients"
            onPress={() => navigation.goBack()}
          >
            <XIcon size={18} color={appColors.textPrimary} weight="bold" />
          </IconButton>
        </View>

        <AppCard variant="hero" style={styles.heroCard}>
          <SegmentedControl
            value={selectedMode}
            onChange={setSelectedMode}
            style={styles.toggleRow}
            options={[
              { label: "Today", value: "today" },
              { label: "7 day avg", value: "average_7d" },
            ]}
          />

          {loading ? (
            <LoadingState
              message="Reading recent logged nutrition."
              style={styles.loadingWrap}
              title="Loading micronutrients"
            />
          ) : error ? (
            <ErrorState
              message={error}
              style={styles.stateWrap}
              title="Could not load micronutrients"
            />
          ) : (
            <>
              <AppText style={styles.heroHeadline} variant="sectionTitle">
                {headlineText}
              </AppText>
              <AppText color="secondary" style={styles.heroRangeLabel} variant="bodySmall">
                {selectedMode === "today"
                  ? rangeLabel
                  : `${rangeLabel} per-day average`}
              </AppText>

              <View style={styles.summaryGrid}>
                <AppCard variant="compact" style={styles.summaryTile}>
                  <AppText color="muted" style={styles.summaryTileLabel} variant="label">
                    Tracked
                  </AppText>
                  <NumericText style={styles.summaryTileValue} variant="numberMacroSummary">
                    {trackedCount}
                  </NumericText>
                </AppCard>
                <AppCard variant="compact" style={styles.summaryTile}>
                  <AppText color="muted" style={styles.summaryTileLabel} variant="label">
                    Food logs
                  </AppText>
                  <NumericText style={styles.summaryTileValue} variant="numberMacroSummary">
                    {selectedMode === "today"
                      ? todaySnapshot?.entries.length ?? 0
                      : weekSnapshot?.entries.length ?? 0}
                  </NumericText>
                </AppCard>
              </View>

              <AppCard variant="soft" style={styles.referenceNote}>
                <AppText color="secondary" style={styles.referenceNoteText} variant="bodySmall">
                  {referenceCopy}
                </AppText>
              </AppCard>
            </>
          )}
        </AppCard>

        {!loading && !error ? (
          <>
            {trackedCount === 0 ? (
              <AppCard variant="soft" style={styles.infoCard}>
                <AppText style={styles.infoTitle} variant="bodyStrong">
                  Everything is at zero so far
                </AppText>
                <AppText color="secondary" style={styles.infoText} variant="bodySmall">
                  The targets are still shown below so users can see what daily
                  intake they are aiming for even before richer micronutrient
                  foods are logged.
                </AppText>
              </AppCard>
            ) : null}

            <AppCard style={styles.sectionCard}>
              <AppText style={styles.sectionTitle} variant="sectionTitle">
                Vitamins
              </AppText>
              <AppText color="secondary" style={styles.sectionSubtitle} variant="bodySmall">
                Daily intake compared against {micronutrientProfile ? "your" : "general"}{" "}
                RDA.
              </AppText>
              <View style={styles.sectionStack}>
                {vitamins.map(renderNutrientRow)}
              </View>
            </AppCard>

            <AppCard style={styles.sectionCard}>
              <AppText style={styles.sectionTitle} variant="sectionTitle">
                Minerals
              </AppText>
              <AppText color="secondary" style={styles.sectionSubtitle} variant="bodySmall">
                A quick visual read on what is covered, what is low, and what is
                already above target.
              </AppText>
              <View style={styles.sectionStack}>
                {minerals.map(renderNutrientRow)}
              </View>
            </AppCard>
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
    paddingHorizontal: appSpacing.gutter,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: appSpacing.xs,
  },
  title: {
    marginBottom: appSpacing.xs,
  },
  subtitle: {
  },
  heroCard: {
    marginBottom: appSpacing.md,
  },
  toggleRow: {
    marginBottom: appSpacing.md,
  },
  heroHeadline: {
    marginBottom: appSpacing.xxs,
  },
  heroRangeLabel: {
    marginBottom: appSpacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: appSpacing.sm,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: appSurfaces.soft,
  },
  summaryTileLabel: {
    marginBottom: appSpacing.xxs,
  },
  summaryTileValue: {
    textAlign: "left",
  },
  referenceNote: {
    marginTop: appSpacing.sm,
  },
  referenceNoteText: {
  },
  infoCard: {
    marginBottom: appSpacing.md,
  },
  infoTitle: {
    marginBottom: appSpacing.xxs,
  },
  infoText: {
  },
  sectionCard: {
    marginBottom: appSpacing.md,
  },
  sectionTitle: {
    marginBottom: appSpacing.xxs,
  },
  sectionSubtitle: {
    marginBottom: appSpacing.sm,
  },
  sectionStack: {
    gap: appSpacing.sm,
  },
  nutrientRow: {
    gap: appSpacing.xxs,
    backgroundColor: appSurfaces.soft,
  },
  nutrientMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.xs,
  },
  nutrientMetaText: {
    textAlign: "left",
  },
  loadingWrap: {
    paddingVertical: appSpacing.md,
  },
  stateWrap: {
    marginTop: appSpacing.xs,
  },
});

export default MicrosOverviewScreen;
