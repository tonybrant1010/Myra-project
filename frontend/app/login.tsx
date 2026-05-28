import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

const MYRA_MARK = require("@/assets/images/AI_and_Psychology.png");

export default function LoginScreen() {
  const router = useRouter();
  const { login, token: authContextToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Add meg az email cimedet es a jelszavad.");
      return;
    }
    setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error || "Bejelentkezesi hiba");
    else router.replace("/");
  };

  const handleForgotPassword = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Az elfelejtett jelszo kereshez add meg az email cimedet.");
      return;
    }
    setBusy(true);
    try {
      const r = await authedFetch(authContextToken, "/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      if (r.ok) {
        Alert.alert("Kod elkuldve", "Ha az email cim letezik a rendszerben, elkuld̈tuk ra a 6 jegyu biztonsagi kodot.");
        setMode("reset");
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d?.detail || "Nem sikerult elindıtani a visszaallıtasi folyamatot.");
      }
    } catch {
      setError("Halozati hiba a keres feldolgozasa kozben.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetSubmit = async () => {
    setError(null);
    if (!resetCode.trim() || !newPassword || !passwordConfirm) {
      setError("Kerlek toltsd ki az osszes mezot.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A jelszónak legalabb 8 karakterbol kell allnia.");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("A ket jelszo nem egyezik meg.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("https://myra-project.cfd/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetCode.trim(), new_password: newPassword }),
      });
      const data = await response.json();
      setBusy(false);
      if (response.ok && data.ok) {
        Alert.alert("Sikeres jelszocsSere", "Az uj jelszavad ervénybe lepett.");
        setMode("login");
        setPassword(""); setResetCode(""); setNewPassword(""); setPasswordConfirm("");
      } else {
        setError(data.detail || "Hibas kod vagy lejart munkamenet.");
      }
    } catch {
      setBusy(false);
      setError("Nem sikerult elerni a szervert.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Dark hero — logo + title */}
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Image source={MYRA_MARK} style={styles.logo} resizeMode="cover" />
            </View>
            <T variant="caption" color={theme.accentSoft} style={styles.heroCaption}>ESV-MODELL</T>
            <T variant="display" color={theme.textOnDark} style={styles.heroTitle}>Myra - Project</T>
            <View style={styles.heroRule} />
            <T variant="body" color="rgba(240,237,229,0.6)" align="center" style={{ maxWidth: 280 }}>
              {mode === "login" && "Meres- es interakcioalapu mentalhigienés alkalmazas."}
              {mode === "forgot" && "Biztonsagi kod igénylése jelszó-visszaallıtashoz."}
              {mode === "reset" && "ırd be az emailben kapott 6 jegyű kodot és az uj jelszavad."}
            </T>
          </View>

          {/* Light form area */}
          <View style={styles.formSheet}>

            {mode === "login" && (
              <>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>Email</T>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@name.hu"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="login-email"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>Jelszó</T>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder=" "
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    testID="login-password"
                  />
                </View>
                <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotBtn}>
                  <T variant="small" color={theme.textSecondary} style={{ textDecorationLine: "underline" }}>
                    Elfelejttetted a jelszavad?
                  </T>
                </TouchableOpacity>
                {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }} testID="login-error">{error}</T> : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy} testID="login-submit">
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Bejelentkezés</T>}
                </TouchableOpacity>
                <View style={styles.foot}>
                  <T variant="small" color={theme.textSecondary}>Még nincs fiókod? </T>
                  <Link href="/register" asChild>
                    <Pressable testID="link-register">
                      <T variant="small" color={theme.accent} style={{ fontWeight: "bold" }}>Regisztrálj</T>
                    </Pressable>
                  </Link>
                </View>
              </>
            )}

            {mode === "forgot" && (
              <>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>Email cimed</T>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@name.hu"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }}>{error}</T> : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleForgotPassword} disabled={busy}>
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Biztonsagi kod kerese</T>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode("login")} style={{ alignSelf: "center", marginTop: 20 }}>
                  <T variant="small" color={theme.accent}>Vissza a bejelentkezeshez</T>
                </TouchableOpacity>
              </>
            )}

            {mode === "reset" && (
              <>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>6 jegyű biztonsagi kod</T>
                  <TextInput
                    style={[styles.input, { letterSpacing: 6, textAlign: "center", fontSize: 22 }]}
                    value={resetCode}
                    onChangeText={setResetCode}
                    placeholder="123456"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>Uj jelszo (min. 8 karakter)</T>
                  <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="Uj jelszo" placeholderTextColor={theme.textSecondary} secureTextEntry />
                </View>
                <View style={styles.fieldGroup}>
                  <T variant="caption" color={theme.accent} style={styles.lbl}>Megerosites</T>
                  <TextInput style={styles.input} value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="Megerosites" placeholderTextColor={theme.textSecondary} secureTextEntry />
                </View>
                {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }}>{error}</T> : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleResetSubmit} disabled={busy}>
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Jelszo mentese</T>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode("login")} style={{ alignSelf: "center", marginTop: 20 }}>
                  <T variant="small" color={theme.accent}>Megis inkabb bejelentkeznek</T>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.supportRow}>
              <T variant="small" color={theme.textSecondary}>Segitseg: </T>
              <T variant="small" color={theme.accent}>myra-project@research.hu</T>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  scroll: { flexGrow: 1 },

  hero: {
    backgroundColor: theme.primary,
    alignItems: "center",
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 28,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  logo: { width: 96, height: 96 },
  heroCaption: { letterSpacing: 2.4, fontSize: 10, marginBottom: 8 },
  heroTitle: {
    fontSize: 38,
    color: theme.textOnDark,
    textAlign: "center",
    marginBottom: 16,
  },
  heroRule: {
    width: 32,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    marginBottom: 14,
  },

  formSheet: {
    flex: 1,
    backgroundColor: theme.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    marginTop: -1,
  },

  fieldGroup: { marginBottom: 16 },
  lbl: { marginBottom: 7, letterSpacing: 1.8, fontSize: 10 },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 16,
    color: theme.textPrimary,
    fontFamily: "Manrope_400Regular",
  },
  forgotBtn: { alignSelf: "flex-end", paddingVertical: 4, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  foot: { flexDirection: "row", justifyContent: "center", marginTop: 20, alignItems: "center" },
  supportRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
  },
});
