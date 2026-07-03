import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
      <LinearGradient
        colors={["#04101D", "#08223B", "#123E66"]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bar}
        testID="top-bar"
      >
        <View style={[styles.topMist, styles.noPointer]} />
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
      </LinearGradient>
      <GlobalNotice />
    </View>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: "none" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 66,
    backgroundColor: theme.bg,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  topMist: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "radial-gradient(ellipse at 78% 0%, rgba(87,199,255,0.26), transparent 36%), linear-gradient(118deg, rgba(255,255,255,0.06), transparent 42%, rgba(101,183,242,0.12))",
  } as any,
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
