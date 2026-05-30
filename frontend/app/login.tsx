import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { apiUrl, useAuth } from "@/src/auth/AuthContext";
import { shadow, theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import PasswordInput from "@/src/components/PasswordInput";
import ContentBackground from "@/src/components/ContentBackground";

const MYRA_MARK = require("@/assets/images/uj_logo1_kor.png");

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

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
      setError("Add meg az email címedet és a jelszavad.");
      return;
    }
    setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error || "Nem sikerült bejelentkezni.");
    else router.replace("/");
  };

  const handleForgotPassword = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("A biztonsági kód kéréséhez add meg az email címedet.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      if (r.ok) {
        Alert.alert("Kód elküldve", "Ha az email cím létezik a rendszerben, elküldtük rá a 6 jegyű biztonsági kódot.");
        setMode("reset");
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d?.detail || "Nem sikerült elindítani a visszaállítási folyamatot.");
      }
    } catch {
      setError("Hálózati hiba történt a kérés feldolgozása közben.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetSubmit = async () => {
    setError(null);
    if (!resetCode.trim() || !newPassword || !passwordConfirm) {
      setError("Kérlek, töltsd ki az összes mezőt.");
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
      const response = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetCode.trim(), new_password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        Alert.alert("Jelszó módosítva", "Az új jelszavad érvénybe lépett.");
        setMode("login");
        setPassword("");
        setResetCode("");
        setNewPassword("");
        setPasswordConfirm("");
      } else {
        setError(data.detail || "Hibás kód vagy lejárt visszaállítási folyamat.");
      }
    } catch {
      setError("Nem sikerült elérni a szervert.");
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === "login"
      ? "Mérés- és interakcióalapú mentálhigiénés alkalmazás."
      : mode === "forgot"
        ? "Biztonsági kódot küldünk a jelszó visszaállításához."
        : "Írd be az emailben kapott kódot és az új jelszavad.";

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ContentBackground>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.shell}>
              <View style={styles.hero}>
                <View style={[styles.logoRing, shadow.glow]}>
                  <Image source={MYRA_MARK} style={styles.logo} resizeMode="contain" />
                </View>
                <T variant="caption" color={theme.accentSoft} style={styles.heroCaption}>ESV-MODELL</T>
                <T variant="display" color={theme.textOnDark} style={styles.heroTitle}>Myra Project</T>
                <T variant="body" color="rgba(245,249,255,0.74)" align="center" style={styles.heroSubtitle}>
                  {subtitle}
                </T>
              </View>

              <View style={styles.formSheet}>
              <View style={[styles.formCard, shadow.card]}>
                {mode === "login" ? (
                  <>
                    <FieldLabel text="Email" />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@example.com"
                      placeholderTextColor={styles.placeholderColor.color}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      testID="login-email"
                    />
                    <FieldLabel text="Jelszó" />
                    <PasswordInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Jelszó"
                      placeholderTextColor={styles.placeholderColor.color}
                      containerStyle={styles.passwordBox}
                      style={styles.passwordInput}
                      testID="login-password"
                    />
                    <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotBtn}>
                      <T variant="small" color={theme.accentDeep}>Elfelejtetted a jelszavad?</T>
                    </TouchableOpacity>
                    {error ? <T variant="small" color={theme.danger} style={styles.error} testID="login-error">{error}</T> : null}
                    <PrimaryButton busy={busy} label="Bejelentkezés" onPress={submit} testID="login-submit" />
                    <View style={styles.foot}>
                      <T variant="small" color="rgba(247,251,255,0.70)">Még nincs fiókod? </T>
                      <Link href="/register" asChild>
                        <Pressable testID="link-register">
                          <T variant="small" color={theme.accentDeep} style={styles.link}>Regisztrálj</T>
                        </Pressable>
                      </Link>
                    </View>
                  </>
                ) : null}

                {mode === "forgot" ? (
                  <>
                    <FieldLabel text="Email címed" />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@example.com"
                      placeholderTextColor={styles.placeholderColor.color}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {error ? <T variant="small" color={theme.danger} style={styles.error}>{error}</T> : null}
                    <PrimaryButton busy={busy} label="Biztonsági kód kérése" onPress={handleForgotPassword} />
                    <TextButton label="Vissza a bejelentkezéshez" onPress={() => setMode("login")} />
                  </>
                ) : null}

                {mode === "reset" ? (
                  <>
                    <FieldLabel text="6 jegyű biztonsági kód" />
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={resetCode}
                      onChangeText={setResetCode}
                      placeholder="000000"
                      placeholderTextColor={styles.placeholderColor.color}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <FieldLabel text="Új jelszó" />
                    <PasswordInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Legalább 8 karakter"
                      placeholderTextColor={styles.placeholderColor.color}
                      containerStyle={styles.passwordBox}
                      style={styles.passwordInput}
                    />
                    <FieldLabel text="Megerősítés" />
                    <PasswordInput
                      value={passwordConfirm}
                      onChangeText={setPasswordConfirm}
                      placeholder="Új jelszó még egyszer"
                      placeholderTextColor={styles.placeholderColor.color}
                      containerStyle={styles.passwordBox}
                      style={styles.passwordInput}
                    />
                    {error ? <T variant="small" color={theme.danger} style={styles.error}>{error}</T> : null}
                    <PrimaryButton busy={busy} label="Jelszó mentése" onPress={handleResetSubmit} />
                    <TextButton label="Mégis inkább bejelentkezem" onPress={() => setMode("login")} />
                  </>
                ) : null}

                <View style={styles.supportRow}>
                  <Ionicons name="mail-outline" size={15} color="rgba(247,251,255,0.58)" />
                  <T variant="small" color="rgba(247,251,255,0.62)">myra-project@research.hu</T>
                </View>
              </View>
              </View>
            </View>
          </ScrollView>
        </ContentBackground>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <T variant="caption" color={theme.accentSoft} style={styles.lbl}>{text}</T>;
}

