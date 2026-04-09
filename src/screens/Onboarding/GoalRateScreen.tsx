import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FireIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GoalType, OnboardingParamList } from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";
import OnboardingTopBar from "./OnboardingTopBar";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "GoalRate">;

type GoalRateOption = {
  label: string;
  subtitle: string;
  value: number;
};

const LOSS_OPTIONS: GoalRateOption[] = [
  {
    label: "0.25 kg per week",
    subtitle: "Easiest to recover from and great when performance matters.",
    value: 0.25,
  },
  {
    label: "0.50 kg per week",
    subtitle: "Balanced pace and the best starting point for most people.",
    value: 0.5,
  },
  {
    label: "0.75 kg per week",
    subtitle: "More aggressive, so hunger and recovery need closer attention.",
    value: 0.75,
  },
];

const GAIN_OPTIONS: GoalRateOption[] = [
  {
    label: "0.10 kg per week",
    subtitle: "Very lean, slower progress with minimal overshooting.",
    value: 0.1,
  },
  {
    label: "0.20 kg per week",
    subtitle: "Balanced pace and the best starting point for most people.",
    value: 0.2,
  },
  {
    label: "0.30 kg per week",
    subtitle: "Faster scale progress, but body-fat gain is more likely.",
    value: 0.3,
  },
];

const buildScreenContent = (goal: GoalType) => {
  if (goal === "lose_fat") {
    return {
      eyebrow: "Fat Loss Pace",
      title: "How fast do you want to lose weight?",
      subtitle: "Choose a weekly pace so we can set a more realistic calorie target.",
      notes: [
        "0.50 kg/week is the most sustainable default for most users.",
        "If training performance matters a lot, start at 0.25 kg/week and review after 2-3 weeks.",
      ],
      options: LOSS_OPTIONS,
      icon: <FireIcon size={26} color={appColors.danger700} weight="fill" />,
      accentBackground: appColors.dangerSoftBg,
      accentText: appColors.danger700,
    };
  }

  return {
    eyebrow: "Muscle Gain Pace",
    title: "How fast do you want to gain weight?",
    subtitle: "A lean gain works best when the weekly pace matches your training quality.",
    notes: [
      "0.20 kg/week is the most balanced starting point for most users.",
      "If you want to stay leaner, begin at 0.10 kg/week and increase only if progress stalls.",
    ],
    options: GAIN_OPTIONS,
    icon: <TrendUpIcon size={26} color={appColors.green700} weight="fill" />,
    accentBackground: appColors.greenSoftBg,
    accentText: appColors.green700,
  };
};

const GoalRateScreen = ({ navigation, route }: Props) => {
  const content = buildScreenContent(route.params.goal);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
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
            subtitle={option.subtitle}
            value={String(option.value)}
            borderColor={appColors.charcoal}
            navigation={navigation}
            navGoal="BodyData"
            dataToSend={{
              goal: route.params.goal,
              goalRateKgPerWeek: option.value,
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
    backgroundColor: appColors.amberSoft,
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
    borderRadius: 12,
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
