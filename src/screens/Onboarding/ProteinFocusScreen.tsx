import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarbellIcon, CheckIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OnboardingParamList,
  ProteinFocus,
} from "../../navigation/onboardingTypes";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";
import { appColors } from "../../theme/colors";
import { PROTEIN_FOCUS_OPTIONS } from "../../engine/proteinFocus";

type Props = NativeStackScreenProps<OnboardingParamList, "ProteinFocus">;

const ProteinFocusScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const [selectedProteinFocus, setSelectedProteinFocus] =
    React.useState<ProteinFocus>(route.params.proteinFocus ?? "focused");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <OnboardingTopBar
        onBack={() => navigation.goBack()}
        stepLabel="Protein Focus"
      />
      <Text style={styles.eyebrow}>Macro Bias</Text>
      <Text style={styles.title}>How protein-focused should this be?</Text>
      <Text style={styles.subtitle}>
        This changes macro targets and protein grams per kilogram, while leaving
        the calorie recommendation itself alone.
      </Text>

      <OnboardingReviewCard
        items={[
          {
            label: "Goal",
            value: formatGoalSummary(
              route.params.goal,
              route.params.goalRateKgPerWeek,
            ),
            onEdit: () => navigation.push("Goal"),
          },
          {
            label: "Body data",
            value: formatBodySummary(route.params.bodyData),
            onEdit: () =>
              navigation.push("BodyData", {
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
                bodyData: route.params.bodyData,
              }),
          },
          {
            label: "Activity",
            value: formatActivitySummary(route.params.activity),
            onEdit: () =>
              navigation.push("Activity", {
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
                bodyData: route.params.bodyData,
              }),
          },
          {
            label: "Training",
            value: formatTrainingSummary(route.params.training),
            onEdit: () =>
              navigation.push("Training", {
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
                bodyData: route.params.bodyData,
                activity: route.params.activity,
                training: route.params.training,
                proteinFocus: selectedProteinFocus,
              }),
          },
        ]}
      />

      <View style={styles.listWrap}>
        {PROTEIN_FOCUS_OPTIONS.map((option) => {
          const isSelected = selectedProteinFocus === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setSelectedProteinFocus(option.value)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionRow}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>
                    {option.label} ({option.gramsPerKg} g/kg)
                  </Text>
                  <Text style={styles.optionText}>{option.description}</Text>
                </View>
                <View style={styles.optionMeta}>
                  <View style={styles.iconBadge}>
                    <BarbellIcon
                      size={22}
                      color={appColors.slate900}
                      weight="fill"
                    />
                  </View>
                  <View
                    style={[
                      styles.checkBadge,
                      isSelected && styles.checkBadgeSelected,
                    ]}
                  >
                    {isSelected ? (
                      <CheckIcon size={14} color={appColors.white} weight="bold" />
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.helper}>
        Current selection: {formatProteinFocusSummary(selectedProteinFocus)}
      </Text>

      <OnboardingPrimaryButton
        label="Continue"
        style={styles.primaryButton}
        onPress={() =>
          navigation.push("FuelPlan", {
            goal: route.params.goal,
            goalRateKgPerWeek: route.params.goalRateKgPerWeek,
            bodyData: route.params.bodyData,
            activity: route.params.activity,
            training: route.params.training,
            proteinFocus: selectedProteinFocus,
          })
        }
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 22,
    flexGrow: 1,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.brand500,
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: appColors.slate600,
    marginBottom: 18,
  },
  listWrap: {
    gap: 10,
  },
  option: {
    backgroundColor: appColors.surfaceCanvasAlt,
    borderWidth: 1,
    borderColor: appColors.slate300,
    borderRadius: 8,
    padding: 14,
  },
  optionSelected: {
    borderColor: appColors.brand700,
    backgroundColor: appColors.slate900,
  },
  optionPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: appColors.textPrimary,
    fontWeight: "800",
    fontSize: 17,
    marginBottom: 4,
  },
  optionText: {
    color: appColors.slate500,
    fontSize: 13,
    lineHeight: 18,
  },
  optionMeta: {
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: appColors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.slate300,
    backgroundColor: appColors.surfaceCanvasAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeSelected: {
    backgroundColor: appColors.slate900,
    borderColor: appColors.brand700,
  },
  helper: {
    marginTop: 12,
    color: appColors.slate600,
    fontSize: 13,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 18,
  },
});

export default ProteinFocusScreen;
