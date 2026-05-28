import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";

export default function QuizResultScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<{
    code?: string;
    title?: string;
    severity?: string;
  } | null>(null);
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
  const codeFontSize = width < 480 ? 64 : width < 900 ? 72 : 64;
  const codeLineHeight = codeFontSize + 10;

  return (
    <SafeAreaView style={styles.safe} testID="quiz-result-screen">
      <TopBar title="Eredmény" />
      <ContentBackground>
        <View style={styles.container}>

          <View style={styles.heroBlock}>
            <T variant="caption" color={theme.accent}>A TE ALLAPOTKODOD</T>

            <View style={styles.codeWrap} testID="result-code">
              {String(displayCode).split("").map((d, i) => (
                <View key={i} style={styles.digitBox}>
                  <T
                    variant="hero"
                    color={theme.primary}
                    style={{ fontSize: codeFontSize, lineHeight: codeLineHeight, letterSpacing: 0 }}
                  >
                    {d}
                  </T>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 8 }} />
            ) : profile ? (
              <View style={[styles.profileCard, shadow.card]}>
                {profile.severity ? (
                  <View style={styles.sevTag}>
                    <T variant="caption" color={theme.accent} style={{ fontSize: 10, letterSpacing: 2 }}>
                      {profile.severity}
                    </T>
                  </View>
                ) : null}
                <T variant="h1" align="center" style={{ marginTop: 10 }}>
                  {profile.title}
                </T>
              </View>
            ) : null}

            <T variant="body" color={theme.textSecondary} align="center" style={styles.note}>
              A meres sikeresen lezarult. Myra mar felkeszult a fogadasodra — szemelyre szabott beszelgetessel var.
            </T>
          </View>

          <View style={styles.ctaBlock}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/chat")}
              testID="result-start-chat"
              activeOpacity={0.85}
            >
              <T variant="title" color={theme.white}>Beszelgetes Myraval</T>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.replace("/welcome")}
              testID="result-goto-welcome"
              activeOpacity={0.85}
            >
              <T variant="title" color={theme.primary}>Vissza a foodalra</T>
            </TouchableOpacity>
          </View>

        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: "space-between" },
  heroBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  codeWrap: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  digitBox: {
    width: 64,
    height: 72,
    backgroundColor: "rgba(43,58,48,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
  },
  sevTag: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  note: {
    maxWidth: 380,
    alignSelf: "center",
    paddingHorizontal: 4,
    lineHeight: 23,
  },
  ctaBlock: { gap: 10 },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.primary,
    backgroundColor: theme.surface,
  },
});
