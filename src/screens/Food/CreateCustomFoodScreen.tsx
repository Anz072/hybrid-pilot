import React from "react";
import {
  StackActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CalendarIcon,
  CaretDownIcon,
  CaretUpIcon,
  ForkKnifeIcon,
} from "phosphor-react-native";
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
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodNutrientDetails } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodShortDate,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

type CreateCustomFoodRoute = RouteProp<FoodStackParamList, "CreateCustomFood">;
type CreateCustomFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "CreateCustomFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

type OptionalNutrientInputValues = Partial<
  Record<keyof DBFoodNutrientDetails, string>
>;

type NutrientField = {
  key: keyof DBFoodNutrientDetails;
  label: string;
  unit: string;
};

const OPTIONAL_NUTRIENT_SECTIONS: Array<{
  title: string;
  fields: NutrientField[];
}> = [
  {
    title: "Macros + extras",
    fields: [
      { key: "fiberG", label: "Fiber", unit: "g" },
      { key: "sugarG", label: "Sugar", unit: "g" },
      { key: "addedSugarsG", label: "Added sugars", unit: "g" },
      { key: "waterG", label: "Water", unit: "g" },
      { key: "alcoholG", label: "Alcohol", unit: "g" },
    ],
  },
  {
    title: "Fats",
    fields: [
      { key: "fatSaturatedG", label: "Saturated fat", unit: "g" },
      { key: "fatMonounsaturatedG", label: "Monounsaturated fat", unit: "g" },
      { key: "fatPolyunsaturatedG", label: "Polyunsaturated fat", unit: "g" },
      { key: "fatTransG", label: "Trans fat", unit: "g" },
      { key: "omega3G", label: "Omega-3", unit: "g" },
      { key: "omega6G", label: "Omega-6", unit: "g" },
      { key: "epaG", label: "EPA", unit: "g" },
      { key: "dhaG", label: "DHA", unit: "g" },
      { key: "alaG", label: "ALA", unit: "g" },
      { key: "linoleicAcidG", label: "Linoleic acid", unit: "g" },
      { key: "alphaLinolenicAcidG", label: "Alpha-linolenic acid", unit: "g" },
      { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
    ],
  },
  {
    title: "Vitamins",
    fields: [
      { key: "vitaminAUg", label: "Vitamin A", unit: "ug" },
      { key: "vitaminCMg", label: "Vitamin C", unit: "mg" },
      { key: "vitaminDUg", label: "Vitamin D", unit: "ug" },
      { key: "vitaminEMg", label: "Vitamin E", unit: "mg" },
      { key: "vitaminKUg", label: "Vitamin K", unit: "ug" },
      { key: "vitaminK1Ug", label: "Vitamin K1", unit: "ug" },
      { key: "vitaminK2Ug", label: "Vitamin K2", unit: "ug" },
      { key: "thiaminB1Mg", label: "Thiamin B1", unit: "mg" },
      { key: "riboflavinB2Mg", label: "Riboflavin B2", unit: "mg" },
      { key: "niacinB3Mg", label: "Niacin B3", unit: "mg" },
      { key: "pantothenicAcidB5Mg", label: "Pantothenic acid B5", unit: "mg" },
      { key: "vitaminB6Mg", label: "Vitamin B6", unit: "mg" },
      { key: "biotinB7Ug", label: "Biotin B7", unit: "ug" },
      { key: "folateB9Ug", label: "Folate B9", unit: "ug" },
      { key: "vitaminB12Ug", label: "Vitamin B12", unit: "ug" },
      { key: "cholineMg", label: "Choline", unit: "mg" },
    ],
  },
  {
    title: "Minerals",
    fields: [
      { key: "calciumMg", label: "Calcium", unit: "mg" },
      { key: "ironMg", label: "Iron", unit: "mg" },
      { key: "magnesiumMg", label: "Magnesium", unit: "mg" },
      { key: "phosphorusMg", label: "Phosphorus", unit: "mg" },
      { key: "potassiumMg", label: "Potassium", unit: "mg" },
      { key: "sodiumMg", label: "Sodium", unit: "mg" },
      { key: "zincMg", label: "Zinc", unit: "mg" },
      { key: "copperMg", label: "Copper", unit: "mg" },
      { key: "manganeseMg", label: "Manganese", unit: "mg" },
      { key: "seleniumUg", label: "Selenium", unit: "ug" },
      { key: "iodineUg", label: "Iodine", unit: "ug" },
      { key: "chromiumUg", label: "Chromium", unit: "ug" },
      { key: "molybdenumUg", label: "Molybdenum", unit: "ug" },
    ],
  },
  {
    title: "Amino acids",
    fields: [
      { key: "histidineG", label: "Histidine", unit: "g" },
      { key: "isoleucineG", label: "Isoleucine", unit: "g" },
      { key: "leucineG", label: "Leucine", unit: "g" },
      { key: "lysineG", label: "Lysine", unit: "g" },
      { key: "methionineG", label: "Methionine", unit: "g" },
      { key: "phenylalanineG", label: "Phenylalanine", unit: "g" },
      { key: "threonineG", label: "Threonine", unit: "g" },
      { key: "tryptophanG", label: "Tryptophan", unit: "g" },
      { key: "valineG", label: "Valine", unit: "g" },
      { key: "alanineG", label: "Alanine", unit: "g" },
      { key: "arginineG", label: "Arginine", unit: "g" },
      { key: "asparticAcidG", label: "Aspartic acid", unit: "g" },
      { key: "cysteineG", label: "Cysteine", unit: "g" },
      { key: "glutamicAcidG", label: "Glutamic acid", unit: "g" },
      { key: "glycineG", label: "Glycine", unit: "g" },
      { key: "prolineG", label: "Proline", unit: "g" },
      { key: "serineG", label: "Serine", unit: "g" },
      { key: "tyrosineG", label: "Tyrosine", unit: "g" },
    ],
  },
  {
    title: "Other",
    fields: [
      { key: "caffeineMg", label: "Caffeine", unit: "mg" },
      { key: "betaineMg", label: "Betaine", unit: "mg" },
      { key: "luteinZeaxanthinUg", label: "Lutein + zeaxanthin", unit: "ug" },
    ],
  },
];

const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

const formatPreviewNumber = (
  value: number,
  suffix = "",
  empty = "--",
): string => (Number.isFinite(value) ? `${value.toFixed(0)}${suffix}` : empty);

const CreateCustomFoodScreen = () => {
  const [name, setName] = React.useState("");
  const [servingSize, setServingSize] = React.useState("100");
  const [calories, setCalories] = React.useState("0");
  const [protein, setProtein] = React.useState("0");
  const [carbs, setCarbs] = React.useState("0");
  const [fat, setFat] = React.useState("0");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [optionalNutrients, setOptionalNutrients] =
    React.useState<OptionalNutrientInputValues>({});

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

  const trimmedName = name.trim();
  const trimmedMealType = mealType?.trim() || null;
  const parsedServing = React.useMemo(
    () => parseLocalizedNumber(servingSize),
    [servingSize],
  );
  const parsedCalories = React.useMemo(
    () => parseLocalizedNumber(calories),
    [calories],
  );
  const parsedProtein = React.useMemo(
    () => parseLocalizedNumber(protein),
    [protein],
  );
  const parsedCarbs = React.useMemo(() => parseLocalizedNumber(carbs), [carbs]);
  const parsedFat = React.useMemo(() => parseLocalizedNumber(fat), [fat]);

  const updateOptionalNutrient = React.useCallback(
    (key: keyof DBFoodNutrientDetails, value: string) => {
      setOptionalNutrients((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const parseOptionalNutrients = React.useCallback(() => {
    const parsed: Partial<DBFoodNutrientDetails> = {};

    for (const section of OPTIONAL_NUTRIENT_SECTIONS) {
      for (const field of section.fields) {
        const rawValue = optionalNutrients[field.key]?.trim();

        if (!rawValue) {
          continue;
        }

        const numericValue = parseLocalizedNumber(rawValue);

        if (!Number.isFinite(numericValue) || numericValue < 0) {
          return {
            error: `${field.label} must be a non-negative number.`,
            values: null,
          };
        }

        parsed[field.key] = numericValue;
      }
    }

    return {
      error: null,
      values: parsed,
    };
  }, [optionalNutrients]);

  const createAndAdd = React.useCallback(async () => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

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
        "Use a positive serving size and non-negative values for the nutrition fields.",
      );
      return;
    }

    const parsedOptionalNutrients = parseOptionalNutrients();
    if (parsedOptionalNutrients.error || !parsedOptionalNutrients.values) {
      Alert.alert(
        "Invalid optional nutrient",
        parsedOptionalNutrients.error ?? "Check the advanced nutrition values.",
      );
      return;
    }

    try {
      setCreating(true);

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
        saltG: null,
        ...parsedOptionalNutrients.values,
        saturatedFatG:
          parsedOptionalNutrients.values.saturatedFatG ??
          parsedOptionalNutrients.values.fatSaturatedG ??
          null,
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

      const routes = navigation.getState().routes;
      const previousRoute = routes[routes.length - 2];

      if (previousRoute?.name === "AddFood" && routes.length >= 2) {
        navigation.dispatch(StackActions.pop(2));
        return;
      }

      navigation.goBack();
    } finally {
      setCreating(false);
    }
  }, [
    date,
    mealType,
    navigation,
    parseOptionalNutrients,
    parsedCalories,
    parsedCarbs,
    parsedFat,
    parsedProtein,
    parsedServing,
    resolvedLoggedAt,
    trimmedName,
    user,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <FoodScreenHeader
            eyebrow="Custom Food"
            title="Create custom food"
            subtitle={`${formatFoodShortDate(date)} | ${resolvedContextLabel}`}
            onBack={() => navigation.goBack()}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroHeaderCopy}>
              <Text style={styles.heroEyebrow}>Quick Create</Text>
              <Text style={styles.heroTitle}>
                {trimmedName || "New custom food"}
              </Text>
              <Text style={styles.heroMeta}>
                Save it once, then drop it straight into your diary using the
                serving below.
              </Text>
            </View>

            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <ForkKnifeIcon size={14} color={appColors.foodPrimary} weight="fill" />
                <Text style={styles.pillText}>{resolvedContextLabel}</Text>
              </View>
              <View style={styles.pill}>
                <CalendarIcon size={14} color={appColors.foodPrimary} weight="bold" />
                <Text style={styles.pillText}>{formatFoodShortDate(date)}</Text>
              </View>
              {trimmedMealType ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{trimmedMealType}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.previewStrip}>
              <Text style={styles.previewValue}>
                {formatPreviewNumber(parsedCalories, " kcal")}
              </Text>
              <Text style={styles.previewText}>
                {`${formatFoodMacro(parsedProtein, "P")} | ${formatFoodMacro(
                  parsedCarbs,
                  "C",
                )} | ${formatFoodMacro(parsedFat, "F")}`}
              </Text>
              <Text style={styles.previewSubtext}>
                Default log size {formatPreviewNumber(parsedServing, " g")}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Food Details</Text>
            <Text style={styles.sectionSubtitle}>
              Start with the saved name and the amount you want logged by
              default.
            </Text>

            <Text style={styles.fieldLabel}>Food name</Text>
            <TextInput
              style={styles.input}
              placeholder="Chicken rice bowl"
              placeholderTextColor={appColors.foodPlaceholder}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
              Default serving
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor={appColors.foodPlaceholder}
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="decimal-pad"
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitText}>g</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Core Nutrition</Text>
            <Text style={styles.sectionSubtitle}>
              Enter the nutrition for that serving.
            </Text>

            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Calories</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.foodPlaceholder}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.foodPlaceholder}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.foodPlaceholder}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.foodPlaceholder}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => setShowAdvanced((current) => !current)}
            style={({ pressed }) => [
              styles.card,
              styles.advancedToggle,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.advancedToggleCopy}>
              <Text style={styles.sectionTitle}>Advanced Nutrition</Text>
              <Text style={styles.advancedToggleText}>
                Optional micronutrients and detailed fats for the same serving.
              </Text>
            </View>
            {showAdvanced ? (
              <CaretUpIcon size={18} color={appColors.foodInk} weight="bold" />
            ) : (
              <CaretDownIcon size={18} color={appColors.foodInk} weight="bold" />
            )}
          </Pressable>

          {showAdvanced ? (
            <View style={styles.card}>
              <Text style={styles.advancedIntro}>
                Leave anything blank if you do not know it. Calories and macros
                above are the only required nutrition fields.
              </Text>
              {OPTIONAL_NUTRIENT_SECTIONS.map((section) => (
                <View key={section.title} style={styles.advancedGroup}>
                  <Text style={styles.advancedGroupTitle}>{section.title}</Text>
                  <View style={styles.grid}>
                    {section.fields.map((field) => (
                      <View key={field.key} style={styles.gridCell}>
                        <Text style={styles.fieldLabel}>
                          {field.label} ({field.unit})
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Optional"
                          placeholderTextColor={appColors.foodPlaceholder}
                          value={optionalNutrients[field.key] ?? ""}
                          onChangeText={(value) =>
                            updateOptionalNutrient(field.key, value)
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              void createAndAdd();
            }}
            disabled={creating}
            style={({ pressed }) => [
              styles.primaryButton,
              creating && styles.disabled,
              pressed && !creating && styles.cardPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {creating ? "Creating..." : "Create and add"}
            </Text>
          </Pressable>
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
  heroCard: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  heroHeaderCopy: {
    marginBottom: 10,
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
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    color: appColors.foodPrimary,
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
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.foodPreviewText,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  previewSubtext: {
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
  fieldLabelSpacing: {
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
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
  unitPill: {
    borderRadius: 8,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitText: {
    color: appColors.foodPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridCell: {
    width: "47%",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  advancedToggleCopy: {
    flex: 1,
  },
  advancedToggleText: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  advancedIntro: {
    color: appColors.foodPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginBottom: 10,
  },
  advancedGroup: {
    marginTop: 6,
    marginBottom: 14,
  },
  advancedGroupTitle: {
    color: appColors.foodText,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
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
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default CreateCustomFoodScreen;
