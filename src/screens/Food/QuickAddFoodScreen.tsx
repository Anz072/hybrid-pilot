import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, StackActions } from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CalendarIcon,
  ClockIcon,
  PencilSimpleIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  calculateQuickAddCaloriesFromMacros,
  formatFoodLoggedTime,
  formatFoodShortDate,
  normalizePositiveFoodInput,
} from "./foodUtils";

type QuickAddRoute = RouteProp<FoodStackParamList, "QuickAddFood">;
type QuickAddNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "QuickAddFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

const toSafeNumber = (value: string): number => {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumberInput = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const QuickAddFoodScreen = () => {
  const route = useRoute<QuickAddRoute>();
  const navigation = useNavigation<QuickAddNav>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [loading, setLoading] = React.useState(Boolean(route.params.entryId));
  const [saving, setSaving] = React.useState(false);
  const [entry, setEntry] = React.useState<DBUserFoodLogEntry | null>(null);
  const [energyValue, setEnergyValue] = React.useState("");
  const [proteinValue, setProteinValue] = React.useState("");
  const [fatValue, setFatValue] = React.useState("");
  const [carbsValue, setCarbsValue] = React.useState("");
  const [alcoholValue, setAlcoholValue] = React.useState("");
  const [nameValue, setNameValue] = React.useState("");
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [isEnergyManuallySet, setIsEnergyManuallySet] = React.useState(false);
  const resolvedLoggedAt = React.useMemo(() => {
    if (route.params.loggedAt) {
      return route.params.loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(route.params.date, now.getHours(), now.getMinutes());
  }, [route.params.date, route.params.loggedAt]);
  const [loggedAtDate, setLoggedAtDate] = React.useState(
    () => new Date(resolvedLoggedAt),
  );

  React.useEffect(() => {
    const entryId = route.params.entryId;

    if (entryId == null) {
      return;
    }

    let cancelled = false;

    const loadEntry = async () => {
      setLoading(true);

      try {
        const nextEntry = await DB.getUserFoodLogEntryById(entryId);

        if (cancelled) {
          return;
        }

        if (!nextEntry || nextEntry.entrySource !== "quick_add") {
          setEntry(null);
          return;
        }

        setEntry(nextEntry);
        setLoggedAtDate(new Date(nextEntry.loggedAt));
        setEnergyValue(formatNumberInput(nextEntry.calories));
        setProteinValue(formatNumberInput(nextEntry.proteinG));
        setFatValue(formatNumberInput(nextEntry.fatG));
        setCarbsValue(formatNumberInput(nextEntry.carbsG));
        setAlcoholValue(formatNumberInput(nextEntry.alcoholG));
        setNameValue(nextEntry.quickAddName ?? "");
        setIsEnergyManuallySet(nextEntry.isEnergyManuallySet);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [route.params.entryId]);

  const proteinG = React.useMemo(() => toSafeNumber(proteinValue), [proteinValue]);
  const fatG = React.useMemo(() => toSafeNumber(fatValue), [fatValue]);
  const carbsG = React.useMemo(() => toSafeNumber(carbsValue), [carbsValue]);
  const alcoholG = React.useMemo(() => toSafeNumber(alcoholValue), [alcoholValue]);
  const macroCalculatedCalories = React.useMemo(
    () =>
      calculateQuickAddCaloriesFromMacros({
        proteinG,
        carbsG,
        fatG,
        alcoholG,
      }),
    [alcoholG, carbsG, fatG, proteinG],
  );
  const displayedEnergyValue = isEnergyManuallySet
    ? energyValue
    : macroCalculatedCalories > 0
      ? String(macroCalculatedCalories)
      : "";
  const calories = React.useMemo(
    () => toSafeNumber(displayedEnergyValue),
    [displayedEnergyValue],
  );
  const requiredEnergyFallback = React.useMemo(() => {
    if (entry?.calories != null && entry.calories > 0) {
      return entry.calories;
    }

    if (macroCalculatedCalories > 0) {
      return macroCalculatedCalories;
    }

    return 1;
  }, [entry?.calories, macroCalculatedCalories]);
  const resolvedName = nameValue.trim() || "Quick Add";
  const helperText = isEnergyManuallySet
    ? `System calculates ${macroCalculatedCalories.toFixed(0)} kcal from macros.`
    : `Macro sum is ${macroCalculatedCalories.toFixed(0)} kcal.`;
  const contextLabel = route.params.contextLabel?.trim()
    ? route.params.contextLabel
    : formatFoodLoggedTime(loggedAtDate.toISOString());

  const closeAfterSave = React.useCallback(() => {
    if (route.params.entryId) {
      navigation.goBack();
      return;
    }

    const routes = navigation.getState().routes;
    const previousRoute = routes[routes.length - 2];

    if (previousRoute?.name === "AddFood" && routes.length >= 2) {
      navigation.dispatch(StackActions.pop(2));
      return;
    }

    navigation.goBack();
  }, [navigation, route.params.entryId]);

  const handleTimeChange = React.useCallback(
    (event: DateTimePickerEvent, nextDate?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }

      if (event.type !== "set" || !nextDate) {
        return;
      }

      const merged = new Date(loggedAtDate);
      merged.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);
      setLoggedAtDate(merged);
    },
    [loggedAtDate],
  );

  const handleSave = React.useCallback(async () => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

    if (!Number.isFinite(calories) || calories <= 0) {
      Alert.alert("Energy required", "Enter a valid energy value before saving.");
      return;
    }

    try {
      setSaving(true);

      if (route.params.entryId) {
        await DB.updateQuickAddFoodLog({
          id: route.params.entryId,
          loggedAt: loggedAtDate.toISOString(),
          mealType: route.params.mealType ?? entry?.mealType ?? null,
          name: nameValue.trim() || null,
          calories,
          proteinG,
          carbsG,
          fatG,
          alcoholG,
          systemCalculatedCalories: macroCalculatedCalories,
          isEnergyManuallySet,
        });
      } else {
        await DB.addQuickAddFoodLog({
          userExternalId: user.externalId,
          date: route.params.date,
          loggedAt: loggedAtDate.toISOString(),
          mealType: route.params.mealType ?? null,
          name: nameValue.trim() || null,
          calories,
          proteinG,
          carbsG,
          fatG,
          alcoholG,
          systemCalculatedCalories: macroCalculatedCalories,
          isEnergyManuallySet,
        });
      }

      closeAfterSave();
    } catch {
      Alert.alert("Could not save quick add", "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    alcoholG,
    calories,
    carbsG,
    closeAfterSave,
    entry?.mealType,
    fatG,
    isEnergyManuallySet,
    loggedAtDate,
    macroCalculatedCalories,
    nameValue,
    proteinG,
    route.params.date,
    route.params.entryId,
    route.params.mealType,
    user,
  ]);

  const handleEnergyBlur = React.useCallback(() => {
    if (isEnergyManuallySet) {
      setEnergyValue((current) =>
        normalizePositiveFoodInput(current, requiredEnergyFallback, 0),
      );
      return;
    }

    if (macroCalculatedCalories <= 0) {
      setEnergyValue(
        normalizePositiveFoodInput("", requiredEnergyFallback, 0),
      );
      setIsEnergyManuallySet(true);
    }
  }, [
    isEnergyManuallySet,
    macroCalculatedCalories,
    requiredEnergyFallback,
  ]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Quick Add"
            title="Loading entry"
            subtitle="Preparing your quick add..."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.card}>
            <Text style={styles.helperText}>Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (route.params.entryId && (!entry || entry.entrySource !== "quick_add")) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Quick Add"
            title="Entry unavailable"
            subtitle="That quick add could not be loaded."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.card}>
            <Text style={styles.helperText}>Try returning to your diary.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(36, insets.bottom + 20) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <FoodScreenHeader
            eyebrow="Quick Add"
            title={route.params.entryId ? "Edit quick add" : "Quick add entry"}
            subtitle={`${formatFoodShortDate(route.params.date)} | ${formatFoodLoggedTime(
              loggedAtDate.toISOString(),
            )}`}
            onBack={() => navigation.goBack()}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroHeaderCopy}>
                <Text style={styles.heroEyebrow}>One-Time Entry</Text>
                <Text style={styles.heroTitle}>{resolvedName}</Text>
                <Text style={styles.heroMeta}>
                  Logs directly to your diary without saving a permanent food item.
                </Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{contextLabel}</Text>
              </View>
            </View>

            <View style={styles.heroPillsRow}>
              <View style={styles.contextPill}>
                <CalendarIcon
                  size={14}
                  color={appColors.foodPrimary}
                  weight="bold"
                />
                <Text style={styles.contextPillText}>
                  {formatFoodShortDate(route.params.date)}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowTimePicker((current) => !current)}
                style={({ pressed }) => [
                  styles.contextPill,
                  pressed && styles.cardPressed,
                ]}
              >
                <ClockIcon
                  size={14}
                  color={appColors.foodPrimary}
                  weight="bold"
                />
                <Text style={styles.contextPillText}>
                  {formatFoodLoggedTime(loggedAtDate.toISOString())}
                </Text>
                <Text style={styles.contextPillAction}>Change</Text>
              </Pressable>
            </View>

            <View style={styles.previewStrip}>
              <Text style={styles.previewValue}>{calories.toFixed(0)} kcal</Text>
              <Text style={styles.previewText}>
                {`${proteinG.toFixed(0)}P | ${carbsG.toFixed(0)}C | ${fatG.toFixed(
                  0,
                )}F${alcoholG > 0 ? ` | ${alcoholG.toFixed(0)}A` : ""}`}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Energy</Text>
            <Text style={styles.sectionSubtitle}>
              Energy is required. If you type protein, fat, carbs, or alcohol first, the energy field updates automatically.
            </Text>

            <Text style={styles.fieldLabel}>Energy</Text>
            <View style={styles.energyRow}>
              <TextInput
                style={styles.energyInput}
                value={displayedEnergyValue}
                onChangeText={(value) => {
                  setEnergyValue(value);
                  setIsEnergyManuallySet(value.trim().length > 0);
                }}
                onBlur={handleEnergyBlur}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={appColors.foodPlaceholder}
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>kcal</Text>
              </View>
            </View>
            <Text style={styles.helperText}>{helperText}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Macros</Text>
            <Text style={styles.sectionSubtitle}>
              Empty macro fields save as zero. Name is optional and defaults to Quick Add in your diary.
            </Text>

            <View style={styles.macroGrid}>
              <View style={styles.macroField}>
                <Text style={styles.fieldLabel}>Protein</Text>
                <View style={styles.nutrientInputWrap}>
                  <TextInput
                    style={styles.nutrientInput}
                    value={proteinValue}
                    onChangeText={setProteinValue}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={appColors.foodPlaceholder}
                  />
                  <Text style={styles.nutrientUnit}>g</Text>
                </View>
              </View>

              <View style={styles.macroField}>
                <Text style={styles.fieldLabel}>Fat</Text>
                <View style={styles.nutrientInputWrap}>
                  <TextInput
                    style={styles.nutrientInput}
                    value={fatValue}
                    onChangeText={setFatValue}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={appColors.foodPlaceholder}
                  />
                  <Text style={styles.nutrientUnit}>g</Text>
                </View>
              </View>

              <View style={styles.macroField}>
                <Text style={styles.fieldLabel}>Carbs</Text>
                <View style={styles.nutrientInputWrap}>
                  <TextInput
                    style={styles.nutrientInput}
                    value={carbsValue}
                    onChangeText={setCarbsValue}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={appColors.foodPlaceholder}
                  />
                  <Text style={styles.nutrientUnit}>g</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>Alcohol</Text>
            <View style={styles.nutrientInputWrapWide}>
              <TextInput
                style={styles.nutrientInput}
                value={alcoholValue}
                onChangeText={setAlcoholValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={appColors.foodPlaceholder}
              />
              <Text style={styles.nutrientUnit}>g</Text>
            </View>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={nameValue}
              onChangeText={setNameValue}
              placeholder="Quick Add"
              placeholderTextColor={appColors.foodPlaceholder}
            />
          </View>

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
              {saving
                ? route.params.entryId
                  ? "Saving..."
                  : "Logging..."
                : route.params.entryId
                  ? "Save quick add"
                  : "Log quick add"}
            </Text>
          </Pressable>

          {showTimePicker ? (
            <DateTimePicker
              value={loggedAtDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleTimeChange}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.foodScreenBg,
  },
  content: {
    paddingHorizontal: 18,
  },
  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  heroCard: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  heroHeaderCopy: {
    flex: 1,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroTitle: {
    color: appColors.foodText,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 3,
  },
  heroMeta: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroPillText: {
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: appColors.foodPillBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
  },
  contextPillText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  contextPillAction: {
    color: appColors.foodAccentText,
    fontSize: 11,
    fontWeight: "800",
  },
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.foodPrimaryDark,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  previewValue: {
    color: appColors.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.foodPreviewText,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  fieldLabel: {
    color: appColors.foodLabel,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginTop: 10,
  },
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  energyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.foodPrimaryDark,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
    paddingVertical: 13,
    color: appColors.foodText,
    fontSize: 20,
    fontWeight: "800",
  },
  unitPill: {
    borderRadius: 8,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  unitText: {
    color: appColors.foodPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  helperText: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  macroGrid: {
    flexDirection: "row",
    gap: 8,
  },
  macroField: {
    flex: 1,
  },
  nutrientInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
  },
  nutrientInputWrapWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
  },
  nutrientInput: {
    flex: 1,
    paddingVertical: 11,
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "700",
  },
  nutrientUnit: {
    color: appColors.foodPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  textInput: {
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryDark,
    paddingVertical: 13,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default QuickAddFoodScreen;
