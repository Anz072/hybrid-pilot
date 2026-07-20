import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { appColors } from "../../theme/colors";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import { AppText } from "./AppText";

type SkeletonLineProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
  width?: ViewStyle["width"];
};

export const SkeletonLine = ({
  height = 10,
  style,
  width = "100%",
}: SkeletonLineProps) => (
  <View style={[styles.skeleton, { height, width }, style]} />
);

type StateBlockProps = {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  message?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
};

export const EmptyState = ({
  action,
  icon,
  message,
  style,
  title,
}: StateBlockProps) => (
  <View style={[styles.stateBlock, style]}>
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <AppText align="center" variant="cardTitle">
      {title}
    </AppText>
    {message ? (
      <AppText align="center" color="secondary" variant="bodySmall">
        {message}
      </AppText>
    ) : null}
    {action}
  </View>
);

export const ErrorState = ({
  action,
  icon,
  message,
  style,
  title,
}: StateBlockProps) => (
  <View style={[styles.stateBlock, styles.errorBlock, style]}>
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <AppText align="center" color="error" variant="cardTitle">
      {title}
    </AppText>
    {message ? (
      <AppText align="center" color="secondary" variant="bodySmall">
        {message}
      </AppText>
    ) : null}
    {action}
  </View>
);

export const SuccessState = ({
  action,
  icon,
  message,
  style,
  title,
}: StateBlockProps) => (
  <View style={[styles.stateBlock, styles.successBlock, style]}>
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <AppText align="center" color="success" variant="cardTitle">
      {title}
    </AppText>
    {message ? (
      <AppText align="center" color="secondary" variant="bodySmall">
        {message}
      </AppText>
    ) : null}
    {action}
  </View>
);

type LoadingStateProps = {
  message?: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
};

export const LoadingState = ({
  message,
  style,
  title = "Loading",
}: LoadingStateProps) => (
  <View style={[styles.stateBlock, style]}>
    <ActivityIndicator color={appColors.actionPrimary} />
    <AppText align="center" variant="cardTitle">
      {title}
    </AppText>
    {message ? (
      <AppText align="center" color="secondary" variant="bodySmall">
        {message}
      </AppText>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.ghostStrong,
  },
  stateBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.xs,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.soft,
    padding: appSpacing.xl,
  },
  errorBlock: {
    backgroundColor: appColors.dangerSurface,
  },
  successBlock: {
    backgroundColor: appColors.statusSuccessSoft,
  },
  iconWrap: {
    marginBottom: appSpacing.xxs,
  },
});
