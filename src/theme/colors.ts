/**
 * Shared app color tokens — the "Bright Editorial" direction.
 * A porcelain canvas with near-black ink text and one persimmon action
 * accent. Nutrient/status hues stay deliberately subdued — they exist to
 * support progress visualization, not to decorate the page.
 */
const palette = {
  white: "#FFFFFF",
  porcelain: "#FAFAF8",
  porcelainSoft: "#F1F1ED",
  porcelainMuted: "#EAEAE4",
  ink: "#171715",
  inkSoft: "#55534C",
  inkMuted: "#8A887E",
  divider: "#E5E5DF",
  dividerStrong: "#D8D8D0",
  persimmonTint: "#F7E2DB",
  persimmonSoft: "#E9AA98",
  persimmonMid: "#E08063",
  persimmon: "#D6533C",
  persimmonDeep: "#B8402C",
  redTint: "#F3DED8",
  red: "#A3402F",
  redDeep: "#7C2E20",
  gardenTint: "#E4EBE1",
  gardenSoft: "#9FB79A",
  garden: "#5B8A66",
  gardenDeep: "#436B4E",
  spring: "#5E86A0",
  olive: "#66753F",
  russet: "#A34E36",
  wheat: "#A87A2F",
  honeySoft: "#F3E7D2",
  honey: "#B98A3D",
  honeyDeep: "#8F6821",
} as const;

const neutral = {
  50: palette.porcelain,
  100: palette.porcelainSoft,
  200: palette.divider,
  300: palette.dividerStrong,
  400: palette.inkMuted,
  500: palette.inkMuted,
  600: palette.inkSoft,
  700: palette.inkSoft,
  800: palette.ink,
  900: palette.ink,
  950: palette.ink,
} as const;

const brand = {
  100: palette.persimmonTint,
  200: palette.persimmonTint,
  300: palette.persimmonSoft,
  400: palette.persimmonMid,
  500: palette.persimmon,
  600: palette.persimmon,
  700: palette.persimmonDeep,
  800: palette.ink,
  900: palette.ink,
} as const;

const success = {
  500: palette.gardenSoft,
  600: palette.garden,
  700: palette.gardenDeep,
} as const;

const warning = {
  300: palette.honeySoft,
  600: palette.honey,
  700: palette.honeyDeep,
  800: palette.honeyDeep,
  surface: palette.honeySoft,
  surfaceStrong: palette.porcelainMuted,
} as const;

const danger = {
  100: palette.redTint,
  600: palette.red,
  700: palette.redDeep,
  800: palette.redDeep,
  text: palette.red,
  surface: palette.redTint,
  surfaceAlt: palette.redTint,
  border: palette.red,
} as const;

const grayScale = {
  50: palette.porcelain,
  100: palette.porcelainSoft,
  200: palette.divider,
  300: palette.dividerStrong,
  400: palette.inkMuted,
  500: palette.inkSoft,
  600: palette.inkSoft,
  700: palette.ink,
  800: palette.ink,
  900: palette.ink,
} as const;

const surface = {
  canvas: palette.porcelain,
  canvasAlt: palette.porcelainSoft,
  base: palette.porcelain,
  card: palette.white,
  cardAlt: palette.porcelainSoft,
  cardRaised: palette.white,
  field: palette.porcelainSoft,
  fieldAlt: palette.porcelainMuted,
  overlay: "rgba(23, 23, 21, 0.45)",
  ghost: "rgba(23, 23, 21, 0.05)",
  ghostStrong: "rgba(23, 23, 21, 0.10)",
  /** Ink-filled surface for toasts/snackbars — the one intentionally dark panel. */
  inverse: palette.ink,
} as const;

const text = {
  primary: palette.ink,
  secondary: palette.inkSoft,
  muted: palette.inkMuted,
} as const;

const border = {
  soft: palette.divider,
  strong: palette.dividerStrong,
} as const;

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
  white: palette.white,

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

  brand300: brand[300],
  brand400: brand[400],
  brand500: brand[500],
  brand600: brand[600],
  brand700: brand[700],
  brand800: brand[800],
  brand900: brand[900],

  gray900: grayScale[900],
  gray500: grayScale[500],

  warning800: warning[800],
  warning700: warning[700],
  warning600: warning[600],
  warning300: warning[300],

  success500: success[500],
  success600: success[600],
  success700: success[700],

  danger600: danger[600],
  danger700: danger[700],
  danger800: danger[800],

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
  surfaceInverse: surface.inverse,

  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,
  textDisabled: text.muted,
  textInverse: palette.porcelain,

  borderSoft: border.soft,
  borderStrong: border.strong,

  dangerText: danger.text,
  dangerSoftBg: danger.surface,
  dangerSurface: danger.surfaceAlt,
  dangerBorder: danger.border,

  warningSurface: warning.surface,
  warningSurfaceStrong: warning.surfaceStrong,

  actionPrimary: brand[500],
  actionPrimaryPressed: brand[700],
  actionPrimarySoft: brand[100],
  actionPrimaryBorder: brand[300],

  statusSuccess: success[700],
  statusSuccessSoft: palette.gardenTint,
  statusWarning: warning[700],
  statusWarningSoft: warning.surface,
  statusError: danger[600],
  statusErrorSoft: danger.surface,

  // Macro aliases — kept as subdued, food-native hues for progress
  // visualization only. Calories stay ink: the boldest line on the label,
  // not a brand decoration.
  calories: palette.ink,
  protein: palette.russet,
  carbs: palette.wheat,
  fat: palette.olive,
  water: palette.spring,
} as const;

export type AppColorToken = keyof typeof appColors;
export type AppColorValue = (typeof appColors)[AppColorToken];
