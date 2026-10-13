import { Platform } from "react-native";

const mod = <T,>(webValue: T, nativeValue: T): T =>
  Platform.OS === "web" ? webValue : nativeValue;

export const theme = {

  bg: mod("var(--myra-bg)", "#040b14"),
  background: mod("var(--myra-bg)", "#040b14"),
  surface: mod("var(--myra-surface)", "rgba(255,255,255,0.96)"),
  surfaceStrong: mod("var(--myra-surface-strong)", "#FFFFFF"),
  surfaceAlt: mod("var(--myra-surface-alt)", "rgba(244,249,255,0.85)"),
  surfaceGlass: mod("var(--myra-glass)", "rgba(255,255,255,0.08)"),
  surfaceGlassStrong: mod("var(--myra-glass-strong)", "rgba(255,255,255,0.15)"),


  primary: "#071b30",
  primaryDark: mod("var(--myra-primary-dark)", "#030c16"),
  primarySoft: mod("var(--myra-primary-soft)", "#0f2d4e"),
  secondary: "#7ea3ff",
  accent: "#4fd1c5",
  accentDeep: "#2baba0",
  accentSoft: "#e6fffa",
  info: "#4299e1",
  warm: "#ecc94b",
  calm: "#319795",
  violet: "#9f7aea",


  textPrimary: mod("var(--myra-text-primary)", "#0d1f35"),
  textSecondary: mod("var(--myra-text-secondary)", "#4a5d73"),
  textMuted: mod("var(--myra-text-muted)", "#718096"),
  textOnDark: "#f7fafc",


  border: mod("var(--myra-border)", "rgba(79,209,197,0.3)"),
  borderSoft: mod("var(--myra-border-soft)", "rgba(79,209,197,0.15)"),
  borderOnDark: mod("var(--myra-border-on-dark)", "rgba(255,255,255,0.12)"),


  danger: "#e53e3e",
  success: "#38a169",
  white: "#FFFFFF",
};

export const backgroundGradient: [string, string, string, string] = [
  mod("var(--myra-grad-1)", "#04101D"),
  mod("var(--myra-grad-2)", "#08223B"),
  mod("var(--myra-grad-3)", "#123E66"),
  mod("var(--myra-grad-4)", "#EAF7FF"),
];

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
    web: {
      boxShadow: "0 14px 28px rgba(3,17,31,0.18)",
    },
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
    web: {
      boxShadow: "0 8px 22px rgba(87,199,255,0.28)",
    },
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
