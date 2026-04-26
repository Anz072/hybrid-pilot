import type { TextStyle } from "react-native";

export const appTypography = {
  displayHero: {
    fontSize: 44,
    lineHeight: 46,
    fontWeight: "500",
    letterSpacing: 0,
  } satisfies TextStyle,
  displaySection: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "500",
    letterSpacing: 0,
  } satisfies TextStyle,
  displayCard: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
    letterSpacing: 0,
  } satisfies TextStyle,
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "500",
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0.24,
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0.16,
  } satisfies TextStyle,
  bodySmall: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: 0.16,
  } satisfies TextStyle,
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
  } satisfies TextStyle,
} as const;
