import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
// Az 'Ionicons' importot eltávolítottuk
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
// A 'fonts' importot eltávolítottuk
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";

const RESULT_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";

export default function QuizResultScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
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

  return (
    <SafeAreaView style={styles.safe} testID="quiz-result-screen">
      <TopBar title="Eredmény" />
      <ImageBackground source={{ uri: RESULT_BG }} style={styles.bg} imageStyle={styles.bgImage}>
        <View style={styles.container}>
          <View style={styles.heroBlock}>
            <T variant="caption">A TE ÁLLAPOTKÓDOD</T>
            <View style={styles.codeWrap} testID="result-code">
              {String(displayCode).split("").map((d, i) => (
                <T
                  key={i}
                  variant="hero"
                  color={theme.primary}
                  style={styles.codeChar}
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
            {/* Ikon eltávolítva */}
            <T variant="title" color={theme.white} style={{ fontWeight: "bold" }}>Beszélgetés Myrával</T>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  bg: { flex: 1 },
  bgImage: { opacity: 0.18 },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: "space-between" },
  heroBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  codeWrap: { flexDirection: "row", gap: 4 },
  codeChar: {
    // fontFamily eltávolítva, font-weight beállítva
    fontWeight: "bold",
    fontSize: 80,
    lineHeight: 90,
    letterSpacing: 4,
    marginHorizontal: 2,
  },
  profileCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    alignItems: "center",
    maxWidth: 360,
    marginTop: 8,
  },
  sevTag: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  note: { paddingHorizontal: 24, maxWidth: 360, marginTop: 4 },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});