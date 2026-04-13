import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GaugeIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  ActivityLevel,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatBodySummary,
  formatGoalSummary,
} from "./onboardingSummary";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "Activity">;

const ActivityLevelScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const levels: {
    label: string;
    value: ActivityLevel;
    note: string;
    accent: string;
    bgColor?: string;
    borderColor?: string;
  }[] = [
    {
      label: "Desk mode",
      value: "sedentary",
      note: "Mostly seated, minimal movement.",
      accent: appColors.raw_hex_BFDBFE,
      bgColor: appColors.raw_hex_bfdbfe9a,
      borderColor: appColors.raw_hex_60a5fa,
    },
    {
      label: "Light movement",
      value: "lightly_active",
      note: "Daily steps with occasional activity.",
      accent: appColors.raw_hex_A7F3D0,
      bgColor: appColors.raw_hex_a7f3d09a,
      borderColor: appColors.emerald500,
    },
    {
      label: "Regular training",
      value: "moderately_active",
      note: "Frequent workouts through the week.",
      accent: appColors.amberSoft,
      bgColor: appColors.raw_hex_fde68a9a,
      borderColor: appColors.raw_hex_f59e0b,
    },
    {
      label: "High output",
      value: "very_active",
      note: "Demanding routine and heavy training volume.",
      accent: appColors.raw_hex_FECACA,
      bgColor: appColors.raw_hex_fecaca9a,
      borderColor: appColors.raw_hex_ef4444,
    },
    {
      label: "Beast mode",
      value: "athlete",
      note: "Performance-centric, high weekly load.",
      accent: appColors.violetSoftBg,
      bgColor: appColors.raw_hex_ddd6fe9a,
      borderColor: appColors.violet600,
    },
  ];

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
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <OnboardingTopBar
        onBack={() => navigation.goBack()}
        stepLabel="Activity"
      />

      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <GaugeIcon size={24} color={appColors.sky700} weight="fill" />
          <Text style={styles.eyebrow}>Daily Baseline</Text>
        </View>
        <Text style={styles.title}>How active are you?</Text>
        <Text style={styles.subtitle}>
          Choose your baseline outside dedicated workouts.
        </Text>
      </View>

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
        ]}
      />

      <View style={styles.listWrap}>
        {levels.map((item) => (
          <View key={item.value}>
            <OnboardingButton
              label={item.label}
              subtitle={item.note}
              dataToSend={{
                goal: route.params.goal,
                goalRateKgPerWeek: route.params.goalRateKgPerWeek,
                bodyData: route.params.bodyData,
                activity: item.value,
              }}
              value={item.value}
              borderColor={appColors.charcoal}
              navigation={navigation}
              navGoal="Training"
            />
          </View>
        ))}
      </View>
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
  bgOrbTop: {
    position: "absolute",
    top: -64,
    right: -46,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: appColors.skySoftBg,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -72,
    left: -56,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.foodEyebrowBg,
  },
  headerWrap: {
    marginTop: 18,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.sky800,
    backgroundColor: appColors.skySoftBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.slate600,
  },
  listWrap: {
    gap: 10,
  },
  levelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appColors.white,
    borderColor: appColors.slate200,
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  levelButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  accentBar: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: 999,
    marginRight: 10,
  },
  levelTextWrap: {
    flex: 1,
  },
  levelText: {
    fontSize: 20,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: appColors.slate900,
    marginBottom: 3,
    marginTop: 4,
  },
  levelNote: {
    fontSize: 13,
    color: appColors.slate500,
    lineHeight: 18,
  },
  levelText99: {
    color: appColors.slate900,
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 3,
  },
  levelNote99: {
    color: appColors.slate500,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ActivityLevelScreen;
