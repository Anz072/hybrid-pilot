import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FoodDiaryFavoriteFood } from "./foodDiaryTypes";
import { formatFoodHourLabel, formatFoodServing, formatFoodSourceLabel } from "./foodUtils";
import { appColors } from "../../theme/colors";

type FoodDiaryQuickAddsProps = {
  favoriteFoods: FoodDiaryFavoriteFood[];
  selectedHour: number;
  onAddFavorite: (food: FoodDiaryFavoriteFood, hour: number) => void;
};

const FoodDiaryQuickAdds = ({
  favoriteFoods,
  selectedHour,
  onAddFavorite,
}: FoodDiaryQuickAddsProps) => {
  if (favoriteFoods.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        Quick adds at {formatFoodHourLabel(selectedHour)}
      </Text>
      <Text style={styles.sectionText}>
        Your repeat foods stay one tap away, with a quick amount check first.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.favoriteRow}
      >
        {favoriteFoods.map((food) => (
          <View key={food.id} style={styles.favoriteCard}>
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
            <Pressable
              onPress={() => onAddFavorite(food, selectedHour)}
              style={({ pressed }) => [
                styles.favoriteButton,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.favoriteButtonText}>Review</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.whiteOverlay96,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionText: {
    color: appColors.foodMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  favoriteRow: {
    gap: 12,
    paddingRight: 12,
  },
  favoriteCard: {
    width: 214,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    borderWidth: 1,
    borderColor: appColors.foodSoftBorder,
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
    color: appColors.foodText,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  favoriteMeta: {
    color: appColors.slate300,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  favoriteButton: {
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  favoriteButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryQuickAdds;
