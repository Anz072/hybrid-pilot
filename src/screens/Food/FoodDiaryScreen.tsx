import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarIcon,
  ClockIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "phosphor-react-native";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import {
  buildFoodLoggedAt,
  clampFoodRatio,
  formatFoodDateKey,
  formatFoodHourLabel,
  formatFoodLoggedTime,
  formatFoodLongDate,
  formatFoodServing,
  formatFoodSourceLabel,
  formatMacroLine,
  getFoodDefaultLogAmount,
  getFoodLoggedHour,
  getFoodResolvedServing,
  shiftFoodDate,
  sumLoggedNutrition,
  type FoodNutritionTotals,
  calculateLoggedNutrition,
} from "./foodUtils";

type FoodDiaryNav = NativeStackNavigationProp<FoodStackParamList, "Diary">;
type FavoriteFoodCard = DBFoodItem & {
  servingSize: number;
  servingUnit: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const INITIAL_START = 7;
const INITIAL_END = 22;

const MacroBar = ({
  accent,
  consumed,
  label,
  target,
}: {
  accent: string;
  consumed: number;
  label: string;
  target: number | null;
}) => {
  const ratio = target && target > 0 ? clampFoodRatio(consumed / target) : 0;

  return (
    <View style={styles.macroCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {consumed.toFixed(0)}
          {target && target > 0 ? ` / ${target.toFixed(0)}` : ""}
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { backgroundColor: accent, width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
};

const FoodDiaryScreen = () => {
  const navigation = useNavigation<FoodDiaryNav>();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [user, setUser] = useState<DBUser | null>(null);
  const [entries, setEntries] = useState<DBUserFoodLogEntry[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<FavoriteFoodCard[]>([]);
  const [visibleStartHour, setVisibleStartHour] = useState(INITIAL_START);
  const [visibleEndHour, setVisibleEndHour] = useState(INITIAL_END);
  const [selectedHour, setSelectedHour] = useState(() =>
    Math.min(INITIAL_END, Math.max(INITIAL_START, new Date().getHours())),
  );

  const dateKey = useMemo(() => formatFoodDateKey(selectedDate), [selectedDate]);

  const loadData = useCallback(async () => {
    const currentUser = await DB.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setEntries([]);
      setFavoriteFoods([]);
      return;
    }

    const [dayEntries, favorites] = await Promise.all([
      DB.getUserFoodLogEntriesByDate(currentUser.externalId, dateKey),
      DB.getFavoriteFoodItems(currentUser.externalId, 10),
    ]);

    setEntries(dayEntries);
    setFavoriteFoods(
      favorites.map((food) => {
        const serving = getFoodResolvedServing(food);
        return {
          ...food,
          servingSize: serving.value,
          servingUnit: serving.unit,
          calories: food.calories ?? 0,
          proteinG: food.proteinG ?? 0,
          carbsG: food.carbsG ?? 0,
          fatG: food.fatG ?? 0,
        };
      }),
    );
  }, [dateKey]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  React.useEffect(() => {
    setSelectedHour((current) =>
      Math.min(visibleEndHour, Math.max(visibleStartHour, current)),
    );
  }, [visibleEndHour, visibleStartHour]);

  const totals = useMemo(() => sumLoggedNutrition(entries), [entries]);
  const isToday = dateKey === formatFoodDateKey(new Date());
  const remainingCalories =
    user?.calorieAllowance != null ? Math.round(user.calorieAllowance - totals.calories) : null;

  const hourBuckets = useMemo(() => {
    const rows: Array<{
      hour: number;
      entries: DBUserFoodLogEntry[];
      totals: FoodNutritionTotals;
    }> = [];

    for (let hour = visibleStartHour; hour <= visibleEndHour; hour += 1) {
      const hourEntries = entries.filter((entry) =>
        getFoodLoggedHour(entry.loggedAt ?? entry.createdAt) === hour,
      );

      rows.push({ hour, entries: hourEntries, totals: sumLoggedNutrition(hourEntries) });
    }

    return rows;
  }, [entries, visibleEndHour, visibleStartHour]);

  const filledHours = hourBuckets.filter((bucket) => bucket.entries.length > 0).length;

  const openAddFoodAtHour = (hour: number) => {
    navigation.navigate("AddFood", {
      contextLabel: formatFoodHourLabel(hour),
      date: dateKey,
      loggedAt: buildFoodLoggedAt(dateKey, hour),
      mealType: null,
    });
  };

  const addFavoriteToHour = async (food: DBFoodItem, hour: number) => {
    if (!user) {
      return;
    }

    const minute = isToday && new Date().getHours() === hour ? new Date().getMinutes() : 0;

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId: food.id,
      date: dateKey,
      loggedAt: buildFoodLoggedAt(dateKey, hour, minute),
      quantityG: getFoodDefaultLogAmount(food),
      mealType: null,
    });

    await loadData();
  };

  const deleteEntry = (entryId: number) => {
    Alert.alert("Remove food", "Delete this entry from your diary?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await DB.deleteUserFoodLog(entryId);
          await loadData();
        },
      },
    ]);
  };

  const copyYesterday = async () => {
    if (!user) {
      return;
    }

    const sourceDate = formatFoodDateKey(shiftFoodDate(selectedDate, -1));
    await DB.copyFoodLogsFromDate(user.externalId, sourceDate, dateKey);
    await loadData();
  };

  const changeStart = (next: number) => setVisibleStartHour(Math.max(0, Math.min(next, visibleEndHour - 1)));
  const changeEnd = (next: number) => setVisibleEndHour(Math.min(23, Math.max(next, visibleStartHour + 1)));

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 36 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerPill}>
            <ForkKnifeIcon size={14} color="#6D52EA" weight="fill" />
            <Text style={styles.headerPillText}>Diary</Text>
          </View>
          <Text style={styles.title}>Food Timeline</Text>
          <Text style={styles.subtitle}>A cleaner hour-by-hour view of your day.</Text>
        </View>

        <View style={styles.hero}>
          <View style={[styles.rowBetween, styles.dateRow]}>
            <Pressable onPress={() => setSelectedDate((current) => shiftFoodDate(current, -1))} style={({ pressed }) => [styles.navButton, pressed && styles.cardPressed]}>
              <Text style={styles.navButtonText}>Prev</Text>
            </Pressable>
            <View style={styles.dateCenter}>
              <View style={styles.datePill}>
                <CalendarIcon size={14} color="#6D52EA" weight="bold" />
                <Text style={styles.datePillText}>{isToday ? "Today" : formatFoodLongDate(selectedDate)}</Text>
              </View>
              <Text style={styles.dateKey}>{dateKey}</Text>
            </View>
            <Pressable onPress={() => setSelectedDate((current) => shiftFoodDate(current, 1))} style={({ pressed }) => [styles.navButton, pressed && styles.cardPressed]}>
              <Text style={styles.navButtonText}>Next</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statDark]}>
              <Text style={styles.statLabelDark}>Consumed</Text>
              <Text style={styles.statValueDark}>{Math.round(totals.calories)}</Text>
              <Text style={styles.statHintDark}>kcal</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Entries</Text>
              <Text style={styles.statValue}>{entries.length}</Text>
              <Text style={styles.statHint}>{filledHours} active hours</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Target</Text>
              <Text style={styles.statValue}>
                {remainingCalories == null ? "--" : remainingCalories >= 0 ? remainingCalories : Math.abs(remainingCalories)}
              </Text>
              <Text style={styles.statHint}>
                {remainingCalories == null ? "not set" : remainingCalories >= 0 ? "left" : "over"}
              </Text>
            </View>
          </View>

          <View style={styles.stack}>
            <MacroBar accent="#6D52EA" consumed={totals.proteinG} label="Protein" target={user?.proteinG ?? null} />
            <MacroBar accent="#3B82F6" consumed={totals.carbsG} label="Carbs" target={user?.carbsG ?? null} />
            <MacroBar accent="#F59E0B" consumed={totals.fatG} label="Fat" target={user?.fatG ?? null} />
          </View>

          <View style={[styles.rowBetween, styles.selectedRow]}>
            <View>
              <Text style={styles.smallLabel}>Selected slot</Text>
              <Text style={styles.selectedValue}>{formatFoodHourLabel(selectedHour)}</Text>
            </View>
            <Pressable onPress={() => openAddFoodAtHour(selectedHour)} style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}>
              <Text style={styles.primaryButtonText}>Add food</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
            {hourBuckets.map((bucket) => {
              const selected = bucket.hour === selectedHour;
              return (
                <Pressable
                  key={bucket.hour}
                  onPress={() => setSelectedHour(bucket.hour)}
                  style={({ pressed }) => [styles.hourChip, selected && styles.hourChipActive, pressed && styles.cardPressed]}
                >
                  <Text style={[styles.hourChipLabel, selected && styles.hourChipLabelActive]}>{formatFoodHourLabel(bucket.hour)}</Text>
                  <Text style={[styles.hourChipText, selected && styles.hourChipTextActive]}>
                    {bucket.entries.length > 0 ? `${Math.round(bucket.totals.calories)} kcal` : "Open"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.rangeCard}>
            <View style={[styles.rowBetween, { marginBottom: 10 }]}>
              <Text style={styles.rangeTitle}>Visible hours</Text>
              <Pressable onPress={() => { setVisibleStartHour(INITIAL_START); setVisibleEndHour(INITIAL_END); }} style={({ pressed }) => [styles.resetPill, pressed && styles.cardPressed]}>
                <Text style={styles.resetPillText}>Reset 07:00-22:00</Text>
              </Pressable>
            </View>
            <View style={styles.rangeRow}>
              <View style={styles.rangeCell}>
                <Text style={styles.smallLabel}>From</Text>
                <View style={styles.rangeStepper}>
                  <Pressable onPress={() => changeStart(visibleStartHour - 1)} disabled={visibleStartHour <= 0} style={({ pressed }) => [styles.stepperButton, visibleStartHour <= 0 && styles.dimmed, pressed && visibleStartHour > 0 && styles.cardPressed]}>
                    <Text style={styles.stepperButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.rangeValue}>{formatFoodHourLabel(visibleStartHour)}</Text>
                  <Pressable onPress={() => changeStart(visibleStartHour + 1)} disabled={visibleStartHour >= visibleEndHour - 1} style={({ pressed }) => [styles.stepperButton, visibleStartHour >= visibleEndHour - 1 && styles.dimmed, pressed && visibleStartHour < visibleEndHour - 1 && styles.cardPressed]}>
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.rangeCell}>
                <Text style={styles.smallLabel}>To</Text>
                <View style={styles.rangeStepper}>
                  <Pressable onPress={() => changeEnd(visibleEndHour - 1)} disabled={visibleEndHour <= visibleStartHour + 1} style={({ pressed }) => [styles.stepperButton, visibleEndHour <= visibleStartHour + 1 && styles.dimmed, pressed && visibleEndHour > visibleStartHour + 1 && styles.cardPressed]}>
                    <Text style={styles.stepperButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.rangeValue}>{formatFoodHourLabel(visibleEndHour)}</Text>
                  <Pressable onPress={() => changeEnd(visibleEndHour + 1)} disabled={visibleEndHour >= 23} style={({ pressed }) => [styles.stepperButton, visibleEndHour >= 23 && styles.dimmed, pressed && visibleEndHour < 23 && styles.cardPressed]}>
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {favoriteFoods.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick adds at {formatFoodHourLabel(selectedHour)}</Text>
            <Text style={styles.sectionText}>Your repeat foods stay one tap away.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteRow}>
              {favoriteFoods.map((food) => (
                <View key={food.id} style={styles.favoriteCard}>
                  <Text style={styles.favoriteEyebrow}>{formatFoodSourceLabel(food.source)}</Text>
                  <Text style={styles.favoriteName} numberOfLines={2}>{food.name}</Text>
                  <Text style={styles.favoriteMeta}>{Math.round(food.calories)} kcal • {formatFoodServing(food.servingSize, food.servingUnit)}</Text>
                  <Text style={styles.favoriteMeta}>{food.proteinG.toFixed(0)}P • {food.carbsG.toFixed(0)}C • {food.fatG.toFixed(0)}F</Text>
                  <Pressable onPress={() => void addFavoriteToHour(food, selectedHour)} style={({ pressed }) => [styles.favoriteButton, pressed && styles.cardPressed]}>
                    <Text style={styles.favoriteButtonText}>Add</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionText}>Every visible hour stays readable, even when it is empty.</Text>
          <View style={styles.timeline}>
            {hourBuckets.map((bucket, index) => {
              const selected = bucket.hour === selectedHour;
              const isLast = index === hourBuckets.length - 1;

              return (
                <View key={bucket.hour} style={styles.timelineRow}>
                  <Pressable onPress={() => setSelectedHour(bucket.hour)} style={styles.axis}>
                    <Text style={[styles.axisLabel, selected && styles.axisLabelActive]}>{formatFoodHourLabel(bucket.hour)}</Text>
                    <View style={styles.axisTrack}>
                      <View style={[styles.axisDot, selected && styles.axisDotActive]} />
                      {!isLast ? <View style={styles.axisLine} /> : null}
                    </View>
                  </Pressable>
                  <View style={styles.timelineContent}>
                    <View style={[styles.hourCard, selected && styles.hourCardActive]}>
                      <View style={[styles.rowBetween, { marginBottom: bucket.entries.length ? 10 : 0 }]}>
                        <View>
                          <Text style={styles.hourTitle}>{bucket.entries.length ? `${bucket.entries.length} ${bucket.entries.length === 1 ? "entry" : "entries"}` : "No entries yet"}</Text>
                          <Text style={styles.hourText}>{bucket.entries.length ? `${Math.round(bucket.totals.calories)} kcal • ${formatMacroLine(bucket.totals)}` : "Add food here if you want the full day visible."}</Text>
                        </View>
                        <Pressable onPress={() => openAddFoodAtHour(bucket.hour)} style={({ pressed }) => [styles.addPill, pressed && styles.cardPressed]}>
                          <Text style={styles.addPillText}>Add</Text>
                        </Pressable>
                      </View>
                      {bucket.entries.length > 0 ? (
                        <View style={styles.stack}>
                          {bucket.entries.map((entry) => {
                            const nutrition = calculateLoggedNutrition(entry);
                            const time = formatFoodLoggedTime(entry.loggedAt ?? entry.createdAt);
                            return (
                              <View key={entry.id} style={styles.entryCard}>
                                <Pressable style={styles.entryMain} onPress={() => navigation.navigate("EditFoodEntry", { entryId: entry.id })}>
                                  <View style={styles.rowBetween}>
                                    <View style={styles.entryCopy}>
                                      <Text style={styles.entryTitle} numberOfLines={2}>{entry.foodName}</Text>
                                      <Text style={styles.entryTime}>{time}</Text>
                                    </View>
                                    <Text style={styles.entryCalories}>{Math.round(nutrition.calories)} kcal</Text>
                                  </View>
                                  <View style={styles.entryMetaRow}>
                                    <View style={styles.entryPill}>
                                      <ClockIcon size={12} color="#6D52EA" weight="bold" />
                                      <Text style={styles.entryPillText}>{time}</Text>
                                    </View>
                                    {entry.mealType?.trim() ? (
                                      <View style={styles.entryPill}>
                                        <Text style={styles.entryPillText}>{entry.mealType.trim()}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text style={styles.entryText}>{formatFoodServing(entry.quantityG, entry.servingUnit)} • {formatMacroLine(nutrition)}</Text>
                                </Pressable>
                                <View style={styles.entryActions}>
                                  <Pressable onPress={() => navigation.navigate("EditFoodEntry", { entryId: entry.id })} style={({ pressed }) => [styles.iconButton, pressed && styles.cardPressed]}>
                                    <PencilSimpleIcon size={16} color="#6D52EA" weight="bold" />
                                  </Pressable>
                                  <Pressable onPress={() => deleteEntry(entry.id)} style={({ pressed }) => [styles.iconButton, pressed && styles.cardPressed]}>
                                    <TrashIcon size={16} color="#DC2626" weight="bold" />
                                  </Pressable>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>More</Text>
          <Text style={styles.sectionText}>Support actions that stay out of the way.</Text>
          <View style={styles.stack}>
            <Pressable onPress={() => void copyYesterday()} style={({ pressed }) => [styles.moreRow, pressed && styles.cardPressed]}>
              <View style={styles.moreCopy}>
                <Text style={styles.moreTitle}>Copy yesterday</Text>
                <Text style={styles.moreText}>Reuse the previous day when meals repeat.</Text>
              </View>
              <View style={styles.morePill}><Text style={styles.morePillText}>Copy</Text></View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("CreateCustomFood", {
                contextLabel: formatFoodHourLabel(selectedHour),
                date: dateKey,
                loggedAt: buildFoodLoggedAt(dateKey, selectedHour),
                mealType: null,
              })}
              style={({ pressed }) => [styles.moreRow, pressed && styles.cardPressed]}
            >
              <View style={styles.moreCopy}>
                <Text style={styles.moreTitle}>Create custom food</Text>
                <Text style={styles.moreText}>Add a new item directly into {formatFoodHourLabel(selectedHour)}.</Text>
              </View>
              <View style={styles.morePill}><Text style={styles.morePillText}>New</Text></View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F4FB" },
  content: { paddingHorizontal: 18 },
  orbTop: { position: "absolute", top: -90, right: -70, width: 250, height: 250, borderRadius: 999, backgroundColor: "#E4D9FF" },
  orbBottom: { position: "absolute", bottom: -120, left: -90, width: 280, height: 280, borderRadius: 999, backgroundColor: "#EEE7FF" },
  header: { alignItems: "center", marginBottom: 18 },
  headerPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E1F7", paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12 },
  headerPillText: { color: "#6D52EA", fontSize: 12, fontWeight: "800" },
  title: { color: "#181326", fontSize: 32, lineHeight: 38, fontWeight: "900", marginBottom: 6 },
  subtitle: { color: "#7F7791", fontSize: 15, lineHeight: 20, textAlign: "center" },
  hero: { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 28, borderWidth: 1, borderColor: "#E9E1F7", padding: 18, marginBottom: 16 },
  card: { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 26, borderWidth: 1, borderColor: "#E9E1F7", padding: 16, marginBottom: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stack: { gap: 10 },
  dateRow: { marginBottom: 16 },
  navButton: { width: 64, height: 40, borderRadius: 999, backgroundColor: "#F5F1FB", borderWidth: 1, borderColor: "#E4DDF3", alignItems: "center", justifyContent: "center" },
  navButtonText: { color: "#3A314A", fontSize: 13, fontWeight: "800" },
  dateCenter: { flex: 1, alignItems: "center" },
  datePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "#F4F0FF", borderWidth: 1, borderColor: "#E5DDF8", paddingHorizontal: 12, paddingVertical: 7, marginBottom: 5 },
  datePillText: { color: "#4F3D83", fontSize: 13, fontWeight: "800" },
  dateKey: { color: "#8B839C", fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 22, backgroundColor: "#F8F4FF", borderWidth: 1, borderColor: "#EBE4F8", padding: 14 },
  statDark: { backgroundColor: "#1F1831", borderColor: "#1F1831" },
  statLabel: { color: "#7E7399", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  statLabelDark: { color: "#C7BBFF", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  statValue: { color: "#1B1529", fontSize: 24, fontWeight: "900", marginBottom: 2 },
  statValueDark: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 2 },
  statHint: { color: "#7E7399", fontSize: 12, fontWeight: "700" },
  statHintDark: { color: "#C9C2DD", fontSize: 12, fontWeight: "700" },
  macroCard: { borderRadius: 18, backgroundColor: "#FBF9FF", borderWidth: 1, borderColor: "#ECE5F9", padding: 12 },
  macroLabel: { color: "#3B3450", fontSize: 13, fontWeight: "800" },
  macroValue: { color: "#1B1529", fontSize: 13, fontWeight: "800" },
  macroTrack: { height: 8, borderRadius: 999, backgroundColor: "#E9E2F5", overflow: "hidden", marginTop: 8 },
  macroFill: { height: "100%", borderRadius: 999 },
  selectedRow: { marginVertical: 16 },
  smallLabel: { color: "#7E7399", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  selectedValue: { color: "#1B1529", fontSize: 22, fontWeight: "900" },
  primaryButton: { borderRadius: 999, backgroundColor: "#1F1831", paddingHorizontal: 16, paddingVertical: 12 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  hourRow: { gap: 10, paddingRight: 10, marginBottom: 16 },
  hourChip: { width: 92, borderRadius: 22, backgroundColor: "#F7F3FC", borderWidth: 1, borderColor: "#E9E2F7", paddingHorizontal: 12, paddingVertical: 14 },
  hourChipActive: { backgroundColor: "#1F1831", borderColor: "#1F1831" },
  hourChipLabel: { color: "#2F2741", fontSize: 14, fontWeight: "900", marginBottom: 4 },
  hourChipLabelActive: { color: "#FFFFFF" },
  hourChipText: { color: "#827994", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  hourChipTextActive: { color: "#CFC5E7" },
  rangeCard: { borderRadius: 22, backgroundColor: "#FBF9FF", borderWidth: 1, borderColor: "#ECE5F8", padding: 14 },
  rangeTitle: { color: "#1B1529", fontSize: 16, fontWeight: "900" },
  resetPill: { borderRadius: 999, backgroundColor: "#F0EAFB", paddingHorizontal: 12, paddingVertical: 8 },
  resetPillText: { color: "#6D52EA", fontSize: 12, fontWeight: "800" },
  rangeRow: { flexDirection: "row", gap: 10 },
  rangeCell: { flex: 1, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECE5F8", padding: 12 },
  rangeStepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stepperButton: { width: 32, height: 32, borderRadius: 999, backgroundColor: "#F1ECFA", alignItems: "center", justifyContent: "center" },
  stepperButtonText: { color: "#4F3D83", fontSize: 18, fontWeight: "900", lineHeight: 20 },
  dimmed: { opacity: 0.45 },
  rangeValue: { color: "#1B1529", fontSize: 16, fontWeight: "900" },
  sectionTitle: { color: "#1B1529", fontSize: 22, fontWeight: "900", marginBottom: 4 },
  sectionText: { color: "#7F7791", fontSize: 14, lineHeight: 20, marginBottom: 14 },
  favoriteRow: { gap: 12, paddingRight: 12 },
  favoriteCard: { width: 214, borderRadius: 22, backgroundColor: "#FBF9FF", borderWidth: 1, borderColor: "#ECE5F9", padding: 14 },
  favoriteEyebrow: { color: "#8A7DB0", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  favoriteName: { color: "#1B1529", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  favoriteMeta: { color: "#6E6582", fontSize: 13, lineHeight: 18, marginBottom: 4 },
  favoriteButton: { borderRadius: 16, backgroundColor: "#1F1831", paddingVertical: 12, alignItems: "center", marginTop: 10 },
  favoriteButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  timeline: { gap: 8 },
  timelineRow: { flexDirection: "row", gap: 12 },
  axis: { width: 62, alignItems: "center" },
  axisLabel: { color: "#8A809F", fontSize: 12, fontWeight: "800", marginTop: 6, marginBottom: 8 },
  axisLabelActive: { color: "#6D52EA" },
  axisTrack: { flex: 1, alignItems: "center" },
  axisDot: { width: 11, height: 11, borderRadius: 999, backgroundColor: "#DDD3F3" },
  axisDotActive: { backgroundColor: "#6D52EA" },
  axisLine: { width: 2, flex: 1, backgroundColor: "#ECE5F6", marginTop: 6, marginBottom: -2 },
  timelineContent: { flex: 1, paddingBottom: 8 },
  hourCard: { borderRadius: 22, backgroundColor: "#FCFBFF", borderWidth: 1, borderColor: "#ECE5F8", padding: 14 },
  hourCardActive: { borderColor: "#CDBEFF", backgroundColor: "#FAF7FF" },
  hourTitle: { color: "#1B1529", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  hourText: { color: "#7F7791", fontSize: 12, lineHeight: 17, maxWidth: 210 },
  addPill: { borderRadius: 999, backgroundColor: "#EFE9FA", paddingHorizontal: 14, paddingVertical: 9 },
  addPillText: { color: "#6D52EA", fontSize: 12, fontWeight: "800" },
  entryCard: { flexDirection: "row", gap: 12, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE3F7", padding: 12 },
  entryMain: { flex: 1 },
  entryCopy: { flex: 1, paddingRight: 8 },
  entryTitle: { color: "#1B1529", fontSize: 15, fontWeight: "900", marginBottom: 3 },
  entryTime: { color: "#8A809F", fontSize: 12, fontWeight: "700" },
  entryCalories: { color: "#1B1529", fontSize: 14, fontWeight: "900" },
  entryMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 8 },
  entryPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: "#F3EEFC", paddingHorizontal: 10, paddingVertical: 6 },
  entryPillText: { color: "#6D52EA", fontSize: 11, fontWeight: "800" },
  entryText: { color: "#6E6582", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  entryActions: { justifyContent: "space-between", gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F2FC", borderWidth: 1, borderColor: "#E8E1F5" },
  moreRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#FBF9FF", borderWidth: 1, borderColor: "#ECE5F8", padding: 14 },
  moreCopy: { flex: 1 },
  moreTitle: { color: "#1B1529", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  moreText: { color: "#7F7791", fontSize: 13, lineHeight: 18 },
  morePill: { borderRadius: 999, backgroundColor: "#1F1831", paddingHorizontal: 12, paddingVertical: 8 },
  morePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  cardPressed: { opacity: 0.9 },
});

export default FoodDiaryScreen;
