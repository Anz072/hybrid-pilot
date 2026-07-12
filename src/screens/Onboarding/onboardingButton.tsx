import React from "react";
import { OptionCard } from "../../components/ui";

export type OnboardingButtonProps = {
  borderColor?: string;
  dataToSend: any;
  icon?: React.ReactNode;
  label: string;
  navigation?: {
    navigate?: (...args: any[]) => void;
    push?: (...args: any[]) => void;
  };
  navGoal: string;
  subtitle: string;
  value: string;
  valueKey?: string;
};

const OnboardingButton = (props: OnboardingButtonProps) => {
  const params = props.valueKey
    ? { ...props.dataToSend, [props.valueKey]: props.value }
    : props.dataToSend;

  return (
    <OptionCard
      icon={props.icon}
      onPress={() =>
        props.navigation?.push
          ? props.navigation.push(props.navGoal, params)
          : props.navigation?.navigate?.(props.navGoal, params)
      }
      showCheck={false}
      subtitle={props.subtitle}
      title={props.label}
    />
  );
};

export default OnboardingButton;
