import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

export default function GlobalNotice() {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/config"))
      .then((r) => r.json())
      .then((d) => {
        if (alive) setNotice(String(d?.global_notice_text || "").trim());
      })
      .catch(() => {
        if (alive) setNotice("");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!notice) return null;

  return (
    <View style={styles.wrap} testID="global-notice">
      <Ionicons name="information-circle-outline" size={17} color={theme.accentSoft} />
      <T variant="small" color={theme.textOnDark} style={styles.text} numberOfLines={2}>
        {notice}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(7,29,50,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    flex: 1,
    lineHeight: 18,
  },
});
