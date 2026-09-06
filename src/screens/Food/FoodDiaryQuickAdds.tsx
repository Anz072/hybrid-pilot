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
import { appBorders, appRadius, appSpacing } from "../../theme/tokens";

import MealBucketSelect from "./MealBucketSelect";
import { AppText } from "../../components/ui";
import { useReducedMotion } from "../../theme/useReducedMotion";

type FoodDiaryQuickAddsProps = {
  onSelectMeal: (slot: MealSlot) => void;
  onBeforeToggle: () => void;
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
      <Text style={styles.favoriteName} numberOfLines={2}>
        {food.name}
      </Text>
      <Text style={styles.favoriteMeta}>
        {Math.round(food.calories)} kcal ·{" "}
        {formatFoodServing(food.servingSize, food.servingUnit)}
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
            color={appColors.textSecondary}
            weight="bold"
          />
        </Pressable>
      </View>
    </View>
  );
};

const FoodDiaryQuickAdds = ({
  onSelectMeal,
  onBeforeToggle,
  favoriteFoods,
  recentFoods,
  selectedMeal,
  onAddFavorite,
  onQuickLogFavorite,
}: FoodDiaryQuickAddsProps) => {
  const [recentExpanded, setRecentExpanded] = React.useState(false);
  const reducedMotion = useReducedMotion();

  const toggleRecentExpanded = () => {
    onBeforeToggle();
    if (!reducedMotion)
      LayoutAnimation.configureNext({
        ...LayoutAnimation.Presets.easeInEaseOut,
        duration: 160,
      });
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
      <View style={styles.targetRow}>
        {favoriteFoods.length > 0 || recentFoods.length > 0 ? (
          <AppText color="secondary" variant="bodySmallStrong">
            Quick picks
          </AppText>
        ) : null}
        <MealBucketSelect
          value={selectedMeal}
          onChange={onSelectMeal}
          accessibilityLabel={`Meal for quick picks and repeat: ${MEAL_SLOT_LABELS[selectedMeal]}`}
        />
      </View>
      {favoriteFoods.length > 0 ? <>{renderRail(favoriteFoods)}</> : null}

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
  targetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.xs,
    marginVertical: appSpacing.xs,
  },
  card: {
    marginBottom: appSpacing.md,
  },
  sectionTitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "none",
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 16,
  },
  recentHeader: {
    minHeight: 48,
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
    width: 180,
    borderRadius: appRadius.md,
    borderWidth: 0,
    borderColor: appBorders.soft,
    backgroundColor: appColors.surfaceField,
    padding: appSpacing.sm,
  },
  reviewCard: {
    minHeight: 96,
    justifyContent: "flex-start",
  },
  favoriteEyebrow: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "none",
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
    borderRadius: appRadius.md,
    backgroundColor: appColors.actionPrimary,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: appSpacing.sm,
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
    backgroundColor: appColors.surfaceField,
    alignItems: "center",
    justifyContent: "center",
    marginTop: appSpacing.sm,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodDiaryQuickAdds;
