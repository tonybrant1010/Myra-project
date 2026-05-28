import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";

export default function WelcomeScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <TopBar title="" />
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* Dark hero section */}
        <View style={styles.heroSection}>
          <T variant="caption" color={theme.accentSoft} style={styles.heroCaption}>
            ESV-MODELL
          </T>
          <T variant="display" color={theme.textOnDark} style={styles.heroName}>
            {"Szia,\n"}{user?.name ?? ""}!
          </T>
          <View style={styles.heroRule} />
          <T variant="body" color="rgba(240,237,229,0.65)" style={{ maxWidth: 300 }}>
            Örülök, hogy itt vagy.
          </T>
        </View>

        {/* Light content section */}
        <View style={styles.lightContent}>

          <View style={[styles.infoCard, shadow.card]}>
            <T variant="caption" color={theme.accent} style={styles.infoTitle}>Mi a Myra?</T>
            <T variant="body" color={theme.textSecondary} style={styles.infoText}>
              Önismereti chatbot az ESV-modell alapján. Nem diagnosztizál, nem helyettesít szakembert — egy tükör, amely visszamutat arra, ami benned van.
            </T>
          </View>

          <View style={[styles.infoCard, shadow.card]}>
            <T variant="caption" color={theme.accent} style={styles.infoTitle}>Mi az ESV-modell?</T>
            <T variant="body" color={theme.textSecondary} style={styles.infoText}>
              Az Érzelem–Stressz–Viselkedés modell négy területen ad pillanatképet az aktuális pszichés állapotodról: érzelem, szabályozás, stressz, testi tünetek.
            </T>
          </View>

          <View style={styles.supportBlock}>
            <T variant="small" color={theme.textSecondary}>Kérdés vagy probléma esetén:</T>
            <T variant="small" color={theme.accent} style={{ marginTop: 2 }}>
              myra-project@research.hu
            </T>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },

  heroSection: {
    backgroundColor: theme.primary,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
  },
  heroCaption: {
    letterSpacing: 2.4,
    fontSize: 11,
    marginBottom: 14,
  },
  heroName: {
    fontSize: 44,
    lineHeight: 50,
    color: theme.textOnDark,
    marginBottom: 22,
  },
  heroRule: {
    width: 36,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    marginBottom: 14,
  },

  lightContent: {
    backgroundColor: theme.bg,
    padding: 20,
    paddingBottom: 56,
    minHeight: 400,
  },

  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 22,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  infoTitle: {
    marginBottom: 10,
  },
  infoText: {
    lineHeight: 23,
  },

  supportBlock: {
    marginTop: 12,
    alignItems: "center",
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
  },
});
