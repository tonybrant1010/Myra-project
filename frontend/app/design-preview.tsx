import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

const MYRA_AVATAR = require("@/assets/images/myra-avatar.png");
const ESV_LOGO = require("@/assets/images/esv-logo.png");

const palette = {
  ink: "#132238",
  forest: "#173B63",
  paper: "#F3F6FA",
  surface: "#FFFFFF",
  line: "#D4DFEA",
  mist: "#DCEBFA",
  teal: "#3A8FD8",
  amber: "#C89A4A",
  coral: "#4B9B8F",
  plum: "#6D6A9F",
  muted: "#5E6E80",
};

export default function DesignPreviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <SafeAreaView style={styles.safe} testID="design-preview-screen">
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.topNav}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.replace("/welcome")}
              testID="preview-back"
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={20} color={palette.ink} />
            </TouchableOpacity>
            <View style={styles.brand}>
              <Image source={ESV_LOGO} style={styles.logo} />
              <View>
                <T variant="caption" color={palette.coral} style={styles.brandKicker}>
                  ESV-MODELL
                </T>
                <T variant="title" color={palette.ink}>Myra</T>
              </View>
            </View>
            <TouchableOpacity style={styles.iconButton} testID="preview-menu" activeOpacity={0.85}>
              <Ionicons name="menu" size={20} color={palette.ink} />
            </TouchableOpacity>
          </View>

          <View style={[styles.hero, compact ? styles.heroCompact : null]}>
            <View style={styles.heroCopy}>
              <View style={styles.statusPill}>
                <View style={styles.liveDot} />
                <T variant="caption" color={palette.forest} style={styles.statusText}>
                  AKTÍV ÖNISMERETI SZÁL
                </T>
              </View>
              <T variant="display" color={palette.ink} style={styles.heroTitle}>
                Belső térkép és következő lépés
              </T>
              <T variant="body" color={palette.muted} style={styles.heroText}>
                A mai mérés alapján Myra az érzelmi terhelés, a stresszválasz és a viselkedési minták
                összefüggéseire ad visszajelzést.
              </T>
            </View>

            <LinearGradient
              colors={[palette.forest, palette.ink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.codePanel}
            >
              <T variant="caption" color="#D8C7B7" style={styles.panelCaption}>
                ÁLLAPOTKÓD
              </T>
              <T variant="hero" color="#FFF8EC" style={styles.code}>
                2334
              </T>
              <View style={styles.riskRow}>
                <View style={[styles.riskChip, { borderColor: palette.teal }]}>
                  <T variant="small" color="#D8F0E8">Terhelés közepes</T>
                </View>
                <View style={[styles.riskChip, { borderColor: palette.amber }]}>
                  <T variant="small" color="#F5DEAD">Követés 14 nap</T>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={[styles.grid, compact ? styles.gridCompact : null]}>
            <MetricCard
              icon="pulse"
              label="Érzelmi terhelés"
              value="72%"
              tone={palette.coral}
              track="magasabb"
            />
            <MetricCard
              icon="leaf"
              label="Szabalyozas"
              value="46%"
              tone={palette.teal}
              track="fejleszthető"
            />
            <MetricCard
              icon="flash"
              label="Stresszválasz"
              value="61%"
              tone={palette.amber}
              track="aktiv"
            />
          </View>

          <View style={[styles.mainArea, compact ? styles.mainAreaCompact : null]}>
            <View style={styles.planPanel}>
              <View style={styles.sectionHeader}>
                <T variant="caption" color={palette.coral}>FOLYAMATI ÍV</T>
                <T variant="h2" color={palette.ink}>Következő 3 lépés</T>
              </View>
              <PlanStep index="01" title="Regulációs alap" text="Napi rövid gyakorlat, szomatikus jelzések követése." tone={palette.teal} />
              <PlanStep index="02" title="Mintafelismerés" text="Triggerhelyzetek és visszatérő reakciók összekötése." tone={palette.amber} />
              <PlanStep index="03" title="Konzultációs mélyítés" text="A chat témái alapján célzott következő modul." tone={palette.plum} />
            </View>

            <View style={styles.myraPanel}>
              <View style={styles.avatarFrame}>
                <Image source={MYRA_AVATAR} style={styles.avatar} />
              </View>
              <T variant="caption" color={palette.coral} style={{ marginTop: 16 }}>
                MYRA FOLYTATJA
              </T>
              <T variant="h2" color={palette.ink} align="center" style={{ marginTop: 6 }}>
                Ma a lezárás és a visszatérés lesz a téma.
              </T>
              <TouchableOpacity style={styles.primaryAction} activeOpacity={0.9} testID="preview-chat">
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFF8EC" />
                <T variant="title" color="#FFF8EC">Beszélgetés indítása</T>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  track,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: string;
  track: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}22` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <T variant="small" color={palette.muted} style={{ marginTop: 14 }}>{label}</T>
      <View style={styles.metricValueRow}>
        <T variant="h1" color={palette.ink}>{value}</T>
        <T variant="caption" color={tone} style={styles.metricTrack}>{track}</T>
      </View>
    </View>
  );
}

function PlanStep({
  index,
  title,
  text,
  tone,
}: {
  index: string;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <View style={styles.planStep}>
      <View style={[styles.stepIndex, { borderColor: tone }]}>
        <T variant="caption" color={tone} style={{ letterSpacing: 1 }}>{index}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T variant="title" color={palette.ink}>{title}</T>
        <T variant="small" color={palette.muted} style={{ marginTop: 3 }}>{text}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  page: { flex: 1, backgroundColor: palette.paper },
  content: { padding: 18, paddingBottom: 40 },
  shell: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },
  topNav: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 19 },
  brandKicker: { fontSize: 9, letterSpacing: 1.8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  hero: {
    marginTop: 18,
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
  },
  heroCompact: { flexDirection: "column" },
  heroCopy: {
    flex: 1.25,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 24,
    minHeight: 260,
    justifyContent: "center",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.mist,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.teal,
  },
  statusText: { fontSize: 9, letterSpacing: 1.4 },
  heroTitle: {
    marginTop: 22,
    fontSize: 46,
    lineHeight: 52,
    maxWidth: 560,
  },
  heroText: { marginTop: 14, maxWidth: 560 },
  codePanel: {
    flex: 0.75,
    borderRadius: 8,
    padding: 24,
    minHeight: 260,
    justifyContent: "space-between",
  },
  panelCaption: { fontSize: 10, letterSpacing: 2 },
  code: { fontSize: 76, lineHeight: 84, letterSpacing: 10 },
  riskRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  riskChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  grid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  gridCompact: { flexDirection: "column" },
  metricCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 18,
    minHeight: 142,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValueRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  metricTrack: { fontSize: 9, letterSpacing: 1.3, paddingBottom: 8 },
  mainArea: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    alignItems: "stretch",
  },
  mainAreaCompact: { flexDirection: "column" },
  planPanel: {
    flex: 1.15,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 20,
  },
  sectionHeader: { marginBottom: 14 },
  planStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  stepIndex: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  myraPanel: {
    flex: 0.85,
    backgroundColor: "#EFE6DC",
    borderWidth: 1,
    borderColor: "#D8C8B7",
    borderRadius: 8,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
  avatarFrame: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 5,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "#D8C8B7",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 42 },
  primaryAction: {
    marginTop: 20,
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: palette.ink,
  },
});
