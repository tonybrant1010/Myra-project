import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { backgroundGradient, theme } from "@/src/theme";

type Props = {
  children: React.ReactNode;
  style?: object;
};

// Nyugodt légzésritmus: ~6 légzés/perc (4,2 mp be, 5,8 mp ki).
const BREATH_IN_MS = 4200;
const BREATH_OUT_MS = 5800;
const MIST_TWO_BASE_OPACITY = Platform.OS === "web" ? 1 : 0.55;

export default function ContentBackground({ children, style }: Props) {
  const breath = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (mounted) setReduceMotion(!!enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      breath.setValue(0.5);
      return;
    }
    const useNative = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_IN_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_OUT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduceMotion]);

  const mistOneOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] });
  const mistTwoOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [MIST_TWO_BASE_OPACITY * 0.72, MIST_TWO_BASE_OPACITY],
  });

  return (
    <LinearGradient
      // A négy megálló a témából jön: weben CSS-változó, natívon fix érték.
      // Éjszakai módban a negyedik (nappal majdnem fehér) megálló is besötétedik.
      colors={backgroundGradient}
      locations={[0, 0.42, 0.78, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bg, style]}
    >
      <Animated.View style={[styles.auroraMistOne, styles.noPointer, { opacity: mistOneOpacity }]} />
      <Animated.View style={[styles.auroraMistTwo, styles.noPointer, { opacity: mistTwoOpacity }]} />
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
