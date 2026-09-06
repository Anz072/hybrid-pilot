import { appColors } from "../../theme/colors";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/ui";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { appSpacing } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingStepScreen, {
  onboardingStepProgress,
} from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => (
  <OnboardingStepScreen
    centered
    headerAccessory={
      <Image
        accessibilityLabel="Nouri logo"
        source={require("../../../nouri_app_assets/brand/nouri-mark-transparent-2048.png")}
        style={styles.brandMark}
      />
    }
    subtitle="Food, weight, and a plan that fits you."
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
    width: 80,
    height: 80,
    tintColor: appColors.actionPrimary,
    marginBottom: appSpacing.xs,
  },
  actions: {
    gap: appSpacing.sm,
  },
});

export default WelcomeScreen;
