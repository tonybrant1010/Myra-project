import React from "react";
import { ImageBackground, StyleSheet } from "react-native";
import { theme } from "@/src/theme";

// Ugyanaz a háttérkép, mint a login/register oldalon
const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";

type Props = {
  children: React.ReactNode;
  style?: object;
};

/**
 * Egységes háttérkép-wrapper az összes oldalhoz.
 * A TopBar alá kerül, és a teljes content területet lefedi.
 */
export default function ContentBackground({ children, style }: Props) {
  return (
    <ImageBackground
      source={{ uri: HERO_BG }}
      style={[styles.bg, style]}
      imageStyle={styles.bgImg}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: theme.bg },
  bgImg: { opacity: 0.12 },
});
