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
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "../../theme/tokens";
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
  onBlur,
  onFocus,
  placeholderTextColor = appColors.textMuted,
  style,
  ...props
}: AppInputProps) => {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText color="secondary" style={styles.label} variant="eyebrow">
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={placeholderTextColor}
        {...props}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
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
};

type SearchInputProps = Omit<AppInputProps, "label"> & {
  label?: string;
};

export const SearchInput = ({
  containerStyle,
  label = "Search",
  onBlur,
  onFocus,
  placeholder = "Search foods",
  placeholderTextColor = appColors.textMuted,
  style,
  ...props
}: SearchInputProps) => {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText color="secondary" style={styles.label} variant="eyebrow">
          {label}
        </AppText>
      ) : null}
      <View style={[styles.searchWrap, focused ? styles.inputFocused : null]}>
        <MagnifyingGlassIcon size={20} color={appColors.textMuted} weight="bold" />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          returnKeyType="search"
          {...props}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          style={[styles.searchInput, style]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    marginBottom: 0,
  },
  // Editorial fields are soft fills — the border rests transparent and only
  // appears to signal focus or an error, without a layout jump.
  input: {
    minHeight: 48,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: "transparent",
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  inputFocused: {
    borderColor: appStates.focusBorder,
  },
  inputError: {
    borderColor: appColors.statusError,
  },
  searchWrap: {
    minHeight: 52,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: "transparent",
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 16,
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
