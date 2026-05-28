import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  ImageBackground,
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

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";
const MYRA_MARK = require("@/assets/images/AI_and_Psychology.png");

export default function LoginScreen() {
  const router = useRouter();
  const { login, token: authContextToken } = useAuth();

  // Normál Login állapotok
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Közös UI állapotok
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visszaállítási folyamat állapotai
  // "login" | "forgot" (email bekérő) | "reset" (kód és új jelszó bekérő)
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // 1. Normál Bejelentkezés
  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Add meg az email címed és a jelszavad.");
      return;
    }
    setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error || "Bejelentkezési hiba");
    else router.replace("/");
  };

  // 2. 6 jegyű kód igénylése (Elfelejtett jelszó lépés 1)
  const handleForgotPassword = async () => {
    setError(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Az elfelejtett jelszó kéréséhez előbb add meg az Email címedet.");
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
        Alert.alert(
          "Kód elküldve",
          "Ha az email cím létezik a rendszerben, elküldtük rá a 6 jegyű biztonsági kódot."
        );
        setMode("reset"); // Átváltunk a kód és új jelszó bekérő nézetre
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d?.detail || "Nem sikerült elindítani a visszaállítási folyamatot.");
      }
    } catch (err) {
      setError("Hálózati hiba a kérés feldolgozása közben.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Jelszó módosítása a kapott kóddal (Elfelejtett jelszó lépés 2)
  const handleResetSubmit = async () => {
    setError(null);
    if (!resetCode.trim() || !newPassword || !passwordConfirm) {
      setError("Kérlek töltsd ki az összes mezőt.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A jelszónak legalább 8 karakterből kell állnia.");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("A két jelszó nem egyezik meg.");
      return;
    }

    setBusy(true);
    try {
      // Itt a token mezőbe magát a 6 jegyű kódot küldjük be a backendnek
      const response = await fetch("https://myra-project.cfd/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetCode.trim(), new_password: newPassword }),
      });

      const data = await response.json();
      setBusy(false);

      if (response.ok && data.ok) {
        Alert.alert("Sikeres jelszócsere", "Az új jelszavad érvénybe lépett, most már bejelentkezhetsz.");
        setMode("login");
        setPassword("");
        setResetCode("");
        setNewPassword("");
        setPasswordConfirm("");
      } else {
        setError(data.detail || "Hibás kód vagy lejárt munkamenet.");
      }
    } catch (e) {
      setBusy(false);
      setError("Nem sikerült elérni a szervert.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <ImageBackground source={{ uri: HERO_BG }} style={styles.bg} imageStyle={styles.bgImg}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Fejléc rész (Közös mindhárom nézetnél) */}
            <View style={styles.heroBlock}>
              <View style={styles.markRing}>
                <Image source={MYRA_MARK} style={styles.mark} resizeMode="cover" />
              </View>
              <T variant="caption" color={theme.accent}>ESV-MODELL</T>
              <T variant="display" style={{ marginTop: 6 }}>Myra - Project</T>
              <T variant="bodyLg" color={theme.textSecondary} style={{ marginTop: 8, maxWidth: 320 }}>
                {mode === "login" && "Mérés- és interakcióalapú mentálhigiénés alkalmazás."}
                {mode === "forgot" && "Biztonsági kód igénylése jelszó-visszaállításhoz."}
                {mode === "reset" && "Írd be az emailben kapott 6 jegyű kódot és az új jelszavad."}
              </T>
            </View>

            {/* 1. NÉZET: NORMÁL LOGIN */}
            {mode === "login" && (
              <View style={styles.form}>
                <T variant="label" color={theme.textSecondary} style={styles.lbl}>Email</T>
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

                <T variant="label" color={theme.textSecondary} style={styles.lbl}>Jelszó</T>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder=" "
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  testID="login-password"
                />

                <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotBtn}>
                  <T variant="small" color={theme.textSecondary} style={styles.forgotText}>
                    Elfelejtetted a jelszavad?
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
              </View>
            )}

            {/* 2. NÉZET: EMAIL BEKÉRŐ (FORGOT) */}
            {mode === "forgot" && (
              <View style={styles.form}>
                <T variant="label" color={theme.textSecondary} style={styles.lbl}>Email címed</T>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@name.hu"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }}>{error}</T> : null}

                <TouchableOpacity style={styles.primaryBtn} onPress={handleForgotPassword} disabled={busy}>
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Biztonsági kód kérése</T>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode("login")} style={{ alignSelf: "center", marginTop: 20 }}>
                  <T variant="small" color={theme.accent}>Vissza a bejelentkezéshez</T>
                </TouchableOpacity>
              </View>
            )}

            {/* 3. NÉZET: KÓD ÉS ÚJ JELSZÓ BEKÉRŐ (RESET) */}
            {mode === "reset" && (
              <View style={styles.form}>
                <T variant="label" color={theme.textSecondary} style={styles.lbl}>6 jegyű biztonsági kód</T>
                <TextInput
                  style={[styles.input, { letterSpacing: 4, textAlign: "center", fontSize: 20, fontWeight: "bold" }]}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="123456"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <T variant="label" color={theme.textSecondary} style={styles.lbl}>Új jelszó (min. 8 karakter)</T>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Új jelszó"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />

                <T variant="label" color={theme.textSecondary} style={styles.lbl}>Új jelszó megerősítése</T>
                <TextInput
                  style={styles.input}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="Megerősítés"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />

                {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }}>{error}</T> : null}

                <TouchableOpacity style={styles.primaryBtn} onPress={handleResetSubmit} disabled={busy}>
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Jelszó mentése</T>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode("login")} style={{ alignSelf: "center", marginTop: 20 }}>
                  <T variant="small" color={theme.accent}>Mégis inkább bejelentkeznék</T>
                </TouchableOpacity>
              </View>
            )}

            {/* Support blokk (Közös) */}
            <View style={styles.supportContainer}>
              <T variant="small" color={theme.textSecondary} style={styles.supportLabel}>
                Technikai segítség vagy kérdés esetén:
              </T>
              <T variant="small" color={theme.primary} style={styles.supportEmail}>
                myra-project@research.hu
              </T>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  bg: { flex: 1 },
  bgImg: { opacity: 0.18 },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 40 },
  heroBlock: { alignItems: "flex-start", marginBottom: 28 },
  markRing: {
    width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: theme.borderSoft,
    overflow: "hidden", marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
  },
  mark: { width: 116, height: 116 },
  form: { gap: 4 },
  lbl: { marginTop: 16, letterSpacing: 1.8, fontSize: 10, textTransform: "uppercase", color: theme.textSecondary },
  input: {
    backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: theme.border, fontSize: 16, color: theme.textPrimary,
    marginTop: 6,
  },
  forgotBtn: { alignSelf: "flex-end", paddingVertical: 6, marginTop: 6 },
  forgotText: { textDecorationLine: "underline", fontSize: 13 },
  primaryBtn: {
    backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 999,
    alignItems: "center", justifyContent: "center", marginTop: 24,
    shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  foot: { flexDirection: "row", justifyContent: "center", marginTop: 20, alignItems: "center" },
  supportContainer: {
    marginTop: 40, alignItems: "center", justifyContent: "center", gap: 2,
    borderTopWidth: 1, borderTopColor: theme.borderSoft, paddingTop: 24,
  },
  supportLabel: { fontSize: 12 },
  supportEmail: { fontSize: 13, letterSpacing: 0.5 },
});
