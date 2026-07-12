import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { AppButton } from "../../components/ui";

type OnboardingPrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const OnboardingPrimaryButton = ({
  disabled = false,
  label,
  onPress,
  style,
}: OnboardingPrimaryButtonProps) => (
  <AppButton
    disabled={disabled}
    label={label}
    onPress={onPress}
    style={style}
    variant="primary"
  />
);

export default OnboardingPrimaryButton;
