import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
  BarcodeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ForkKnifeIcon,
  StarIcon,
} from "phosphor-react-native";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem, DBUser } from "../../store/DB_TYPES";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  formatFoodLoggedTime,
  formatFoodNumber,
  formatFoodShortDate,
  formatFoodSourceLabel,
  formatMacroLine,
  getFoodDefaultLogAmount,
  getFoodResolvedServing,
  type FoodNutritionTotals,
} from "./foodUtils";

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
  const { barcode, contextLabel, date, foodId, loggedAt, mealType, scanStatus } =
    route.params;

  const [food, setFood] = React.useState<DBFoodItem | null>(null);
  const [user, setUser] = React.useState<DBUser | null>(null);
  const [quantityValue, setQuantityValue] = React.useState("");
  const [labelValue, setLabelValue] = React.useState(mealType ?? "");
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const loadFood = React.useCallback(async () => {
    setLoading(true);

    try {
      const [currentUser, nextFood] = await Promise.all([
        DB.getUser(),
        DB.getFoodItemById(foodId),
      ]);

      setUser(currentUser);
      setFood(nextFood);

      if (nextFood) {
        setQuantityValue(String(getFoodDefaultLogAmount(nextFood)));
      }

      if (currentUser && nextFood) {
        const favoriteIds = await DB.getFavoriteFoodIds(currentUser.externalId);
        setIsFavorite(favoriteIds.includes(nextFood.id));
      } else {
        setIsFavorite(false);
      }
    } finally {
      setLoading(false);
    }
  }, [foodId]);

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
  const resolvedLoggedAt = React.useMemo(
    () => {
      if (loggedAt) {
        return loggedAt;
      }

      const now = new Date();
      return buildFoodLoggedAt(date, now.getHours(), now.getMinutes());
    },
    [date, loggedAt],
  );
  const resolvedContextLabel = React.useMemo(
    () => contextLabel?.trim() || formatFoodLoggedTime(resolvedLoggedAt),
    [contextLabel, resolvedLoggedAt],
  );
  const statusLabel =
    scanStatus === "created" ? "Added to library" : "Found in library";

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
      Alert.alert("No account found", "Create or restore a user before saving foods.");
      return;
    }

    await DB.setFoodItemFavorite(user.externalId, food.id, !isFavorite);
    setIsFavorite((current) => !current);
  }, [food, isFavorite, user]);

  const saveLog = React.useCallback(async () => {
    if (!user || !food) {
      Alert.alert("No account found", "Create or restore a user before adding food.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive quantity before logging.");
      return;
    }

    try {
      setSaving(true);
      await DB.addUserFoodLog({
        userExternalId: user.externalId,
        foodId: food.id,
        date,
        loggedAt: resolvedLoggedAt,
        quantityG: quantity,
        mealType: labelValue.trim() || null,
      });
      closeAfterSave();
    } finally {
      setSaving(false);
    }
  }, [
    closeAfterSave,
    date,
    food,
    labelValue,
    quantity,
    resolvedLoggedAt,
    user,
  ]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.bgOrbTop} />
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Barcode"
            title="Add scanned food"
            subtitle="Loading the scanned food..."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#1F1831" />
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
            eyebrow="Barcode"
            title="Food unavailable"
            subtitle="The barcode resolved, but the saved food item could not be loaded."
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

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FoodScreenHeader
          eyebrow="Barcode"
          title="Add scanned food"
          subtitle={`${formatFoodShortDate(date)} | ${resolvedContextLabel} | Review and log this item.`}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.heroCard}>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <CheckCircleIcon size={14} color="#6D52EA" weight="fill" />
              <Text style={styles.pillText}>{statusLabel}</Text>
            </View>
            <View style={styles.pill}>
              <CalendarIcon size={14} color="#6D52EA" weight="bold" />
              <Text style={styles.pillText}>{formatFoodShortDate(date)}</Text>
            </View>
            {barcode ? (
              <View style={styles.pill}>
                <BarcodeIcon size={14} color="#6D52EA" weight="bold" />
                <Text style={styles.pillText}>{barcode}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroTitle}>{food.name}</Text>
          <Text style={styles.heroText}>
            {food.brand ? `${food.brand} | ` : ""}
            {formatFoodSourceLabel(food.source)} | Default serving{" "}
            {formatFoodNumber(serving.value, ` ${serving.unit}`)}
          </Text>

          <View style={styles.previewStrip}>
            <Text style={styles.previewValue}>
              {preview ? `${preview.calories.toFixed(0)} kcal` : "--"}
            </Text>
            <Text style={styles.previewText}>
              {preview
                ? formatMacroLine(preview)
                : "Enter an amount to preview nutrition"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <Text style={styles.sectionSubtitle}>
            Adjust the amount before it is added to your diary.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={quantityValue}
              onChangeText={setQuantityValue}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor="#8A809F"
            />
            <View style={styles.unitPill}>
              <Text style={styles.unitText}>{serving.unit}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Diary slot</Text>
          <Text style={styles.sectionSubtitle}>
            This food will be logged to the selected date and time.
          </Text>
          <View style={styles.slotRow}>
            <View style={styles.slotIcon}>
              <ForkKnifeIcon size={18} color="#6D52EA" weight="fill" />
            </View>
            <View style={styles.slotCopy}>
              <Text style={styles.slotLabel}>Time</Text>
              <Text style={styles.slotValue}>{resolvedContextLabel}</Text>
            </View>
            <Text style={styles.slotDate}>{formatFoodShortDate(date)}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.labelInput]}
            value={labelValue}
            onChangeText={setLabelValue}
            placeholder="Optional label"
            placeholderTextColor="#8A809F"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <Text style={styles.sectionSubtitle}>
            Preview based on the amount above.
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

        <Pressable
          onPress={() => void toggleFavorite()}
          style={({ pressed }) => [
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonActive,
            pressed && styles.cardPressed,
          ]}
        >
          <StarIcon
            size={16}
            color={isFavorite ? "#FFFFFF" : "#6D52EA"}
            weight={isFavorite ? "fill" : "bold"}
          />
          <Text
            style={[
              styles.favoriteButtonText,
              isFavorite && styles.favoriteButtonTextActive,
            ]}
          >
            {isFavorite ? "Saved to favorites" : "Save to favorites"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void saveLog()}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryButton,
            saving && styles.disabled,
            pressed && !saving && styles.cardPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? "Adding..." : "Add to diary"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F4FB",
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
    backgroundColor: "#E4D9FF",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#EEE7FF",
  },
  centerCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 18,
  },
  centerText: {
    color: "#7F7791",
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F3EEFC",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    color: "#6D52EA",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#1B1529",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroText: {
    color: "#7F7791",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  previewStrip: {
    borderRadius: 8,
    backgroundColor: "#1F1831",
    padding: 14,
  },
  previewValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  previewText: {
    color: "#CFC5E7",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#1B1529",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#7F7791",
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
    borderColor: "#E6DEF1",
    borderRadius: 16,
    backgroundColor: "#FBF9FF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#1B1529",
    fontSize: 16,
    fontWeight: "700",
  },
  unitPill: {
    borderRadius: 14,
    backgroundColor: "#F3EEFC",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unitText: {
    color: "#6D52EA",
    fontSize: 15,
    fontWeight: "800",
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    padding: 14,
  },
  slotIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EEFC",
  },
  slotCopy: {
    flex: 1,
  },
  slotLabel: {
    color: "#7E7399",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  slotValue: {
    color: "#1B1529",
    fontSize: 17,
    fontWeight: "900",
  },
  slotDate: {
    color: "#6D52EA",
    fontSize: 13,
    fontWeight: "800",
  },
  labelInput: {
    marginTop: 12,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: 14,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#ECE5F9",
    padding: 12,
  },
  nutritionLabel: {
    color: "#7E7399",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  nutritionValue: {
    color: "#1B1529",
    fontSize: 18,
    fontWeight: "900",
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "#E6DEF1",
    paddingVertical: 15,
    marginBottom: 12,
  },
  favoriteButtonActive: {
    backgroundColor: "#6D52EA",
    borderColor: "#6D52EA",
  },
  favoriteButtonText: {
    color: "#6D52EA",
    fontSize: 15,
    fontWeight: "800",
  },
  favoriteButtonTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#1F1831",
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default ScannedFoodLogScreen;
