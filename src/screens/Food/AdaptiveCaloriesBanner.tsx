import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DBAdaptiveCalorieRecommendation } from "../../store/DB_TYPES";
import { appColors } from "../../theme/colors";

type AdaptiveCaloriesBannerProps = {
  recommendation: DBAdaptiveCalorieRecommendation;
  onReview: () => void;
};

const formatDelta = (value: number) =>
  `${value > 0 ? "+" : ""}${value} kcal`;

const AdaptiveCaloriesBanner = ({
  recommendation,
  onReview,
}: AdaptiveCaloriesBannerProps) => {
  const currentBaseCalories = recommendation.currentBaseCalories;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Adaptive Calories</Text>
          <Text style={styles.title}>A new target is ready to review</Text>
        </View>
        <View style={styles.confidencePill}>
          <Text style={styles.confidenceText}>
            {recommendation.confidence.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.body}>
        {currentBaseCalories != null
          ? `Current base target ${currentBaseCalories} kcal/day. Suggested target ${recommendation.recommendedBaseCalories} kcal/day (${formatDelta(
              recommendation.recommendedDelta,
            )}).`
          : `Suggested base target ${recommendation.recommendedBaseCalories} kcal/day based on your recent complete diary days and weight trend.`}
      </Text>

      <Pressable
        onPress={onReview}
        style={({ pressed }) => [
          styles.reviewButton,
          pressed && styles.reviewButtonPressed,
        ]}
      >
        <Text style={styles.reviewButtonText}>Review recommendation</Text>
      </Pressable>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  eyebrow: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  title: {
    color: appColors.foodText,
    fontSize: 18,
    fontWeight: "900",
  },
  confidencePill: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    backgroundColor: appColors.revolutLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confidenceText: {
    color: appColors.revolutDark,
    fontSize: 11,
    fontWeight: "800",
  },
  body: {
    color: appColors.foodMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  reviewButton: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reviewButtonPressed: {
    opacity: 0.9,
  },
  reviewButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
});

export default AdaptiveCaloriesBanner;
