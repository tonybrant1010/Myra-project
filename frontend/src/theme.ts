import { Platform } from "react-native";

export const theme = {
  // Aurora Blue system
  bg: "#061320",
  background: "#061320",
  surface: "rgba(255,255,255,0.94)",
  surfaceStrong: "#FFFFFF",
  surfaceAlt: "rgba(241,248,255,0.82)",
  surfaceGlass: "rgba(255,255,255,0.14)",
  surfaceGlassStrong: "rgba(255,255,255,0.22)",

  // Brand
  primary: "#0A2340",
  primaryDark: "#05111F",
  primarySoft: "#123A62",
  secondary: "#8BA8FF",
  accent: "#57C7FF",
  accentDeep: "#1D8ED8",
  accentSoft: "#DDF5FF",
  info: "#65B7F2",
  warm: "#D2AA6C",
  calm: "#55B7B0",
  violet: "#8B8FE8",

  // Text
  textPrimary: "#10243A",
  textSecondary: "#60758A",
  textMuted: "#8A9BAA",
  textOnDark: "#F7FBFF",

  // Borders & dividers
  border: "rgba(87,199,255,0.28)",
  borderSoft: "rgba(87,199,255,0.16)",
  borderOnDark: "rgba(255,255,255,0.18)",

  // Status
  danger: "#D95F72",
  success: "#56D68D",
  white: "#FFFFFF",
};

export const fonts = {
  display: Platform.select({
    ios: "Manrope_700Bold",
    android: "Manrope_700Bold",
    default: "Manrope_700Bold",
  })!,
  displayBook: "Manrope_600SemiBold",
  body: Platform.select({
    ios: "Manrope_400Regular",
    android: "Manrope_400Regular",
    default: "Manrope_400Regular",
  })!,
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#03111F",
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 3 },
    default: {
      shadowColor: "#03111F",
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
    },
  })!,
  glow: Platform.select({
    ios: {
      shadowColor: "#57C7FF",
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 4 },
    default: {
      shadowColor: "#57C7FF",
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
    },
  })!,
};
