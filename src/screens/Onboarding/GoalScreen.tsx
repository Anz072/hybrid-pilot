import React from "react";
import { StyleSheet, View } from "react-native";
import { FireIcon, ShieldCheckIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  GoalType,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingButton from "./onboardingButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "Goal">;

type GoalOption = {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  value: GoalType;
};

const GoalScreen = ({ navigation }: Props) => {
  const options: GoalOption[] = [
    {
      label: "Lose fat",
      value: "lose_fat",
      subtitle: "Slight calorie deficit with protein-first targets.",
      icon: <FireIcon size={22} color={appColors.actionPrimary} weight="fill" />,
    },
    {
      label: "Maintain",
      value: "maintain",
      subtitle: "Balanced intake to keep performance steady.",
      icon: <ShieldCheckIcon size={22} color={appColors.statusSuccess} weight="fill" />,
    },
    {
      label: "Build muscle",
      value: "build_muscle",
      subtitle: "Lean surplus and recovery-focused macro split.",
      icon: <TrendUpIcon size={22} color={appColors.protein} weight="fill" />,
    },
  ];

  return (
    <OnboardingStepScreen
      eyebrow="Setup"
      onBack={() => navigation.goBack()}
      progress={onboardingStepProgress(2)}
      stepLabel="Goal"
      subtitle="Pick one to tune calories, macros, and training recommendations."
      title="What is your primary goal?"
    >
      <View style={styles.optionsWrap}>
        {options.map((option) => (
          <OnboardingButton
            dataToSend={
              option.value === "maintain"
                ? { goal: option.value, goalStrategy: "maintain" }
                : { goal: option.value }
            }
            icon={option.icon}
            key={option.value}
            label={option.label}
            navGoal={option.value === "maintain" ? "BodyData" : "GoalRate"}
            navigation={navigation}
            subtitle={option.subtitle}
            value={option.value}
          />
        ))}
      </View>
    </OnboardingStepScreen>
  );
};

const styles = StyleSheet.create({
  optionsWrap: {
    gap: appSpacing.sm,
  },
});

export default GoalScreen;
