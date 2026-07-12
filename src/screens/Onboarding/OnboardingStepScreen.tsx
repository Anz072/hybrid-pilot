import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../components/ui";
import { appColors } from "../../theme/colors";
import { appSpacing, appSurfaces } from "../../theme/tokens";
import OnboardingTopBar from "./OnboardingTopBar";

export const ONBOARDING_TOTAL_STEPS = 10;

export const onboardingStepProgress = (step: number) =>
  step / ONBOARDING_TOTAL_STEPS;

type OnboardingStepScreenProps = {
  centered?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  footer?: React.ReactNode;
  headerAccessory?: React.ReactNode;
  onBack?: () => void;
  progress?: number;
  stepLabel?: string;
  subtitle?: string;
  title: string;
};

const OnboardingStepScreen = ({
  centered,
  children,
  contentStyle,
  eyebrow,
  footer,
  headerAccessory,
  onBack,
  progress,
  stepLabel,
  subtitle,
  title,
}: OnboardingStepScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          centered && styles.contentCentered,
          {
            paddingTop: insets.top + appSpacing.md,
            paddingBottom: footer ? appSpacing.xl : insets.bottom + appSpacing.xl,
          },
          contentStyle,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingTopBar
          onBack={onBack}
          progress={progress}
          stepLabel={stepLabel}
        />
        <View style={[styles.header, centered && styles.headerCentered]}>
          {headerAccessory}
          {eyebrow ? (
            <AppText
              color="coral"
              style={centered ? styles.centeredEyebrow : styles.eyebrow}
              variant="eyebrow"
            >
              {eyebrow}
            </AppText>
          ) : null}
          <AppText
            align={centered ? "center" : undefined}
            variant={centered ? "screenTitle" : "sectionTitleLarge"}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              align={centered ? "center" : undefined}
              color="secondary"
              variant="bodySmall"
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + appSpacing.xs }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: appSpacing.gutter,
  },
  contentCentered: {
    justifyContent: "center",
  },
  header: {
    gap: appSpacing.xs,
    marginBottom: appSpacing.xl,
  },
  headerCentered: {
    alignItems: "center",
  },
  eyebrow: {
    alignSelf: "flex-start",
  },
  centeredEyebrow: {
    alignSelf: "center",
  },
  footer: {
    paddingHorizontal: appSpacing.gutter,
    paddingTop: appSpacing.sm,
    backgroundColor: appColors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
});

export default OnboardingStepScreen;
