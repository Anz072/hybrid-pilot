import React from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import {
  BarcodeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem } from "../../store/DB_TYPES";
import FoodEntryForm from "./FoodEntryForm";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  formatFoodMacro,
  formatFoodLoggedTime,
  formatFoodNumber,
  formatFoodShortDate,
  formatFoodSourceLabel,
  getFoodDefaultLogAmount,
  getFoodResolvedServing,
  normalizePositiveFoodInput,
  type FoodNutritionTotals,
} from "./foodUtils";
import { appColors } from "../../theme/colors";
import { MacroBar } from "./FoodDiaryHeroCard";
import { useAppSelector } from "../../store/hooks";
import {
  getMicronutrientTargets,
  MICRONUTRIENT_TARGETS,
  MicronutrientSex,
  OpenFoodMapMicronutrientKey,
} from "../../engine/micronutrients";
import { getAgeFromBirthdateValue } from "../../helpers";
import { sharedStyleValues } from "../../theme/sharedStyles";

type ScannedFoodRoute = RouteProp<FoodStackParamList, "ScannedFood">;
type ScannedFoodNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "ScannedFood">,
  NativeStackNavigationProp<RootStackParamList>
>;

const roundTo = (value: number, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const parseQuantity = (value: string): number =>
  Number(value.trim().replace(",", "."));

const buildPreview = (
  food: DBFoodItem,
  quantity: number,
): FoodNutritionTotals | null => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const serving = getFoodResolvedServing(food);
  const factor = serving.value > 0 ? quantity / serving.value : 1;

  return {
    calories: roundTo((food.calories ?? 0) * factor, 0),
    proteinG: roundTo((food.proteinG ?? 0) * factor),
    carbsG: roundTo((food.carbsG ?? 0) * factor),
    fatG: roundTo((food.fatG ?? 0) * factor),
  };
};

