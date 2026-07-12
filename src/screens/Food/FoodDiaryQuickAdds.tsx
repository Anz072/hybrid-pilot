import React from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CaretDownIcon,
  CaretUpIcon,
  LightningIcon,
  PencilSimpleIcon,
} from "phosphor-react-native";
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
  mode = "quickPick",
  selectedMeal,
  onAddFavorite,
  onQuickLogFavorite,
}: {
  food: FoodDiaryFavoriteFood;
  mode?: "quickPick" | "review";
  selectedMeal: MealSlot;
  onAddFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
  onQuickLogFavorite: (food: FoodDiaryFavoriteFood, slot: MealSlot) => void;
}) => {
  const content = (
    <>
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
    </>
  );

  if (mode === "review") {
    return (
      <Pressable
        accessibilityLabel={`Review ${food.name}`}
        onPress={() => onAddFavorite(food, selectedMeal)}
        style={({ pressed }) => [
          styles.favoriteCard,
          styles.reviewCard,
          pressed && styles.cardPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.favoriteCard}>
      {content}
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
          <PencilSimpleIcon
            size={16}
            color={appColors.brand500}
            weight="bold"
          />
        </Pressable>
      </View>
    </View>
  );
};

const FoodDiaryQuickAdds = ({
  favoriteFoods,
  recentFoods,
  selectedMeal,
  onAddFavorite,
  onQuickLogFavorite,
}: FoodDiaryQuickAddsProps) => {
  const [recentExpanded, setRecentExpanded] = React.useState(false);

  if (favoriteFoods.length === 0 && recentFoods.length === 0) {
    return null;
  }

  const toggleRecentExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRecentExpanded((current) => !current);
  };

  const renderRail = (
    foods: FoodDiaryFavoriteFood[],
    mode: "quickPick" | "review" = "quickPick",
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.favoriteRow}
    >
      {foods.map((food) => (
        <QuickPickCard
          key={food.id}
          food={food}
          mode={mode}
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
          <Pressable
            accessibilityLabel={
              recentExpanded
                ? "Collapse recently logged foods"
                : "Expand recently logged foods"
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: recentExpanded }}
            onPress={toggleRecentExpanded}
            style={({ pressed }) => [
              styles.recentHeader,
              favoriteFoods.length > 0 && styles.sectionTitleSpaced,
              recentExpanded && styles.recentHeaderExpanded,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={[styles.sectionTitle, styles.recentHeaderTitle]}>
              Recently logged
            </Text>
            {recentExpanded ? (
              <CaretUpIcon
                size={17}
                color={appColors.textMuted}
                weight="bold"
              />
            ) : (
              <CaretDownIcon
                size={17}
                color={appColors.textMuted}
                weight="bold"
              />
            )}
          </Pressable>
          {recentExpanded ? renderRail(recentFoods, "review") : null}
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
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 16,
  },
  recentHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  recentHeaderTitle: {
    flex: 1,
    marginBottom: 0,
  },
  recentHeaderExpanded: {
    marginBottom: 12,
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
  reviewCard: {
    width: 168,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "flex-start",
  },
  favoriteEyebrow: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  favoriteName: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
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
    fontWeight: "600",
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
