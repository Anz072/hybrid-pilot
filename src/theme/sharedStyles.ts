import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { appColors } from "./colors";

type SharedStyleValue = ViewStyle | TextStyle | ImageStyle;

export const sharedStyleValues = {
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  cardCompact: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  centerCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: appColors.surfaceCard,
    padding: 16,
  },
  centerText: {
    color: appColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  eyebrow: {
    alignSelf: "flex-start",
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroTitle: {
    color: appColors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  heroTitleLarge: {
    color: appColors.textPrimary,
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 3,
  },
  metaText: {
    color: appColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  fieldLabel: {
    color: appColors.slate300,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldLabelSpacing: {
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  inputCompact: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  unitPill: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitPillRound: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitText: {
    color: appColors.brand500,
    fontSize: 13,
    fontWeight: "800",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    color: appColors.brand500,
    fontSize: 11,
    fontWeight: "800",
  },
  contextPillText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 10,
  },
  nutritionValue: {
    color: appColors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
    backgroundColor: appColors.surfaceOverlay,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerButton: {
    flex: 1,
  },
  buttonBase: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 13,
  },
  buttonWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: {
    backgroundColor: appColors.brand700,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  lightPrimaryButton: {
    backgroundColor: appColors.slate50,
    paddingVertical: 14,
  },
  lightPrimaryButtonText: {
    color: appColors.slate900,
    fontSize: 14,
    fontWeight: "600",
  },
  warningPrimaryButton: {
    backgroundColor: appColors.warning600,
    paddingVertical: 14,
  },
  warningPrimaryButtonText: {
    color: appColors.slate900,
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 2,
    borderColor: appColors.surfaceGhostStrong,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  outlineButton: {
    backgroundColor: appColors.surfaceCard,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
  },
  outlineButtonText: {
    color: appColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  dangerButtonText: {
    color: appColors.danger700,
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.9,
  },
} satisfies Record<string, SharedStyleValue>;

export const sharedStyles = StyleSheet.create(sharedStyleValues);
