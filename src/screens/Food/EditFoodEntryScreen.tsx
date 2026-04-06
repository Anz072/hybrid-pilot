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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ForkKnifeIcon, PencilSimpleIcon, TrashIcon } from "phosphor-react-native";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  DEFAULT_MEALS,
  calculateLoggedNutrition,
  formatFoodServing,
  formatMacroLine,
} from "./foodUtils";

type Props = NativeStackScreenProps<FoodStackParamList, "EditFoodEntry">;

const EditFoodEntryScreen = ({ navigation, route }: Props) => {
  const [entry, setEntry] = React.useState<DBUserFoodLogEntry | null>(null);
  const [quantityG, setQuantityG] = React.useState("");
  const [mealType, setMealType] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      const data = await DB.getUserFoodLogEntryById(route.params.entryId);
      setEntry(data);
      setQuantityG(String(data?.quantityG ?? ""));
      setMealType(data?.mealType ?? "Snacks");
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

  const mealOptions = React.useMemo(() => {
    const base = [...DEFAULT_MEALS];
    const normalized = mealType.trim();

    if (normalized.length > 0 && !base.includes(normalized as (typeof DEFAULT_MEALS)[number])) {
      base.push(normalized);
    }

    return base;
  }, [mealType]);

  const handleSave = async () => {
    if (!entry || !Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Enter a valid quantity in grams.");
      return;
    }

    await DB.updateUserFoodLog({
      id: entry.id,
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

  if (!entry) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <FoodScreenHeader
          eyebrow="Food Entry"
          title="Edit entry"
          subtitle="Loading nutrition details..."
          onBack={() => navigation.goBack()}
        />
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FoodScreenHeader
            eyebrow="Food Entry"
            title="Edit entry"
            subtitle="Refine the amount or move this item to a different meal section."
            onBack={() => navigation.goBack()}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroPill}>
              <ForkKnifeIcon size={14} color="#9A3412" weight="fill" />
              <Text style={styles.heroPillText}>{mealType.trim() || "Snacks"}</Text>
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
            <Text style={styles.sectionTitle}>Meal section</Text>
            <Text style={styles.sectionSubtitle}>
              Pick a common section or keep using your own custom label.
            </Text>
            <View style={styles.chipRow}>
              {mealOptions.map((meal) => {
                const selected = mealType.trim() === meal;
                return (
                  <Pressable
                    key={meal}
                    onPress={() => setMealType(meal)}
                    style={({ pressed }) => [
                      styles.mealChip,
                      selected && styles.mealChipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mealChipText,
                        selected && styles.mealChipTextActive,
                      ]}
                    >
                      {meal}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              value={mealType}
              onChangeText={setMealType}
              placeholder="Custom meal label"
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

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]} onPress={() => void handleSave()}>
            <PencilSimpleIcon size={16} color="#FFFFFF" weight="bold" />
            <Text style={styles.primaryButtonText}>Save changes</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.deleteButton, pressed && styles.cardPressed]} onPress={() => void handleDelete()}>
            <TrashIcon size={16} color="#B91C1C" weight="bold" />
            <Text style={styles.deleteButtonText}>Delete entry</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  bgOrbTop: {
    position: "absolute",
    top: -84,
    right: -44,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#FED7AA",
    opacity: 0.9,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -110,
    left: -76,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "#FDE68A",
    opacity: 0.25,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 18,
    marginBottom: 16,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  heroPillText: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  previewStrip: {
    borderRadius: 18,
    backgroundColor: "#111827",
    padding: 14,
  },
  previewStripValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  previewStripText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#6B7280",
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
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  unitPill: {
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unitText: {
    color: "#9A3412",
    fontSize: 15,
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  mealChip: {
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mealChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  mealChipText: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "800",
  },
  mealChipTextActive: {
    color: "#FFFFFF",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 12,
  },
  nutritionLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  nutritionValue: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "#111827",
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
