import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { shadow, theme } from "@/src/theme";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";

export default function QuizResultScreen() {
  useAuthGuard();
  const router = useRouter();
  const { token } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<{ code?: string; title?: string; severity?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch(token, "/api/codes/me");
        if (r.ok) {
          const data = await r.json();
          setProfile(data.profile || null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const displayCode = code || profile?.code || "----";
  const codeFontSize = width < 480 ? 52 : 64;
  const codeLineHeight = codeFontSize + 8;

  return (
    <SafeAreaView style={styles.safe} testID="quiz-result-screen">
      <ContentBackground>
        <TopBar title="Mérési eredmény" />
        <View style={styles.container}>
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.resultPanel, shadow.card]}>
            <View style={[styles.resultSheen, styles.noPointer]} />
            <T variant="caption" color={theme.accentSoft} style={styles.caption}>
              A te állapotkódod
            </T>

            <View style={styles.codeWrap} testID="result-code">
              {String(displayCode).split("").map((d, i) => (
                <View key={i} style={styles.digitBox}>
                  <T
                    variant="hero"
                    color={theme.textOnDark}
                    style={{ fontSize: codeFontSize, lineHeight: codeLineHeight, letterSpacing: 0 }}
                  >
                    {d}
                  </T>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
            ) : profile ? (
              <View style={styles.profileBlock}>
                {profile.severity ? (
                  <View style={styles.sevTag}>
                    <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10, letterSpacing: 1.6 }}>
                      {profile.severity}
                    </T>
                  </View>
                ) : null}
              </View>
            ) : null}

            <T variant="body" color="rgba(247,251,255,0.72)" align="center" style={styles.note}>
              A mérés sikeresen lezárult. Myra már felkészült a fogadásodra - személyre szabott beszélgetéssel vár.
            </T>
          </LinearGradient>

          <View style={styles.ctaBlock}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/chat")} testID="result-start-chat" activeOpacity={0.88}>
              <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
                <Ionicons name="chatbubble-ellipses" size={18} color={theme.white} />
                <T variant="title" color={theme.white}>Beszélgetés Myrával</T>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/welcome")} testID="result-goto-welcome" activeOpacity={0.88}>
              <T variant="title" color={theme.textOnDark}>Vissza a főoldalra</T>
            </TouchableOpacity>
          </View>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: "none" },
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flex: 1, padding: 18, justifyContent: "space-between" },
  resultPanel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  resultSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "radial-gradient(ellipse at 78% 10%, rgba(87,199,255,0.18), transparent 38%), linear-gradient(135deg, rgba(139,143,232,0.10), transparent 46%)",
  } as any,
  caption: { fontSize: 10, letterSpacing: 2 },
  codeWrap: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 26 },
  digitBox: {
    width: 66,
    height: 78,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileBlock: { alignItems: "center", width: "100%", maxWidth: 440, marginTop: 24 },
  sevTag: { backgroundColor: "rgba(87,199,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  note: { maxWidth: 430, alignSelf: "center", marginTop: 22, lineHeight: 23 },
  ctaBlock: { gap: 10, marginTop: 12 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  primaryGradient: { width: "100%", minHeight: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
