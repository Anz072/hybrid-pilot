import React from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { MagnifyingGlassIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import { AppText } from "./AppText";

type AppInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  error?: string | null;
  label?: string;
};

export const AppInput = ({
  containerStyle,
  error,
  label,
  placeholderTextColor = appColors.textMuted,
  style,
  ...props
}: AppInputProps) => (
  <View style={[styles.container, containerStyle]}>
    {label ? (
      <AppText color="secondary" style={styles.label} variant="eyebrow">
        {label}
      </AppText>
    ) : null}
    <TextInput
      placeholderTextColor={placeholderTextColor}
      {...props}
      style={[
        styles.input,
        error ? styles.inputError : null,
        style,
      ]}
    />
    {error ? (
      <AppText color="error" style={styles.error} variant="metadata">
        {error}
      </AppText>
    ) : null}
  </View>
);

type SearchInputProps = Omit<AppInputProps, "label"> & {
  label?: string;
};

export const SearchInput = ({
  containerStyle,
  label = "Search",
  placeholder = "Search foods",
  placeholderTextColor = appColors.textMuted,
  style,
  ...props
}: SearchInputProps) => (
  <View style={[styles.container, containerStyle]}>
    {label ? (
      <AppText color="secondary" style={styles.label} variant="eyebrow">
        {label}
      </AppText>
    ) : null}
    <View style={styles.searchWrap}>
      <MagnifyingGlassIcon size={20} color={appColors.textMuted} weight="bold" />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        returnKeyType="search"
        {...props}
        style={[styles.searchInput, style]}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    marginBottom: 0,
  },
  input: {
    minHeight: 48,
    borderRadius: appRadius.sm,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  inputError: {
    borderColor: appColors.statusError,
  },
  searchWrap: {
    minHeight: 52,
    borderRadius: appRadius.sm,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  searchInput: {
    flex: 1,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  error: {
    marginTop: appSpacing.xxs,
  },
});
