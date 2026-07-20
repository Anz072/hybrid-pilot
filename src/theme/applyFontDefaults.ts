import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
} from "react-native";
import { notifyTextInputFocused } from "./textInputFocusEvents";

type FontWeightValue = TextStyle["fontWeight"];

type PatchedTextComponent = {
  render?: (...args: unknown[]) => React.ReactElement | null;
  __fontPatched?: boolean;
};

type FontPatchedElementProps = {
  onFocus?: ((event: unknown) => void) | undefined;
  style?: StyleProp<TextStyle>;
};

const normalizeFontWeight = (fontWeight?: FontWeightValue): number => {
  if (fontWeight === "bold") {
    return 700;
  }

  if (fontWeight === "normal" || fontWeight == null) {
    return 400;
  }

  const parsed = Number(fontWeight);
  if (!Number.isFinite(parsed)) {
    return 400;
  }

  if (parsed <= 450) return 400;
  if (parsed <= 550) return 500;
  if (parsed <= 650) return 600;
  return 700;
};

/**
 * IBM Plex Sans is the app-wide default for any Text/TextInput that hasn't
 * opted into a role from `appTypography` (which sets its own fontFamily,
 * e.g. Newsreader for titles and coaching copy).
 */
const resolveDefaultFontFamily = (
  fontWeight?: FontWeightValue,
  fontStyle?: TextStyle["fontStyle"],
) => {
  const weight = normalizeFontWeight(fontWeight);
  const italicSuffix = fontStyle === "italic" ? "_Italic" : "";

  switch (weight) {
    case 500:
      return `IBMPlexSans_500Medium${italicSuffix}`;
    case 600:
      return `IBMPlexSans_600SemiBold${italicSuffix}`;
    case 700:
      return `IBMPlexSans_700Bold${italicSuffix}`;
    default:
      return `IBMPlexSans_400Regular${italicSuffix}`;
  }
};

const withDefaultFont = (style: StyleProp<TextStyle>) => {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) {
    return style;
  }

  return [
    {
      fontFamily: resolveDefaultFontFamily(
        flattened?.fontWeight,
        flattened?.fontStyle,
      ),
    },
    style,
  ];
};

const patchTextRender = (
  component: PatchedTextComponent,
  options: {
    notifyOnFocus?: boolean;
  } = {},
) => {
  if (component.__fontPatched || !component.render) {
    return;
  }

  const originalRender = component.render;
  component.render = function patchedFontRender(...args: unknown[]) {
    const element = originalRender.apply(this, args);
    if (!React.isValidElement(element)) {
      return element;
    }

    const typedElement = element as React.ReactElement<FontPatchedElementProps>;
    const props = typedElement.props;
    const nextProps: FontPatchedElementProps = {
      style: withDefaultFont(props.style),
    };

    if (options.notifyOnFocus) {
      nextProps.onFocus = (event) => {
        props.onFocus?.(event);
        requestAnimationFrame(() => {
          notifyTextInputFocused();
        });
      };
    }

    return React.cloneElement(typedElement, nextProps);
  };
  component.__fontPatched = true;
};

export const applyFontDefaults = () => {
  patchTextRender(Text as unknown as PatchedTextComponent);
  patchTextRender(TextInput as unknown as PatchedTextComponent, {
    notifyOnFocus: true,
  });
};
