import React from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <ImageBackground source={{ uri: HERO_BG }} style={styles.bg} imageStyle={styles.bgImg}>
        <TopBar title="" showMenu />
        <ContentBackground>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Köszöntés */}
            <View style={styles.greetBlock}>
              <T variant="caption" color={theme.accent} style={styles.caption}>ESV-MODELL</T>
              <T variant="display" style={styles.greet}>
                Szia, {user?.name ?? ""}!
              </T>
              <T variant="body" color={theme.textSecondary} style={styles.sub}>
                Örülök, hogy itt vagy.
              </T>
            </View>

            {/* Mi a Myra? */}
            <View style={styles.infoCard}>
              <T variant="label" color={theme.accent} style={styles.infoTitle}>Mi a Myra?</T>
              <T variant="body" color={theme.textSecondary} style={styles.infoText}>
                A Myra egy önismereti chatbot, amely az ESV-modell alapján ismeri az aktuális érzelmi és stressz állapotodat. Nem diagnosztizál és nem helyettesít szakembert — egy tükör, amely visszamutat arra, ami benned van.
              </T>
            </View>

            {/* Mi az ESV-modell? */}
            <View style={styles.infoCard}>
              <T variant="label" color={theme.accent} style={styles.infoTitle}>Mi az ESV-modell?</T>
              <T variant="body" color={theme.textSecondary} style={styles.infoText}>
                Az Érzelem–Stressz–Viselkedés (ESV) modell azt mutatja meg, hogyan hat egymásra a három belső tényező — egy visszacsatoló rendszerként, amely fenntartja a pszichés mintázatokat. A mérés négy területen (érzelem, szabályozás, stressz, testi tünetek) ad pillanatképet, nem diagnózist.
              </T>
            </View>

            {/* Support */}
            <View style={styles.supportBlock}>
              <T variant="small" color={theme.textSecondary}>Kérdés vagy probléma esetén:</T>
              <T variant="small" color={theme.primary} style={{ fontWeight: "600", marginTop: 2 }}>
                myra-project@research.hu
              </T>
            </View>

          </ScrollView>
        </ContentBackground>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  bg: { flex: 1 },
  bgImg: { opacity: 0.10 },
  scroll: { padding: 24, paddingBottom: 48 },
  greetBlock: { marginBottom: 20 },
  caption: { letterSpacing: 2, fontSize: 11, textTransform: "uppercase", marginBottom: 6 },
  greet: { marginBottom: 8 },
  sub: { maxWidth: 360 },
  codeCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryBtn: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  infoTitle: {
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontSize: 11,
    marginBottom: 8,
  },
  infoText: { lineHeight: 22 },
  supportBlock: {
    marginTop: 8,
    alignItems: "center",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
  },
});
