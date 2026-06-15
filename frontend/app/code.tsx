import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { theme } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";

export default function CodeScreen() {
  useAuthGuard();
  const router = useRouter();
  const { token, setUserLocal } = useAuth();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<Array<TextInput | null>>([null, null, null, null]);

  const handleChange = (idx: number, raw: string) => {
    const v = raw.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    setError(null);
    if (v && idx < 3) refs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (idx: number, key: string) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = "";
      setDigits(next);
      refs.current[idx - 1]?.focus();
    }
  };

  const code = digits.join("");
  const isComplete = code.length === 4;

  const submit = async () => {
    if (!isComplete) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authedFetch(token, "/api/codes/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.detail || "Érvénytelen kód");
        setBusy(false);
        return;
      }
      setUserLocal((u) => (u ? { ...u, state_code: code } : u));
      router.replace("/chat");
    } catch (e: any) {
      setError(e?.message || "Hiba a kód ellenőrzésekor");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="code-screen">
      <TopBar title="Állapotkód" showBack />
      <ContentBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.container}>
            <View>
              <Text style={styles.overline}>2. LÉPÉS</Text>
              <Text style={styles.title}>A te négy számjegyed</Text>
              <Text style={styles.subtitle}>
                Add meg a kérdőív végén kapott 4 számjegyű állapotkódot.
              </Text>

              <View style={styles.otpRow}>
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => {
                      refs.current[i] = r;
                    }}
                    value={d}
                    onChangeText={(v) => handleChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[styles.otpInput, d ? styles.otpInputFilled : null]}
                    testID={`otp-input-${i + 1}`}
                    autoFocus={i === 0}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? (
                <Text style={styles.error} testID="code-error">
                  {error}
                </Text>
              ) : null}

              <View style={styles.hintBox}>
                <Text style={styles.hint}>
                  Tipp: A kódot a Google Forms kitöltése utáni eredmény oldalon találod.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !isComplete && styles.primaryBtnDisabled]}
              onPress={submit}
              disabled={!isComplete || busy}
              testID="verify-code-button"
            >
              {busy ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Beszélgetés indítása</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: "space-between" },
  overline: { fontSize: 12, fontWeight: "600", letterSpacing: 3, color: theme.accent, marginBottom: 8, marginTop: 16 },
  title: { fontSize: 32, fontWeight: "300", color: theme.textOnDark, marginBottom: 12 },
  subtitle: { fontSize: 15, color: "rgba(247,251,255,0.72)", lineHeight: 22, marginBottom: 16 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 32,
    paddingHorizontal: 8,
  },
  otpInput: {
    flex: 1,
    height: 84,
    textAlign: "center",
    fontSize: 36,
    fontWeight: "300",
    color: theme.textOnDark,
    borderBottomWidth: 2,
    borderColor: theme.border,
    backgroundColor: "transparent",
  },
  otpInputFilled: { borderColor: theme.primary },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  hint: { color: "rgba(247,251,255,0.66)", fontSize: 13, flex: 1 },
  error: { color: theme.danger, fontSize: 14, textAlign: "center", marginTop: 4 },
  primaryBtn: {
    backgroundColor: theme.accentDeep,
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnDisabled: { backgroundColor: theme.border },
  primaryBtnText: { color: theme.white, fontSize: 16, fontWeight: "bold" },
});
