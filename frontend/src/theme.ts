import { Platform } from "react-native";

export const theme = {
  // Paper & Surface
  bg: "#F7F5F0", // Paper-Cream
  surface: "#FFFFFF",
  surfaceAlt: "#FDFCF8",

  // Brand
  primary: "#2B3A30", // Deep Moss
  primaryDark: "#1E2A23", // Darker Moss (TopBar border)
  secondary: "#6B7D70", // Sage
  accent: "#C07C66", // Terracotta
  accentSoft: "#E9D9D2",

  // Text
  textPrimary: "#1E2420", // Graphite
  textSecondary: "#5C6B61", // Muted Moss
  textOnDark: "#F0EDE5", // Used on Deep Moss surfaces (drawer)

  // Borders & dividers
  border: "#D9D5C8",
  borderSoft: "#EDEAE0",

  // Status
  danger: "#A65442",
  white: "#FFFFFF",
};

export const fonts = {
  display: Platform.select({
    ios: "CormorantGaramond_500Medium",
    android: "CormorantGaramond_500Medium",
    default: "CormorantGaramond_500Medium",
  })!,
  displayBook: "CormorantGaramond_400Regular",
  body: Platform.select({
    ios: "Manrope_400Regular",
    android: "Manrope_400Regular",
    default: "Manrope_400Regular",
  })!,
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
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
  // Soft elevation for premium cards
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 2 },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
  })!,
};
