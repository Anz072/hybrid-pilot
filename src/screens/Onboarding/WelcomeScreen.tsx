import React from "react";
import { StyleSheet, View } from "react-native";
import { BarbellIcon, RocketLaunchIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/ui";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appSpacing } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => (
  <OnboardingStepScreen
    centered
    eyebrow="Nutrition + Training"
    headerAccessory={
      <View style={styles.heroRow}>
        <RocketLaunchIcon size={28} color={appColors.actionPrimary} weight="fill" />
        <BarbellIcon size={24} color={appColors.textPrimary} weight="fill" />
      </View>
    }
    progress={onboardingStepProgress(1)}
    stepLabel="Welcome"
    subtitle="Build your plan in under a minute and get tailored calories, macros, and progress tracking."
    title="Dribsnis"
  >
    <View style={styles.actions}>
      <OnboardingPrimaryButton
        label="Get Started"
        onPress={() => navigation.navigate("Goal")}
      />
      <AppButton
        label="I already have an account"
        onPress={() => navigation.navigate("Login")}
        variant="secondary"
      />
    </View>
  </OnboardingStepScreen>
);

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.sm,
    marginBottom: appSpacing.xs,
  },
  actions: {
    gap: appSpacing.sm,
  },
});

export default WelcomeScreen;
