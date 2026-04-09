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
  ScrollView,
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
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import FoodEntryForm from "./FoodEntryForm";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  calculateLoggedNutrition,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodServing,
  formatFoodShortDate,
} from "./foodUtils";
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
  const [entry, setEntry] = React.useState<DBUserFoodLogEntry | null>(null);
  const [quantityValue, setQuantityValue] = React.useState("");
  const [mealTypeValue, setMealTypeValue] = React.useState("");
  const [loggedAtDate, setLoggedAtDate] = React.useState(new Date());
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const loadEntry = React.useCallback(async () => {
    setLoading(true);

    try {
      const nextEntry = await DB.getUserFoodLogEntryById(route.params.entryId);
      setEntry(nextEntry);

      if (!nextEntry) {
        return;
      }

      setQuantityValue(String(nextEntry.quantityG));
      setMealTypeValue(nextEntry.mealType ?? "");
      setLoggedAtDate(new Date(nextEntry.loggedAt));
    } finally {
      setLoading(false);
    }
  }, [route.params.entryId]);

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
            <ActivityIndicator size="small" color={appColors.foodPrimaryDark} />
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

  const loggedTime = formatFoodLoggedTime(loggedAtDate.toISOString());
  const loggedDate = formatFoodShortDate(loggedAtDate);

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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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
                key: "date",
                label: loggedDate,
                icon: <CalendarIcon size={14} color={appColors.foodPrimary} weight="bold" />,
              },
              ...(mealTypeValue.trim()
                ? [
                    {
                      key: "label",
                      label: mealTypeValue.trim(),
                      icon: <ForkKnifeIcon size={14} color={appColors.foodPrimary} weight="fill" />,
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
            slot={{
              icon: <ClockIcon size={18} color={appColors.foodPrimary} weight="bold" />,
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
            secondaryAction={{
              label: "Delete entry",
              icon: <TrashIcon size={16} color={appColors.danger700} weight="bold" />,
              onPress: handleDelete,
              tone: "danger",
            }}
          />

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
    paddingBottom: 36,
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
  centerCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: appColors.white,
    padding: 16,
  },
  centerText: {
    color: appColors.foodMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
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
  cardPressed: {
    opacity: 0.9,
  },
});

export default EditFoodEntryScreen;
