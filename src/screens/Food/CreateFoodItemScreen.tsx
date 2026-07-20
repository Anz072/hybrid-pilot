import React from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import type { NutritionBasis } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import {
  buildCustomFoodItemInput,
  parseLocalizedNumber,
  toSafeNumber,
} from "./customFoodItem";
import FoodScreenHeader from "./FoodScreenHeader";
import MealBucketSelect, { getInitialMealBucket } from "./MealBucketSelect";
import {
  calculateQuickAddCaloriesFromMacros,
  MEAL_SLOT_LABELS,
  normalizePositiveFoodInput,
} from "./foodUtils";
import { resolveFoodLogContext } from "./foodLogContext";
import { appColors } from "../../theme/colors";
import { sharedStyleValues } from "../../theme/sharedStyles";

type CreateFoodItemRoute = RouteProp<FoodStackParamList, "CreateFoodItem">;
type CreateFoodItemNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "CreateFoodItem">,
  NativeStackNavigationProp<RootStackParamList>
>;

type FoodItemSaveMode = "save" | "save_and_log";

const NUTRITION_BASES: { basis: NutritionBasis; label: string }[] = [
  { basis: "100g", label: "Per 100 g" },
  { basis: "100ml", label: "Per 100 ml" },
  { basis: "serving", label: "Per serving" },
];

const SERVING_UNIT_PRESETS = ["g", "ml", "serving", "piece"];

const getBasisLabel = (basis: NutritionBasis) =>
  NUTRITION_BASES.find((option) => option.basis === basis)?.label ??
  "Per serving";

const getFoodItemDraftSignature = ({
  barcode,
  basis,
  brand,
  calories,
  carbs,
  fat,
  fiber,
  isCaloriesManuallySet,
  name,
  protein,
  salt,
  saturatedFat,
  servingUnit,
  servingValue,
  sugar,
}: {
  barcode: string;
  basis: NutritionBasis;
  brand: string;
  calories: string;
  carbs: string;
  fat: string;
  fiber: string;
  isCaloriesManuallySet: boolean;
  name: string;
  protein: string;
  salt: string;
  saturatedFat: string;
  servingUnit: string;
  servingValue: string;
  sugar: string;
}) =>
  JSON.stringify({
    barcode: barcode.trim(),
    basis,
    brand: brand.trim(),
    calories: calories.trim(),
    carbs: carbs.trim(),
    fat: fat.trim(),
    fiber: fiber.trim(),
    isCaloriesManuallySet,
    name: name.trim(),
    protein: protein.trim(),
    salt: salt.trim(),
    saturatedFat: saturatedFat.trim(),
    servingUnit: servingUnit.trim(),
    servingValue: servingValue.trim(),
    sugar: sugar.trim(),
  });

