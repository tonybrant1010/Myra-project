import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import PasswordInput from "@/src/components/PasswordInput";
import ContentBackground from "@/src/components/ContentBackground";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>(); // Kinyeri a ?token=... részt az URL-ből
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError(null);
    if (!password || !passwordConfirm) {
      setError("Kérlek töltsd ki mindkét mezőt.");
      return;
    }
    if (password.length < 8) {
      setError("A jelszónak legalább 8 karakterből kell állnia.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("A két jelszó nem egyezik meg.");
      return;
    }
    if (!token) {
      setError("Hiányzik a biztonsági token. Kérj egy új linket.");
      return;
    }

    setBusy(true);
    try {
      // Hívás a te Rackhost backended felé
      const response = await fetch("https://myra-project.cfd/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await response.json();
      setBusy(false);

      if (response.ok && data.ok) {
        setSuccess(true);
      } else {
        setError(data.detail || "Hiba történt a jelszó visszaállítása során.");
      }
    } catch (e) {
      setBusy(false);
      setError("Nem sikerült elérni a szervert.");
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentBackground style={styles.bg}>
          <View style={styles.container}>
            <T variant="display" style={{ textAlign: "center" }}>Sikeres jelszócsere!</T>
            <T variant="body" color={theme.textSecondary} style={{ marginTop: 12, textAlign: "center", marginBottom: 24 }}>
              Az új jelszavad érvénybe lépett. Most már bejelentkezhetsz az alkalmazásba.
            </T>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/login")}>
              <T variant="title" color={theme.white}>Tovább a bejelentkezéshez</T>
            </TouchableOpacity>
          </View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ContentBackground style={styles.bg}>
        <View style={styles.container}>
          <T variant="caption" color={theme.accent}>BIZTONSÁG</T>
          <T variant="display" style={{ marginTop: 6 }}>Új jelszó megadása</T>
          <T variant="body" color={theme.textSecondary} style={{ marginTop: 8, marginBottom: 16 }}>
            Kérjük, adj meg egy új, biztonságos jelszót a fiókodhoz.
          </T>

          <View style={styles.form}>
            <T variant="label" color={theme.textSecondary} style={styles.lbl}>Új jelszó (min. 8 karakter)</T>
            <PasswordInput value={password} onChangeText={setPassword} placeholder="Új jelszó" />

            <T variant="label" color={theme.textSecondary} style={styles.lbl}>Új jelszó megerősítése</T>
            <PasswordInput value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="Megerősítés" />

            {error ? <T variant="small" color={theme.danger} style={{ marginTop: 12 }}>{error}</T> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Jelszó mentése</T>}
            </TouchableOpacity>
          </View>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  bg: { flex: 1, justifyContent: "center", padding: 24 },
  container: { maxWidth: 400, width: "100%", alignSelf: "center" },
  form: { gap: 4 },
  lbl: { marginTop: 14, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase" },
  input: {
    backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.border, fontSize: 16, color: theme.textPrimary,
  },
  primaryBtn: {
    backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 999,
    alignItems: "center", justifyContent: "center", marginTop: 24,
  },
});
