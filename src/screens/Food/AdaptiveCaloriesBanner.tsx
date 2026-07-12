import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRightIcon, XIcon } from "phosphor-react-native";
import type { DBAdaptiveCalorieRecommendation } from "../../store/DB_TYPES";
import { appColors } from "../../theme/colors";
import { ADAPTIVE_RECALCULATION_INTERVAL_MS } from "../User_Settings/adaptiveCaloriesActions";

type AdaptiveCaloriesBannerProps = {
  recommendation: DBAdaptiveCalorieRecommendation;
  onDismiss?: () => void;
  onReview: () => void;
};

const formatDelta = (value: number) =>
  `${value > 0 ? "+" : ""}${value} kcal`;

const formatNextReviewLabel = (createdAt: string) => {
  const nextReviewAt = new Date(
    new Date(createdAt).getTime() + ADAPTIVE_RECALCULATION_INTERVAL_MS,
  );

  if (Number.isNaN(nextReviewAt.getTime())) {
    return "Next review follows the weekly cadence.";
  }

  return `Next review ${nextReviewAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
};

const AdaptiveCaloriesBanner = ({
  recommendation,
  onDismiss,
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
      <Text style={styles.reviewDate}>
        {formatNextReviewLabel(recommendation.createdAt)}
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onReview}
          accessibilityLabel="Review adaptive calorie recommendation"
          style={({ pressed }) => [
            styles.reviewButton,
            pressed && styles.reviewButtonPressed,
          ]}
        >
          <Text style={styles.reviewButtonText}>Review</Text>
          <CaretRightIcon size={15} color={appColors.white} weight="bold" />
        </Pressable>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityLabel="Close adaptive calorie recommendation"
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.reviewButtonPressed,
            ]}
          >
            <XIcon size={16} color={appColors.textPrimary} weight="bold" />
          </Pressable>
        ) : null}
      </View>
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
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  confidencePill: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    backgroundColor: appColors.slate50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confidenceText: {
    color: appColors.slate900,
    fontSize: 11,
    fontWeight: "600",
  },
  body: {
    color: appColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    fontWeight: "600",
  },
  dismissButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.surfaceGhost,
  },
});

export default AdaptiveCaloriesBanner;
