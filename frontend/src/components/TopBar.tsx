import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import GlobalNotice from "@/src/components/GlobalNotice";
import SideMenu from "@/src/components/SideMenu";

type Props = {
  title?: string;
  showBack?: boolean;
  backPath?: string;
  rightLabel?: string;
};

export default function TopBar({ title, showBack, backPath, rightLabel }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View>
      <View style={styles.bar} testID="top-bar">
        <View style={styles.sideContainer}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => {
                if (backPath) {
                  router.replace(backPath as any);
                } else {
                  router.replace("/welcome");
                }
              }}
              style={styles.iconBtn}
              testID="topbar-back"
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={22} color={theme.textOnDark} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={styles.iconBtn}
              testID="topbar-menu"
              hitSlop={10}
            >
              <Ionicons name="menu" size={22} color={theme.textOnDark} />
            </TouchableOpacity>
          )}
        </View>

        <T variant="h2" align="center" color={theme.textOnDark} style={styles.title} numberOfLines={1}>
          {title || ""}
        </T>

        <View style={[styles.sideContainer, { alignItems: "flex-end" }]}>
          {rightLabel ? (
            <View style={styles.rightPill}>
              <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10, letterSpacing: 1.5 }}>
                {rightLabel}
              </T>
            </View>
          ) : null}
        </View>

        <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </View>
      <GlobalNotice />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 66,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  sideContainer: {
    minWidth: 52,
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: theme.surfaceGlass,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.borderOnDark,
  },
  rightPill: {
    backgroundColor: theme.surfaceGlass,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderOnDark,
  },
});