function PrimaryButton({ busy, label, onPress, testID }: { busy: boolean; label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress} disabled={busy} testID={testID} activeOpacity={0.88}>
      <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
        {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>{label}</T>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.textButton}>
      <T variant="small" color={theme.accentDeep}>{label}</T>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { flexGrow: 1 },
  shell: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 30,
    paddingHorizontal: 28,
  },
  logoRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 86, height: 86, borderRadius: 43 },
  heroCaption: { fontSize: 10, letterSpacing: 1.4 },
  heroTitle: { fontSize: 40, lineHeight: 46, textAlign: "center", marginTop: 14 },
  heroSubtitle: { maxWidth: 310, marginTop: 10 },
  formSheet: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 38,
  },
  formCard: {
    backgroundColor: "rgba(6,19,32,0.58)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 20,
    backdropFilter: "blur(18px)",
  },
  lbl: { marginTop: 12, marginBottom: 7, letterSpacing: 1.1, fontSize: 10 },
  input: {
    backgroundColor: "rgba(247,251,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(247,251,255,0.24)",
    fontSize: 16,
    color: theme.textOnDark,
    fontFamily: "Manrope_400Regular",
  },
  placeholderColor: { color: "rgba(247,251,255,0.56)" },
  passwordBox: {
    backgroundColor: "rgba(247,251,255,0.12)",
    borderColor: "rgba(247,251,255,0.24)",
    borderRadius: 10,
  },
  passwordInput: {
    color: theme.textOnDark,
  },
  codeInput: { letterSpacing: 6, textAlign: "center", fontSize: 22 },
  forgotBtn: { alignSelf: "flex-end", paddingVertical: 10 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    overflow: "hidden",
  },
  primaryGradient: { minHeight: 52, alignItems: "center", justifyContent: "center", width: "100%" },
  textButton: { alignSelf: "center", paddingVertical: 18 },
  error: { marginTop: 10 },
  foot: { flexDirection: "row", justifyContent: "center", marginTop: 20, alignItems: "center" },
  link: { fontFamily: "Manrope_700Bold" },
  supportRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
});
