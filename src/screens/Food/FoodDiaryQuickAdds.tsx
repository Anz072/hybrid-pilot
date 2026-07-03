import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LightningIcon, PencilSimpleIcon } from "phosphor-react-native";
import type { FoodDiaryFavoriteFood } from "./foodDiaryTypes";
import {
  formatFoodServing,
  formatFoodSourceLabel,
  MEAL_SLOT_LABELS,
  type MealSlot,
} from "./foodUtils";
import { appColors } from "../../theme/colors";

type FoodDiaryQuickAddsProps = {
  favoriteFoods: FoodDiaryFavoriteFood[];
  recentFoods: FoodDiaryFavoriteFood[];
  selectedMeal: MealSlot;
  onAddFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
};

const QuickPickCard = ({
  food,
  selectedMeal,
  onAddFavorite,
  onQuickLogFavorite,
}: {
  food: FoodDiaryFavoriteFood;
  selectedMeal: MealSlot;
  onAddFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
}) => (
  <View style={styles.favoriteCard}>
    <Text style={styles.favoriteEyebrow}>
      {formatFoodSourceLabel(food.source)}
    </Text>
    <Text style={styles.favoriteName} numberOfLines={2}>
      {food.name}
    </Text>
    <Text style={styles.favoriteMeta}>
      {Math.round(food.calories)} kcal |{" "}
      {formatFoodServing(food.servingSize, food.servingUnit)}
    </Text>
    <Text style={styles.favoriteMeta}>
      {food.proteinG.toFixed(0)}P | {food.carbsG.toFixed(0)}C |{" "}
      {food.fatG.toFixed(0)}F
    </Text>
    <View style={styles.favoriteActionRow}>
      <Pressable
        onPress={() => onQuickLogFavorite(food, selectedMeal)}
        accessibilityLabel={`Quick log ${food.name}`}
        style={({ pressed }) => [
          styles.favoriteButton,
          pressed && styles.cardPressed,
        ]}
      >
        <LightningIcon size={16} color={appColors.white} weight="fill" />
        <Text style={styles.favoriteButtonText}>Log</Text>
      </Pressable>
      <Pressable
        onPress={() => onAddFavorite(food, selectedMeal)}
        accessibilityLabel={`Adjust ${food.name} before logging`}
        style={({ pressed }) => [
          styles.favoriteIconButton,
          pressed && styles.cardPressed,
        ]}
      >
        <PencilSimpleIcon size={16} color={appColors.brand500} weight="bold" />
      </Pressable>
    </View>
  </View>
);

const FoodDiaryQuickAdds = ({
  favoriteFoods,
  recentFoods,
  selectedMeal,
  onAddFavorite,
  onQuickLogFavorite,
}: FoodDiaryQuickAddsProps) => {
  if (favoriteFoods.length === 0 && recentFoods.length === 0) {
    return null;
  }

  const renderRail = (foods: FoodDiaryFavoriteFood[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.favoriteRow}
    >
      {foods.map((food) => (
        <QuickPickCard
          key={food.id}
          food={food}
          selectedMeal={selectedMeal}
          onAddFavorite={onAddFavorite}
          onQuickLogFavorite={onQuickLogFavorite}
        />
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.card}>
      {favoriteFoods.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            Quick picks for {MEAL_SLOT_LABELS[selectedMeal]}
          </Text>
          {renderRail(favoriteFoods)}
        </>
      ) : null}

      {recentFoods.length > 0 ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              favoriteFoods.length > 0 && styles.sectionTitleSpaced,
            ]}
          >
            Recently logged
          </Text>
          {renderRail(recentFoods)}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceField,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
    marginBottom: 18,
  },
  sectionTitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 16,
  },
  favoriteRow: {
    gap: 12,
    paddingRight: 12,
  },
  favoriteCard: {
    width: 202,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 14,
  },
  favoriteEyebrow: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  favoriteName: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  favoriteMeta: {
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  favoriteButton: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  favoriteButtonText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  favoriteActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  favoriteIconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryQuickAdds;
