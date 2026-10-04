import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { apiUrl, registerMaintenanceListener, useAuth } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

const DEFAULT_MESSAGE =
  "A Myra jelenleg tervezett karbantartás miatt nem érhető el. Kérjük, próbáld meg később.";
const POLL_MS = 60000;

// Karbantartás alatt a nem-admin felhasználók csak ezt a tájékoztató oldalt látják.
// Az állapotot a nyilvános /api/config adja, és bármelyik 503-as válasz azonnal bekapcsolja.
// A bejelentkezés és a jelszó-visszaállítás elérhető marad, hogy az admin be tudjon lépni.
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [notice, setNotice] = useState("");
  const wasOn = useRef(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/config"), { cache: "no-store", credentials: "omit" });
      if (!r.ok) return;
      const d = await r.json();
      setOn(!!d?.maintenance_mode);
      setNotice(String(d?.global_notice_text || "").trim());
    } catch {}
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    const unsubscribe = registerMaintenanceListener(() => setOn(true));
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, [check]);

  // Ha a karbantartás véget ér, újratöltjük az oldalt, hogy minden adat frissen betöltődjön.
  useEffect(() => {
    if (wasOn.current && !on && Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    }
    wasOn.current = on;
  }, [on]);

  const allowedRoute = pathname.startsWith("/login") || pathname.startsWith("/reset-password");
  if (!on || loading || user?.is_admin || allowedRoute) return <>{children}</>;

  return (
    <View style={styles.wrap} testID="maintenance-screen">
      <View style={styles.card}>
        <Ionicons name="construct-outline" size={40} color={theme.accent} />
        <T variant="h2" color={theme.textOnDark} align="center" style={styles.title}>
          Karbantartás
        </T>
        <T variant="body" color={theme.textOnDark} align="center" style={styles.text}>
          {DEFAULT_MESSAGE}
        </T>
        {!!notice && (
          <T variant="small" color={theme.accentSoft} align="center" style={styles.text}>
            {notice}
          </T>
        )}
        <T variant="small" color={theme.accentSoft} align="center" style={styles.text}>
          Az adataid biztonságban vannak. Amint végeztünk, az oldal magától újratöltődik.
        </T>
        {!user && (
          <Pressable onPress={() => router.push("/login")} style={styles.link} accessibilityRole="link">
            <T variant="caption" color={theme.accent} align="center">
              Bejelentkezés
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    maxWidth: 480,
    width: "100%",
    alignItems: "center",
    gap: 14,
    padding: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.3)",
    backgroundColor: "rgba(7,29,50,0.96)",
  },
  title: { marginTop: 4 },
  text: { lineHeight: 22 },
  link: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
});