const ScannedFoodLogScreen = () => {
  const route = useRoute<ScannedFoodRoute>();
  const navigation = useNavigation<ScannedFoodNav>();
  const insets = useSafeAreaInsets();
  const { barcode, date, foodId, loggedAt, mealType, scanStatus } =
    route.params;
  const isScannedFlow = scanStatus != null;
  const user = useAppSelector((state) => state.user.currentUser);

  const microTargets = user
    ? getMicronutrientTargets({
        sex: String(user.gender) as MicronutrientSex,
        age: getAgeFromBirthdateValue(user.birthdate) ?? 29,
      })
    : MICRONUTRIENT_TARGETS.generic;

  const [food, setFood] = React.useState<DBFoodItem | null>(null);
  const [quantityValue, setQuantityValue] = React.useState("");
  const [labelValue, setLabelValue] = React.useState(mealType ?? "");
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const initialLoggedAt = React.useMemo(() => {
    if (loggedAt) {
      return loggedAt;
    }

    const now = new Date();
    return buildFoodLoggedAt(date, now.getHours(), now.getMinutes());
  }, [date, loggedAt]);
  const [loggedAtDate, setLoggedAtDate] = React.useState(
    () => new Date(initialLoggedAt),
  );

  React.useEffect(() => {
    setLoggedAtDate(new Date(initialLoggedAt));
  }, [initialLoggedAt]);

  const loadFood = React.useCallback(async () => {
    setLoading(true);

    try {
      const nextFood = await DB.getFoodItemById(foodId);

      setFood(nextFood);

      if (nextFood) {
        setQuantityValue(String(getFoodDefaultLogAmount(nextFood)));
      }

      if (user && nextFood) {
        const favoriteIds = await DB.getFavoriteFoodIds(user.externalId);
        setIsFavorite(favoriteIds.includes(nextFood.id));
      } else {
        setIsFavorite(false);
      }
    } finally {
      setLoading(false);
    }
  }, [foodId, user]);

  React.useEffect(() => {
    void loadFood();
  }, [loadFood]);

  const serving = React.useMemo(
    () => (food ? getFoodResolvedServing(food) : null),
    [food],
  );
  const quantity = React.useMemo(
    () => parseQuantity(quantityValue),
    [quantityValue],
  );
  const preview = React.useMemo(
    () => (food ? buildPreview(food, quantity) : null),
    [food, quantity],
  );
  const canFavoriteFood = food != null && food.source !== "recipe";
  const micronutrientFactor = React.useMemo(() => {
    if (!serving || !Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }

    return serving.value > 0 ? quantity / serving.value : 1;
  }, [quantity, serving]);
  const handleQuantityBlur = React.useCallback(() => {
    if (!food) {
      return;
    }

    setQuantityValue((current) =>
      normalizePositiveFoodInput(current, getFoodDefaultLogAmount(food)),
    );
  }, [food]);
  const loggedTime = React.useMemo(
    () => formatFoodLoggedTime(loggedAtDate.toISOString()),
    [loggedAtDate],
  );
  const screenDateLabel = React.useMemo(
    () => formatFoodShortDate(date),
    [date],
  );
  const statusLabel =
    scanStatus === "created" ? "Added to library" : "Found in library";
  const screenEyebrow = isScannedFlow ? "Barcode" : "Food";
  const screenTitle = isScannedFlow ? "Add scanned food" : "Review food";
  const screenSubtitle = `${screenDateLabel} | ${loggedTime}`;
  const heroPills = React.useMemo(() => {
    const pills = [];

    if (isScannedFlow) {
      pills.push({
        key: "status",
        label: statusLabel,
        icon: (
          <CheckCircleIcon
            size={14}
            color={appColors.brand500}
            weight="fill"
          />
        ),
      });
    }

    pills.push({
      key: "date",
      label: formatFoodShortDate(date),
      icon: (
        <CalendarIcon size={14} color={appColors.brand500} weight="bold" />
      ),
    });

    if (barcode) {
      pills.push({
        key: "barcode",
        label: barcode,
        icon: (
          <BarcodeIcon size={14} color={appColors.brand500} weight="bold" />
        ),
      });
    }

    return pills;
  }, [barcode, date, isScannedFlow, statusLabel]);

  const handleTimeChange = React.useCallback(
    (event: DateTimePickerEvent, nextDate?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }

      if (event.type !== "set" || !nextDate) {
        return;
      }

      const merged = new Date(loggedAtDate);
      merged.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);
      setLoggedAtDate(merged);
    },
    [loggedAtDate],
  );

  const closeAfterSave = React.useCallback(() => {
    const routes = navigation.getState().routes;
    const previousRoute = routes[routes.length - 2];

    if (previousRoute?.name === "AddFood" && routes.length >= 2) {
      navigation.dispatch(StackActions.pop(2));
      return;
    }

    navigation.goBack();
  }, [navigation]);

  const toggleFavorite = React.useCallback(async () => {
    if (!user || !food) {
      Alert.alert(
        "No account found",
        "Create or restore a user before saving foods.",
      );
      return;
    }

    if (!canFavoriteFood) {
      Alert.alert(
        "Unavailable",
        "Recipes are shared separately and cannot be favorited here.",
      );
      return;
    }

    await DB.setFoodItemFavorite(user.externalId, food.id, !isFavorite);
    setIsFavorite((current) => !current);
  }, [canFavoriteFood, food, isFavorite, user]);

  const saveLog = React.useCallback(async () => {
    if (!user || !food) {
      Alert.alert(
        "No account found",
        "Create or restore a user before adding food.",
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert(
        "Invalid quantity",
        "Enter a positive quantity before logging.",
      );
      return;
    }

    try {
      setSaving(true);
      await DB.addUserFoodLog({
        userExternalId: user.externalId,
        foodId: food.id,
        date,
        loggedAt: loggedAtDate.toISOString(),
        quantityG: quantity,
        mealType: labelValue.trim() || null,
      });
      closeAfterSave();
    } finally {
      setSaving(false);
    }
  }, [closeAfterSave, date, food, labelValue, loggedAtDate, quantity, user]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow={screenEyebrow}
            title={screenTitle}
            subtitle={
              isScannedFlow
                ? "Loading the scanned food..."
                : "Loading food details..."
            }
            onBack={() => navigation.goBack()}
          />
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color={appColors.brand700} />
            <Text style={styles.centerText}>Preparing the log screen.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!food || !serving) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow={screenEyebrow}
            title="Food unavailable"
            subtitle={
              isScannedFlow
                ? "The barcode resolved, but the saved food item could not be loaded."
                : "The selected food item could not be loaded."
            }
            onBack={() => navigation.goBack()}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 148 + Math.max(insets.bottom, 12) },
        ]}
        focusedInputBottomOffset={132}
      >
        <FoodEntryForm
          headerEyebrow={screenEyebrow}
          headerTitle={screenTitle}
          headerSubtitle={screenSubtitle}
          onBack={() => navigation.goBack()}
          heroEyebrow={isScannedFlow ? "Quick Review" : "Food Review"}
          heroTitle={food.name}
          heroMeta={`${food.brand ? `${food.brand} | ` : ""}${formatFoodSourceLabel(
            food.source,
          )} | Serving ${formatFoodNumber(serving.value, ` ${serving.unit}`)}`}
          heroPills={heroPills}
          heroAction={
            canFavoriteFood
              ? {
                  active: isFavorite,
                  icon: (
                    <StarIcon
                      size={14}
                      color={isFavorite ? appColors.white : appColors.brand500}
                      weight={isFavorite ? "fill" : "bold"}
                    />
                  ),
                  label: isFavorite ? "Saved" : "Save",
                  onPress: () => {
                    void toggleFavorite();
                  },
                }
              : undefined
          }
          previewCaloriesText={
            preview ? `${preview.calories.toFixed(0)} kcal` : "--"
          }
          previewSummaryText={
            preview
              ? `${formatFoodMacro(preview.proteinG, "P")} | ${formatFoodMacro(
                  preview.carbsG,
                  "C",
                )} | ${formatFoodMacro(preview.fatG, "F")}`
              : "Enter an amount to preview nutrition"
          }
          amountKeyboardType="decimal-pad"
          amountPlaceholder="Amount"
          amountUnit={serving.unit}
          amountValue={quantityValue}
          detailsSubtitle="Set the amount, logged time, and slot before adding this food."
          onChangeAmount={setQuantityValue}
          onAmountBlur={handleQuantityBlur}
          slot={{
            icon: (
              <ClockIcon
                size={18}
                color={appColors.brand500}
                weight="bold"
              />
            ),
            label: "Logged time",
            value: loggedTime,
            actionLabel: "Change",
            onPress: () => setShowTimePicker((current) => !current),
          }}
          labelValue={labelValue}
          onChangeLabel={setLabelValue}
          labelPlaceholder="Optional label"
          nutritionItems={[
            {
              label: "Calories",
              value: preview ? preview.calories.toFixed(0) : "--",
            },
            {
              label: "Protein",
              value: preview ? `${preview.proteinG.toFixed(1)} g` : "--",
            },
            {
              label: "Carbs",
              value: preview ? `${preview.carbsG.toFixed(1)} g` : "--",
            },
            {
              label: "Fat",
              value: preview ? `${preview.fatG.toFixed(1)} g` : "--",
            },
          ]}
          onPrimaryAction={() => {
            void saveLog();
          }}
          primaryActionDisabled={saving}
          primaryActionLabel={saving ? "Adding..." : "Add to diary"}
          showPrimaryAction={false}
        />
        <Text style={styles.title}>Micronutrients</Text>
        {(
          Object.entries(microTargets) as [
            OpenFoodMapMicronutrientKey,
            number,
          ][]
        ).map(([key, target]) => (
          <MacroBar
            key={key}
            accent={appColors.brand500}
            consumed={Number(food?.[key] ?? 0) * micronutrientFactor}
            target={target}
            label={key
              .slice(0, -2)
              .split(/(?=[A-Z])/)
              .map((w) => w[0].toUpperCase() + w.slice(1))
              .join(" ")}
            unit={key.endsWith("Ug") ? "ug" : "mg"}
          />
        ))}
        {showTimePicker ? (
          <DateTimePicker
            value={loggedAtDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
          ) : null}
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.min(insets.bottom, 16) },
        ]}
      >
        <Pressable
          onPress={() => {
            void saveLog();
          }}
          disabled={saving}
          style={({ pressed }) => [
            styles.stickyPrimaryButton,
            saving && styles.disabled,
            pressed && !saving && styles.cardPressed,
          ]}
        >
          <Text style={styles.stickyPrimaryButtonText}>
            {saving ? "Adding..." : "Add to diary"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 18,
  },
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
  centerCard: sharedStyleValues.centerCard,
  centerText: sharedStyleValues.centerText,
  stickyFooter: sharedStyleValues.footer,
  stickyPrimaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.lightPrimaryButton,
  },
  stickyPrimaryButtonText: sharedStyleValues.lightPrimaryButtonText,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.lightPrimaryButton,
    marginBottom: 6,
  },
  primaryButtonText: sharedStyleValues.lightPrimaryButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default ScannedFoodLogScreen;

