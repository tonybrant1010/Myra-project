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
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiUrl, useAuth } from "@/src/auth/AuthContext";
import ContentBackground from "@/src/components/ContentBackground";
import PasswordInput from "@/src/components/PasswordInput";
import { T } from "@/src/components/Typography";
import { shadow, theme } from "@/src/theme";

const MYRA_MARK = require("@/assets/images/uj_logo1_kor.png");
const PASSWORD_MAX_CHARS = 128;

type Mode = "login" | "mfa" | "forgot" | "reset";

export default function LoginScreen() {
  const router = useRouter();
  const { login, verifyMfa } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [mfaIsAdmin, setMfaIsAdmin] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [mfaCodeFocused, setMfaCodeFocused] = useState(false);
  const [resetCodeFocused, setResetCodeFocused] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Add meg az email címedet és a jelszavad.");
      return;
    }
    setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (r.mfaRequired && r.challengeId) {
      setMfaChallengeId(r.challengeId);
      setMfaIsAdmin(!!r.isAdmin);
      setRememberDevice(!r.isAdmin);
      setMfaCode("");
      setMode("mfa");
      return;
    }
    if (!r.ok) setError(r.error || "Nem sikerült bejelentkezni.");
    else router.replace("/");
  };

  const submitMfa = async () => {
    setError(null);
    if (!mfaChallengeId || !mfaCode.trim()) {
      setError("Add meg az emailben kapott biztonsági kódot.");
      return;
    }
    setBusy(true);
    const r = await verifyMfa(mfaChallengeId, mfaCode.trim(), mfaIsAdmin ? false : rememberDevice);
    setBusy(false);
    if (!r.ok) setError(r.error || "Nem sikerült ellenőrizni a biztonsági kódot.");
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
        cache: "no-store",
        credentials: "omit",
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
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Add meg az email címedet is.");
      return;
    }
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
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, token: resetCode.trim(), new_password: newPassword }),
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
      : mode === "mfa"
        ? "Add meg az emailben kapott biztonsági kódot."
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
                        style={[styles.input, emailFocused && styles.inputFocused]}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@example.com"
                        placeholderTextColor={styles.placeholderColor.color}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
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
                        maxLength={PASSWORD_MAX_CHARS}
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

                  {mode === "mfa" ? (
                    <>
                      <View style={styles.securityBanner}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={theme.accentSoft} />
                        <T variant="small" color="rgba(247,251,255,0.72)" style={{ flex: 1 }}>
                          {mfaIsAdmin
                            ? "Admin belépéshez mindig szükséges a külön biztonsági kód."
                            : "Ehhez a fiókhoz kétlépcsős azonosítás van bekapcsolva."}
                        </T>
                      </View>
                      <FieldLabel text="6 jegyű biztonsági kód" />
                      <TextInput
                        style={[styles.input, styles.codeInput, mfaCodeFocused && styles.inputFocused]}
                        value={mfaCode}
                        onChangeText={setMfaCode}
                        placeholder="000000"
                        placeholderTextColor={styles.placeholderColor.color}
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={() => setMfaCodeFocused(true)}
                        onBlur={() => setMfaCodeFocused(false)}
                        testID="mfa-code"
                      />
                      {!mfaIsAdmin ? (
                        <TouchableOpacity style={styles.checkRow} onPress={() => setRememberDevice((v) => !v)} activeOpacity={0.8}>
                          <View style={[styles.checkbox, rememberDevice && styles.checkboxOn]}>
                            {rememberDevice ? <Ionicons name="checkmark" size={15} color={theme.white} /> : null}
                          </View>
                          <T variant="small" color="rgba(247,251,255,0.72)" style={{ flex: 1 }}>
                            Megbízható eszközként megjegyzem ezt a böngészőt
                          </T>
                        </TouchableOpacity>
                      ) : null}
                      {error ? <T variant="small" color={theme.danger} style={styles.error}>{error}</T> : null}
                      <PrimaryButton busy={busy} label="Kód ellenőrzése" onPress={submitMfa} />
                      <TextButton label="Vissza a bejelentkezéshez" onPress={() => setMode("login")} />
                    </>
                  ) : null}

                  {mode === "forgot" ? (
                    <>
                      <FieldLabel text="Email címed" />
                      <TextInput
                        style={[styles.input, emailFocused && styles.inputFocused]}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@example.com"
                        placeholderTextColor={styles.placeholderColor.color}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
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
                        style={[styles.input, styles.codeInput, resetCodeFocused && styles.inputFocused]}
                        value={resetCode}
                        onChangeText={setResetCode}
                        placeholder="000000"
                        placeholderTextColor={styles.placeholderColor.color}
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={() => setResetCodeFocused(true)}
                        onBlur={() => setResetCodeFocused(false)}
                      />
                      <FieldLabel text="Új jelszó" />
                      <PasswordInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Legalább 8 karakter"
                        placeholderTextColor={styles.placeholderColor.color}
                        containerStyle={styles.passwordBox}
                        style={styles.passwordInput}
                        maxLength={PASSWORD_MAX_CHARS}
                      />
                      <FieldLabel text="Megerősítés" />
                      <PasswordInput
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        placeholder="Új jelszó még egyszer"
                        placeholderTextColor={styles.placeholderColor.color}
                        containerStyle={styles.passwordBox}
                        style={styles.passwordInput}
                        maxLength={PASSWORD_MAX_CHARS}
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
      <T variant="label" color={theme.accentDeep}>{label}</T>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 26 },
  shell: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 24 },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,209,197,0.14)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    marginBottom: 16,
  },
  logo: { width: 82, height: 82, borderRadius: 41 },
  heroCaption: { marginBottom: 7 },
  heroTitle: { textAlign: "center" },
  heroSubtitle: { marginTop: 10, maxWidth: 400, lineHeight: 22 },
  formSheet: { width: "100%" },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    backgroundColor: "rgba(7,27,48,0.48)",
    padding: 20,
    backdropFilter: "blur(20px)",
  } as any,
  lbl: { marginTop: 12, marginBottom: 6 },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: theme.textOnDark,
    paddingHorizontal: 14,
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
  },
  inputFocused: {
    borderColor: theme.accent,
    backgroundColor: "rgba(255,255,255,0.08)",
    ...Platform.select({
      web: {
        boxShadow: "0 0 12px rgba(79, 209, 197, 0.4)",
        outlineWidth: 0,
      },
      ios: {
        shadowColor: theme.accent,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 3,
      }
    })
  } as any,
  codeInput: {
    textAlign: "center",
    letterSpacing: 6,
    fontSize: 22,
  },
  placeholderColor: { color: "rgba(247,251,255,0.45)" },
  passwordBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(79,209,197,0.18)",
    borderRadius: 12,
  },
  passwordInput: { color: theme.textOnDark },
  forgotBtn: { alignSelf: "flex-end", marginTop: 10, marginBottom: 4 },
  error: { marginTop: 12 },
  primaryBtn: { marginTop: 18, borderRadius: 12, overflow: "hidden" },
  primaryGradient: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  textButton: { alignItems: "center", paddingVertical: 14 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 18, flexWrap: "wrap" },
  link: { fontFamily: "Manrope_700Bold" },
  supportRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18 },
  securityBanner: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    backgroundColor: "rgba(79,209,197,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  checkboxOn: {
    backgroundColor: theme.accentDeep,
    borderColor: theme.accentDeep,
  },
});
