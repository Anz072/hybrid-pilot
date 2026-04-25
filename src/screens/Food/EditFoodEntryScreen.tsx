import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CalendarIcon,
  ClockIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUserFoodLogEntry } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import FoodEntryForm from "./FoodEntryForm";
import { MacroBar } from "./FoodDiaryHeroCard";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  calculateLoggedNutrition,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodServing,
  formatFoodShortDate,
  normalizePositiveFoodInput,
} from "./foodUtils";
import {
  getMicronutrientTargets,
  MICRONUTRIENT_TARGETS,
  MicronutrientSex,
  OpenFoodMapMicronutrientKey,
} from "../../engine/micronutrients";
import { getAgeFromBirthdateValue } from "../../helpers";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<FoodStackParamList, "EditFoodEntry">;

const parseQuantity = (value: string): number =>
  Number(value.trim().replace(",", "."));

const formatPreviewValue = (
  value: number | null | undefined,
  places = 1,
): string => {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(places)} g`;
};

const EditFoodEntryScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const [entry, setEntry] = React.useState<DBUserFoodLogEntry | null>(null);
  const [food, setFood] = React.useState<DBFoodItem | null>(null);
  const [quantityValue, setQuantityValue] = React.useState("");
  const [mealTypeValue, setMealTypeValue] = React.useState("");
  const [loggedAtDate, setLoggedAtDate] = React.useState(new Date());
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const microTargets = React.useMemo(
    () =>
      user
        ? getMicronutrientTargets({
            sex: String(user.gender) as MicronutrientSex,
            age: getAgeFromBirthdateValue(user.birthdate) ?? 29,
          })
        : MICRONUTRIENT_TARGETS.generic,
    [user],
  );

  const loadEntry = React.useCallback(async () => {
    setLoading(true);

    try {
      const nextEntry = await DB.getUserFoodLogEntryById(route.params.entryId);

      if (nextEntry?.entrySource === "quick_add") {
        navigation.replace("QuickAddFood", {
          entryId: nextEntry.id,
          date: nextEntry.date,
          loggedAt: nextEntry.loggedAt,
          mealType: nextEntry.mealType ?? null,
          contextLabel: formatFoodLoggedTime(nextEntry.loggedAt),
        });
        return;
      }

      setEntry(nextEntry);
      setFood(
        nextEntry?.foodId != null
          ? await DB.getFoodItemById(nextEntry.foodId)
          : null,
      );

      if (!nextEntry) {
        return;
      }

      setQuantityValue(String(nextEntry.quantityG));
      setMealTypeValue(nextEntry.mealType ?? "");
      setLoggedAtDate(new Date(nextEntry.loggedAt));
    } finally {
      setLoading(false);
    }
  }, [navigation, route.params.entryId]);

  React.useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  const quantity = React.useMemo(
    () => parseQuantity(quantityValue),
    [quantityValue],
  );

  const preview = React.useMemo(() => {
    if (!entry || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    return calculateLoggedNutrition({
      ...entry,
      quantityG: quantity,
    });
  }, [entry, quantity]);
  const handleQuantityBlur = React.useCallback(() => {
    if (!entry) {
      return;
    }

    setQuantityValue((current) =>
      normalizePositiveFoodInput(current, entry.quantityG),
    );
  }, [entry]);

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
    if (!entry) {
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert("Invalid amount", "Enter a positive amount before saving.");
      return;
    }

    try {
      setSaving(true);
      await DB.updateUserFoodLog({
        id: entry.id,
        loggedAt: loggedAtDate.toISOString(),
        quantityG: quantity,
        mealType: mealTypeValue.trim() || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [entry, loggedAtDate, mealTypeValue, navigation, quantity]);

  const handleDelete = React.useCallback(() => {
    if (!entry) {
      return;
    }

    Alert.alert("Delete entry?", "This will remove the entry from your diary.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await DB.deleteUserFoodLog(entry.id);
            navigation.goBack();
          })();
        },
      },
    ]);
  }, [entry, navigation]);

  const loggedTime = formatFoodLoggedTime(loggedAtDate.toISOString());
  const loggedDate = formatFoodShortDate(loggedAtDate);
  const micronutrientFactor = React.useMemo(() => {
    if (!food || !Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }

    return entry && entry.servingSize > 0 ? quantity / entry.servingSize : 1;
  }, [entry, food, quantity]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Edit entry"
            subtitle="Loading your saved food..."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color={appColors.brand700} />
            <Text style={styles.centerText}>Preparing the editor.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Entry unavailable"
            subtitle="The saved food entry could not be loaded."
            onBack={() => navigation.goBack()}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
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
          <FoodEntryForm
            headerEyebrow="Food Entry"
            headerTitle="Edit entry"
            headerSubtitle={`${loggedDate} | ${loggedTime}`}
            onBack={() => navigation.goBack()}
            heroEyebrow="Entry Review"
            heroTitle={entry.foodName}
            heroMeta={`Base serving ${formatFoodServing(
              entry.servingSize,
              entry.servingUnit,
            )} | ${entry.calories.toFixed(0)} kcal`}
            heroPills={[
              {
                key: "mode",
                label: "Edit",
                icon: (
                  <PencilSimpleIcon
                    size={14}
                    color={appColors.brand500}
                    weight="bold"
                  />
                ),
              },
              {
                key: "date",
                label: loggedDate,
                icon: <CalendarIcon size={14} color={appColors.brand500} weight="bold" />,
              },
              ...(mealTypeValue.trim()
                ? [
                    {
                      key: "label",
                      label: mealTypeValue.trim(),
                      icon: <ForkKnifeIcon size={14} color={appColors.brand500} weight="fill" />,
                    },
                  ]
                : []),
            ]}
            previewCaloriesText={preview ? `${preview.calories.toFixed(0)} kcal` : "--"}
            previewSummaryText={
              preview
                ? `${formatFoodMacro(preview.proteinG, "P")} | ${formatFoodMacro(
                    preview.carbsG,
                    "C",
                  )} | ${formatFoodMacro(preview.fatG, "F")}`
                : "Enter an amount to preview nutrition"
            }
            amountKeyboardType="decimal-pad"
            amountPlaceholder="Amount"
            amountUnit={entry.servingUnit?.trim() || "g"}
            amountValue={quantityValue}
            detailsSubtitle="Adjust the amount, logged time, or label for this entry."
            onChangeAmount={setQuantityValue}
            onAmountBlur={handleQuantityBlur}
            slot={{
              icon: <ClockIcon size={18} color={appColors.brand500} weight="bold" />,
              label: "Logged time",
              value: loggedTime,
              actionLabel: "Change",
              onPress: () => setShowTimePicker((current) => !current),
            }}
            labelValue={mealTypeValue}
            onChangeLabel={setMealTypeValue}
            labelPlaceholder="Post-workout, cafe, office..."
            nutritionItems={[
              {
                label: "Calories",
                value: preview ? preview.calories.toFixed(0) : "--",
              },
              {
                label: "Protein",
                value: preview ? formatPreviewValue(preview.proteinG) : "--",
              },
              {
                label: "Carbs",
                value: preview ? formatPreviewValue(preview.carbsG) : "--",
              },
              {
                label: "Fat",
                value: preview ? formatPreviewValue(preview.fatG) : "--",
              },
            ]}
            onPrimaryAction={() => {
              void handleSave();
            }}
            primaryActionDisabled={saving}
            primaryActionIcon={
              <PencilSimpleIcon size={16} color={appColors.white} weight="bold" />
            }
            primaryActionLabel={saving ? "Saving..." : "Save changes"}
            showPrimaryAction={false}
          />

          {food ? (
            <>
              <Text style={styles.title}>Micronutrients</Text>
              {(
                Object.entries(microTargets) as [
                  OpenFoodMapMicronutrientKey,
                  number,
                ][]
              ).map(([key, target]) => (
                <MacroBar
                  key={key}
                  accent={appColors.brand500}
                  consumed={(food[key] ?? 0) * micronutrientFactor}
                  target={target}
                  label={key
                    .slice(0, -2)
                    .split(/(?=[A-Z])/)
                    .map((word) => word[0].toUpperCase() + word.slice(1))
                    .join(" ")}
                  unit={key.endsWith("Ug") ? "ug" : "mg"}
                />
              ))}
            </>
          ) : null}

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
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.cardPressed,
            ]}
          >
            <TrashIcon size={16} color={appColors.danger700} weight="bold" />
            <Text style={styles.secondaryButtonText}>Delete entry</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void handleSave();
            }}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabled,
              pressed && !saving && styles.cardPressed,
            ]}
          >
            <PencilSimpleIcon size={16} color={appColors.white} weight="bold" />
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving..." : "Save changes"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 12,
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
    backgroundColor: appColors.brand800,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  centerCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: appColors.white,
    padding: 16,
  },
  centerText: {
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
    backgroundColor: appColors.surfaceOverlay,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.dangerBorder,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: appColors.danger700,
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

export default EditFoodEntryScreen;

