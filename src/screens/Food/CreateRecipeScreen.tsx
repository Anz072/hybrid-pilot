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
import { Swipeable } from "react-native-gesture-handler";
import {
  BarcodeIcon,
  CaretRightIcon,
  CalendarIcon,
  ClockIcon,
  CookingPotIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type {
  DBFoodItem,
  DBRecipe,
  DBRecipeDetails,
  RecipeBuildMethod,
} from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { sharedStyleValues } from "../../theme/sharedStyles";
import FoodBarcodeScannerModal from "./FoodBarcodeScannerModal";
import FoodScreenHeader from "./FoodScreenHeader";
import PublicVisibilityCheckbox from "./PublicVisibilityCheckbox";
import type { ScannedFoodLookupResult } from "./FoodBarcodeScannerShared";
import {
  buildFoodLoggedAt,
  formatFoodItemServing,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodNumber,
  formatFoodShortDate,
  formatFoodSourceLabel,
  getFoodResolvedServing,
  normalizePositiveFoodInput,
} from "./foodUtils";
import {
  searchFoodResults,
  type FoodSearchResult,
} from "./foodSearch";

type CreateRecipeRoute = RouteProp<FoodStackParamList, "CreateRecipe">;
type CreateRecipeNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "CreateRecipe">,
  NativeStackNavigationProp<RootStackParamList>
>;

type SearchFoodResult = FoodSearchResult;

type RecipeIngredientDraft = {
  key: string;
  foodId: number;
  food: DBFoodItem;
  amountValue: string;
};

type RecipeMethodOption = {
  value: RecipeBuildMethod;
  title: string;
  description: string;
  available: boolean;
  badge: string;
};

const RECIPE_METHODS: RecipeMethodOption[] = [
  {
    value: "scratch",
    title: "Build from scratch",
    description: "Manually enter ingredients and preparation steps.",
    available: true,
    badge: "Ready",
  },
  // {
  //   value: "link",
  //   title: "Import from link",
  //   description: "Paste a recipe URL and convert it into a saved recipe later.",
  //   available: false,
  //   badge: "Soon",
  // },
  // {
  //   value: "ai",
  //   title: "Import with AI",
  //   description: "Turn text or photos into recipe ingredients in a later update.",
  //   available: false,
  //   badge: "Soon",
  // },
];

const SEARCH_DEBOUNCE_MS = 260;
const MAX_SEARCH_RESULTS = 18;
const REMOTE_SEARCH_MIN_QUERY_LENGTH = 2;
const RECIPE_INGREDIENT_SEARCH_RANK_OPTIONS = {
  completeScoreBonus: 8,
  localScoreBonus: 100,
  maxResults: MAX_SEARCH_RESULTS,
  verifiedScoreBonus: 12,
};

const parseLocalizedNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

const toSafeNumber = (value: string): number => {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumberInput = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
};

const calculateIngredientFactor = (ingredient: RecipeIngredientDraft) => {
  const serving = getFoodResolvedServing(ingredient.food);
  const amount = toSafeNumber(ingredient.amountValue);

  if (serving.value <= 0) {
    return {
      amount,
      factor: amount > 0 ? amount : 0,
      serving,
    };
  }

  return {
    amount,
    factor: amount / serving.value,
    serving,
  };
};

type RecipeSaveMode = "save" | "save_and_add";

const CreateRecipeScreen = () => {
  const route = useRoute<CreateRecipeRoute>();
  const navigation = useNavigation<CreateRecipeNav>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const searchCacheRef = React.useRef(new Map<string, SearchFoodResult[]>());
  const editingRecipeId = route.params.recipeId ?? null;
  const isEditing = editingRecipeId != null;

  const [method, setMethod] = React.useState<RecipeBuildMethod>("scratch");
  const [name, setName] = React.useState("");
  const [servingsValue, setServingsValue] = React.useState("1");
  const [preparedWeightValue, setPreparedWeightValue] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [prepTimeValue, setPrepTimeValue] = React.useState("");
  const [cookTimeValue, setCookTimeValue] = React.useState("");
  const [linkValue, setLinkValue] = React.useState("");
  const [descriptionValue, setDescriptionValue] = React.useState("");
  const [ingredientQuery, setIngredientQuery] = React.useState("");
  const [ingredientResults, setIngredientResults] = React.useState<
    SearchFoodResult[]
  >([]);
  const [ingredientSearchLoading, setIngredientSearchLoading] =
    React.useState(false);
  const [scannerVisible, setScannerVisible] = React.useState(false);
  const [ingredients, setIngredients] = React.useState<RecipeIngredientDraft[]>(
    [],
  );
  const [steps, setSteps] = React.useState<string[]>([]);
  const [recipeDetails, setRecipeDetails] =
    React.useState<DBRecipeDetails | null>(null);
  const [loadingRecipe, setLoadingRecipe] = React.useState(isEditing);
  const [recipeLoadError, setRecipeLoadError] = React.useState<string | null>(
    null,
  );
  const [saveMode, setSaveMode] = React.useState<RecipeSaveMode | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const saving = saveMode != null;

  const resolvedLoggedAt = React.useMemo(() => {
    if (route.params.loggedAt) {
      return route.params.loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(
      route.params.date,
      now.getHours(),
      now.getMinutes(),
    );
  }, [route.params.date, route.params.loggedAt]);

  const resolvedContextLabel = React.useMemo(() => {
    const trimmed = route.params.contextLabel?.trim();
    if (trimmed) {
      return trimmed;
    }

    return formatFoodLoggedTime(resolvedLoggedAt);
  }, [resolvedLoggedAt, route.params.contextLabel]);

  const parsedServings = React.useMemo(
    () => toSafeNumber(servingsValue),
    [servingsValue],
  );
  const parsedPreparedWeight = React.useMemo(
    () => toSafeNumber(preparedWeightValue),
    [preparedWeightValue],
  );
  const recipeName = name.trim();
  const resolvedServings = parsedServings > 0 ? parsedServings : 1;
  const resolvedPreparedWeight =
    parsedPreparedWeight > 0 ? parsedPreparedWeight : null;

  const recipeTotals = React.useMemo(() => {
    return ingredients.reduce(
      (accumulator, ingredient) => {
        const { amount, factor } = calculateIngredientFactor(ingredient);

        accumulator.calories += (ingredient.food.calories ?? 0) * factor;
        accumulator.proteinG += (ingredient.food.proteinG ?? 0) * factor;
        accumulator.carbsG += (ingredient.food.carbsG ?? 0) * factor;
        accumulator.fatG += (ingredient.food.fatG ?? 0) * factor;
        accumulator.totalWeightG += amount;
        return accumulator;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, totalWeightG: 0 },
    );
  }, [ingredients]);

  const recipeWeightMetrics = React.useMemo(() => {
    const ingredientTotalWeightG = recipeTotals.totalWeightG;
    const effectiveRecipeWeightG =
      resolvedPreparedWeight ??
      (ingredientTotalWeightG > 0 ? ingredientTotalWeightG : null);
    const gramsPerServing =
      effectiveRecipeWeightG != null && effectiveRecipeWeightG > 0
        ? effectiveRecipeWeightG / resolvedServings
        : null;

    return {
      ingredientTotalWeightG,
      effectiveRecipeWeightG,
      gramsPerServing,
      usesPreparedWeight: resolvedPreparedWeight != null,
    };
  }, [recipeTotals.totalWeightG, resolvedPreparedWeight, resolvedServings]);

  const perServingNutrition = React.useMemo(
    () => ({
      calories: recipeTotals.calories / resolvedServings,
      proteinG: recipeTotals.proteinG / resolvedServings,
      carbsG: recipeTotals.carbsG / resolvedServings,
      fatG: recipeTotals.fatG / resolvedServings,
    }),
    [recipeTotals, resolvedServings],
  );

  React.useEffect(() => {
    let cancelled = false;

    if (!isEditing || editingRecipeId == null) {
      setRecipeDetails(null);
      setLoadingRecipe(false);
      setRecipeLoadError(null);
      setIsPublic(true);
      return () => {
        cancelled = true;
      };
    }

    const loadRecipe = async () => {
      try {
        setLoadingRecipe(true);
        setRecipeLoadError(null);

        const loadedRecipe = await DB.getUserRecipeDetailsById(editingRecipeId);

        if (!loadedRecipe) {
          throw new Error("That recipe could not be found.");
        }

        if (cancelled) {
          return;
        }

        setRecipeDetails(loadedRecipe);
        setMethod(loadedRecipe.buildMethod);
        setName(loadedRecipe.name);
        setServingsValue(formatNumberInput(loadedRecipe.servings));
        setPreparedWeightValue(
          formatNumberInput(loadedRecipe.preparedFoodWeightG),
        );
        setIsPublic(loadedRecipe.isPublic);
        setPrepTimeValue(formatNumberInput(loadedRecipe.prepTimeMin));
        setCookTimeValue(formatNumberInput(loadedRecipe.cookTimeMin));
        setLinkValue(loadedRecipe.linkUrl ?? "");
        setDescriptionValue(loadedRecipe.description ?? "");
        setIngredients(
          loadedRecipe.ingredients.map((ingredient) => ({
            key: `${ingredient.id}-${ingredient.foodId}`,
            foodId: ingredient.foodId,
            food: ingredient.food,
            amountValue: formatNumberInput(ingredient.amount),
          })),
        );
        setSteps(loadedRecipe.steps);
        setIngredientQuery("");
        setIngredientResults([]);
      } catch (error) {
        if (!cancelled) {
          setRecipeLoadError(
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipe(false);
        }
      }
    };

    void loadRecipe();

    return () => {
      cancelled = true;
    };
  }, [editingRecipeId, isEditing]);

  const searchFoods = React.useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    const cached = searchCacheRef.current.get(normalizedQuery);
    if (cached) {
      return cached;
    }

    const ranked = await searchFoodResults({
      query: normalizedQuery,
      getLocalRows: (queryText) => DB.searchFoodItems(queryText, 30),
      includeLocalFood: true,
      rankOptions: RECIPE_INGREDIENT_SEARCH_RANK_OPTIONS,
      remoteMinQueryLength: REMOTE_SEARCH_MIN_QUERY_LENGTH,
    });

    searchCacheRef.current.set(normalizedQuery, ranked);
    return ranked;
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const trimmed = ingredientQuery.trim();

      if (!trimmed) {
        setIngredientResults([]);
        setIngredientSearchLoading(false);
        return;
      }

      const cached = searchCacheRef.current.get(trimmed);
      if (cached) {
        setIngredientResults(cached);
        setIngredientSearchLoading(false);
        return;
      }

      setIngredientSearchLoading(true);
      const results = await searchFoods(trimmed);
      if (!cancelled) {
        setIngredientResults(results);
        setIngredientSearchLoading(false);
      }
    };

    const timeout = setTimeout(() => {
      void run();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [ingredientQuery, searchFoods]);

  const persistFoodResult = React.useCallback(
    async (result: SearchFoodResult) => {
      if (result.localId != null && result.localFood) {
        return { foodId: result.localId, food: result.localFood };
      }

      if (result.localId != null) {
        const existing = await DB.getFoodItemById(result.localId);
        if (existing) {
          return { foodId: result.localId, food: existing };
        }
      }

      const {
        key: _key,
        localId: _localId,
        localFood: _localFood,
        ...saveInput
      } = result;
      const savedId = await DB.saveFoodItem(saveInput);
      const savedFood = await DB.getFoodItemById(savedId);

      if (!savedFood) {
        throw new Error("Ingredient could not be saved.");
      }

      setIngredientResults((current) =>
        current.map((item) =>
          item.key === result.key
            ? { ...item, localId: savedId, localFood: savedFood }
            : item,
        ),
      );
      searchCacheRef.current.clear();

      return { foodId: savedId, food: savedFood };
    },
    [],
  );

  const addPersistedIngredient = React.useCallback(
    (persisted: { foodId: number; food: DBFoodItem }) => {
      const defaultServing = getFoodResolvedServing(persisted.food).value;

      setIngredients((current) => {
        const existingIndex = current.findIndex(
          (ingredient) => ingredient.foodId === persisted.foodId,
        );

        if (existingIndex >= 0) {
          const next = [...current];
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            amountValue: formatNumberInput(
              toSafeNumber(existing.amountValue) + defaultServing,
            ),
          };
          return next;
        }

        return [
          ...current,
          {
            key: `${persisted.foodId}-${Date.now()}`,
            foodId: persisted.foodId,
            food: persisted.food,
            amountValue: formatNumberInput(defaultServing),
          },
        ];
      });

      setIngredientQuery("");
      setIngredientResults([]);
    },
    [],
  );

  const handleAddIngredient = React.useCallback(
    async (result: SearchFoodResult) => {
      try {
        const persisted = await persistFoodResult(result);
        addPersistedIngredient(persisted);
      } catch (error) {
        Alert.alert(
          "Could not add ingredient",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    },
    [addPersistedIngredient, persistFoodResult],
  );

  const handleScannedIngredientResolved = React.useCallback(
    async (result: ScannedFoodLookupResult) => {
      setScannerVisible(false);

      try {
        const food = await DB.getFoodItemById(result.foodId);

        if (!food) {
          Alert.alert(
            "Could not add ingredient",
            "That scanned food could not be loaded yet.",
          );
          return;
        }

        addPersistedIngredient({
          foodId: result.foodId,
          food,
        });
      } catch (error) {
        Alert.alert(
          "Could not add ingredient",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    },
    [addPersistedIngredient],
  );

  const updateIngredientAmount = React.useCallback(
    (key: string, amountValue: string) => {
      setIngredients((current) =>
        current.map((ingredient) =>
          ingredient.key === key ? { ...ingredient, amountValue } : ingredient,
        ),
      );
    },
    [],
  );

  const normalizeIngredientAmount = React.useCallback((key: string) => {
    setIngredients((current) =>
      current.map((ingredient) => {
        if (ingredient.key !== key) {
          return ingredient;
        }

        return {
          ...ingredient,
          amountValue: normalizePositiveFoodInput(
            ingredient.amountValue,
            getFoodResolvedServing(ingredient.food).value,
            1,
          ),
        };
      }),
    );
  }, []);

  const removeIngredient = React.useCallback((key: string) => {
    setIngredients((current) =>
      current.filter((ingredient) => ingredient.key !== key),
    );
  }, []);

  const openIngredientDetails = React.useCallback(
    (ingredient: RecipeIngredientDraft) => {
      navigation.navigate("FoodReadOnly", {
        foodId: ingredient.foodId,
        quantity: toSafeNumber(ingredient.amountValue),
        contextLabel: resolvedContextLabel,
        date: route.params.date,
        loggedAt: resolvedLoggedAt,
      });
    },
    [
      navigation,
      resolvedContextLabel,
      resolvedLoggedAt,
      route.params.date,
    ],
  );

  const addStep = React.useCallback(() => {
    setSteps((current) => [...current, ""]);
  }, []);

  const updateStep = React.useCallback((index: number, value: string) => {
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? value : step)),
    );
  }, []);

  const removeStep = React.useCallback((index: number) => {
    setSteps((current) =>
      current.filter((_, stepIndex) => stepIndex !== index),
    );
  }, []);

  const closeAfterSave = React.useCallback((mode: RecipeSaveMode) => {
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

  const handleSave = React.useCallback(
    async (mode: RecipeSaveMode = "save") => {
      if (!user) {
        Alert.alert(
          "No account found",
          "Create or restore a user before saving recipes.",
        );
        return;
      }

      if (!recipeName) {
        Alert.alert("Missing name", "Enter a recipe name first.");
        return;
      }

      if (!Number.isFinite(parsedServings) || parsedServings <= 0) {
        Alert.alert("Invalid servings", "Servings must be more than zero.");
        return;
      }

      if (ingredients.length === 0) {
        Alert.alert(
          "Add ingredients",
          "Add at least one ingredient before saving the recipe.",
        );
        return;
      }

      const ingredientInputs = ingredients.map((ingredient) => ({
        food: ingredient.food,
        foodId: ingredient.foodId,
        amount: toSafeNumber(ingredient.amountValue),
      }));

      if (ingredientInputs.some((ingredient) => ingredient.amount <= 0)) {
        Alert.alert(
          "Invalid ingredient amount",
          "Each ingredient amount must be greater than zero.",
        );
        return;
      }

      const prepTime = toSafeNumber(prepTimeValue);
      const cookTime = toSafeNumber(cookTimeValue);

      if (prepTime < 0 || cookTime < 0) {
        Alert.alert(
          "Invalid preparation time",
          "Prep and cook time must be zero or higher.",
        );
        return;
      }

      try {
        setSaveMode(mode);

        const payload = {
          userExternalId: user.externalId,
          createdByUserExternalId:
            recipeDetails?.createdByUserExternalId ?? user.externalId,
          buildMethod: method,
          isPublic,
          name: recipeName,
          description: descriptionValue.trim() || null,
          linkUrl: linkValue.trim() || null,
          prepTimeMin: prepTime > 0 ? prepTime : null,
          cookTimeMin: cookTime > 0 ? cookTime : null,
          servings: parsedServings,
          preparedFoodWeightG: resolvedPreparedWeight,
          steps: steps.map((step) => step.trim()).filter(Boolean),
          ingredients: ingredientInputs,
        };

        let savedRecipe: DBRecipe;
        if (isEditing && editingRecipeId != null) {
          savedRecipe = await DB.updateUserRecipe({
            recipeId: editingRecipeId,
            ...payload,
          });
        } else {
          savedRecipe = await DB.createUserRecipe(payload);
        }

        if (mode === "save_and_add") {
          await DB.addUserFoodLog({
            userExternalId: user.externalId,
            foodId: savedRecipe.linkedFoodId,
            date: route.params.date,
            loggedAt: resolvedLoggedAt,
            quantityG: 1,
            mealType: route.params.mealType ?? null,
          });
        }

        closeAfterSave(mode);
      } catch (error) {
        Alert.alert(
          isEditing ? "Could not update recipe" : "Could not save recipe",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setSaveMode(null);
      }
    },
    [
      closeAfterSave,
      cookTimeValue,
      descriptionValue,
      editingRecipeId,
      ingredients,
      isPublic,
      isEditing,
      linkValue,
      method,
      parsedServings,
      recipeDetails?.createdByUserExternalId,
      resolvedPreparedWeight,
      resolvedLoggedAt,
      recipeName,
      prepTimeValue,
      route.params.date,
      route.params.mealType,
      steps,
      user,
    ],
  );

  const handleDeleteRecipe = React.useCallback(() => {
    if (!isEditing || editingRecipeId == null || deleting) {
      return;
    }

    Alert.alert(
      "Delete recipe?",
      "This will remove the saved recipe and its linked food item from your local app.",
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
                await DB.deleteUserRecipe(editingRecipeId);
                navigation.goBack();
              } catch (error) {
                Alert.alert(
                  "Could not delete recipe",
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
  }, [deleting, editingRecipeId, isEditing, navigation]);

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
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(176, insets.bottom + 152) },
          ]}
          focusedInputBottomOffset={148}
        >
          <FoodScreenHeader
            title={isEditing ? "Edit recipe" : "Create recipe"}
            onBack={() => navigation.goBack()}
          />

          {loadingRecipe ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Loading recipe</Text>
              <Text style={styles.sectionSubtitle}>
                Pulling the saved ingredients and recipe details into the editor.
              </Text>
            </View>
          ) : recipeLoadError ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recipe unavailable</Text>
              <Text style={styles.sectionSubtitle}>{recipeLoadError}</Text>
            </View>
          ) : (
            <>
          <View style={styles.card}>
            <View
              style={styles.heroHeaderRow}
            >
              <View style={styles.heroHeaderCopy}>
                <Text style={styles.heroEyebrow}>
                  {isEditing ? "Saved recipe" : "Recipe builder"}
                </Text>
                <Text style={styles.heroTitle}>
                  {isEditing ? "Edit recipe" : "Create recipe"}
                </Text>
                <Text style={styles.heroMeta}>
                  {isEditing
                    ? "Update ingredients, servings, and preparation details. Saved changes show anywhere this recipe is used."
                    : `Build a saved recipe for ${resolvedContextLabel}, then save it for later or Save and Add one serving right away.`}
                </Text>
              </View>
              {isEditing ? (
                <View style={styles.contextPill}>
                  <Text style={styles.contextPillText}>Edit</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.heroPillsRow}>
              <View style={styles.contextPill}>
                <CalendarIcon
                  size={14}
                  color={appColors.brand500}
                  weight="bold"
                />
                <Text style={styles.contextPillText}>
                  {formatFoodShortDate(route.params.date)}
                </Text>
              </View>
              <View style={styles.contextPill}>
                <ClockIcon
                  size={14}
                  color={appColors.brand500}
                  weight="bold"
                />
                <Text style={styles.contextPillText}>{resolvedContextLabel}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Details</Text>

            <Text style={styles.fieldLabel}>Recipe name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Banana bread"
              placeholderTextColor={appColors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <View style={[styles.twoUpGrid, styles.fieldSpacing]}>
              <View style={styles.twoUpCell}>
                <Text style={styles.fieldLabel}>Servings</Text>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1"
                    placeholderTextColor={appColors.textMuted}
                    value={servingsValue}
                    onChangeText={setServingsValue}
                    onBlur={() =>
                      setServingsValue((current) =>
                        normalizePositiveFoodInput(current, 1, 1),
                      )
                    }
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitText}>servings</Text>
                  </View>
                </View>
              </View>

              <View style={styles.twoUpCell}>
                <Text style={styles.fieldLabel}>Prepared weight</Text>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional"
                    placeholderTextColor={appColors.textMuted}
                    value={preparedWeightValue}
                    onChangeText={setPreparedWeightValue}
                    onBlur={() =>
                      setPreparedWeightValue((current) => {
                        const next = toSafeNumber(current);
                        return next > 0 ? formatNumberInput(next) : "";
                      })
                    }
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitText}>g</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.fieldSpacing}>
              <PublicVisibilityCheckbox
                checked={isPublic}
                onChange={setIsPublic}
              />
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Ingredient weight</Text>
                <Text style={styles.metricValue}>
                  {formatFoodNumber(
                    recipeWeightMetrics.ingredientTotalWeightG,
                    " g",
                  )}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Prepared recipe weight</Text>
                <Text style={styles.metricValue}>
                  {recipeWeightMetrics.usesPreparedWeight
                    ? formatFoodNumber(resolvedPreparedWeight, " g")
                    : "Using ingredient total"}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Weight per serving</Text>
                <Text style={styles.metricValue}>
                  {recipeWeightMetrics.gramsPerServing != null
                    ? formatFoodNumber(
                        recipeWeightMetrics.gramsPerServing,
                        " g",
                      )
                    : "--"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.sectionSubtitle}>
              Search or scan ingredients, tap a result to add it, and swipe
              saved ingredient rows left to remove them.
            </Text>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <MagnifyingGlassIcon
                  size={18}
                  color={appColors.textMuted}
                  weight="bold"
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredients"
                  placeholderTextColor={appColors.textMuted}
                  value={ingredientQuery}
                  onChangeText={setIngredientQuery}
                  returnKeyType="search"
                />
              </View>
              <Pressable
                onPress={() => setScannerVisible(true)}
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.cardPressed,
                ]}
              >
                <BarcodeIcon size={18} color={appColors.white} weight="bold" />
              </Pressable>
            </View>

            {ingredientQuery.trim() ? (
              <View style={styles.resultsWrap}>
                <Text style={styles.resultsMeta}>
                  {ingredientSearchLoading
                    ? "Searching your foods and USDA ingredients..."
                    : ingredientResults.length > 0
                      ? `${ingredientResults.length} ingredient matches`
                      : "No ingredients matched yet."}
                </Text>

                {ingredientResults.map((result) => (
                  <Pressable
                    key={result.key}
                    onPress={() => {
                      void handleAddIngredient(result);
                    }}
                    style={({ pressed }) => [
                      styles.searchResultCard,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.searchResultCopy}>
                      <View style={styles.resultTopRow}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {result.name}
                        </Text>
                        <Text style={styles.resultCalories}>
                          {formatFoodNumber(result.calories, " kcal")}
                        </Text>
                      </View>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {result.brand ? `${result.brand} | ` : ""}
                        {formatFoodSourceLabel(result.source)} |{" "}
                        {formatFoodItemServing(result)}
                      </Text>
                    </View>
                    <View style={styles.addButton}>
                      <PlusIcon
                        size={16}
                        color={appColors.white}
                        weight="bold"
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.ingredientList}>
              {ingredients.length === 0 ? (
                <Text style={styles.emptyText}>
                  No ingredients yet. Search above to start building the recipe.
                </Text>
              ) : (
                ingredients.map((ingredient) => {
                  const { amount, factor, serving } =
                    calculateIngredientFactor(ingredient);
                  const calories = (ingredient.food.calories ?? 0) * factor;
                  const protein = (ingredient.food.proteinG ?? 0) * factor;
                  const carbs = (ingredient.food.carbsG ?? 0) * factor;
                  const fat = (ingredient.food.fatG ?? 0) * factor;

                  return (
                    <Swipeable
                      key={ingredient.key}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => removeIngredient(ingredient.key)}
                          style={({ pressed }) => [
                            styles.deleteSwipe,
                            pressed && styles.cardPressed,
                          ]}
                          accessibilityLabel={`Delete ${ingredient.food.name} ingredient`}
                        >
                          <TrashIcon
                            size={18}
                            color={appColors.white}
                            weight="bold"
                          />
                          <Text style={styles.deleteSwipeText}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <View style={styles.ingredientCard}>
                        <Pressable
                          onPress={() => openIngredientDetails(ingredient)}
                          style={({ pressed }) => [
                            styles.ingredientPressable,
                            pressed && styles.cardPressed,
                          ]}
                        >
                          <View style={styles.ingredientHeaderRow}>
                            <View style={styles.ingredientCopy}>
                              <Text
                                style={styles.ingredientTitle}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {ingredient.food.name}
                              </Text>
                              <Text
                                style={styles.ingredientMeta}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {ingredient.food.brand
                                  ? `${ingredient.food.brand} | `
                                  : ""}
                                {formatFoodSourceLabel(ingredient.food.source)} |{" "}
                                {formatFoodItemServing(ingredient.food)}
                              </Text>
                            </View>
                            <CaretRightIcon
                              size={14}
                              color={appColors.brand500}
                              weight="bold"
                            />
                          </View>

                          <Text style={styles.ingredientPreviewText}>
                            {`${formatFoodNumber(amount, ` ${serving.unit}`)} | ${formatFoodNumber(
                              calories,
                              " kcal",
                            )} | ${formatFoodMacro(
                              protein,
                              "P",
                            )} | ${formatFoodMacro(
                              carbs,
                              "C",
                            )} | ${formatFoodMacro(fat, "F")}`}
                          </Text>
                        </Pressable>

                        <View style={styles.ingredientAmountRow}>
                          <Text style={styles.ingredientAmountLabel}>Amount</Text>
                          <View style={styles.ingredientAmountInputWrap}>
                            <TextInput
                              style={[
                                styles.textInput,
                                styles.ingredientAmountInput,
                              ]}
                              value={ingredient.amountValue}
                              onChangeText={(value) =>
                                updateIngredientAmount(ingredient.key, value)
                              }
                              onBlur={() =>
                                normalizeIngredientAmount(ingredient.key)
                              }
                              keyboardType="decimal-pad"
                              placeholder={formatNumberInput(serving.value)}
                              placeholderTextColor={appColors.textMuted}
                            />
                            <View
                              style={[
                                styles.unitPill,
                                styles.ingredientAmountUnitPill,
                              ]}
                            >
                              <Text style={styles.unitText}>{serving.unit}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preparation</Text>
            <View style={styles.twoUpGrid}>
              <View style={styles.twoUpCell}>
                <Text style={styles.fieldLabel}>Prep time</Text>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional"
                    placeholderTextColor={appColors.textMuted}
                    value={prepTimeValue}
                    onChangeText={setPrepTimeValue}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitText}>min</Text>
                  </View>
                </View>
              </View>

              <View style={styles.twoUpCell}>
                <Text style={styles.fieldLabel}>Cook time</Text>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional"
                    placeholderTextColor={appColors.textMuted}
                    value={cookTimeValue}
                    onChangeText={setCookTimeValue}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitText}>min</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>Link</Text>
            <TextInput
              style={styles.textInput}
              placeholder="https://..."
              placeholderTextColor={appColors.textMuted}
              value={linkValue}
              onChangeText={setLinkValue}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              Description
            </Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Describe the recipe, notes, or serving details."
              placeholderTextColor={appColors.textMuted}
              value={descriptionValue}
              onChangeText={setDescriptionValue}
              multiline
              textAlignVertical="top"
              maxLength={1500}
            />

            <View style={styles.stepsHeaderRow}>
              <View style={styles.stepsHeaderCopy}>
                <Text style={[styles.fieldLabel, styles.stepsLabel]}>
                  Steps
                </Text>
                <Text style={styles.stepsSubtitle}>
                  Add preparation steps if you want the recipe saved with
                  instructions.
                </Text>
              </View>
              <Pressable
                onPress={addStep}
                style={({ pressed }) => [
                  styles.iconButtonPrimary,
                  pressed && styles.cardPressed,
                ]}
              >
                <PlusIcon size={16} color={appColors.white} weight="bold" />
              </Pressable>
            </View>

            {steps.length === 0 ? (
              <Text style={styles.emptyText}>
                Steps are optional. Tap the plus button to add one.
              </Text>
            ) : (
              <View style={styles.stepsList}>
                {steps.map((step, index) => (
                  <View key={`step-${index}`} style={styles.stepCard}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={styles.stepTitle}>Step {index + 1}</Text>
                      <Pressable
                        onPress={() => removeStep(index)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <TrashIcon
                          size={16}
                          color={appColors.dangerText}
                          weight="bold"
                        />
                      </Pressable>
                    </View>
                    <TextInput
                      style={[styles.textInput, styles.stepInput]}
                      placeholder="Describe this step"
                      placeholderTextColor={appColors.textMuted}
                      value={step}
                      onChangeText={(value) => updateStep(index, value)}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
            </>
          )}
        </KeyboardAwareScrollView>

        {!loadingRecipe && !recipeLoadError ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {isEditing ? (
              <Pressable
                onPress={handleDeleteRecipe}
                disabled={deleting || saving}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.deleteButton,
                  (deleting || saving) && styles.disabled,
                  pressed && !deleting && !saving && styles.cardPressed,
                ]}
              >
                <Text style={[styles.secondaryButtonText, styles.deleteButtonText]}>
                  {deleting ? "Deleting..." : "Delete recipe"}
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

      <FoodBarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onFoodResolved={handleScannedIngredientResolved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: sharedStyleValues.screen,
  content: sharedStyleValues.content,
  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.success700,
  },
  heroCard: sharedStyleValues.card,
  heroHeaderCopy: {
    flex: 1,
  },
  heroEyebrow: sharedStyleValues.eyebrow,
  heroTitle: {
    ...sharedStyleValues.heroTitleLarge,
    marginBottom: 4,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  heroMeta: sharedStyleValues.metaText,
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  contextPillText: sharedStyleValues.contextPillText,
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  previewValue: {
    color: appColors.white,
    fontSize: 22,
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
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  methodStack: {
    gap: 10,
  },
  methodCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
    padding: 14,
  },
  methodCardSelected: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  methodCardDisabled: {
    opacity: 0.8,
  },
  methodIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  methodCopy: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  methodTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  methodTitleSelected: {
    color: appColors.white,
  },
  methodDescription: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  methodDescriptionSelected: {
    color: appColors.brand300,
  },
  methodBadge: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  methodBadgeSelected: {
    backgroundColor: appColors.brand500,
  },
  methodBadgeText: {
    color: appColors.brand700,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  methodBadgeTextSelected: {
    color: appColors.white,
  },
  fieldLabel: sharedStyleValues.fieldLabel,
  fieldSpacing: {
    marginTop: 10,
  },
  textInput: sharedStyleValues.input,
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingLeft: 12,
    paddingRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  resultsWrap: {
    marginTop: 10,
    marginBottom: 12,
    gap: 6,
  },
  resultsMeta: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchResultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  resultCalories: {
    color: appColors.brand700,
    fontSize: 11,
    fontWeight: "800",
  },
  resultTitle: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  resultMeta: {
    color: appColors.slate300,
    fontSize: 11,
    lineHeight: 15,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientList: {
    gap: 6,
  },
  ingredientCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ingredientPressable: {
    marginBottom: 6,
  },
  ingredientHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  ingredientCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
  },
  ingredientTitle: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
    marginBottom: 2,
  },
  ingredientMeta: {
    color: appColors.textSecondary,
    fontSize: 11,
    flexShrink: 1,
    lineHeight: 15,
  },
  ingredientPreviewText: {
    color: appColors.brand500,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  ingredientAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ingredientAmountLabel: {
    color: appColors.slate300,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 52,
  },
  ingredientAmountInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ingredientAmountInput: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  ingredientAmountUnitPill: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unitPill: {
    ...sharedStyleValues.unitPill,
    paddingRight: 8,
    paddingLeft: 2,
    paddingVertical: 12,
  },
  unitText: sharedStyleValues.unitText,
  twoUpGrid: {
    flexDirection: "row",
    gap: 8,
  },
  twoUpCell: {
    flex: 1,
  },
  metricCard: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metricLabel: {
    flex: 1,
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  metricValue: {
    color: appColors.brand700,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "right",
  },
  multilineInput: {
    minHeight: 96,
  },
  stepsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 10,
  },
  stepsHeaderCopy: {
    flex: 1,
  },
  stepsLabel: {
    marginBottom: 4,
  },
  stepsSubtitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  stepsList: {
    gap: 10,
  },
  stepCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceField,
    padding: 12,
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  stepTitle: {
    color: appColors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  stepInput: {
    minHeight: 76,
  },
  emptyText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  iconButtonPrimary: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.brand700,
  },
  deleteSwipe: {
    width: 96,
    borderRadius: 8,
    backgroundColor: appColors.danger700,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  footer: sharedStyleValues.footer,
  footerRow: sharedStyleValues.footerRow,
  footerButton: sharedStyleValues.footerButton,
  secondaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.secondaryButton,
  },
  secondaryButtonText: sharedStyleValues.secondaryButtonText,
  deleteButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  deleteButtonText: {
    color: appColors.danger700,
  },
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.lightPrimaryButton,
  },
  primaryButtonText: sharedStyleValues.lightPrimaryButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default CreateRecipeScreen;

