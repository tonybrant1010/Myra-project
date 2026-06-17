import React from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme, radii, spacing } from "@/src/theme";

export default function RelaxCenterScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} testID="relax-center-screen">
      <TopBar title="Relaxációs Központ" />
      <ContentBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <T variant="display" color={theme.textOnDark} style={styles.title}>
            Lassíts le egy pillanatra.
          </T>
          <T variant="body" color="rgba(247,251,255,0.72)" style={styles.subtitle}>
            Válassz egy pihentető játékot vagy gyakorlatot a feszültség levezetéséhez és az elme megnyugtatásához.
          </T>

          {/* Activity 1: Myra Match */}
          <TouchableOpacity
            style={[styles.card, shadow.card]}
            onPress={() => router.push("/relax-match")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(87,199,255,0.15)", "rgba(18,58,98,0.3)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(87,199,255,0.2)" }]}>
                  <Ionicons name="grid-outline" size={24} color={theme.accent} />
                </View>
                <View style={styles.badge}>
                  <T variant="small" color={theme.accent} style={{ fontWeight: "600" }}>ELÉRHETŐ</T>
                </View>
              </View>
              <T variant="title" color={theme.textOnDark} style={styles.cardTitle}>
                Myra Match
              </T>
              <T variant="body" color="rgba(247,251,255,0.76)" style={styles.cardDesc}>
                Párosítsd a hasonló szimbólumokat, lépj be a virágok és csillagok nyugtató világába, és érj el minél több pontot!
              </T>
              <View style={styles.playRow}>
                <T variant="label" color={theme.accent}>Indítás</T>
                <Ionicons name="arrow-forward" size={16} color={theme.accent} style={{ marginLeft: 6 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Activity 2: Breathing Exercise (Coming Soon) */}
          <View style={[styles.card, styles.cardDisabled, shadow.card]}>
            <LinearGradient
              colors={["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                  <Ionicons name="leaf-outline" size={24} color="rgba(247,251,255,0.4)" />
                </View>
                <View style={[styles.badge, styles.badgeDisabled]}>
                  <T variant="small" color="rgba(247,251,255,0.4)" style={{ fontWeight: "600" }}>HAMAROSAN</T>
                </View>
              </View>
              <T variant="title" color="rgba(247,251,255,0.5)" style={styles.cardTitle}>
                Légzésgyakorlat
              </T>
              <T variant="body" color="rgba(247,251,255,0.4)" style={styles.cardDesc}>
                Kövesd a ritmust, lassítsd le a légzésed és találd meg a belső egyensúlyod a vezetett légzésritmussal.
              </T>
            </LinearGradient>
          </View>

          {/* Activity 3: Sound Bath (Coming Soon) */}
          <View style={[styles.card, styles.cardDisabled, shadow.card]}>
            <LinearGradient
              colors={["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                  <Ionicons name="musical-notes-outline" size={24} color="rgba(247,251,255,0.4)" />
                </View>
                <View style={[styles.badge, styles.badgeDisabled]}>
                  <T variant="small" color="rgba(247,251,255,0.4)" style={{ fontWeight: "600" }}>HAMAROSAN</T>
                </View>
              </View>
              <T variant="title" color="rgba(247,251,255,0.5)" style={styles.cardTitle}>
                Meditációs Hangfürdő
              </T>
              <T variant="body" color="rgba(247,251,255,0.4)" style={styles.cardDesc}>
                Nyugtató binaurális ütemek és természetes hangok gyűjteménye a mély relaxációhoz és meditációhoz.
              </T>
            </LinearGradient>
          </View>
        </ScrollView>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(247,251,255,0.68)",
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardGradient: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: "rgba(87,199,255,0.12)",
  },
  badgeDisabled: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: {
    fontSize: 20,
    marginBottom: spacing.xs,
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
});
