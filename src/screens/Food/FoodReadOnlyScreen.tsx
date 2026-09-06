import { Disclosure } from "../../components/ui";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import {
  getMicronutrientTargets,
  MICRONUTRIENT_TARGETS,
  MicronutrientSex,
  OpenFoodMapMicronutrientKey,
} from "../../engine/micronutrients";
import { getAgeFromBirthdateValue } from "../../helpers";
import { DB } from "../../store/DB";
import type { DBFoodItem } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { LoadingState } from "../../components/ui";
import { sharedStyleValues } from "../../theme/sharedStyles";
import { MacroBar } from "./FoodDiaryHeroCard";
import FoodScreenHeader from "./FoodScreenHeader";
import {
  buildFoodLoggedAt,
  formatFoodItemServing,
  formatFoodLoggedTime,
  formatFoodMacro,
  formatFoodNumber,
  formatFoodShortDate,
  formatFoodSourceLabel,
  getFoodQuantityFactor,
  getFoodResolvedServing,
  scaleFoodNutritionForQuantity,
  type FoodNutritionTotals,
} from "./foodUtils";

type FoodReadOnlyRoute = RouteProp<FoodStackParamList, "FoodReadOnly">;
type FoodReadOnlyNav = CompositeNavigationProp<
  NativeStackNavigationProp<FoodStackParamList, "FoodReadOnly">,
  NativeStackNavigationProp<RootStackParamList>
>;

const buildPreview = (
  food: DBFoodItem,
  quantity: number,
): FoodNutritionTotals | null => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return scaleFoodNutritionForQuantity(food, quantity);
};

const FoodReadOnlyScreen = () => {
  const route = useRoute<FoodReadOnlyRoute>();
  const navigation = useNavigation<FoodReadOnlyNav>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);
  const { contextLabel, date, foodId, loggedAt, quantity } = route.params;
  const [food, setFood] = React.useState<DBFoodItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  const microTargets = React.useMemo(
    () =>
      user
        ? getMicronutrientTargets({
            sex: String(user.gender) as MicronutrientSex,
            age: getAgeFromBirthdateValue(user.birthdate) ?? 29,
          })
        : MICRONUTRIENT_TARGETS.generic,
    [user],
  );

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

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      try {
        const nextFood = await DB.getFoodItemById(foodId);
        if (!cancelled) {
          setFood(nextFood);
        }
      } catch {
        if (!cancelled) setFood(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [foodId]);

  const serving = React.useMemo(
    () => (food ? getFoodResolvedServing(food) : null),
    [food],
  );
  const preview = React.useMemo(
    () => (food ? buildPreview(food, quantity) : null),
    [food, quantity],
  );
  const micronutrientFactor = React.useMemo(() => {
    if (!food || !Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }

    return getFoodQuantityFactor(food, quantity);
  }, [food, quantity]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Ingredient"
            title="Ingredient details"
            subtitle="Loading food details..."
            onBack={() => navigation.goBack()}
          />
          <LoadingState
            title="Loading food"
            message="Preparing the ingredient view."
            style={styles.centerCard}
          />
        </View>
      </View>
    );
  }

  if (!food || !serving) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <FoodScreenHeader
            eyebrow="Ingredient"
            title="Food unavailable"
            subtitle="The selected food item could not be loaded."
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <FoodScreenHeader
          title={food.name}
          subtitle={`${formatFoodNumber(quantity, ` ${serving.unit}`)} in recipe`}
          onBack={() => navigation.goBack()}
        />
        <Text style={[styles.heroMeta, { marginBottom: 24 }]}>
          {[food.brand, formatFoodSourceLabel(food.source)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.card}>
          <View style={styles.nutritionGrid}>
            {[
              {
                label: "kcal",
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
            ].map((item) => (
              <View key={item.label} style={styles.nutritionCell}>
                <Text style={styles.nutritionLabel}>{item.label}</Text>
                <Text style={styles.nutritionValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Disclosure title="Micronutrients">
          {(
            Object.entries(microTargets ?? MICRONUTRIENT_TARGETS.generic) as [
              OpenFoodMapMicronutrientKey,
              number,
            ][]
          )
            .filter(([key]) => food?.[key] != null)
            .map(([key, target]) => (
              <MacroBar
                key={key}
                accent={appColors.brand500}
                consumed={Number(food[key] ?? 0) * micronutrientFactor}
                target={target}
                label={key
                  .slice(0, -2)
                  .split(/(?=[A-Z])/)
                  .map((word) => word[0].toUpperCase() + word.slice(1))
                  .join(" ")}
                unit={key.endsWith("Ug") ? "ug" : "mg"}
              />
            ))}
        </Disclosure>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: sharedStyleValues.screen,
  title: {
    color: appColors.textPrimary,
    fontSize: 24,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 12,
  },
  content: sharedStyleValues.content,
  centerCard: sharedStyleValues.centerCard,
  heroCard: sharedStyleValues.cardCompact,
  heroHeaderCopy: {
    marginBottom: 12,
  },
  heroEyebrow: sharedStyleValues.eyebrow,
  heroTitle: sharedStyleValues.heroTitle,
  heroMeta: sharedStyleValues.metaText,
  previewStrip: {
    borderRadius: 10,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  previewValue: {
    color: appColors.textPrimary,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  previewSubtext: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  card: sharedStyleValues.cardCompact,
  sectionTitle: sharedStyleValues.sectionTitle,
  sectionSubtitle: sharedStyleValues.sectionSubtitle,
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  readOnlyLabel: {
    color: appColors.slate300,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flexShrink: 0,
  },
  readOnlyValue: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  nutritionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nutritionCell: { flex: 1, minWidth: 60 },
  nutritionLabel: { ...sharedStyleValues.metaText, marginBottom: 4 },
  nutritionValue: sharedStyleValues.nutritionValue,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.primaryButton,
    marginBottom: 12,
  },
  primaryButtonText: sharedStyleValues.primaryButtonText,
  cardPressed: sharedStyleValues.pressed,
});

export default FoodReadOnlyScreen;
