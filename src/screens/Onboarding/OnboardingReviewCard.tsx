import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { appColors } from "../../theme/colors";

export type ReviewItem = {
  label: string;
  value: string;
  onEdit: () => void;
};

type OnboardingReviewCardProps = {
  items: ReviewItem[];
  title?: string;
};

const OnboardingReviewCard = ({
  items,
  title = "Review & edit",
}: OnboardingReviewCardProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <View style={styles.valueWrap}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
            <Pressable
              onPress={item.onEdit}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.editButtonPressed,
              ]}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate300,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  title: {
    color: appColors.slate900,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.slate200,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  valueWrap: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  value: {
    color: appColors.slate900,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: appColors.slate50,
    borderWidth: 1,
    borderColor: appColors.slate300,
    marginTop: 2,
  },
  editButtonPressed: {
    opacity: 0.9,
  },
  editText: {
    color: appColors.slate900,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});

export default OnboardingReviewCard;
