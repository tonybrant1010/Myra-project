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

  // Képernyőszélességtől függő betűméret a kódhoz
  const codeFontSize = width < 480 ? 72 : width < 900 ? 80 : 64;
  const codeLineHeight = codeFontSize + 12;

  return (
    <SafeAreaView style={styles.safe} testID="quiz-result-screen">
      <TopBar title="Eredmény" />
      <ContentBackground>
        <View style={styles.container}>

          <View style={styles.heroBlock}>
            <T variant="caption">A TE ÁLLAPOTKÓDOD</T>

            <View style={styles.codeWrap} testID="result-code">
              {String(displayCode).split("").map((d, i) => (
                <T
                  key={i}
                  variant="hero"
                  color={theme.primary}
                  style={{ fontWeight: "bold", fontSize: codeFontSize, lineHeight: codeLineHeight, letterSpacing: 4, marginHorizontal: 2 }}
                >
                  {d}
                </T>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : profile ? (
              <View style={[styles.profileCard, shadow.card]}>
                {profile.severity ? (
                  <View style={styles.sevTag}>
                    <T variant="caption" color={theme.accent} style={{ fontSize: 10, letterSpacing: 2 }}>
                      {profile.severity}
                    </T>
                  </View>
                ) : null}
                <T variant="h2" align="center" style={{ marginTop: 8 }}>
                  {profile.title}
                </T>
              </View>
            ) : null}

            <T variant="body" color={theme.textSecondary} align="center" style={styles.note}>
              A mérés sikeresen lezárult, az állapotkódod alapján pedig Myra már felkészült a fogadásodra. Kész, statikus válaszok helyett egy személyre szabott beszélgetéssel vár. Indítsd el a chatet, és kezdd el a közös munkát.
            </T>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/chat")}
            testID="result-start-chat"
            activeOpacity={0.85}
          >
            <T variant="title" color={theme.white} style={{ fontWeight: "bold" }}>Beszélgetés Myrával</T>
          </TouchableOpacity>

        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: "space-between" },
  heroBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  codeWrap: { flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" },
  profileCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
  },
  sevTag: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  note: {
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 8,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
