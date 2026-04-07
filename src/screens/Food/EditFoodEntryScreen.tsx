import React from "react";
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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ClockIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "phosphor-react-native";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  calculateLoggedNutrition,
  formatFoodLoggedTime,
  formatFoodServing,
  formatFoodShortDate,
  formatMacroLine,
} from "./foodUtils";

type Props = NativeStackScreenProps<FoodStackParamList, "EditFoodEntry">;

const EditFoodEntryScreen = ({ navigation, route }: Props) => {
  const [entry, setEntry] = React.useState<DBUserFoodLogEntry | null>(null);
  const [quantityG, setQuantityG] = React.useState("");
  const [mealType, setMealType] = React.useState("");
  const [loggedAt, setLoggedAt] = React.useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      const data = await DB.getUserFoodLogEntryById(route.params.entryId);
      setEntry(data);
      setQuantityG(String(data?.quantityG ?? ""));
      setMealType(data?.mealType ?? "");
      setLoggedAt(data ? new Date(data.loggedAt ?? data.createdAt) : null);
    };

    void load();
  }, [route.params.entryId]);

  const quantity = Number(quantityG);
  const preview = React.useMemo(() => {
    if (!entry || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    return calculateLoggedNutrition({
      ...entry,
      quantityG: quantity,
    });
  }, [entry, quantity]);

  const handleSave = async () => {
    if (!entry || !Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Enter a valid quantity in grams.");
      return;
    }

    await DB.updateUserFoodLog({
      id: entry.id,
      loggedAt: loggedAt?.toISOString() ?? entry.loggedAt,
      quantityG: quantity,
      mealType: mealType.trim() || null,
    });

    navigation.goBack();
  };

  const handleDelete = async () => {
    if (!entry) {
      return;
    }

    Alert.alert("Delete entry?", "Remove this item from your diary?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await DB.deleteUserFoodLog(entry.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setLoggedAt(selectedDate);
  };

  if (!entry) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Edit entry"
            subtitle="Loading nutrition details..."
            onBack={() => navigation.goBack()}
          />
        </View>
      </View>
    );
  }

  const resolvedLoggedAt = loggedAt ?? new Date(entry.loggedAt ?? entry.createdAt);

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Edit entry"
            subtitle="Refine the amount, time, or optional label for this log."
            onBack={() => navigation.goBack()}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <ForkKnifeIcon size={14} color="#6D52EA" weight="fill" />
                <Text style={styles.heroPillText}>
                  {formatFoodLoggedTime(resolvedLoggedAt.toISOString())}
                </Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>
                  {formatFoodShortDate(resolvedLoggedAt)}
                </Text>
              </View>
              {mealType.trim() ? (
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{mealType.trim()}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroTitle}>{entry.foodName}</Text>
            <Text style={styles.heroSubtitle}>
              Base serving {formatFoodServing(entry.servingSize, entry.servingUnit)} •{" "}
              {entry.calories.toFixed(0)} kcal
            </Text>
            <View style={styles.previewStrip}>
              <Text style={styles.previewStripValue}>
                {preview ? `${preview.calories.toFixed(0)} kcal` : "--"}
              </Text>
              <Text style={styles.previewStripText}>
                {preview ? formatMacroLine(preview) : "Enter a quantity to preview nutrition"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <Text style={styles.sectionSubtitle}>
              Update grams to match what you actually ate.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={quantityG}
                onChangeText={setQuantityG}
                keyboardType="numeric"
                placeholder="Quantity (g)"
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>{entry.servingUnit?.trim() || "g"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Logged time</Text>
            <Text style={styles.sectionSubtitle}>
              Keep the diary ordered by when you actually ate it.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.timeButton, pressed && styles.cardPressed]}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.timeButtonCopy}>
                <ClockIcon size={18} color="#6D52EA" weight="bold" />
                <View>
                  <Text style={styles.timeButtonLabel}>Time</Text>
                  <Text style={styles.timeButtonValue}>
                    {formatFoodLoggedTime(resolvedLoggedAt.toISOString())}
                  </Text>
                </View>
              </View>
              <Text style={styles.timeButtonAction}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Optional label</Text>
            <Text style={styles.sectionSubtitle}>
              Keep a short label only if it helps you remember the context.
            </Text>
            <TextInput
              style={styles.input}
              value={mealType}
              onChangeText={setMealType}
              placeholder="Post-workout, cafe, office..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nutrition preview</Text>
            <Text style={styles.sectionSubtitle}>
              Your preview updates instantly as you adjust the quantity.
            </Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionLabel}>Calories</Text>
                <Text style={styles.nutritionValue}>
                  {preview ? preview.calories.toFixed(0) : "--"}
                </Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionLabel}>Protein</Text>
                <Text style={styles.nutritionValue}>
                  {preview ? `${preview.proteinG.toFixed(1)} g` : "--"}
                </Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionLabel}>Carbs</Text>
                <Text style={styles.nutritionValue}>
                  {preview ? `${preview.carbsG.toFixed(1)} g` : "--"}
                </Text>
              </View>
              <View style={styles.nutritionCell}>
                <Text style={styles.nutritionLabel}>Fat</Text>
                <Text style={styles.nutritionValue}>
                  {preview ? `${preview.fatG.toFixed(1)} g` : "--"}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}
            onPress={() => void handleSave()}
          >
            <PencilSimpleIcon size={16} color="#FFFFFF" weight="bold" />
            <Text style={styles.primaryButtonText}>Save changes</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.deleteButton, pressed && styles.cardPressed]}
            onPress={() => void handleDelete()}
          >
            <TrashIcon size={16} color="#B91C1C" weight="bold" />
            <Text style={styles.deleteButtonText}>Delete entry</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {showTimePicker ? (
        <DateTimePicker
          value={resolvedLoggedAt}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          is24Hour
          onChange={handleTimeChange}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F4FB",
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
    backgroundColor: "#E4D9FF",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#EEE7FF",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  heroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F3EEFC",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroPillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#1B1529",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  previewStrip: {
    borderRadius: 8,
    backgroundColor: "#1F1831",
    padding: 14,
  },
  previewStripValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  previewStripText: {
    color: "#CFC5E7",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#1B1529",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E6DEF1",
    borderRadius: 16,
    backgroundColor: "#FBF9FF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#1B1529",
    fontSize: 16,
    fontWeight: "700",
  },
  unitPill: {
    borderRadius: 14,
    backgroundColor: "#F3EEFC",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unitText: {
    color: "#6D52EA",
    fontSize: 15,
    fontWeight: "800",
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeButtonCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeButtonLabel: {
    color: "#7E7399",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  timeButtonValue: {
    color: "#1B1529",
    fontSize: 17,
    fontWeight: "900",
  },
  timeButtonAction: {
    color: "#6D52EA",
    fontSize: 13,
    fontWeight: "800",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: 14,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#ECE5F9",
    padding: 12,
  },
  nutritionLabel: {
    color: "#7E7399",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  nutritionValue: {
    color: "#1B1529",
    fontSize: 18,
    fontWeight: "900",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "#1F1831",
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 15,
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default EditFoodEntryScreen;
