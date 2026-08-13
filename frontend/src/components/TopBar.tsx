import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import GlobalNotice from "@/src/components/GlobalNotice";
import SideMenu from "@/src/components/SideMenu";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { getForumSeenAt } from "@/src/utils/forumSeen";

type Props = {
  title?: string;
  showBack?: boolean;
  backPath?: string;
  rightLabel?: string;
  rightAction?: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    onPress: () => void;
    testID?: string;
  };
};

export default function TopBar({ title, showBack, backPath, rightLabel, rightAction }: Props) {
  const router = useRouter();
  const { token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [forumUnread, setForumUnread] = useState(false);

  // A TopBar minden kepernyon ott van, tehat minden navigalaskor ujra lefut.
  // Ez eleg frissesseg a jelzeshez, es nem kell hozza idozito.
  const checkForum = useCallback(async () => {
    if (!token) return;
    try {
      const r = await authedFetch(token, "/api/forum/latest");
      if (!r.ok) return;
      const { latest } = await r.json();
      if (!latest) return;
      const seen = await getForumSeenAt();
      setForumUnread(latest > seen);
    } catch {
      // A jelzes nem kritikus: halozati hiba eseten egyszeruen nem mutatunk pottyot.
    }
  }, [token]);

  useEffect(() => { checkForum(); }, [checkForum]);

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
              {forumUnread ? <View style={styles.menuDot} testID="topbar-forum-dot" /> : null}
            </TouchableOpacity>
          )}
        </View>

        <T variant="h2" align="center" color={theme.textOnDark} style={styles.title} numberOfLines={1}>
          {title || ""}
        </T>

        <View style={[styles.sideContainer, styles.rightRow]}>
          {rightLabel ? (
            <View style={styles.rightPill}>
              <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10, letterSpacing: 1.5 }}>
                {rightLabel}
              </T>
            </View>
          ) : null}
          {rightAction ? (
            <TouchableOpacity
              onPress={rightAction.onPress}
              style={styles.iconBtn}
              testID={rightAction.testID}
              hitSlop={10}
            >
              <Ionicons name={rightAction.icon} size={18} color={theme.textOnDark} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SideMenu
          visible={menuOpen}
          onClose={() => { setMenuOpen(false); checkForum(); }}
          forumUnread={forumUnread}
        />
      </View>
      <GlobalNotice />
    </View>
  );
}

const styles = StyleSheet.create({
  menuDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.accent,
    borderWidth: 1,
    borderColor: "rgba(3,12,22,0.9)",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 66,
    backgroundColor: "transparent",
  },
  sideContainer: {
    minWidth: 52,
    justifyContent: "center",
  },
  rightRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
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
