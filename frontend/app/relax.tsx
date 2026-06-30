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
      <TopBar title="Játszótér" showBack={true} />
      <ContentBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <T variant="display" color={theme.textOnDark} style={styles.title}>
            Kikapcsolódás
          </T>
          <T variant="body" color="rgba(247,251,255,0.72)" style={styles.subtitle}>
            Játssz egy kicsit, csendesítsd el az elméd, és töltődj fel a megnyugtató játékainkkal.
          </T>

          {/* Leaderboard button */}
          <TouchableOpacity
            style={[styles.leaderboardButton, shadow.card]}
            onPress={() => router.push("/relax-leaderboard")}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["rgba(255,215,0,0.15)", "rgba(18,58,98,0.3)"]}
              style={styles.leaderboardGradient}
            >
              <Ionicons name="trophy-outline" size={20} color={theme.warm} />
              <T variant="label" color={theme.textOnDark} style={{ marginLeft: 8, fontWeight: "600" }}>
                Globális Ranglista Megtekintése
              </T>
              <Ionicons name="chevron-forward" size={16} color="rgba(247,251,255,0.6)" style={{ marginLeft: "auto" }} />
            </LinearGradient>
          </TouchableOpacity>

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

          {/* Activity 2: Snake */}
          <TouchableOpacity
            style={[styles.card, shadow.card]}
            onPress={() => router.push("/relax-snake")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(86,214,141,0.15)", "rgba(18,58,98,0.3)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(86,214,141,0.2)" }]}>
                  <Ionicons name="navigate-outline" size={24} color={theme.success} />
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(86,214,141,0.12)" }]}>
                  <T variant="small" color={theme.success} style={{ fontWeight: "600" }}>ELÉRHETŐ</T>
                </View>
              </View>
              <T variant="title" color={theme.textOnDark} style={styles.cardTitle}>
                Klasszikus Kígyó
              </T>
              <T variant="body" color="rgba(247,251,255,0.76)" style={styles.cardDesc}>
                Irányítsd a kígyót, gyűjtsd össze a pontokat, és kerüld el az ütközéseket ebben a letisztult, meditatív játékban!
              </T>
              <View style={styles.playRow}>
                <T variant="label" color={theme.success}>Indítás</T>
                <Ionicons name="arrow-forward" size={16} color={theme.success} style={{ marginLeft: 6 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Activity 3: Coloring */}
          <TouchableOpacity
            style={[styles.card, shadow.card]}
            onPress={() => router.push("/relax-coloring")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(139,143,232,0.15)", "rgba(18,58,98,0.3)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(139,143,232,0.2)" }]}>
                  <Ionicons name="color-palette-outline" size={24} color={theme.violet} />
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(139,143,232,0.12)" }]}>
                  <T variant="small" color={theme.violet} style={{ fontWeight: "600" }}>ELÉRHETŐ</T>
                </View>
              </View>
              <T variant="title" color={theme.textOnDark} style={styles.cardTitle}>
                Pixel Színező
              </T>
              <T variant="body" color="rgba(247,251,255,0.76)" style={styles.cardDesc}>
                Színezz ki előre rajzolt pixel art mintákat (szív, virág, napocska) vagy alkoss szabadon a nyugtató színpalettával!
              </T>
              <View style={styles.playRow}>
                <T variant="label" color={theme.violet}>Indítás</T>
                <Ionicons name="arrow-forward" size={16} color={theme.violet} style={{ marginLeft: 6 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Activity 4: Sudoku */}
          <TouchableOpacity
            style={[styles.card, shadow.card]}
            onPress={() => router.push("/relax-sudoku")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(255,138,224,0.15)", "rgba(18,58,98,0.3)"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: "rgba(255,138,224,0.2)" }]}>
                  <Ionicons name="apps-outline" size={24} color={theme.warm} />
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(255,138,224,0.12)" }]}>
                  <T variant="small" color={theme.warm} style={{ fontWeight: "600" }}>ELÉRHETŐ</T>
                </View>
              </View>
              <T variant="title" color={theme.textOnDark} style={styles.cardTitle}>
                Sudoku
              </T>
              <T variant="body" color="rgba(247,251,255,0.76)" style={styles.cardDesc}>
                Töltsd ki a rácsot a számokkal, válaszd ki a neked tetsző méretet (4x4, 6x6 vagy 9x9), és koncentrálj a megnyugtató feladványra!
              </T>
              <View style={styles.playRow}>
                <T variant="label" color={theme.warm}>Indítás</T>
                <Ionicons name="arrow-forward" size={16} color={theme.warm} style={{ marginLeft: 6 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.18)",
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
  leaderboardButton: {
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderColor: "rgba(255,215,0,0.22)",
    borderWidth: 1,
  },
  leaderboardGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
