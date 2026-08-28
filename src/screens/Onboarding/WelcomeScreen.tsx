import React from "react";
import { Image, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/ui";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { appSpacing } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => (
  <OnboardingStepScreen
    centered
    eyebrow="Nutrition + Training"
    headerAccessory={
      <Image
        accessibilityLabel="Nouri logo"
        source={require("../../../nouri_app_assets/brand/nouri-rounded-preview-transparent.png")}
        style={styles.brandMark}
      />
    }
    progress={onboardingStepProgress(1)}
    stepLabel="Welcome"
    subtitle="Build your plan in under a minute and get tailored calories, macros, and progress tracking."
    title="Nouri"
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
  brandMark: {
    width: 112,
    height: 112,
    marginBottom: appSpacing.xs,
  },
  actions: {
    gap: appSpacing.sm,
  },
});

export default WelcomeScreen;
