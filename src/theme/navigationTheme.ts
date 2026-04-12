import { DarkTheme, type Theme } from "@react-navigation/native";
import { appColors } from "./colors";

export const appNavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: appColors.foodPrimaryDark,
    background: appColors.surfaceCanvas,
    card: appColors.surfaceCard,
    text: appColors.textPrimary,
    border: appColors.borderSoft,
    notification: appColors.foodPrimary,
  },
};