const CreateFoodItemScreen = () => {
  const route = useRoute<CreateFoodItemRoute>();
  const navigation = useNavigation<CreateFoodItemNav>();
  const insets = useSafeAreaInsets();
  const { barcode, contextLabel, date, loggedAt, mealType, prefillName } =
    route.params;
  const [selectedMeal, setSelectedMeal] = React.useState(() =>
    getInitialMealBucket(mealType),
  );

  const [name, setName] = React.useState(prefillName?.trim() ?? "");
  const [brand, setBrand] = React.useState("");
  const [barcodeValue, setBarcodeValue] = React.useState(barcode?.trim() ?? "");
  const [basis, setBasis] = React.useState<NutritionBasis>("100g");
  const [servingValue, setServingValue] = React.useState("1");
  const [servingUnit, setServingUnit] = React.useState("serving");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("0");
  const [carbs, setCarbs] = React.useState("0");
  const [fat, setFat] = React.useState("0");
  const [isCaloriesManuallySet, setIsCaloriesManuallySet] =
    React.useState(false);
  const [fiber, setFiber] = React.useState("");
  const [sugar, setSugar] = React.useState("");
  const [saturatedFat, setSaturatedFat] = React.useState("");
  const [salt, setSalt] = React.useState("");
  const [showMoreNutrients, setShowMoreNutrients] = React.useState(false);
  const [saveMode, setSaveMode] = React.useState<FoodItemSaveMode | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const bypassUnsavedGuardRef = React.useRef(false);
  const initialDraftSignatureRef = React.useRef<string | null>(null);
  // Synchronous lock: state-based disabling applies only after a re-render, so
  // a fast double-tap could otherwise save twice.
  const savingRef = React.useRef(false);
  const saving = saveMode != null;

  const user = useAppSelector((state) => state.user.currentUser);
  const foodLogContext = React.useMemo(
    () =>
      resolveFoodLogContext({
        contextLabel,
        date,
        loggedAt,
        mealType,
      }),
    [contextLabel, date, loggedAt, mealType],
  );

  const parsedProtein = React.useMemo(
    () => parseLocalizedNumber(protein),
    [protein],
  );
  const parsedCarbs = React.useMemo(() => parseLocalizedNumber(carbs), [carbs]);
  const parsedFat = React.useMemo(() => parseLocalizedNumber(fat), [fat]);
  const macroCalculatedCalories = React.useMemo(
    () =>
      calculateQuickAddCaloriesFromMacros({
        proteinG: parsedProtein,
        carbsG: parsedCarbs,
        fatG: parsedFat,
      }),
    [parsedCarbs, parsedFat, parsedProtein],
  );
  const displayedCaloriesValue = isCaloriesManuallySet
    ? calories
    : macroCalculatedCalories > 0
      ? String(macroCalculatedCalories)
      : "";
  const resolvedCalories = React.useMemo(
    () => toSafeNumber(displayedCaloriesValue),
    [displayedCaloriesValue],
  );
  const requiredCaloriesFallback = React.useMemo(() => {
    const parsedCalories = toSafeNumber(calories);

    if (parsedCalories > 0) {
      return parsedCalories;
    }

    if (macroCalculatedCalories > 0) {
      return macroCalculatedCalories;
    }

    return 1;
  }, [calories, macroCalculatedCalories]);
  const caloriesHelperText = isCaloriesManuallySet
    ? `System calculates ${macroCalculatedCalories.toFixed(0)} kcal from macros.`
    : `Macro sum is ${macroCalculatedCalories.toFixed(0)} kcal.`;

  const currentDraftSignature = React.useMemo(
    () =>
      getFoodItemDraftSignature({
        barcode: barcodeValue,
        basis,
        brand,
        calories,
        carbs,
        fat,
        fiber,
        isCaloriesManuallySet,
        name,
        protein,
        salt,
        saturatedFat,
        servingUnit,
        servingValue,
        sugar,
      }),
    [
      barcodeValue,
      basis,
      brand,
      calories,
      carbs,
      fat,
      fiber,
      isCaloriesManuallySet,
      name,
      protein,
      salt,
      saturatedFat,
      servingUnit,
      servingValue,
      sugar,
    ],
  );

  React.useEffect(() => {
    if (initialDraftSignatureRef.current) {
      return;
    }

    initialDraftSignatureRef.current = currentDraftSignature;
  }, [currentDraftSignature]);

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
        Alert.alert("Discard new food?", "Unsaved food details will be lost.", [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              bypassUnsavedGuardRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ]);
      }),
    [isDirty, navigation, saving],
  );

  const handleServingValueBlur = React.useCallback(() => {
    setFormError(null);
    setServingValue((current) => normalizePositiveFoodInput(current, 1));
  }, []);

  const handleCaloriesBlur = React.useCallback(() => {
    setFormError(null);
    if (isCaloriesManuallySet) {
      setCalories((current) =>
        normalizePositiveFoodInput(current, requiredCaloriesFallback, 0),
      );
      return;
    }

    if (macroCalculatedCalories <= 0) {
      setCalories(normalizePositiveFoodInput("", requiredCaloriesFallback, 0));
      setIsCaloriesManuallySet(true);
    }
  }, [
    isCaloriesManuallySet,
    macroCalculatedCalories,
    requiredCaloriesFallback,
  ]);

  const handleCancel = React.useCallback(() => {
    if (saving) {
      return;
    }

    navigation.goBack();
  }, [navigation, saving]);

  const handleSave = React.useCallback(
    async (mode: FoodItemSaveMode = "save") => {
      if (savingRef.current) {
        return;
      }

      if (!user) {
        Alert.alert(
          "No account found",
          "Create or restore a user before saving foods.",
        );
        return;
      }

      setFormError(null);
      const buildResult = buildCustomFoodItemInput({
        name,
        brand,
        barcode: barcodeValue,
        basis,
        servingValue,
        servingUnit,
        calories: resolvedCalories,
        proteinG: parsedProtein,
        carbsG: parsedCarbs,
        fatG: parsedFat,
        fiber,
        sugar,
        saturatedFat,
        salt,
      });

      if (buildResult.error != null) {
        setFormError(buildResult.error);
        return;
      }

      savingRef.current = true;

      try {
        setSaveMode(mode);

        const normalizedBarcode = buildResult.input.barcode;
        if (normalizedBarcode) {
          // saveFoodItem silently merges into an existing food with the same
          // barcode, which would discard or overwrite this form. Best-effort:
          // if the lookup fails, let the save proceed.
          let existingFood = null;
          try {
            existingFood = await DB.getFoodItemByBarcode(normalizedBarcode);
          } catch {
            existingFood = null;
          }

          if (existingFood) {
            setFormError(
              `Barcode ${normalizedBarcode} already belongs to "${existingFood.name}". Scan or search for it instead, or change the barcode.`,
            );
            return;
          }
        }

        const foodId = await DB.saveFoodItem(buildResult.input);

        bypassUnsavedGuardRef.current = true;

        if (mode === "save_and_log") {
          navigation.replace("ScannedFood", {
            foodId,
            date,
            mealType: MEAL_SLOT_LABELS[selectedMeal],
            loggedAt: foodLogContext.loggedAt,
            contextLabel: MEAL_SLOT_LABELS[selectedMeal],
            barcode: buildResult.input.barcode,
            scanStatus: "created",
          });
          return;
        }

        navigation.goBack();
      } catch (error) {
        bypassUnsavedGuardRef.current = false;
        Alert.alert(
          "Could not save food",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        savingRef.current = false;
        setSaveMode(null);
      }
    },
    [
      barcodeValue,
      basis,
      brand,
      date,
      fiber,
      foodLogContext.contextLabel,
      foodLogContext.loggedAt,
      name,
      navigation,
      parsedCarbs,
      parsedFat,
      parsedProtein,
      resolvedCalories,
      selectedMeal,
      salt,
      saturatedFat,
      servingUnit,
      servingValue,
      sugar,
      user,
    ],
  );

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(176, insets.bottom + 152) },
          ]}
          focusedInputBottomOffset={132}
        >
          <FoodScreenHeader
            eyebrow="Custom Food"
            title="Create food"
            subtitle={foodLogContext.dateLabel}
            onBack={() => navigation.goBack()}
          />
          <MealBucketSelect
            disabled={saving}
            onChange={setSelectedMeal}
            style={styles.mealBucketSelect}
            value={selectedMeal}
          />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Food Details</Text>
            <Text style={styles.sectionSubtitle}>
              Save the name and brand so this food is easy to find in search
              later.
            </Text>

            <Text style={styles.fieldLabel}>Food name</Text>
            <TextInput
              style={styles.input}
              placeholder="Greek yogurt 2%"
              placeholderTextColor={appColors.textMuted}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setFormError(null);
              }}
              autoFocus={!prefillName}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
              Brand (optional)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Brand or store name"
              placeholderTextColor={appColors.textMuted}
              value={brand}
              onChangeText={(value) => {
                setBrand(value);
                setFormError(null);
              }}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
              Barcode (optional)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 737628064502"
              placeholderTextColor={appColors.textMuted}
              value={barcodeValue}
              onChangeText={(value) => {
                setBarcodeValue(value);
                setFormError(null);
              }}
              keyboardType="number-pad"
            />
            <Text style={styles.helperText}>
              Add the EAN or UPC digits so scanning the package finds this food
              next time.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nutrition Basis</Text>
            <Text style={styles.sectionSubtitle}>
              Pick what the nutrition values below describe.
            </Text>
            <View style={styles.presetRow}>
              {NUTRITION_BASES.map((option) => {
                const selected = option.basis === basis;
                return (
                  <Pressable
                    key={option.basis}
                    onPress={() => {
                      setBasis(option.basis);
                      setFormError(null);
                    }}
                    style={({ pressed }) => [
                      styles.presetChip,
                      selected && styles.presetChipSelected,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        selected && styles.presetChipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {basis === "serving" ? (
              <>
                <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
                  Serving size
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={appColors.textMuted}
                    value={servingValue}
                    onChangeText={(value) => {
                      setServingValue(value);
                      setFormError(null);
                    }}
                    onBlur={handleServingValueBlur}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.unitInput]}
                    placeholder="serving"
                    placeholderTextColor={appColors.textMuted}
                    value={servingUnit}
                    onChangeText={(value) => {
                      setServingUnit(value);
                      setFormError(null);
                    }}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.presetRow}>
                  {SERVING_UNIT_PRESETS.map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        setServingUnit(unit);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.presetChip,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text style={styles.presetChipText}>{unit}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Nutrition {getBasisLabel(basis)}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Copy the values from the label for the basis picked above.
            </Text>
            <View style={styles.mainCell}>
              <Text style={styles.fieldLabel}>Calories</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={appColors.textMuted}
                value={displayedCaloriesValue}
                onChangeText={(value) => {
                  setCalories(value);
                  setIsCaloriesManuallySet(value.trim().length > 0);
                  setFormError(null);
                }}
                onBlur={handleCaloriesBlur}
                keyboardType="decimal-pad"
              />
              <Text style={styles.helperText}>{caloriesHelperText}</Text>
              {isCaloriesManuallySet && macroCalculatedCalories > 0 ? (
                <Pressable
                  onPress={() => {
                    setCalories("");
                    setIsCaloriesManuallySet(false);
                    setFormError(null);
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
            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.textMuted}
                  value={protein}
                  onChangeText={(value) => {
                    setProtein(value);
                    setFormError(null);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.textMuted}
                  value={carbs}
                  onChangeText={(value) => {
                    setCarbs(value);
                    setFormError(null);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={appColors.textMuted}
                  value={fat}
                  onChangeText={(value) => {
                    setFat(value);
                    setFormError(null);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Pressable
              onPress={() => setShowMoreNutrients((current) => !current)}
              style={({ pressed }) => [
                styles.inlineQuietButton,
                styles.moreNutrientsToggle,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.inlineQuietButtonText}>
                {showMoreNutrients ? "Hide extra nutrients" : "More nutrients"}
              </Text>
            </Pressable>

            {showMoreNutrients ? (
              <View style={styles.grid}>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Fiber (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="--"
                    placeholderTextColor={appColors.textMuted}
                    value={fiber}
                    onChangeText={(value) => {
                      setFiber(value);
                      setFormError(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Sugar (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="--"
                    placeholderTextColor={appColors.textMuted}
                    value={sugar}
                    onChangeText={(value) => {
                      setSugar(value);
                      setFormError(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Sat. fat (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="--"
                    placeholderTextColor={appColors.textMuted}
                    value={saturatedFat}
                    onChangeText={(value) => {
                      setSaturatedFat(value);
                      setFormError(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Salt (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="--"
                    placeholderTextColor={appColors.textMuted}
                    value={salt}
                    onChangeText={(value) => {
                      setSalt(value);
                      setFormError(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            ) : null}
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </KeyboardAwareScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.footerRow}>
            <Pressable
              onPress={handleCancel}
              disabled={saving}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.footerButton,
                saving && styles.disabled,
                pressed && !saving && styles.cardPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleSave("save");
              }}
              disabled={saving}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.footerButton,
                saving && styles.disabled,
                pressed && !saving && styles.cardPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {saving && saveMode === "save" ? "Saving..." : "Save only"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              void handleSave("save_and_log");
            }}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabled,
              pressed && !saving && styles.cardPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {saving && saveMode === "save_and_log"
                ? "Saving and logging..."
                : "Save and log"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: sharedStyleValues.screen,
  content: {
    ...sharedStyleValues.content,
    paddingBottom: 36,
  },
  card: sharedStyleValues.card,
  mealBucketSelect: {
    marginBottom: 16,
  },
  sectionTitle: sharedStyleValues.sectionTitle,
  sectionSubtitle: sharedStyleValues.sectionSubtitle,
  fieldLabel: sharedStyleValues.fieldLabel,
  fieldLabelSpacing: sharedStyleValues.fieldLabelSpacing,
  inputRow: sharedStyleValues.inputRow,
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  unitInput: {
    flex: 0,
    minWidth: 104,
  },
  helperText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  formError: {
    color: appColors.danger700,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  inlineQuietButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  inlineQuietButtonText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "600",
  },
  moreNutrientsToggle: {
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipSelected: {
    backgroundColor: appColors.actionPrimarySoft,
    borderColor: appColors.actionPrimaryBorder,
  },
  presetChipText: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  presetChipTextSelected: {
    color: appColors.actionPrimaryPressed,
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mainCell: {
    width: "65%",
  },
  gridCell: {
    width: "30%",
  },
  footer: {
    ...sharedStyleValues.footer,
    gap: 8,
    marginBottom: 16,
  },
  footerRow: sharedStyleValues.footerRow,
  footerButton: sharedStyleValues.footerButton,
  secondaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.secondaryButton,
    paddingVertical: 12,
  },
  secondaryButtonText: sharedStyleValues.secondaryButtonText,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.lightPrimaryButton,
    paddingVertical: 12,
  },
  primaryButtonText: sharedStyleValues.warningPrimaryButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default CreateFoodItemScreen;
