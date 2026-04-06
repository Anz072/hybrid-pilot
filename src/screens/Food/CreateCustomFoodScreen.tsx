import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CaretDownIcon, CaretUpIcon, ForkKnifeIcon } from "phosphor-react-native";
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
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  formatFoodLoggedTime,
  formatFoodShortDate,
} from "./foodUtils";

type CreateCustomFoodRoute = RouteProp<FoodStackParamList, "CreateCustomFood">;
type CreateCustomFoodNav = NativeStackNavigationProp<
  FoodStackParamList,
  "CreateCustomFood"
>;

const CreateCustomFoodScreen = () => {
  const [name, setName] = React.useState("");
  const [servingSize, setServingSize] = React.useState("100");
  const [calories, setCalories] = React.useState("0");
  const [protein, setProtein] = React.useState("0");
  const [carbs, setCarbs] = React.useState("0");
  const [fat, setFat] = React.useState("0");
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const user = useAppSelector((state) => state.user.currentUser);
  const route = useRoute<CreateCustomFoodRoute>();
  const navigation = useNavigation<CreateCustomFoodNav>();
  const { contextLabel, date, loggedAt, mealType } = route.params;

  const resolvedLoggedAt = React.useMemo(() => {
    if (loggedAt) {
      return loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(date, now.getHours(), now.getMinutes());
  }, [date, loggedAt]);

  const resolvedContextLabel = React.useMemo(() => {
    const trimmed = contextLabel?.trim();
    if (trimmed) {
      return trimmed;
    }

    return formatFoodLoggedTime(resolvedLoggedAt);
  }, [contextLabel, resolvedLoggedAt]);

  const parsedServing = Number(servingSize);
  const parsedCalories = Number(calories);
  const parsedProtein = Number(protein);
  const parsedCarbs = Number(carbs);
  const parsedFat = Number(fat);

  const createAndAdd = async () => {
    if (!user) {
      Alert.alert("No account found", "Create or restore a user before adding food.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Missing name", "Enter a food name first.");
      return;
    }

    if (
      [parsedServing, parsedCalories, parsedProtein, parsedCarbs, parsedFat].some(
        (value) => Number.isNaN(value) || value < 0,
      ) || parsedServing <= 0
    ) {
      Alert.alert(
        "Invalid numbers",
        "Use positive serving size and non-negative values for the nutrition fields.",
      );
      return;
    }

    const foodId = await DB.saveFoodItem({
      source: "custom",
      sourceId: null,
      barcode: null,
      name: trimmedName,
      brand: null,
      imageUrl: null,
      quantityValue: null,
      quantityUnit: null,
      servingSizeValue: parsedServing,
      servingSizeUnit: "g",
      nutritionBasis: "serving",
      calories: parsedCalories,
      proteinG: parsedProtein,
      carbsG: parsedCarbs,
      fatG: parsedFat,
      fiberG: null,
      sugarG: null,
      saltG: null,
      saturatedFatG: null,
      ingredientsText: null,
      verified: false,
      isComplete: true,
    });

    await DB.addUserFoodLog({
      userExternalId: user.externalId,
      foodId,
      date,
      loggedAt: resolvedLoggedAt,
      quantityG: parsedServing,
      mealType: mealType ?? null,
    });

    navigation.navigate("Diary");
  };

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
            eyebrow="Custom Food"
            title="Create a new item"
            subtitle={`Build a food once, then reuse it instantly inside your diary at ${resolvedContextLabel}.`}
            onBack={() => navigation.goBack()}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <ForkKnifeIcon size={14} color="#9A3412" weight="fill" />
                <Text style={styles.heroPillText}>{resolvedContextLabel}</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{formatFoodShortDate(date)}</Text>
              </View>
              {mealType ? (
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{mealType}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroTitle}>Saved for quick logging</Text>
            <Text style={styles.heroText}>
              This custom food will be added straight into your diary at the
              selected time using the serving size below.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <Text style={styles.sectionSubtitle}>
              Start with the name and the serving you want to log by default.
            </Text>

            <Text style={styles.label}>Food name</Text>
            <TextInput
              style={styles.input}
              placeholder="Chicken rice bowl"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Serving size</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor="#9CA3AF"
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="numeric"
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>g</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Macros</Text>
            <Text style={styles.sectionSubtitle}>
              Enter the nutrition for the serving above.
            </Text>

            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Calories</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <Text style={styles.sectionSubtitle}>
              This is what will be logged into your diary when you tap create.
            </Text>

            <View style={styles.previewStrip}>
              <Text style={styles.previewCalories}>
                {Number.isFinite(parsedCalories) ? parsedCalories.toFixed(0) : "--"} kcal
              </Text>
              <Text style={styles.previewMacros}>
                {Number.isFinite(parsedProtein) ? parsedProtein.toFixed(0) : "--"}P •{" "}
                {Number.isFinite(parsedCarbs) ? parsedCarbs.toFixed(0) : "--"}C •{" "}
                {Number.isFinite(parsedFat) ? parsedFat.toFixed(0) : "--"}F
              </Text>
              <Text style={styles.previewServing}>
                Default log size {Number.isFinite(parsedServing) ? parsedServing.toFixed(0) : "--"} g
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.advancedToggle, pressed && styles.cardPressed]}
            onPress={() => setShowAdvanced((current) => !current)}
          >
            <View>
              <Text style={styles.advancedTitle}>Advanced nutrition</Text>
              <Text style={styles.advancedText}>
                Micronutrient detail support is planned, but not stored in the current local model yet.
              </Text>
            </View>
            {showAdvanced ? (
              <CaretUpIcon size={18} color="#374151" weight="bold" />
            ) : (
              <CaretDownIcon size={18} color="#374151" weight="bold" />
            )}
          </Pressable>

          {showAdvanced ? (
            <View style={styles.advancedPanel}>
              <Text style={styles.advancedPanelText}>
                The custom-food form is focused on the fields the diary currently saves and uses in totals:
                calories, protein, carbs, fat, and serving size.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}
            onPress={() => void createAndAdd()}
          >
            <Text style={styles.primaryButtonText}>Create and add</Text>
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
    top: -92,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "#FED7AA",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#FDE68A",
    opacity: 0.26,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 18,
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
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroPillText: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
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
  label: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCell: {
    width: "47%",
  },
  previewStrip: {
    borderRadius: 18,
    backgroundColor: "#111827",
    padding: 16,
  },
  previewCalories: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  previewMacros: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewServing: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 10,
  },
  advancedTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  advancedText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  advancedPanel: {
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
    marginBottom: 16,
  },
  advancedPanelText: {
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  primaryButton: {
    borderRadius: 20,
    backgroundColor: "#111827",
    paddingVertical: 17,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default CreateCustomFoodScreen;
