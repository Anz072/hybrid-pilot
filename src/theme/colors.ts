/**
 * Shared app color tokens.
 * The palette is intentionally collapsed onto a small Sunset set:
 * cream surfaces, ink text, coral accents, sage positives, and gold warnings.
 */
const palette = {
  white: "#fef9f3",
  cream: "#FFF8F0",
  creamSoft: "#F7EFE5",
  sand: "#EAD7C5",
  sandDeep: "#D6C2AE",
  taupe: "#A88F7B",
  ink: "#3D405B",
  inkSoft: "#6B6E8A",
  inkMuted: "#9A9DB2",
  coralTint: "#FBE3DD",
  coralSoft: "#F1A58F",
  coral: "#E07A5F",
  coralDeep: "#C96C54",
  sage: "#81B29A",
  sageDeep: "#6FA38C",
  goldSoft: "#F2CC8F",
  gold: "#DDA15E",
  goldDeep: "#C6862F",
} as const;

const neutral = {
  50: palette.cream,
  100: palette.creamSoft,
  200: palette.sand,
  300: palette.sand,
  400: palette.sandDeep,
  500: palette.taupe,
  600: palette.inkSoft,
  700: palette.inkSoft,
  800: palette.ink,
  900: palette.ink,
  950: palette.ink,
} as const;

const brand = {
  100: palette.coralTint,
  200: palette.coralTint,
  300: palette.coralSoft,
  400: palette.coralSoft,
  500: palette.coral,
  600: palette.coral,
  700: palette.coralDeep,
  800: palette.ink,
  900: palette.ink,
} as const;

const success = {
  500: palette.sage,
  600: palette.sage,
  700: palette.sageDeep,
} as const;

const warning = {
  300: palette.goldSoft,
  600: palette.gold,
  700: palette.goldDeep,
  800: palette.goldDeep,
  surface: palette.creamSoft,
  surfaceStrong: palette.sand,
} as const;

const danger = {
  600: palette.coral,
  700: palette.coralDeep,
  800: palette.coralDeep,
  text: palette.coral,
  surface: palette.coralTint,
  surfaceAlt: palette.coralTint,
  border: palette.coralSoft,
} as const;

const grayScale = {
  50: palette.cream,
  100: palette.creamSoft,
  200: palette.sand,
  300: palette.sandDeep,
  400: palette.inkMuted,
  500: palette.inkSoft,
  600: palette.inkSoft,
  700: palette.ink,
  800: palette.ink,
  900: palette.ink,
} as const;

const surface = {
  canvas: palette.cream,
  canvasAlt: palette.creamSoft,
  base: palette.cream,
  card: palette.white,
  cardAlt: palette.creamSoft,
  cardRaised: palette.white,
  field: palette.creamSoft,
  fieldAlt: palette.sand,
  overlay: "rgba(255, 248, 240, 0.94)",
  ghost: "rgba(61, 64, 91, 0.05)",
  ghostStrong: "rgba(61, 64, 91, 0.10)",
} as const;

const text = {
  primary: palette.ink,
  secondary: palette.inkSoft,
  muted: palette.inkMuted,
} as const;

const border = {
  soft: palette.sand,
  strong: palette.sandDeep,
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

  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,

  borderSoft: border.soft,
  borderStrong: border.strong,

  dangerText: danger.text,
  dangerSoftBg: danger.surface,
  dangerSurface: danger.surfaceAlt,
  dangerBorder: danger.border,

  warningSurface: warning.surface,
  warningSurfaceStrong: warning.surfaceStrong,

  // Useful macro aliases
  calories: brand[500],
  protein: success[600],
  carbs: warning[600],
  fat: brand[700],
  water: success[500],
} as const;

export type AppColorToken = keyof typeof appColors;
export type AppColorValue = (typeof appColors)[AppColorToken];
