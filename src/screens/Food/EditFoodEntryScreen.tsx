import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
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
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { LoadingState } from "../../components/ui";
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
  getFoodQuantityFactor,
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
import { sharedStyleValues } from "../../theme/sharedStyles";

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
  const [formError, setFormError] = React.useState<string | null>(null);
  const bypassUnsavedGuardRef = React.useRef(false);
  const initialDraftSignatureRef = React.useRef<string | null>(null);
  // Synchronous lock: `saving` state disables the button only after a re-render,
  // so a fast double-tap could otherwise submit twice.
  const savingRef = React.useRef(false);

  const buildDraftSignature = React.useCallback(
    (quantityInput: string, mealInput: string, loggedAtInput: string) =>
      JSON.stringify({
        loggedAt: loggedAtInput,
        mealType: mealInput.trim() || null,
        quantity: quantityInput.trim(),
      }),
    [],
  );

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
      initialDraftSignatureRef.current = buildDraftSignature(
        String(nextEntry.quantityG),
        nextEntry.mealType ?? "",
        nextEntry.loggedAt,
      );
    } finally {
      setLoading(false);
    }
  }, [buildDraftSignature, navigation, route.params.entryId]);

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

    setFormError(null);
    setQuantityValue((current) =>
      normalizePositiveFoodInput(current, entry.quantityG),
    );
  }, [entry]);

  const currentDraftSignature = React.useMemo(
    () =>
      buildDraftSignature(
        quantityValue,
        mealTypeValue,
        loggedAtDate.toISOString(),
      ),
    [buildDraftSignature, loggedAtDate, mealTypeValue, quantityValue],
  );
  const isDirty =
    initialDraftSignatureRef.current != null &&
    initialDraftSignatureRef.current !== currentDraftSignature;

  React.useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (bypassUnsavedGuardRef.current || saving || !isDirty) {
          return;
        }

        event.preventDefault();
        Alert.alert(
          "Discard food changes?",
          "Unsaved changes to this diary entry will be lost.",
          [
            { text: "Keep editing", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => {
                bypassUnsavedGuardRef.current = true;
                navigation.dispatch(event.data.action);
              },
            },
          ],
        );
      }),
    [isDirty, navigation, saving],
  );

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
      setFormError(null);
      setLoggedAtDate(merged);
    },
    [loggedAtDate],
  );

  const handleSave = React.useCallback(async () => {
    if (!entry || savingRef.current) {
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Enter a positive amount before saving.");
      return;
    }

    savingRef.current = true;

    try {
      setFormError(null);
      setSaving(true);
      await DB.updateUserFoodLog({
        id: entry.id,
        loggedAt: loggedAtDate.toISOString(),
        quantityG: quantity,
        mealType: mealTypeValue.trim() || null,
      });
      bypassUnsavedGuardRef.current = true;
      navigation.goBack();
    } catch {
      setFormError(
        "Could not save the changes. Check your connection and try again.",
      );
    } finally {
      savingRef.current = false;
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
            try {
              await DB.deleteUserFoodLog(entry.id);
              bypassUnsavedGuardRef.current = true;
              navigation.goBack();
            } catch {
              Alert.alert(
                "Could not delete entry",
                "Check your connection and try again.",
              );
            }
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

    return getFoodQuantityFactor(food, quantity);
  }, [food, quantity]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Edit entry"
            subtitle="Loading your saved food..."
            onBack={() => navigation.goBack()}
          />
          <LoadingState
            title="Loading entry"
            message="Preparing the editor."
            style={styles.centerCard}
          />
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.screen}>
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
            onChangeAmount={(value) => {
              setQuantityValue(value);
              setFormError(null);
            }}
            onAmountBlur={handleQuantityBlur}
            slot={{
              icon: <ClockIcon size={18} color={appColors.brand500} weight="bold" />,
              label: "Logged time",
              value: loggedTime,
              actionLabel: "Change",
              onPress: () => setShowTimePicker((current) => !current),
            }}
            labelValue={mealTypeValue}
            onChangeLabel={(value) => {
              setMealTypeValue(value);
              setFormError(null);
            }}
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
            formError={formError}
            showPrimaryAction={false}
          />

          {food ? (
            <>
              <Text style={styles.title}>Micronutrients</Text>
              {(
                Object.entries(microTargets ?? MICRONUTRIENT_TARGETS.generic) as [
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
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.cardPressed,
            ]}
          >
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
    fontWeight: "500",
    marginTop: 16,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 18,
  },
  centerCard: sharedStyleValues.centerCard,
  centerText: sharedStyleValues.centerText,
  footer: sharedStyleValues.footer,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.buttonWithIcon,
    ...sharedStyleValues.primaryButton,
  },
  primaryButtonText: sharedStyleValues.primaryButtonText,
  secondaryButton: {
    minHeight: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  secondaryButtonText: sharedStyleValues.dangerButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default EditFoodEntryScreen;
