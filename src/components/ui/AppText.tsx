import React from "react";
import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { appColors, type AppColorValue } from "../../theme/colors";
import { appTypography, type AppTypographyRole } from "../../theme/typography";

type AppTextColor = "primary" | "secondary" | "muted" | "disabled" | "coral" | "success" | "error";
const tabularNums = ["tabular-nums"] as TextStyle["fontVariant"];

const textColorByRole: Record<AppTextColor, AppColorValue> = {
  primary: appColors.textPrimary,
  secondary: appColors.textSecondary,
  muted: appColors.textMuted,
  disabled: appColors.textDisabled,
  coral: appColors.actionPrimary,
  success: appColors.statusSuccess,
  error: appColors.statusError,
};

type AppTextProps = TextProps & {
  align?: TextStyle["textAlign"];
  children: React.ReactNode;
  color?: AppTextColor | AppColorValue;
  style?: StyleProp<TextStyle>;
  variant?: AppTypographyRole;
};

export const AppText = ({
  align,
  children,
  color = "primary",
  style,
  variant = "body",
  ...props
}: AppTextProps) => {
  const resolvedColor = color in textColorByRole
    ? textColorByRole[color as AppTextColor]
    : color;

  return (
    <Text
      {...props}
      style={[
        appTypography[variant],
        { color: resolvedColor },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
};

type NumericTextProps = Omit<AppTextProps, "variant"> & {
  variant?:
    | "numberCalorieHero"
    | "numberCalorieRow"
    | "numberMacroSummary"
    | "numberMacroRow"
    | "numberWeightHero"
    | "numberWeightEntry"
    | "numberTrendDelta"
    | "numberChartAxis";
};

export const NumericText = ({
  align,
  children,
  color = "primary",
  style,
  variant = "numberCalorieRow",
  ...props
}: NumericTextProps) => (
  <AppText
    {...props}
    align={align}
    color={color}
    style={[style, { fontVariant: tabularNums }]}
    variant={variant}
  >
    {children}
  </AppText>
);
