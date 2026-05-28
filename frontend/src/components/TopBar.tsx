import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import SideMenu from "@/src/components/SideMenu";

type Props = {
  title?: string;
  showBack?: boolean;
  rightLabel?: string;
};

export default function TopBar({ title, showBack, rightLabel }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.bar} testID="top-bar">
      {/* BAL OLDAL: Navigáció */}
      <View style={styles.sideContainer}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.replace("/welcome")}
            style={styles.pillBtn}
            testID="topbar-back"
            hitSlop={10}
          >
            <T variant="label" color={theme.textOnDark} style={{ fontWeight: "600" }}>Vissza</T>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={styles.pillBtn}
            testID="topbar-menu"
            hitSlop={10}
          >
            <T variant="label" color={theme.textOnDark} style={{ fontWeight: "600" }}>Menü</T>
          </TouchableOpacity>
        )}
      </View>

      {/* KÖZÉP: Címsor */}
      <T variant="h2" align="center" color={theme.textOnDark} style={styles.title} numberOfLines={1}>
        {title || ""}
      </T>

      {/* JOBB OLDAL: Állapotkód vagy üres hely */}
      <View style={[styles.sideContainer, { alignItems: "flex-end" }]}>
        {rightLabel ? (
          <View style={styles.rightPill}>
            <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: "bold" }}>
              {rightLabel}
            </T>
          </View>
        ) : null}
      </View>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
    backgroundColor: theme.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.primaryDark,
  },
  sideContainer: {
    minWidth: 80,
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
  },
  pillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  rightPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
});
