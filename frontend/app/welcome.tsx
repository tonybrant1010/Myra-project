import React from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hasCode = !!user?.state_code;

  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <ImageBackground source={{ uri: HERO_BG }} style={styles.bg} imageStyle={styles.bgImg}>
        <TopBar title="" />
        <ContentBackground>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Koszöntes */}
            <View style={styles.greetBlock}>
              <T variant="caption" color={theme.accent} style={styles.caption}>ESV-MODELL</T>
              <T variant="display" style={styles.greet}>
                Szia, {user?.name ?? ""}!
              </T>
              <T variant="body" color={theme.textSecondary} style={styles.sub}>
                Örülök, hogy itt vagy.
              </T>
            </View>

            {/* Allapotkod kartya — ha van mar meres */}
            {hasCode ? (
              <View style={[styles.codeCard, shadow.card]}>
                <T variant="caption" color={theme.accent} style={styles.codeLabel}>
                  Jelenlegi allapotkodod
                </T>
                <T
                  variant="hero"
                  color={theme.primary}
                  style={styles.codeHero}
                  testID="welcome-state-code"
                >
                  {user!.state_code}
                </T>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => router.push("/chat")}
                    testID="welcome-goto-chat"
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.white} style={{ marginRight: 6 }} />
                    <T variant="title" color={theme.white}>Chat Myraval</T>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.push("/quiz")}
                    testID="welcome-retake"
                    activeOpacity={0.85}
                  >
                    <T variant="title" color={theme.primary}>Uj meres</T>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.startCard}
                onPress={() => router.push("/quiz")}
                testID="welcome-start-quiz"
                activeOpacity={0.85}
              >
                <View style={styles.startCardInner}>
                  <View>
                    <T variant="h2" color={theme.textOnDark}>Kezdd el a merést</T>
                    <T variant="body" color="rgba(240,237,229,0.7)" style={{ marginTop: 4 }}>
                      Nehány perc, személyre szabott eredmény.
                    </T>
                  </View>
                  <Ionicons name="arrow-forward" size={22} color={theme.textOnDark} />
                </View>
              </TouchableOpacity>
            )}

            {/* Mi a Myra? */}
            <View style={styles.infoCard}>
              <T variant="caption" color={theme.accent} style={styles.infoTitle}>Mi a Myra?</T>
              <T variant="body" color={theme.textSecondary} style={styles.infoText}>
                A Myra egy önismereti chatbot, amely az ESV-modell alapjan ismeri az aktualis erzelmi es stressz allapotodat. Nem diagnosztizal es nem helyettesit szakembert — egy tükör, amely visszamutat arra, ami benned van.
              </T>
            </View>

            {/* Mi az ESV-modell? */}
            <View style={styles.infoCard}>
              <T variant="caption" color={theme.accent} style={styles.infoTitle}>Mi az ESV-modell?</T>
              <T variant="body" color={theme.textSecondary} style={styles.infoText}>
                Az Érzelem–Stressz–Viselkedes (ESV) modell azt mutatja meg, hogyan hat egymasra a harom belso tenyezo — egy visszacsatoló rendszerkent, amely fenntartja a pszicles mintazatokat. A meres negy teruleten (érzelem, szabalyozas, stressz, testi tünetek) ad pillanatképet, nem diagnózist.
              </T>
            </View>

            {/* Support */}
            <View style={styles.supportBlock}>
              <T variant="small" color={theme.textSecondary}>Kérdés vagy probléma esetén:</T>
              <T variant="small" color={theme.primary} style={{ marginTop: 2 }}>
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
  scroll: { padding: 24, paddingBottom: 52 },

  greetBlock: { marginBottom: 24 },
  caption: { letterSpacing: 2, fontSize: 11, marginBottom: 8 },
  greet: { marginBottom: 6 },
  sub: { maxWidth: 360 },

  codeCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  codeLabel: { marginBottom: 4 },
  codeHero: { fontSize: 52, lineHeight: 60, letterSpacing: 10, marginBottom: 20 },
  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 999,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 999,
  },

  startCard: {
    backgroundColor: theme.primary,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  startCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  infoTitle: { marginBottom: 10 },
  infoText: { lineHeight: 23 },

  supportBlock: {
    marginTop: 12,
    alignItems: "center",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
  },
});
