import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FireIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  GoalType,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import {
  formatSignedCalories,
  listGoalStrategyOptionsForGoal,
} from "../../engine/goalStrategy";
import OnboardingButton from "./onboardingButton";
import OnboardingTopBar from "./OnboardingTopBar";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "GoalRate">;

const buildScreenContent = (goal: GoalType) => {
  if (goal === "lose_fat") {
    return {
      eyebrow: "Deficit Level",
      title: "How strong should the deficit be?",
      subtitle: "Choose how aggressively you want calories to sit below maintenance.",
      notes: [
        "Normal deficit is the most sustainable default for most users.",
        "If training performance matters a lot, start lighter and review after 2-3 weeks.",
      ],
      options: listGoalStrategyOptionsForGoal(goal),
      icon: <FireIcon size={26} color={appColors.danger700} weight="fill" />,
      accentBackground: appColors.dangerSoftBg,
      accentText: appColors.danger700,
    };
  }

  return {
    eyebrow: "Surplus Level",
    title: "How strong should the surplus be?",
    subtitle: "Choose how aggressively calories should sit above maintenance.",
    notes: [
      "Normal surplus is the most balanced starting point for most users.",
      "If you want to stay leaner, begin light and increase only if progress stalls.",
    ],
    options: listGoalStrategyOptionsForGoal(goal),
    icon: <TrendUpIcon size={26} color={appColors.success700} weight="fill" />,
    accentBackground: appColors.success700,
    accentText: appColors.success700,
  };
};

const GoalRateScreen = ({ navigation, route }: Props) => {
  const content = buildScreenContent(route.params.goal);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnboardingTopBar onBack={() => navigation.goBack()} stepLabel="Goal Pace" />

      <View style={styles.headerWrap}>
        <View
          style={[
            styles.headerBadge,
            { backgroundColor: content.accentBackground },
          ]}
        >
          {content.icon}
          <Text style={[styles.eyebrow, { color: content.accentText }]}>
            {content.eyebrow}
          </Text>
        </View>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
      </View>

      <View style={styles.notesCard}>
        {content.notes.map((note) => (
          <Text key={note} style={styles.noteText}>
            {"\u2022"} {note}
          </Text>
        ))}
      </View>

      <View style={styles.optionsWrap}>
        {content.options.map((option) => (
          <OnboardingButton
            key={option.value}
            label={option.label}
            subtitle={`${option.description} ${formatSignedCalories(option.dailyCalorieDelta)}.`}
            value={option.value}
            borderColor={appColors.borderStrong}
            navigation={navigation}
            navGoal="BodyData"
            dataToSend={{
              goal: route.params.goal,
              goalStrategy: option.value,
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.slate50,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
  },
  bgOrbTop: {
    position: "absolute",
    top: -70,
    right: -45,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: appColors.slate200,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -80,
    left: -55,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.success700,
    opacity: 0.3,
  },
  headerWrap: {
    marginTop: 18,
    marginBottom: 18,
    gap: 10,
  },
  headerBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: appColors.slate900,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.slate600,
  },
  notesCard: {
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate300,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: appColors.slate700,
    fontWeight: "600",
  },
  optionsWrap: {
    gap: 10,
  },
});

export default GoalRateScreen;

