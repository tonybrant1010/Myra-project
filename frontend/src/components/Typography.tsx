import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { fonts, theme } from "@/src/theme";

type Variant =
  | "hero"
  | "display"
  | "h1"
  | "h2"
  | "title"
  | "body"
  | "bodyLg"
  | "small"
  | "caption"
  | "label";

const variantStyles: Record<Variant, TextStyle> = {
  hero: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 56,
    letterSpacing: 0,
    color: theme.primary,
    lineHeight: 64,
  },
  display: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: theme.textPrimary,
  },
  h1: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 28,
    lineHeight: 34,
    color: theme.textPrimary,
  },
  h2: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 22,
    lineHeight: 28,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
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
