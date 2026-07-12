import React from "react";
import { StyleSheet, View } from "react-native";
import { FireIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppCard, AppText } from "../../components/ui";
import {
  formatSignedCalories,
  listGoalStrategyOptionsForGoal,
} from "../../engine/goalStrategy";
import type {
  GoalType,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingButton from "./onboardingButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "GoalRate">;

const buildScreenContent = (goal: GoalType) => {
  if (goal === "lose_fat") {
    return {
      eyebrow: "Deficit Level",
      icon: <FireIcon size={22} color={appColors.statusError} weight="fill" />,
      notes: [
        "Normal deficit is the most sustainable default for most users.",
        "If training performance matters a lot, start lighter and review after 2-3 weeks.",
      ],
      options: listGoalStrategyOptionsForGoal(goal),
      subtitle: "Choose how aggressively you want calories to sit below maintenance.",
      title: "How strong should the deficit be?",
    };
  }

  return {
    eyebrow: "Surplus Level",
    icon: <TrendUpIcon size={22} color={appColors.statusSuccess} weight="fill" />,
    notes: [
      "Normal surplus is the most balanced starting point for most users.",
      "If you want to stay leaner, begin light and increase only if progress stalls.",
    ],
    options: listGoalStrategyOptionsForGoal(goal),
    subtitle: "Choose how aggressively calories should sit above maintenance.",
    title: "How strong should the surplus be?",
  };
};

const GoalRateScreen = ({ navigation, route }: Props) => {
  const content = buildScreenContent(route.params.goal);

  return (
    <OnboardingStepScreen
      eyebrow={content.eyebrow}
      headerAccessory={content.icon}
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(3)}
      stepLabel="Goal Pace"
      subtitle={content.subtitle}
      title={content.title}
    >
      <AppCard style={styles.notesCard} variant="soft">
        {content.notes.map((note) => (
          <AppText key={note} color="secondary" variant="bodySmall">
            {"\u2022"} {note}
          </AppText>
        ))}
      </AppCard>

      <View style={styles.optionsWrap}>
        {content.options.map((option) => (
          <OnboardingButton
            dataToSend={{
              goal: route.params.goal,
              goalStrategy: option.value,
            }}
            key={option.value}
            label={option.label}
            navGoal="BodyData"
            navigation={navigation}
            subtitle={`${option.description} ${formatSignedCalories(option.dailyCalorieDelta)}.`}
            value={option.value}
          />
        ))}
      </View>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  notesCard: {
    gap: appSpacing.xs,
    marginBottom: appSpacing.md,
  },
  optionsWrap: {
    gap: appSpacing.sm,
  },
});

export default GoalRateScreen;
