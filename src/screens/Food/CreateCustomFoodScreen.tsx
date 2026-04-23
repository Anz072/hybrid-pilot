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
import {
  CalendarIcon,
  ForkKnifeIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import FoodScreenHeader from "./FoodScreenHeader";
import PublicVisibilityCheckbox from "./PublicVisibilityCheckbox";
import {
  buildFoodLoggedAt,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodShortDate,
  normalizePositiveFoodInput,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

type CreateCustomFoodRoute = RouteProp<FoodStackParamList, "CreateCustomFood">;
type CreateCustomFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "CreateCustomFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

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

const CreateCustomFoodScreen = () => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [servingSize, setServingSize] = React.useState("100");
  const [calories, setCalories] = React.useState("0");
  const [protein, setProtein] = React.useState("0");
  const [carbs, setCarbs] = React.useState("0");
  const [fat, setFat] = React.useState("0");
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
  const saving = saveMode != null;

  const user = useAppSelector((state) => state.user.currentUser);
  const route = useRoute<CreateCustomFoodRoute>();
  const navigation = useNavigation<CreateCustomFoodNav>();
  const insets = useSafeAreaInsets();
  const { contextLabel, date, loggedAt, mealType, mealId } = route.params;
  const isEditing = mealId != null;

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
  const trimmedDescription = description.trim();
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

  const canEditMeal =
    !isEditing ||
    (user?.externalId != null &&
      loadedMealOwnerUserId != null &&
      loadedMealOwnerUserId === user.externalId);

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

        setLoadedMealOwnerUserId(ownerUserId);
        setName(meal.name);
        setDescription(
          typeof payload?.description === "string" ? payload.description : "",
        );
        setServingSize(
          Number.isFinite(meal.servingSizeValue ?? NaN)
            ? String(meal.servingSizeValue)
            : "100",
        );
        setCalories(
          Number.isFinite(meal.calories ?? NaN) ? String(meal.calories) : "0",
        );
        setProtein(
          Number.isFinite(meal.proteinG ?? NaN) ? String(meal.proteinG) : "0",
        );
        setCarbs(
          Number.isFinite(meal.carbsG ?? NaN) ? String(meal.carbsG) : "0",
        );
        setFat(Number.isFinite(meal.fatG ?? NaN) ? String(meal.fatG) : "0");
        setIsPublic(meal.isPublic);
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
    setServingSize((current) => normalizePositiveFoodInput(current, 100));
  }, []);

  const handleCaloriesBlur = React.useCallback(() => {
    setCalories((current) => normalizePositiveFoodInput(current, 1, 0));
  }, []);

  const closeAfterSave = React.useCallback((mode: CustomMealSaveMode) => {
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
  }, [isEditing, navigation]);

  const handleCancel = React.useCallback(() => {
    if (saving || deleting) {
      return;
    }

    navigation.goBack();
  }, [deleting, navigation, saving]);

  const handleSave = React.useCallback(async (mode: CustomMealSaveMode = "save") => {
    if (!user) {
      Alert.alert(
        "No account found",
        "Create or restore a user before saving custom meals.",
      );
      return;
    }

    if (!trimmedName) {
      Alert.alert("Missing name", "Enter a custom meal name first.");
      return;
    }

    if (
      [parsedServing, parsedCalories].some(
        (value) => Number.isNaN(value) || value <= 0,
      ) ||
      [parsedProtein, parsedCarbs, parsedFat].some(
        (value) => Number.isNaN(value) || value < 0,
      )
    ) {
      Alert.alert(
        "Invalid numbers",
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
        calories: parsedCalories,
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
          mealType: mealType ?? null,
        });
      }

      closeAfterSave(mode);
    } catch (error) {
      Alert.alert(
        isEditing ? "Could not update custom meal" : "Could not save custom meal",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaveMode(null);
    }
  }, [
    canEditMeal,
    closeAfterSave,
    date,
    isEditing,
    isPublic,
    loadedMealOwnerUserId,
    mealId,
    mealType,
    parsedCalories,
    parsedCarbs,
    parsedFat,
    parsedProtein,
    parsedServing,
    resolvedLoggedAt,
    trimmedDescription,
    trimmedName,
    user,
  ]);

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
      <View style={styles.heroCard}>
        <View style={styles.heroHeaderCopy}>
          <Text style={styles.heroEyebrow}>
            {isEditing ? "Saved custom meal" : "Quick custom meal"}
          </Text>
          <Text style={styles.heroTitle}>
            {trimmedName || (isEditing ? "Edit custom meal" : "New custom meal")}
          </Text>
          <Text style={styles.heroMeta}>
            {isEditing
              ? "Update the meal once and the saved version stays in sync everywhere it appears."
              : "Save a reusable custom meal for later or Save and Add this serving to your diary right away."}
          </Text>
        </View>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <ForkKnifeIcon size={14} color={appColors.brand500} weight="fill" />
            <Text style={styles.pillText}>{resolvedContextLabel}</Text>
          </View>
          <View style={styles.pill}>
            <CalendarIcon size={14} color={appColors.brand500} weight="bold" />
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
            Serving size {formatPreviewNumber(parsedServing, " g")}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Meal Details</Text>
        <Text style={styles.sectionSubtitle}>
          Save the name, optional notes, and default serving for this custom meal.
        </Text>

        <Text style={styles.fieldLabel}>Meal name</Text>
        <TextInput
          style={styles.input}
          placeholder="Chicken rice bowl"
          placeholderTextColor={appColors.foodPlaceholder}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
          Description
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional notes, ingredients, or prep details"
          placeholderTextColor={appColors.foodPlaceholder}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
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
            onBlur={handleServingBlur}
            keyboardType="decimal-pad"
          />
          <View style={styles.unitPill}>
            <Text style={styles.unitText}>g</Text>
          </View>
        </View>

        <View style={styles.fieldLabelSpacing}>
          <PublicVisibilityCheckbox checked={isPublic} onChange={setIsPublic} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nutrition Per Serving</Text>
        <Text style={styles.sectionSubtitle}>
          Enter the macros for the saved serving size above.
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
              onBlur={handleCaloriesBlur}
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
    </>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

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
            subtitle={`${formatFoodShortDate(date)} | ${resolvedContextLabel}`}
            onBack={() => navigation.goBack()}
          />

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
            renderEditor()
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
                      : "Save"}
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
                    : "Save & Add"}
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
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  heroHeaderCopy: {
    marginBottom: 10,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "500",
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
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
  },
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
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
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
    color: appColors.slate300,
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 96,
  },
  unitPill: {
    borderRadius: 999,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridCell: {
    width: "47%",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
    backgroundColor: appColors.surfaceOverlay,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerButton: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 2,
    borderColor: appColors.whiteOverlay18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: appColors.revolutDark,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  deleteButtonText: {
    color: appColors.danger700,
  },
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default CreateCustomFoodScreen;
