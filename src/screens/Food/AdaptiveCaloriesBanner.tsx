import React from "react";
import { View, StyleSheet } from "react-native";
import { XIcon } from "phosphor-react-native";
import type { DBAdaptiveCalorieRecommendation } from "../../store/DB_TYPES";
import { appColors } from "../../theme/colors";
import {
  appBorders,
  appRadius,
  appSpacing,
  appSurfaces,
} from "../../theme/tokens";
import { AppButton, CoachNote, IconButton } from "../../components/ui";
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
  })}.`;
};

const AdaptiveCaloriesBanner = ({
  recommendation,
  onDismiss,
  onReview,
}: AdaptiveCaloriesBannerProps) => {
  const currentBaseCalories = recommendation.currentBaseCalories;
  const bodyText =
    currentBaseCalories != null
      ? `Current base target ${currentBaseCalories} kcal/day. Suggested target ${recommendation.recommendedBaseCalories} kcal/day (${formatDelta(
          recommendation.recommendedDelta,
        )}).`
      : `Suggested base target ${recommendation.recommendedBaseCalories} kcal/day based on your recent complete diary days and weight trend.`;
  const message = `${bodyText} Confidence: ${recommendation.confidence}. ${formatNextReviewLabel(recommendation.createdAt)}`;

  return (
    <CoachNote
      action={
        <View style={styles.actionRow}>
          <AppButton
            accessibilityLabel="Review adaptive calorie recommendation"
            label="Review"
            onPress={onReview}
            size="sm"
          />
          {onDismiss ? (
            <IconButton
              accessibilityLabel="Close adaptive calorie recommendation"
              onPress={onDismiss}
            >
              <XIcon size={16} color={appColors.textPrimary} weight="bold" />
            </IconButton>
          ) : null}
        </View>
      }
      eyebrow="Adaptive calories"
      message={message}
      messageVariant="bodySmall"
      style={styles.card}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appSurfaces.soft,
    borderRadius: appRadius.md,
    borderWidth: 0,
    borderLeftWidth: appBorders.ruleWidth,
    borderLeftColor: appColors.actionPrimary,
    padding: appSpacing.md,
    marginBottom: appSpacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.sm,
  },
});

export default AdaptiveCaloriesBanner;
