/**
 * Shared app color tokens.
 * Prefer referencing these values instead of hardcoding color literals in screens/components.
 */
const neutral = {
  50: "#F4F4F4",
  100: "#E8EAED",
  200: "#D5D9DE",
  300: "#B8BFC7",
  400: "#8D969E",
  500: "#6F7882",
  600: "#505A63",
  700: "#373F47",
  800: "#23292F",
  900: "#191C1F",
  950: "#101316",
} as const;

const brand = {
  100: "#E7E9FF",
  200: "#D4D8FF",
  300: "#B5BAFF",
  400: "#8D95FF",
  500: "#666EF8",
  600: "#4F55F1",
  700: "#494FDF",
  800: "#363BB2",
  900: "#1F2468",
} as const;

const success = {
  500: "#10C29B",
  600: "#00A87E",
  700: "#007B60",
} as const;

const warning = {
  300: "#F2C86B",
  600: "#EC7E00",
  700: "#BF6600",
  800: "#8C4A00",
  surface: "#3A2612",
  surfaceStrong: "#4A3117",
  canvas: "#1A140C",
} as const;

const danger = {
  600: "#E23B4A",
  700: "#C73144",
  800: "#962535",
  text: "#FF97A5",
  surface: "#3A1A20",
  surfaceAlt: "#28161B",
  border: "#7E3544",
} as const;

const grayScale = {
  50: "#F7F8F9",
  100: "#ECEFF1",
  200: "#D5DAE0",
  300: "#B7BEC7",
  400: "#939BA4",
  500: "#6C7480",
  600: "#4D5660",
  700: "#353C44",
  800: "#21262D",
  900: "#15191D",
} as const;

const surface = {
  canvas: "#0D1014",
  canvasAlt: "#12161C",
  base: "#15191E",
  card: "#191C1F",
  cardAlt: "#20252C",
  cardRaised: "#252C34",
  field: "#10151A",
  fieldAlt: "#141A21",
  overlay: "rgba(13, 16, 20, 0.94)",
  overlaySoft: "rgba(25, 28, 31, 0.90)",
  ghost: "rgba(244, 244, 244, 0.08)",
  ghostStrong: "rgba(244, 244, 244, 0.12)",
  ghostHeavy: "rgba(244, 244, 244, 0.18)",
} as const;

const text = {
  primary: "#FFFFFF",
  secondary: "#C9C9CD",
  muted: "#8D969E",
  subtle: "#505A63",
} as const;

const border = {
  soft: "#252C34",
  strong: "#313942",
} as const;

const brandOverlay18 = "rgba(79, 85, 241, 0.18)";
const brandOverlay34 = "rgba(79, 85, 241, 0.34)";
const brandOverlay38 = "rgba(79, 85, 241, 0.38)";
const tealOverlay18 = "rgba(0, 168, 126, 0.18)";
const darkInkOverlay72 = "rgba(13, 16, 20, 0.72)";
const darkInkOverlay78 = "rgba(13, 16, 20, 0.78)";
const darkInkOverlay82 = "rgba(13, 16, 20, 0.82)";

export const gray = {
  50: grayScale[50],
  100: grayScale[100],
  200: grayScale[200],
  300: grayScale[300],
  400: grayScale[400],
  500: grayScale[500],
  600: grayScale[600],
  700: grayScale[700],
  800: grayScale[800],
  900: grayScale[900],
};

