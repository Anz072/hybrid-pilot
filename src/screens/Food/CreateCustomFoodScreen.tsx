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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import FoodLogContextBar from "./FoodLogContextBar";
import FoodScreenHeader from "./FoodScreenHeader";
import PublicVisibilityCheckbox from "./PublicVisibilityCheckbox";
import {
  calculateQuickAddCaloriesFromMacros,
  formatFoodMacro,
  normalizePositiveFoodInput,
} from "./foodUtils";
import { resolveFoodLogContext } from "./foodLogContext";
import { appColors } from "../../theme/colors";
import { sharedStyleValues } from "../../theme/sharedStyles";

type CreateCustomFoodRoute = RouteProp<FoodStackParamList, "CreateCustomFood">;
type CreateCustomFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "CreateCustomFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

const toSafeNumber = (value: string): number => {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPreviewNumber = (
  value: number,
  suffix = "",
  empty = "--",
): string => (Number.isFinite(value) ? `${value.toFixed(0)}${suffix}` : empty);

const parseMealPayload = (rawPayload: string | null) => {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

type CustomMealSaveMode = "save" | "save_and_add";

const SERVING_PRESETS = [50, 100, 150];

const getCustomMealDraftSignature = ({
  calories,
  carbs,
  description,
  fat,
  isCaloriesManuallySet,
  isPublic,
  name,
  protein,
  servingSize,
}: {
  calories: string;
  carbs: string;
  description: string;
  fat: string;
  isCaloriesManuallySet: boolean;
  isPublic: boolean;
  name: string;
  protein: string;
  servingSize: string;
}) =>
  JSON.stringify({
    calories: calories.trim(),
    carbs: carbs.trim(),
    description: description.trim(),
    fat: fat.trim(),
    isCaloriesManuallySet,
    isPublic,
    name: name.trim(),
    protein: protein.trim(),
    servingSize: servingSize.trim(),
  });

const CreateCustomFoodScreen = () => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [servingSize, setServingSize] = React.useState("100");
  const [calories, setCalories] = React.useState("0");
  const [protein, setProtein] = React.useState("0");
  const [carbs, setCarbs] = React.useState("0");
  const [fat, setFat] = React.useState("0");
  const [isCaloriesManuallySet, setIsCaloriesManuallySet] =
    React.useState(false);
  const [isPublic, setIsPublic] = React.useState(true);
  const [loadedMealOwnerUserId, setLoadedMealOwnerUserId] = React.useState<
    string | null
  >(null);
  const [loadingMeal, setLoadingMeal] = React.useState(false);
  const [mealLoadError, setMealLoadError] = React.useState<string | null>(null);
  const [saveMode, setSaveMode] = React.useState<CustomMealSaveMode | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const bypassUnsavedGuardRef = React.useRef(false);
  const initialDraftSignatureRef = React.useRef<string | null>(null);
  const saving = saveMode != null;

  const user = useAppSelector((state) => state.user.currentUser);
  const route = useRoute<CreateCustomFoodRoute>();
  const navigation = useNavigation<CreateCustomFoodNav>();
  const insets = useSafeAreaInsets();
  const { contextLabel, date, loggedAt, mealType, mealId } = route.params;
  const isEditing = mealId != null;
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
  const resolvedLoggedAt = foodLogContext.loggedAt;

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const trimmedMealType = mealType?.trim() || null;

  const parsedServing = React.useMemo(
    () => parseLocalizedNumber(servingSize),
    [servingSize],
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

  const canEditMeal =
    !isEditing ||
    (user?.externalId != null &&
      loadedMealOwnerUserId != null &&
      loadedMealOwnerUserId === user.externalId);
  const currentDraftSignature = React.useMemo(
    () =>
      getCustomMealDraftSignature({
        calories,
        carbs,
        description,
        fat,
        isCaloriesManuallySet,
        isPublic,
        name,
        protein,
        servingSize,
      }),
    [
      calories,
      carbs,
      description,
      fat,
      isCaloriesManuallySet,
      isPublic,
      name,
      protein,
      servingSize,
    ],
  );

  React.useEffect(() => {
    if (isEditing || initialDraftSignatureRef.current) {
      return;
    }

    initialDraftSignatureRef.current = currentDraftSignature;
  }, [currentDraftSignature, isEditing]);

  const isDirty =
    initialDraftSignatureRef.current != null &&
    initialDraftSignatureRef.current !== currentDraftSignature;

  React.useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (bypassUnsavedGuardRef.current || saving || deleting || !isDirty) {
          return;
        }

        event.preventDefault();
        Alert.alert(
          "Discard custom meal changes?",
          "Unsaved custom meal changes will be lost.",
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
    [deleting, isDirty, navigation, saving],
  );

  React.useEffect(() => {
    let cancelled = false;

    if (!isEditing || mealId == null) {
      setLoadingMeal(false);
      setMealLoadError(null);
      setLoadedMealOwnerUserId(user?.externalId ?? null);
      return () => {
        cancelled = true;
      };
    }

    const loadMeal = async () => {
      try {
        setLoadingMeal(true);
        setMealLoadError(null);

        const meal = await DB.getUserCustomMealFoodById(mealId);

        if (!meal) {
          throw new Error("That custom meal could not be found.");
        }

        const payload = parseMealPayload(meal.rawPayload);
        const ownerUserId =
          typeof payload?.createdByUserExternalId === "string" &&
          payload.createdByUserExternalId.trim()
            ? payload.createdByUserExternalId
            : null;

        if (
          user?.externalId &&
          ownerUserId &&
          ownerUserId !== user.externalId
        ) {
          throw new Error("Only your own custom meals can be edited here.");
        }

        if (cancelled) {
          return;
        }

        const loadedDescription =
          typeof payload?.description === "string" ? payload.description : "";
        const loadedServingSize =
          Number.isFinite(meal.servingSizeValue ?? NaN)
            ? String(meal.servingSizeValue)
            : "100";
        const loadedCalories =
          Number.isFinite(meal.calories ?? NaN) ? String(meal.calories) : "0";
        const loadedProtein =
          Number.isFinite(meal.proteinG ?? NaN) ? String(meal.proteinG) : "0";
        const loadedCarbs =
          Number.isFinite(meal.carbsG ?? NaN) ? String(meal.carbsG) : "0";
        const loadedFat =
          Number.isFinite(meal.fatG ?? NaN) ? String(meal.fatG) : "0";
        const loadedCalculatedCalories = calculateQuickAddCaloriesFromMacros({
          proteinG: meal.proteinG ?? 0,
          carbsG: meal.carbsG ?? 0,
          fatG: meal.fatG ?? 0,
        });
        const loadedIsCaloriesManuallySet =
          Number.isFinite(meal.calories ?? NaN) &&
          (meal.calories ?? 0) > 0 &&
          Math.abs((meal.calories ?? 0) - loadedCalculatedCalories) > 0.5;

        setLoadedMealOwnerUserId(ownerUserId);
        setName(meal.name);
        setDescription(loadedDescription);
        setServingSize(loadedServingSize);
        setCalories(loadedCalories);
        setProtein(loadedProtein);
        setCarbs(loadedCarbs);
        setFat(loadedFat);
        setIsCaloriesManuallySet(loadedIsCaloriesManuallySet);
        setIsPublic(meal.isPublic);
        initialDraftSignatureRef.current = getCustomMealDraftSignature({
          calories: loadedCalories,
          carbs: loadedCarbs,
          description: loadedDescription,
          fat: loadedFat,
          isCaloriesManuallySet: loadedIsCaloriesManuallySet,
          isPublic: meal.isPublic,
          name: meal.name,
          protein: loadedProtein,
          servingSize: loadedServingSize,
        });
      } catch (error) {
        if (!cancelled) {
          setMealLoadError(
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMeal(false);
        }
      }
    };

    void loadMeal();

    return () => {
      cancelled = true;
    };
  }, [isEditing, mealId, user?.externalId]);

  const handleServingBlur = React.useCallback(() => {
    setFormError(null);
    setServingSize((current) => normalizePositiveFoodInput(current, 100));
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

  const closeAfterSave = React.useCallback(
    (mode: CustomMealSaveMode) => {
      if (isEditing || mode === "save") {
        navigation.goBack();
        return;
      }

      const routes = navigation.getState().routes;
      const previousRoute = routes[routes.length - 2];

      if (previousRoute?.name === "AddFood" && routes.length >= 2) {
        navigation.dispatch(StackActions.pop(2));
        return;
      }

      navigation.goBack();
    },
    [isEditing, navigation],
  );

  const handleCancel = React.useCallback(() => {
    if (saving || deleting) {
      return;
    }

    navigation.goBack();
  }, [deleting, navigation, saving]);

  const handleSave = React.useCallback(
    async (mode: CustomMealSaveMode = "save") => {
      if (!user) {
        Alert.alert(
          "No account found",
          "Create or restore a user before saving custom meals.",
        );
        return;
      }

      setFormError(null);
      if (!trimmedName) {
        setFormError("Enter a custom meal name first.");
        return;
      }

      if (
        [parsedServing, resolvedCalories].some(
          (value) => Number.isNaN(value) || value <= 0,
        ) ||
        [parsedProtein, parsedCarbs, parsedFat].some(
          (value) => Number.isNaN(value) || value < 0,
        )
      ) {
        setFormError(
          "Use a positive serving size and calories value. Macros can be zero, but they cannot be negative.",
        );
        return;
      }

      if (isEditing && !canEditMeal) {
        Alert.alert(
          "Custom meal unavailable",
          "Only your own custom meals can be edited here.",
        );
        return;
      }

      try {
        setSaveMode(mode);

        const payload = {
          userExternalId: user.externalId,
          createdByUserExternalId: loadedMealOwnerUserId ?? user.externalId,
          isPublic,
          name: trimmedName,
          description: trimmedDescription || null,
          servingSizeG: parsedServing,
          calories: resolvedCalories,
          proteinG: parsedProtein,
          carbsG: parsedCarbs,
          fatG: parsedFat,
        };

        let mealFood;
        if (isEditing && mealId != null) {
          mealFood = await DB.updateUserCustomMeal({
            mealId,
            ...payload,
          });
        } else {
          mealFood = await DB.createUserCustomMeal(payload);
        }

        if (mode === "save_and_add") {
          await DB.addUserFoodLog({
            userExternalId: user.externalId,
            foodId: mealFood.id,
            date,
            loggedAt: resolvedLoggedAt,
            quantityG: parsedServing,
            mealType: foodLogContext.mealType,
          });
        }

        bypassUnsavedGuardRef.current = true;
        closeAfterSave(mode);
      } catch (error) {
        Alert.alert(
          isEditing
            ? "Could not update custom meal"
            : "Could not save custom meal",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setSaveMode(null);
      }
    },
    [
      canEditMeal,
      closeAfterSave,
      date,
      isEditing,
      isPublic,
      loadedMealOwnerUserId,
      mealId,
      foodLogContext.mealType,
      parsedCarbs,
      parsedFat,
      parsedProtein,
      parsedServing,
      resolvedCalories,
      resolvedLoggedAt,
      trimmedDescription,
      trimmedName,
      user,
    ],
  );

  const handleDeleteMeal = React.useCallback(() => {
    if (!isEditing || mealId == null || deleting || !canEditMeal) {
      return;
    }

    Alert.alert(
      "Delete custom meal?",
      "This removes the saved custom meal and its linked diary shortcut item.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeleting(true);
                await DB.deleteUserCustomMeal(mealId);
                bypassUnsavedGuardRef.current = true;
                navigation.goBack();
              } catch (error) {
                Alert.alert(
                  "Could not delete custom meal",
                  error instanceof Error ? error.message : "Please try again.",
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [canEditMeal, deleting, isEditing, mealId, navigation]);

  const renderEditor = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Meal Details</Text>
        <Text style={styles.sectionSubtitle}>
          Save the name, optional notes, and default serving for this custom
          meal.
        </Text>

        <Text style={styles.fieldLabel}>Meal name</Text>
        <TextInput
          style={styles.input}
          placeholder="Chicken rice bowl"
          placeholderTextColor={appColors.textMuted}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFormError(null);
          }}
          autoFocus={!isEditing}
        />

        <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
          Default serving
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="100"
            placeholderTextColor={appColors.textMuted}
            value={servingSize}
            onChangeText={(value) => {
              setServingSize(value);
              setFormError(null);
            }}
            onBlur={handleServingBlur}
            keyboardType="decimal-pad"
          />
          <View style={styles.unitPill}>
            <Text style={styles.unitText}>g</Text>
          </View>
        </View>
        <View style={styles.presetRow}>
          {SERVING_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => {
                setServingSize(String(preset));
                setFormError(null);
              }}
              style={({ pressed }) => [
                styles.presetChip,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.presetChipText}>{preset}g</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.optionalPanel}>
          <Text style={[styles.fieldLabel, styles.optionalFieldLabel]}>
            Description (optional)
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, styles.optionalInput]}
            placeholder="Optional notes, ingredients, or prep details"
            placeholderTextColor={appColors.textMuted}
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              setFormError(null);
            }}
            multiline
            textAlignVertical="top"
          />
          <PublicVisibilityCheckbox
            checked={isPublic}
            onChange={(value) => {
              setIsPublic(value);
              setFormError(null);
            }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nutrition Per Serving</Text>
        <Text style={styles.sectionSubtitle}>
          Enter the macros for the saved serving size above.
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
      </View>
    </>
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
            eyebrow="Custom Meal"
            title={isEditing ? "Edit custom meal" : "Create custom meal"}
            subtitle={isEditing ? "Library item" : foodLogContext.subtitle}
            onBack={() => navigation.goBack()}
          />
          {!isEditing ? <FoodLogContextBar context={foodLogContext} /> : null}

          {loadingMeal ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Loading custom meal</Text>
              <Text style={styles.sectionSubtitle}>
                Pulling the saved meal details into the editor.
              </Text>
            </View>
          ) : mealLoadError ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Custom meal unavailable</Text>
              <Text style={styles.sectionSubtitle}>{mealLoadError}</Text>
            </View>
          ) : (
            <>
              {renderEditor()}
              {formError ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}
            </>
          )}
        </KeyboardAwareScrollView>

        {!loadingMeal && !mealLoadError ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {isEditing && canEditMeal ? (
              <Pressable
                onPress={handleDeleteMeal}
                disabled={deleting || saving}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.deleteButton,
                  (deleting || saving) && styles.disabled,
                  pressed && !deleting && !saving && styles.cardPressed,
                ]}
              >
                <Text
                  style={[styles.secondaryButtonText, styles.deleteButtonText]}
                >
                  {deleting ? "Deleting..." : "Delete custom meal"}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.footerRow}>
              <Pressable
                onPress={handleCancel}
                disabled={saving || deleting}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.footerButton,
                  (saving || deleting) && styles.disabled,
                  pressed && !saving && !deleting && styles.cardPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleSave("save");
                }}
                disabled={saving || deleting}
                style={({ pressed }) => [
                  isEditing ? styles.primaryButton : styles.secondaryButton,
                  styles.footerButton,
                  (saving || deleting) && styles.disabled,
                  pressed && !saving && !deleting && styles.cardPressed,
                ]}
              >
                <Text
                  style={
                    isEditing
                      ? styles.primaryButtonText
                      : styles.secondaryButtonText
                  }
                >
                  {saving && saveMode === "save"
                    ? isEditing
                      ? "Saving changes..."
                      : "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Save only"}
                </Text>
              </Pressable>
            </View>

            {!isEditing ? (
              <Pressable
                onPress={() => {
                  void handleSave("save_and_add");
                }}
                disabled={saving || deleting}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (saving || deleting) && styles.disabled,
                  pressed && !saving && !deleting && styles.cardPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving && saveMode === "save_and_add"
                    ? "Saving and adding..."
                    : "Save and add"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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
  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    opacity: 0.38,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.success700,
    opacity: 0.34,
  },
  heroCard: sharedStyleValues.card,
  heroHeaderCopy: {
    marginBottom: 10,
  },
  heroEyebrow: sharedStyleValues.eyebrow,
  heroTitle: sharedStyleValues.heroTitleLarge,
  heroMeta: sharedStyleValues.metaText,
  pillRow: sharedStyleValues.pillRow,
  pill: sharedStyleValues.pill,
  pillText: sharedStyleValues.pillText,
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  previewValue: {
    color: appColors.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.brand300,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  previewSubtext: {
    color: appColors.brand300,
    fontSize: 12,
    lineHeight: 16,
  },
  card: sharedStyleValues.card,
  sectionTitle: sharedStyleValues.sectionTitle,
  sectionSubtitle: sharedStyleValues.sectionSubtitle,
  fieldLabel: sharedStyleValues.fieldLabel,
  fieldLabelSpacing: sharedStyleValues.fieldLabelSpacing,
  inputRow: sharedStyleValues.inputRow,
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 96,
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
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 10,
  },
  inlineQuietButtonText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  optionalPanel: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  optionalFieldLabel: {
    color: appColors.textMuted,
  },
  optionalInput: {
    backgroundColor: appColors.surfaceCard,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  presetChipText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  unitPill: {
    ...sharedStyleValues.unitPillRound,
  },
  unitText: {
    ...sharedStyleValues.unitText,
    fontSize: 12,
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
    marginBottom: 16
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
  deleteButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  deleteButtonText: {
    color: appColors.danger700,
  },
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default CreateCustomFoodScreen;
