import React from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBUserFoodLogEntry } from "../../store/DB_TYPES";

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
      setMealType(data?.mealType ?? "");
    };

    void load();
  }, [route.params.entryId]);

  const quantity = Number(quantityG);
  const ratio = entry ? quantity / Math.max(entry.servingSize, 1) : 0;

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

    await DB.deleteUserFoodLog(entry.id);
    navigation.goBack();
  };

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading entry...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Entry</Text>
      <Text style={styles.subtitle}>{entry.foodName}</Text>

      <TextInput
        style={styles.input}
        value={quantityG}
        onChangeText={setQuantityG}
        keyboardType="numeric"
        placeholder="Quantity (g)"
      />

      <TextInput
        style={styles.input}
        value={mealType}
        onChangeText={setMealType}
        placeholder="Meal type"
      />

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Nutrition Preview</Text>
        <Text style={styles.previewText}>Calories {(entry.calories * ratio).toFixed(0)}</Text>
        <Text style={styles.previewText}>Protein {(entry.proteinG * ratio).toFixed(1)}g</Text>
        <Text style={styles.previewText}>Carbs {(entry.carbsG * ratio).toFixed(1)}g</Text>
        <Text style={styles.previewText}>Fat {(entry.fatG * ratio).toFixed(1)}g</Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => void handleDelete()}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
    gap: 10,
  },
  loading: {
    color: "#475569",
    fontSize: 16,
  },
  title: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#334155",
    fontSize: 15,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 4,
  },
  previewTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewText: {
    color: "#334155",
  },
  saveBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#991b1b",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

export default EditFoodEntryScreen;

