import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useNavigation,
  useRoute,
  StackActions,
} from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { ClockIcon, FireIcon, PencilSimpleIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { sharedStyleValues } from "../../theme/sharedStyles";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  calculateQuickAddCaloriesFromMacros,
  formatFoodLoggedTime,
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

const ENERGY_PRESETS = [100, 250, 500];

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
  const [nameValue, setNameValue] = React.useState("");
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [isEnergyManuallySet, setIsEnergyManuallySet] = React.useState(false);
  const resolvedLoggedAt = React.useMemo(() => {
    if (route.params.loggedAt) {
      return route.params.loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(
      route.params.date,
      now.getHours(),
      now.getMinutes(),
    );
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
        setNameValue(nextEntry.quickAddName ?? "");
        setIsEnergyManuallySet(
          nextEntry.isEnergyManuallySet || (nextEntry.alcoholG ?? 0) > 0,
        );
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

  const proteinG = React.useMemo(
    () => toSafeNumber(proteinValue),
    [proteinValue],
  );
  const fatG = React.useMemo(() => toSafeNumber(fatValue), [fatValue]);
  const carbsG = React.useMemo(() => toSafeNumber(carbsValue), [carbsValue]);
  const macroCalculatedCalories = React.useMemo(
    () =>
      calculateQuickAddCaloriesFromMacros({
        proteinG,
        carbsG,
        fatG,
      }),
    [carbsG, fatG, proteinG],
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
  const helperText = isEnergyManuallySet
    ? `System calculates ${macroCalculatedCalories.toFixed(0)} kcal from macros.`
    : `Macro sum is ${macroCalculatedCalories.toFixed(0)} kcal.`;

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
      Alert.alert(
        "Energy required",
        "Enter a valid energy value before saving.",
      );
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
      setEnergyValue(normalizePositiveFoodInput("", requiredEnergyFallback, 0));
      setIsEnergyManuallySet(true);
    }
  }, [isEnergyManuallySet, macroCalculatedCalories, requiredEnergyFallback]);

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
    <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <KeyboardAwareScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(176, insets.bottom + 152) },
          ]}
          focusedInputBottomOffset={132}
        >
          <View style={styles.card}>
            <View style={styles.heroHeaderRow}>
              <Text style={styles.heroTitle}>Quick Add</Text>
            </View>

            <View style={styles.heroPillsRow}>
              <Pressable
                onPress={() => setShowTimePicker((current) => !current)}
                style={({ pressed }) => [
                  styles.contextPill,
                  pressed && styles.cardPressed,
                ]}
              >
                <ClockIcon size={14} color={appColors.brand500} weight="bold" />
                <Text style={styles.contextPillText}>
                  {formatFoodLoggedTime(loggedAtDate.toISOString())}
                </Text>
                <PencilSimpleIcon size={16} color={appColors.slate900} />
              </Pressable>
            </View>
            <View style={styles.energyLabelContainer}>
              <View style={{ marginBottom: 8 }}>
                <FireIcon size={14} />
              </View>
              <Text style={styles.fieldLabel}>Energy</Text>
            </View>
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
                placeholderTextColor={appColors.textMuted}
                autoFocus={!route.params.entryId}
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>kcal</Text>
              </View>
            </View>
            <View style={styles.presetRow}>
              {ENERGY_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => {
                    setEnergyValue(String(preset));
                    setIsEnergyManuallySet(true);
                  }}
                  style={({ pressed }) => [
                    styles.presetChip,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <Text style={styles.presetChipText}>{preset}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.helperText}>{helperText}</Text>
            {isEnergyManuallySet && macroCalculatedCalories > 0 ? (
              <Pressable
                onPress={() => {
                  setEnergyValue("");
                  setIsEnergyManuallySet(false);
                }}
                style={({ pressed }) => [
                  styles.inlineQuietButton,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.inlineQuietButtonText}>
                  Use macro calories
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Macros</Text>
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
                    placeholderTextColor={appColors.textMuted}
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
                    placeholderTextColor={appColors.textMuted}
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
                    placeholderTextColor={appColors.textMuted}
                  />
                  <Text style={styles.nutrientUnit}>g</Text>
                </View>
              </View>
            </View>

            <View style={styles.optionalPanel}>
              <Text style={[styles.fieldLabel, styles.optionalFieldLabel]}>
                Name (optional)
              </Text>
              <TextInput
                style={[styles.textInput, styles.optionalInput]}
                value={nameValue}
                onChangeText={setNameValue}
                placeholder="Quick add"
                placeholderTextColor={appColors.textMuted}
              />
            </View>
          </View>

          {showTimePicker ? (
            <DateTimePicker
              value={loggedAtDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleTimeChange}
            />
          ) : null}
        </KeyboardAwareScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: sharedStyleValues.screen,
  content: sharedStyleValues.content,
  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    opacity: 0.38,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.success700,
    opacity: 0.34,
  },
  heroCard: sharedStyleValues.card,
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
  heroEyebrow: sharedStyleValues.eyebrow,
  heroTitle: {
    ...sharedStyleValues.heroTitleLarge,
    marginBottom: 4,
  },
  heroMeta: sharedStyleValues.metaText,
  heroPill: {
    ...sharedStyleValues.pill,
    gap: 0,
  },
  heroPillText: sharedStyleValues.pillText,
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
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  contextPillText: sharedStyleValues.contextPillText,
  contextPillAction: {
    color: appColors.brand300,
    fontSize: 11,
    fontWeight: "800",
  },
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  previewValue: {
    color: appColors.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.brand300,
    fontSize: 12,
    lineHeight: 16,
  },
  card: sharedStyleValues.card,
  sectionTitle: {
    ...sharedStyleValues.sectionTitle,
    marginBottom: 10,
  },
  sectionSubtitle: sharedStyleValues.sectionSubtitle,
  energyLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldLabel: {
    ...sharedStyleValues.fieldLabel,
    marginBottom: 8,
  },
  fieldSpacing: {
    marginTop: 16,
  },
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  energyInput: {
    ...sharedStyleValues.input,
    borderWidth: 1,
    borderColor: appColors.brand700,
    fontSize: 20,
    fontWeight: "800",
  },
  unitPill: {
    ...sharedStyleValues.unitPillRound,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  unitText: sharedStyleValues.unitText,
  helperText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  inlineQuietButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 10,
  },
  inlineQuietButtonText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  presetChipText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
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
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
  },
  nutrientInputWrapWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
  },
  nutrientInput: {
    flex: 1,
    paddingVertical: 11,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  nutrientUnit: {
    color: appColors.brand500,
    fontSize: 13,
    fontWeight: "800",
  },
  textInput: sharedStyleValues.input,
  optionalPanel: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginTop: 16,
  },
  optionalFieldLabel: {
    color: appColors.textMuted,
  },
  optionalInput: {
    backgroundColor: appColors.surfaceCard,
  },
  footer: sharedStyleValues.footer,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.buttonWithIcon,
    ...sharedStyleValues.primaryButton,
    marginBottom: 12,
  },
  primaryButtonText: sharedStyleValues.lightPrimaryButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default QuickAddFoodScreen;
