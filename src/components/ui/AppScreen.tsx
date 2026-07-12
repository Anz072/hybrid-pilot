import React from "react";
import {
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import { IconButton } from "./AppButton";
import { AppText } from "./AppText";

type AppScreenProps = ViewProps & {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  safeTop?: boolean;
};

export const AppScreen = ({
  children,
  contentStyle,
  safeTop = false,
  style,
  ...props
}: AppScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.screen,
        safeTop ? { paddingTop: insets.top } : null,
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

type ScreenHeaderProps = {
  backAccessibilityLabel?: string;
  backIcon?: React.ReactNode;
  eyebrow?: string;
  onBack?: PressableProps["onPress"];
  safeTop?: boolean;
  subtitle?: string;
  title: string;
};

export const ScreenHeader = ({
  backAccessibilityLabel = "Go back",
  backIcon,
  eyebrow,
  onBack,
  safeTop = true,
  subtitle,
  title,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        safeTop ? { paddingTop: insets.top + appSpacing.sm } : null,
      ]}
    >
      {onBack ? (
        <IconButton
          accessibilityLabel={backAccessibilityLabel}
          onPress={onBack}
          style={styles.backButton}
        >
          {backIcon ?? (
            <ArrowLeftIcon
              size={20}
              color={appColors.textPrimary}
              weight="bold"
            />
          )}
        </IconButton>
      ) : null}
      {eyebrow ? (
        <AppText color="secondary" style={styles.eyebrow} variant="eyebrow">
          {eyebrow}
        </AppText>
      ) : null}
      <AppText style={styles.title} variant="screenTitle">
        {title}
      </AppText>
      {subtitle ? (
        <AppText color="secondary" variant="body">
          {subtitle}
        </AppText>
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
    flex: 1,
    paddingHorizontal: appSpacing.gutter,
  },
  header: {
    marginBottom: appSpacing.gutter,
  },
  backButton: {
    marginBottom: appSpacing.gutter,
  },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: appSurfaces.ghost,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 7,
    borderRadius: appRadius.pill,
    marginBottom: appSpacing.sm,
  },
  title: {
    color: appColors.textPrimary,
    marginBottom: appSpacing.xs,
    ...appTypography.screenTitle,
  },
});
