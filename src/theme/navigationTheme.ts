import { DefaultTheme, type Theme } from "@react-navigation/native";
import { appColors } from "./colors";

export const appNavigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: appColors.brand700,
    background: appColors.surfaceCanvas,
    card: appColors.surfaceCard,
    text: appColors.textPrimary,
    border: appColors.borderSoft,
    notification: appColors.brand500,
  },
};
