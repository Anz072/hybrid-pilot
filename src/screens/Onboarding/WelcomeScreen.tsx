import React from "react";
import { StyleSheet, View } from "react-native";
import { BarbellIcon, RocketLaunchIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/ui";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingStepScreen, { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => (
  <OnboardingStepScreen
    centered
    eyebrow="Nutrition + Training"
    headerAccessory={
      <View style={styles.heroRow}>
        <View style={styles.heroIconBadge}>
          <RocketLaunchIcon size={24} color={appColors.actionPrimary} weight="fill" />
        </View>
        <View style={styles.heroIconBadgeMuted}>
          <BarbellIcon size={20} color={appColors.textPrimary} weight="fill" />
        </View>
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
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.actionPrimarySoft,
    borderWidth: appBorders.width,
    borderColor: appColors.actionPrimaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconBadgeMuted: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appColors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: appSpacing.sm,
  },
});

export default WelcomeScreen;
