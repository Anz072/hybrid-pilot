import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
} from "react-native";

type FontWeightValue = TextStyle["fontWeight"];

type PatchedTextComponent = {
  render?: (...args: unknown[]) => React.ReactElement | null;
  __interPatched?: boolean;
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

  if (parsed <= 150) return 100;
  if (parsed <= 250) return 200;
  if (parsed <= 350) return 300;
  if (parsed <= 450) return 400;
  if (parsed <= 550) return 500;
  if (parsed <= 650) return 600;
  if (parsed <= 750) return 700;
  if (parsed <= 850) return 800;
  return 900;
};

const resolveInterFontFamily = (
  fontWeight?: FontWeightValue,
  fontStyle?: TextStyle["fontStyle"],
) => {
  const weight = normalizeFontWeight(fontWeight);
  const italicSuffix = fontStyle === "italic" ? "_Italic" : "";

  switch (weight) {
    case 100:
      return `Inter_100Thin${italicSuffix}`;
    case 200:
      return `Inter_200ExtraLight${italicSuffix}`;
    case 300:
      return `Inter_300Light${italicSuffix}`;
    case 500:
      return `Inter_500Medium${italicSuffix}`;
    case 600:
      return `Inter_600SemiBold${italicSuffix}`;
    case 700:
      return `Inter_700Bold${italicSuffix}`;
    case 800:
      return `Inter_800ExtraBold${italicSuffix}`;
    case 900:
      return `Inter_900Black${italicSuffix}`;
    default:
      return `Inter_400Regular${italicSuffix}`;
  }
};

const withInterFont = (style: StyleProp<TextStyle>) => {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) {
    return style;
  }

  return [
    {
      fontFamily: resolveInterFontFamily(
        flattened?.fontWeight,
        flattened?.fontStyle,
      ),
    },
    style,
  ];
};

const patchTextRender = (component: PatchedTextComponent) => {
  if (component.__interPatched || !component.render) {
    return;
  }

  const originalRender = component.render;
  component.render = function patchedInterRender(...args: unknown[]) {
    const element = originalRender.apply(this, args);
    if (!React.isValidElement(element)) {
      return element;
    }

    const typedElement = element as React.ReactElement<{
      style?: StyleProp<TextStyle>;
    }>;
    const props = typedElement.props;

    return React.cloneElement(typedElement, {
      style: withInterFont(props.style),
    });
  };
  component.__interPatched = true;
};

export const applyInterFontDefaults = () => {
  patchTextRender(Text as unknown as PatchedTextComponent);
  patchTextRender(TextInput as unknown as PatchedTextComponent);
};
