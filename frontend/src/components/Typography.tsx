import React from "react";
import { Text, StyleSheet, TextProps, TextStyle } from "react-native";
// A 'fonts' importot eltávolítottuk, csak a 'theme' maradt
import { theme } from "@/src/theme";

type Variant =
  | "hero"          // 4-digit code display
  | "display"       // big title
  | "h1"            // page title
  | "h2"            // subsection
  | "title"         // bubble / card title
  | "body"          // 16 default
  | "bodyLg"        // 17 (chat)
  | "small"         // 14 muted
  | "caption"       // 11/12 uppercase tracked
  | "label";        // 13 medium

const variantStyles: Record<Variant, TextStyle> = {
  hero: {
    fontWeight: "bold",
    fontSize: 64,
    letterSpacing: 8,
    color: theme.primary,
    lineHeight: 72,
  },
  display: {
    fontWeight: "bold",
    fontSize: 36,
    lineHeight: 42,
    color: theme.textPrimary,
  },
  h1: {
    fontWeight: "bold",
    fontSize: 28,
    lineHeight: 34,
    color: theme.textPrimary,
  },
  h2: {
    fontWeight: "bold",
    fontSize: 22,
    lineHeight: 28,
    color: theme.textPrimary,
  },
  title: {
    fontWeight: "600", // Félkövér
    fontSize: 16,
    color: theme.textPrimary,
  },
  body: {
    fontWeight: "normal",
    fontSize: 15,
    lineHeight: 22,
    color: theme.textPrimary,
  },
  bodyLg: {
    fontWeight: "normal",
    fontSize: 16,
    lineHeight: 24,
    color: theme.textPrimary,
  },
  small: {
    fontWeight: "normal",
    fontSize: 13,
    lineHeight: 19,
    color: theme.textSecondary,
  },
  caption: {
    fontWeight: "500", // Közepes vastagság
    fontSize: 11,
    letterSpacing: 2.4,
    color: theme.accent,
    textTransform: "uppercase",
  },
  label: {
    fontWeight: "500",
    fontSize: 14,
    color: theme.textPrimary,
  },
};

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  align?: "left" | "center" | "right";
};

export function T({ variant = "body", color, align, style, ...rest }: Props) {
  const base = variantStyles[variant];
  return (
    <Text
      {...rest}
      style={[
        base,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export const ty = variantStyles;