import React from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppCard, AppText } from "../../components/ui";
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
  title = "Review & edit",
}: OnboardingReviewCardProps) => (
  <AppCard style={styles.card} variant="soft">
    <AppText variant="cardTitle">{title}</AppText>
    {items.map((item, index) => (
      <View key={`${item.label}-${index}`}>
        {index > 0 ? <View style={styles.divider} /> : null}
        <View style={styles.row}>
          <View style={styles.valueWrap}>
            <AppText color="muted" variant="eyebrow">
              {item.label}
            </AppText>
            <AppText color="secondary" variant="bodySmallStrong">
              {item.value}
            </AppText>
          </View>
          <AppButton
            label="Edit"
            onPress={item.onEdit}
            size="sm"
            variant="secondary"
          />
        </View>
      </View>
    ))}
  </AppCard>
);

const styles = StyleSheet.create({
  card: {
    gap: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.borderSoft,
    marginBottom: appSpacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: appSpacing.sm,
  },
  valueWrap: {
    flex: 1,
    gap: appSpacing.xxs,
  },
});

export default OnboardingReviewCard;
