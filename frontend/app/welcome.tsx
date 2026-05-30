import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthContext";
import { shadow, theme } from "@/src/theme";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";

export default function WelcomeScreen() {
  const { user } = useAuth();
  const greeting = user?.name ? `Szia ${user.name}!` : "Szia!";

  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <TopBar title="" />
      <ContentBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.heroCard, shadow.card]}>
            <View pointerEvents="none" style={styles.cardSheen} />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={15} color={theme.accentSoft} />
            </View>
            <T variant="display" color={theme.textOnDark} style={styles.heroName}>
              {greeting}
            </T>
            <View style={styles.heroRule} />
            <T variant="body" color="rgba(247,251,255,0.74)" style={styles.heroText}>
              Jó, hogy itt vagy.
            </T>
          </LinearGradient>

          <InfoCard
            icon="chatbubble-ellipses-outline"
            title="Mi a Myra?"
            text="A Myra egy önismereti beszélgetőtárs, amely a mérésed eredményéhez igazodva segít átgondolni az aktuális állapotodat. Nem diagnózis, és nem helyettesít szakembert."
          />

          <InfoCard
            icon="analytics-outline"
            title="Mi az ESV-modell?"
            text="Az Érzelem-Stressz-Viselkedés modell négy területen ad pillanatképet az aktuális pszichés állapotodról: érzelem, szabályozás, stressz és testi tünetek."
          />

          <View style={styles.supportBlock}>
            <T variant="small" color="rgba(247,251,255,0.66)">Kérdés vagy probléma esetén:</T>
            <T variant="small" color={theme.accentSoft} style={{ marginTop: 2 }}>
              myra-project@research.hu
            </T>
          </View>
        </ScrollView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function InfoCard({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={[styles.infoCard, shadow.card]}>
      <View style={styles.infoHead}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={18} color={theme.accentSoft} />
        </View>
        <T variant="caption" color={theme.accentSoft} style={styles.infoTitle}>
          {title}
        </T>
      </View>
      <T variant="body" color="rgba(247,251,255,0.72)" style={styles.infoText}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { padding: 18, paddingBottom: 44 },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 24,
    minHeight: 196,
    justifyContent: "center",
    overflow: "hidden",
  },
  cardSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "linear-gradient(135deg, rgba(87,199,255,0.18), transparent 42%, rgba(139,143,232,0.12))",
  } as any,
  heroBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(87,199,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroName: { fontSize: 34, lineHeight: 40, marginBottom: 18 },
  heroRule: { width: 44, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginBottom: 14 },
  heroText: { maxWidth: 300 },
  infoCard: {
    backgroundColor: "rgba(6,19,32,0.58)",
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(18px)",
  },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(87,199,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { flex: 1 },
  infoText: { lineHeight: 23 },
  supportBlock: {
    marginTop: 18,
    alignItems: "center",
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
});
