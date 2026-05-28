import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { theme, fonts } from "@/src/theme";

type Variant =
  | "hero"          // 4-digit code display — Cormorant Garamond
  | "display"       // big title — Cormorant Garamond
  | "h1"            // page title — Cormorant Garamond
  | "h2"            // subsection — Cormorant Garamond
  | "title"         // card/bubble title — Manrope SemiBold
  | "body"          // 15 default — Manrope
  | "bodyLg"        // 16 (chat) — Manrope
  | "small"         // 13 muted — Manrope
  | "caption"       // 11 uppercase tracked — Manrope Medium
  | "label";        // 14 medium — Manrope Medium

const variantStyles: Record<Variant, TextStyle> = {
  hero: {
    fontFamily: fonts.display,
    fontSize: 64,
    letterSpacing: 8,
    color: theme.primary,
    lineHeight: 72,
  },
  display: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 44,
    color: theme.textPrimary,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: theme.textPrimary,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    color: theme.textPrimary,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: theme.textPrimary,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: theme.textPrimary,
  },
  bodyLg: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 25,
    color: theme.textPrimary,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.textSecondary,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: theme.accent,
    textTransform: "uppercase",
  },
  label: {
    fontFamily: fonts.bodyMedium,
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
