import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LightningIcon, PencilSimpleIcon } from "phosphor-react-native";
import type { FoodDiaryFavoriteFood } from "./foodDiaryTypes";
import { formatFoodHourLabel, formatFoodServing, formatFoodSourceLabel } from "./foodUtils";
import { appColors } from "../../theme/colors";

type FoodDiaryQuickAddsProps = {
  favoriteFoods: FoodDiaryFavoriteFood[];
  selectedHour: number;
  onAddFavorite: (food: FoodDiaryFavoriteFood, hour: number) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, hour: number) => void;
};

const FoodDiaryQuickAdds = ({
  favoriteFoods,
  selectedHour,
  onAddFavorite,
  onQuickLogFavorite,
}: FoodDiaryQuickAddsProps) => {
  if (favoriteFoods.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        Frequent at {formatFoodHourLabel(selectedHour)}
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
            <View style={styles.favoriteActionRow}>
              <Pressable
                onPress={() => onQuickLogFavorite(food, selectedHour)}
                accessibilityLabel={`Quick log ${food.name}`}
                style={({ pressed }) => [
                  styles.favoriteButton,
                  pressed && styles.cardPressed,
                ]}
              >
                <LightningIcon
                  size={16}
                  color={appColors.white}
                  weight="fill"
                />
              </Pressable>
              <Pressable
                onPress={() => onAddFavorite(food, selectedHour)}
                accessibilityLabel={`Adjust ${food.name} before logging`}
                style={({ pressed }) => [
                  styles.favoriteIconButton,
                  pressed && styles.cardPressed,
                ]}
              >
                <PencilSimpleIcon
                  size={16}
                  color={appColors.brand500}
                  weight="bold"
                />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  favoriteRow: {
    gap: 12,
    paddingRight: 12,
  },
  favoriteCard: {
    width: 214,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
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
    height: 42,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  favoriteActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  favoriteIconButton: {
    width: 42,
    height: 42,
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