export const appColors = {
  white: "#FFFFFF",
  slate900: neutral[900],
  slate950: neutral[950],
  slate800: neutral[800],
  slate700: neutral[700],
  slate600: neutral[600],
  slate500: neutral[500],
  slate400: neutral[400],
  slate300: neutral[300],
  slate200: neutral[200],
  slate100: neutral[100],
  slate50: neutral[50],
  gray900: grayScale[900],
  gray500: grayScale[500],
  brand300: brand[300],
  brand400: brand[400],
  brand500: brand[500],
  brand700: brand[700],
  black30: "rgba(255,255,255,0.30)",
  black65: "rgba(255,255,255,0.65)",
  surfaceCanvas: surface.canvas,
  surfaceCanvasAlt: surface.canvasAlt,
  surfaceBase: surface.base,
  surfaceCard: surface.card,
  surfaceCardAlt: surface.cardAlt,
  surfaceRaised: surface.cardRaised,
  surfaceField: surface.field,
  surfaceFieldAlt: surface.fieldAlt,
  surfaceOverlay: surface.overlay,
  surfaceGhost: surface.ghost,
  surfaceGhostStrong: surface.ghostStrong,
  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,
  borderSoft: border.soft,
  borderStrong: border.strong,
  brandOverlay18,
  brandOverlay34,
  brandOverlay38,
  tealOverlay18,
  amberOverlay18: "rgba(236, 126, 0, 0.18)",
  dangerOverlay18: "rgba(226, 59, 74, 0.18)",
  darkInkOverlay60: "rgba(13,16,20,0.6)",
  darkInkOverlay72,
  darkInkOverlay78,
  darkInkOverlay82,
  whiteOverlay04: "rgba(255,255,255,0.04)",
  whiteOverlay16: "rgba(255,255,255,0.16)",
  whiteOverlay82: "rgba(255,255,255,0.82)",
  revolutDark: neutral[900],
  revolutLight: neutral[50],
  revolutTeal: success[600],
  foodText: text.primary,
  foodMuted: text.secondary,
  foodPlaceholder: text.muted,
  foodInk: text.primary,
  foodPreviewText: "#D9DCFF",
  foodBorder: border.strong,
  foodSoftBorder: border.soft,
  foodSectionBg: surface.cardAlt,
  foodEyebrowBg: brandOverlay18,
  foodPillBg: surface.ghost,
  foodFieldBg: surface.field,
  foodSurfaceAlt: surface.cardAlt,
  foodScreenBg: surface.canvas,
  foodOrbTop: brandOverlay18,
  foodOrbBottom: tealOverlay18,
  foodTimelineBorder: border.soft,
  lavenderBorder: border.strong,
  lavenderShadow: brand[400],
  lavenderPanel: brandOverlay18,
  lavenderSurface: surface.fieldAlt,
  lavenderDot: brand[400],
  brand500Overlay: brandOverlay18,
  emerald500: success[500],
  green600: success[600],
  green700: success[700],
  tealSoftBg: tealOverlay18,
  greenSoftBg: tealOverlay18,
  danger700: danger[700],
  danger600: danger[600],
  danger800: danger[800],
  dangerText: danger.text,
  dangerSoftBg: danger.surface,
  dangerSurface: danger.surfaceAlt,
  dangerBorder: danger.border,
  amber800: warning[800],
  amber700: warning[700],
  amber600: warning[600],
  amberSoft: warning.surface,
  amberSoftStrong: warning.surfaceStrong,
  amber300: warning[300],
  cyan500: "#56B8FF",
  sky800: brand[800],
  blue600: brand[600],
  blueSoftBg: brandOverlay18,
  skySoftBg: brandOverlay18,
  violetSoftBg: brandOverlay18,
  violet500: brand[600],
  violet400: brand[400],
  tabFocused: text.primary,
  plumSoftText: text.muted,
  plumPlaceholderAlt: text.muted,
  plumSoft: text.muted,
  plum: text.primary,
  plum2: text.secondary,
  plum700: brand[400],
  plum690: text.secondary,
  plumMuted: text.secondary,
  plumMutedAlt: text.secondary,
  overlayGray: "rgba(201, 201, 205, 0.55)",
  charcoal: border.strong,
  whiteOverlay96: surface.overlay,
  whiteOverlay18: surface.ghostHeavy,
  slateOverlay72: darkInkOverlay72,
  tabScrim: "rgba(13, 16, 20, 0.72)",
} as const;

export type AppColorToken = keyof typeof appColors;
export type AppColorValue = (typeof appColors)[AppColorToken];
