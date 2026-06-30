import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/src/theme";

type Props = {
  children: React.ReactNode;
  style?: object;
};

export default function ContentBackground({ children, style }: Props) {
  return (
    <LinearGradient
      colors={["#04101D", "#08223B", "#123E66", "#EAF7FF"]}
      locations={[0, 0.42, 0.78, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bg, style]}
    >
      <View style={[styles.auroraMistOne, styles.noPointer]} />
      <View style={[styles.auroraMistTwo, styles.noPointer]} />
      <View style={[styles.vignette, styles.noPointer]} />
      <View style={[styles.grainLayer, styles.noPointer]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: theme.bg, overflow: "hidden" },
  noPointer: { pointerEvents: "none" },
  auroraMistOne: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "radial-gradient(ellipse at 82% 4%, rgba(87,199,255,0.40), transparent 36%), radial-gradient(ellipse at 16% 78%, rgba(139,143,232,0.24), transparent 42%)",
  } as any,
  auroraMistTwo: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "linear-gradient(118deg, rgba(255,255,255,0.08), transparent 28%, rgba(101,183,242,0.18) 58%, transparent 82%)",
    opacity: Platform.OS === "web" ? 1 : 0.55,
  } as any,
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "radial-gradient(circle at 50% 18%, transparent 0, transparent 42%, rgba(3,12,22,0.24) 100%)",
  } as any,
  grainLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.045,
    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)",
    backgroundSize: "8px 8px",
  } as any,
});
