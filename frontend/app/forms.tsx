import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking as RNLinking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, apiUrl } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";

export default function FormsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [formsUrl, setFormsUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/config"));
        const data = await r.json();
        setFormsUrl(data.forms_url || "");
      } catch {}
      setLoading(false);
    })();
  }, []);

  const openForms = async () => {
    if (!formsUrl) return;
    try {
      await RNLinking.openURL(formsUrl);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} testID="forms-screen">
      <TopBar title="Az utad" />
      <ContentBackground>
        <View style={styles.container}>
          <View>
            <Text style={styles.overline}>1. LÉPÉS</Text>
            <Text style={styles.title}>Töltsd ki a kérdőívet</Text>
            <Text style={styles.subtitle}>
              Üdv {user?.name?.split(" ")[0] || "barátom"}! A Myra-project mérése egy rövid
              kérdőívvel kezdődik. A kitöltés végén kapsz egy 4 számjegyű kódot, amit a
              következő képernyőn adsz meg.
            </Text>

            <View style={styles.stepCard} testID="step-1-card">
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Kérdőív megnyitása</Text>
                <Text style={styles.stepDesc}>
                  Megnyitjuk a Google Forms kérdőívet a böngésződben.
                </Text>
              </View>
            </View>

            <View style={styles.stepCard} testID="step-2-card">
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Kérdőív kitöltése</Text>
                <Text style={styles.stepDesc}>
                  Válaszolj őszintén minden kérdésre. A végén megkapod a 4 számjegyű állapotkódot.
                </Text>
              </View>
            </View>

            <View style={styles.stepCard} testID="step-3-card">
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Beszélgetés indítása</Text>
                <Text style={styles.stepDesc}>
                  Add meg a kapott kódot, és kezdj el beszélgetni a személyre szabott AI-mentorral.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={openForms}
                  testID="open-forms-button"
                  disabled={!formsUrl}
                >
                  <Text style={styles.primaryBtnText}>Kérdőív megnyitása</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.push("/code")}
                  testID="have-code-button"
                >
                  <Text style={styles.secondaryBtnText}>Megvan a kódom →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: "space-between" },
  overline: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 3,
    color: theme.accent,
    marginBottom: 8,
    marginTop: 8,
  },
  title: { fontSize: 32, fontWeight: "300", color: theme.textOnDark, marginBottom: 12 },
  subtitle: { fontSize: 15, color: "rgba(247,251,255,0.72)", lineHeight: 22, marginBottom: 24 },
  stepCard: {
    backgroundColor: "rgba(6,19,32,0.58)",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(18px)",
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(87,199,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  stepNumberText: { color: theme.accent, fontWeight: "600" },
  stepTitle: { fontSize: 16, fontWeight: "600", color: theme.textOnDark, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "rgba(247,251,255,0.66)", lineHeight: 19 },
  actions: { gap: 12, marginTop: 16 },
  primaryBtn: {
    backgroundColor: theme.accentDeep,
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { color: theme.white, fontSize: 16, fontWeight: "bold" },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  secondaryBtnText: { color: theme.accent, fontSize: 16, fontWeight: "bold" },
});
