import { CaretDownIcon, CaretUpIcon } from "phosphor-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
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
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";

const initMicronutrientState = {
  calcium_mg: 0,
  iron_mg: 0,
  magnesium_mg: 0,
  phosphorus_mg: 0,
  potassium_mg: 0,
  sodium_mg: 0,
  zinc_mg: 0,
  copper_mg: 0,
  manganese_mg: 0,
  selenium_ug: 0,
  iodine_ug: 0,
  chromium_ug: 0,
  molybdenum_ug: 0,
  vitamin_a_iu: 0,
  vitamin_a_ug: 0,
  vitamin_c_mg: 0,
  vitamin_d_iu: 0,
  vitamin_d_ug: 0,
  vitamin_e_mg: 0,
  vitamin_k_ug: 0,
  thiamin_b1_mg: 0,
  riboflavin_b2_mg: 0,
  niacin_b3_mg: 0,
  pantothenic_acid_b5_mg: 0,
  vitamin_b6_mg: 0,
  biotin_b7_ug: 0,
  folate_b9_ug: 0,
  vitamin_b12_ug: 0,
  choline_mg: 0,
  omega_3_g: 0,
  omega_6_g: 0,
  saturated_fat_g: 0,
  trans_fat_g: 0,
  dietary_fiber_g: 0,
  total_sugars_g: 0,
  added_sugars_g: 0,
  cholesterol_mg: 0,
};

type CreateCustomFoodRoute = RouteProp<FoodStackParamList, "CreateCustomFood">;
type CreateCustomFoodNav = NativeStackNavigationProp<
  FoodStackParamList,
  "CreateCustomFood"
>;

const CreateCustomFoodScreen = () => {
  const [newName, setNewName] = useState("");
  const [newServing, setNewServing] = useState("100");
  const [newCalories, setNewCalories] = useState("0");
  const [newProtein, setNewProtein] = useState("0");
  const [newCarbs, setNewCarbs] = useState("0");
  const [newFat, setNewFat] = useState("0");
  const [showMicros, setShowMicros] = useState(false);
  const [newMicronutrient, setNewMicronutrient] = useState(
    initMicronutrientState,
  );

  const user = useAppSelector((state) => state.user.currentUser);
  const route = useRoute<CreateCustomFoodRoute>();
  const navigation = useNavigation<CreateCustomFoodNav>();
  const { date, mealType } = route.params;

  const createAndAdd = async () => {
    if (!user) {
      return;
    }

    const name = newName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter a food name first.");
      return;
    }

    const serving = Number(newServing);
    const calories = Number(newCalories);
    const protein = Number(newProtein);
    const carbs = Number(newCarbs);
    const fat = Number(newFat);

    if (
      [serving, calories, protein, carbs, fat].some(
        (n) => Number.isNaN(n) || n < 0,
      )
    ) {
      Alert.alert(
        "Invalid numbers",
        "Use non-negative values for nutrition fields.",
      );
      return;
    }

    const foodId = await DB.addFoodItem({
      name,
      servingSize: serving,
      calories,
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      fiberG: null,
      isFavorite: false,
    });

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId,
      date,
      quantityG: serving,
      mealType,
    });

    navigation.navigate("Diary");
  };

  const updateMicronutrient = (
    field: keyof typeof newMicronutrient,
    value: string,
  ) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      Alert.alert("Invalid number", "Use a non-negative value.");
      return;
    }
    setNewMicronutrient((prev) => ({ ...prev, [field]: num }));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={12}
    >
      <ScrollView style={styles.createCard}>
        <Text style={styles.createTitle}>Create Custom Food</Text>

        <Text style={styles.inputLabel}>Food Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={newName}
          onChangeText={setNewName}
        />

        <Text style={styles.inputLabel}>Serving Size (g)</Text>
        <TextInput
          style={styles.input}
          placeholder="Serving size (g)"
          value={newServing}
          onChangeText={setNewServing}
          keyboardType="numeric"
        />
        <Text style={styles.inputLabel}>Calories</Text>
        <TextInput
          style={styles.input}
          placeholder="Calories"
          value={newCalories}
          onChangeText={setNewCalories}
          keyboardType="numeric"
        />
        <Text style={styles.inputLabel}>Protein (g)</Text>
        <TextInput
          style={styles.input}
          placeholder="Protein (g)"
          value={newProtein}
          onChangeText={setNewProtein}
          keyboardType="numeric"
        />
        <Text style={styles.inputLabel}>Carbs (g)</Text>
        <TextInput
          style={styles.input}
          placeholder="Carbs (g)"
          value={newCarbs}
          onChangeText={setNewCarbs}
          keyboardType="numeric"
        />
        <Text style={styles.inputLabel}>Fat (g)</Text>
        <TextInput
          style={styles.input}
          placeholder="Fat (g)"
          value={newFat}
          onChangeText={setNewFat}
          keyboardType="numeric"
        />

        <Pressable
          style={styles.microsToggle}
          onPress={() => setShowMicros((prev) => !prev)}
        >
          <Text style={styles.createTitle}>Micros (Optional)</Text>
          {showMicros ? (
            <CaretUpIcon size={18} color="#334155" weight="bold" />
          ) : (
            <CaretDownIcon size={18} color="#334155" weight="bold" />
          )}
        </Pressable>

        {showMicros ? (
          <>
            {Object.keys(initMicronutrientState).map((field) => {
              const micronutrientField =
                field as keyof typeof initMicronutrientState;
              const label = field.replace(/_/g, " ").toUpperCase();
              return (
                <View key={field}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={label}
                    value={newMicronutrient[micronutrientField].toString()}
                    onChangeText={(value) =>
                      updateMicronutrient(micronutrientField, value)
                    }
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </>
        ) : null}

        <Pressable style={styles.createButton} onPress={createAndAdd}>
          <Text style={styles.createButtonText}>Create and Add</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  createCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  microsToggle: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f6f6f7",
    padding: 10,
    borderRadius: 8,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 12,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
  },
  createButton: {
    marginTop: 12,
    marginBottom: 24,
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default CreateCustomFoodScreen;
