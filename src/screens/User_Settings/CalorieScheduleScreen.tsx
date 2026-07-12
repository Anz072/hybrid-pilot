import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { MinusIcon, PlusIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import {
  buildEffectiveCalorieTargetsForDates,
  CALORIE_SCHEDULE_DAY_NAMES,
  CALORIE_TARGET_STEP,
  clampCalorieTarget,
  getWeeklyCalorieBudget,
} from "../../engine/calorieTargets";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppText, ErrorState, IconButton, LoadingState, NumericText } from "../../components/ui";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import CalorieBudgetChart from "./CalorieBudgetChart";
import SettingsStackHeader from "./SettingsStackHeader";
import { supersedeOpenAdaptiveRecommendationForUser } from "./adaptiveCaloriesActions";

type Props = NativeStackScreenProps<MoreParamList, "CalorieScheduleScreen">;

const EMPTY_OVERRIDES = Array.from({ length: 7 }, () => null) as Array<
  number | null
>;

const buildCurrentWeekDates = (reference: Date): Date[] => {
  const weekStart = new Date(reference);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return next;
  });
};

const coerceOverrides = (
  value: Array<number | null> | null | undefined,
): Array<number | null> =>
  Array.from({ length: 7 }, (_, index) => value?.[index] ?? null);

const CalorieScheduleScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [overrides, setOverrides] = React.useState<Array<number | null>>(
    EMPTY_OVERRIDES,
  );
  const [saving, setSaving] = React.useState(false);
  const [contextLoading, setContextLoading] = React.useState(true);
  const [contextError, setContextError] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    if (!user) {
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    setContextError(null);

    try {
      const settings = await DB.getUserSettings(user.externalId);
      setOverrides(coerceOverrides(settings?.dailyCalorieOverrides));
    } catch {
      setContextError("Could not load the calorie schedule. Check your connection and try again.");
    } finally {
      setContextLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const baseCalories = user?.calorieAllowance ?? null;
  const weekDates = React.useMemo(() => buildCurrentWeekDates(new Date()), []);
  const previewSettings = React.useMemo(
    () => ({ dailyCalorieOverrides: overrides }),
    [overrides],
  );
  const weeklyValues = React.useMemo(
    () =>
      buildEffectiveCalorieTargetsForDates({
        dates: weekDates,
        baseCalories,
        settings: previewSettings,
      }),
    [baseCalories, previewSettings, weekDates],
  );
  const weeklyBudget = React.useMemo(
    () =>
      getWeeklyCalorieBudget({
        dates: weekDates,
        baseCalories,
        settings: previewSettings,
      }),
    [baseCalories, previewSettings, weekDates],
  );

  const setOverrideAtIndex = (index: number, value: number | null) => {
    setOverrides((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const adjustOverride = (index: number, delta: number) => {
    const currentValue = overrides[index] ?? baseCalories ?? 2000;
    setOverrideAtIndex(index, clampCalorieTarget(currentValue + delta));
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      await DB.saveUserSettings({
        userExternalId: user.externalId,
        dailyCalorieOverrides: overrides,
        adaptiveLastCalculatedAt: new Date().toISOString(),
      });
      await supersedeOpenAdaptiveRecommendationForUser(user.externalId);
      navigation.navigate("MoreMainScreen");
    } catch {
      Alert.alert("Could not save schedule", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsStackHeader
          onBack={() => navigation.goBack()}
          title="Calorie Schedule"
        />

        {!user ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">No active user</AppText>
            <AppText color="secondary" variant="bodySmall">
              Sign in to your account first before editing the calorie schedule.
            </AppText>
          </AppCard>
        ) : (
          <>
            <View style={styles.baseBlock}>
              <AppText variant="cardTitle">Base daily target</AppText>
              <NumericText color="coral" style={styles.baseValue} variant="numberCalorieHero">
                {baseCalories != null ? `${baseCalories} kcal` : "--"}
              </NumericText>
            </View>

            {contextError ? (
              <ErrorState
                title="Could not load schedule"
                message={contextError}
                action={
                  <AppButton label="Try again" onPress={() => void loadSettings()} size="sm" />
                }
                style={styles.card}
              />
            ) : contextLoading ? (
              <LoadingState
                title="Loading settings"
                message="Fetching your daily calorie overrides."
                style={styles.card}
              />
            ) : (
              <>
                <CalorieBudgetChart
                  highlightDate={new Date()}
                  subtitle={
                    weeklyBudget != null
                      ? `Weekly budget: ${Math.round(weeklyBudget)} kcal`
                      : "Weekly budget preview"
                  }
                  title="Weekly budget"
                  values={weeklyValues}
                />

                <AppCard style={styles.card}>
              <View style={styles.headerRow}>
                <View>
                  <AppText variant="cardTitle">Overrides</AppText>
                  <AppText color="secondary" variant="bodySmall">
                    Raise or lower a specific day by 50 kcal
                  </AppText>
                </View>
                <AppButton
                  onPress={() => setOverrides(EMPTY_OVERRIDES)}
                  label="Clear all"
                  size="sm"
                  variant="ghost"
                />
              </View>

              <View style={styles.dayStack}>
                {CALORIE_SCHEDULE_DAY_NAMES.map((dayName, index) => {
                  const override = overrides[index];
                  const effectiveCalories = override ?? baseCalories ?? null;

                  return (
                    <AppCard key={dayName} style={styles.dayCard} variant="soft">
                      <View style={styles.dayCopy}>
                        <AppText variant="bodySmallStrong">{dayName}</AppText>
                        <AppText color="secondary" variant="metadata">
                          {override != null ? "Override" : "Using base target"}
                        </AppText>
                      </View>

                      <View style={styles.dayControls}>
                        <IconButton
                          accessibilityLabel={`Decrease ${dayName} calories`}
                          onPress={() => adjustOverride(index, -CALORIE_TARGET_STEP)}
                        >
                          <MinusIcon
                            size={16}
                            color={appColors.brand700}
                            weight="bold"
                          />
                        </IconButton>

                        <View style={styles.dayValueWrap}>
                          <NumericText align="center" variant="numberCalorieHero">
                            {effectiveCalories != null
                              ? `${effectiveCalories}`
                              : "--"}
                          </NumericText>
                          <AppText align="center" color="secondary" variant="eyebrow">kcal</AppText>
                        </View>

                        <IconButton
                          accessibilityLabel={`Increase ${dayName} calories`}
                          onPress={() => adjustOverride(index, CALORIE_TARGET_STEP)}
                        >
                          <PlusIcon
                            size={16}
                            color={appColors.brand700}
                            weight="bold"
                          />
                        </IconButton>
                      </View>

                      <AppButton
                        onPress={() => setOverrideAtIndex(index, null)}
                        label="Reset day"
                        size="sm"
                        style={styles.resetDayButton}
                        variant="secondary"
                      />
                    </AppCard>
                  );
                })}
              </View>

              <AppButton
                onPress={() => void handleSave()}
                disabled={saving}
                label={saving ? "Saving..." : "Save daily schedule"}
                style={styles.saveButton}
              />
                </AppCard>
              </>
            )}
          </>
        )}
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
  card: {
    marginTop: appSpacing.md,
  },
  baseBlock: {
    marginBottom: appSpacing.xs,
  },
  baseValue: {
    marginTop: appSpacing.xs,
    marginBottom: appSpacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  dayStack: {
    gap: appSpacing.xs,
  },
  dayCard: {
    gap: appSpacing.sm,
  },
  dayCopy: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  dayControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
  },
  dayValueWrap: {
    flex: 1,
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.card,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingVertical: appSpacing.xs,
    paddingHorizontal: appSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  resetDayButton: {
    alignSelf: "flex-start",
  },
  saveButton: {
    marginTop: appSpacing.md,
  },
});

export default CalorieScheduleScreen;
