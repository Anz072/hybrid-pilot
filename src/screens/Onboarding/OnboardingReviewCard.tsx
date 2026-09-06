import React from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, Disclosure, AppText } from "../../components/ui";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";

export type ReviewItem = {
  label: string;
  onEdit: () => void;
  value: string;
};

type OnboardingReviewCardProps = {
  items: ReviewItem[];
  title?: string;
};

const OnboardingReviewCard = ({
  items,
  title = "Review your answers",
}: OnboardingReviewCardProps) => (
  <Disclosure title={title}>
    {items.map((item, index) => (
      <View
        key={`${item.label}-${index}`}
        style={[styles.row, index > 0 && styles.rowDivider]}
      >
        <View style={styles.valueWrap}>
          <AppText color="muted" variant="metadata">
            {item.label}
          </AppText>
          <AppText variant="bodySmallStrong">{item.value}</AppText>
        </View>
        <AppButton
          accessibilityLabel={`Edit ${item.label.toLowerCase()}`}
          label="Edit"
          onPress={item.onEdit}
          size="sm"
          variant="ghost"
        />
      </View>
    ))}
  </Disclosure>
);

const styles = StyleSheet.create({
  card: {
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: appSpacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
    paddingTop: appSpacing.sm,
  },
  valueWrap: {
    flex: 1,
    gap: appSpacing.xxs,
  },
});

export default OnboardingReviewCard;
