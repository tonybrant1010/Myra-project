import React, { useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

import { gdprText } from "@/src/constants/docs/gdpr";
import { termsText } from "@/src/constants/docs/terms";
import { kisokosText } from "@/src/constants/docs/kisokos";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docModal, setDocModal] = useState<{ title: string; text: string } | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !name.trim() || !password) {
      setError("Kérlek tölts ki minden mezőt."); return;
    }
    if (password.length < 8) {
      setError("A jelszó legalább 8 karakter legyen."); return;
    }
    if (!acceptedTerms) {
      setError("A regisztrációhoz el kell fogadnod a felhasználási feltételeket és a GDPR nyilatkozatot.");
      return;
    }
    setBusy(true);
    try {
      const r = await register(email.trim(), name.trim(), password);
      if (!r.ok) setError(r.error || "Regisztrációs hiba");
      else router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Regisztrációs hiba");
    } finally {
      setBusy(false);
    }
  };

  const openDocModal = (title: string, text: string) => {
    setDocModal({ title, text });
  };

  return (
    <SafeAreaView style={styles.safe} testID="register-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Dark hero */}
          <View style={styles.hero}>
            <T variant="caption" color={theme.accentSoft} style={styles.heroCaption}>ESV-MODELL</T>
            <T variant="display" color={theme.textOnDark} style={styles.heroTitle}>Fiók létrehozása</T>
            <View style={styles.heroRule} />
            <T variant="body" color="rgba(240,237,229,0.6)" align="center" style={{ maxWidth: 280 }}>
              Pár adat megadásával máris elindulhat a folyamat.
            </T>
          </View>

          {/* Light form sheet */}
          <View style={styles.formSheet}>
            <View style={styles.fieldGroup}>
              <T variant="caption" color={theme.accent} style={styles.lbl}>Név</T>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Teljes név"
                placeholderTextColor={theme.textSecondary}
                testID="reg-name"
              />
            </View>

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
                testID="reg-email"
              />
            </View>

            <View style={styles.fieldGroup}>
              <T variant="caption" color={theme.accent} style={styles.lbl}>Jelszó (min. 8 karakter)</T>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder=" "
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                testID="reg-password"
              />
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.8}
              >
                {acceptedTerms && <View style={styles.checkboxInner} />}
              </TouchableOpacity>
              <View style={styles.checkboxTextContainer}>
                <T variant="small" color={theme.textSecondary}>
                  Elfogadom a{" "}
                  <T color={theme.accent} style={styles.linkText} onPress={() => openDocModal("Felhasználási feltételek", termsText)}>Felhasználási feltételeket</T>
                  , a{" "}
                  <T color={theme.accent} style={styles.linkText} onPress={() => openDocModal("GDPR Adatkezelés", gdprText)}>GDPR nyilatkozatot</T>
                  , és elolvastam a{" "}
                  <T color={theme.accent} style={styles.linkText} onPress={() => openDocModal("Myra Kisokos", kisokosText)}>Myra Kisokost</T>
                  .
                </T>
              </View>
            </View>

            {error ? <T variant="small" color={theme.danger} style={{ marginTop: 8 }} testID="reg-error">{error}</T> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy} testID="reg-submit">
              {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Regisztráció</T>}
            </TouchableOpacity>

            <View style={styles.foot}>
              <T variant="small" color={theme.textSecondary}>Már van fiókod? </T>
              <Link href="/login" asChild>
                <Pressable testID="link-login">
                  <T variant="small" color={theme.accent} style={{ fontWeight: "bold" }}>Jelentkezz be</T>
                </Pressable>
              </Link>
            </View>

            <View style={styles.supportRow}>
              <T variant="small" color={theme.textSecondary}>Segítség: </T>
              <T variant="small" color={theme.accent}>myra-project@research.hu</T>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!docModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDocModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <T variant="h2">{docModal?.title}</T>
              <TouchableOpacity onPress={() => setDocModal(null)}>
                <T variant="label" color={theme.primary}>Bezár</T>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1 }}>
              <T variant="small" color={theme.textSecondary} style={{ lineHeight: 20 }}>
                {docModal?.text}
              </T>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  heroCaption: { letterSpacing: 2.4, fontSize: 10, marginBottom: 8 },
  heroTitle: {
    fontSize: 34,
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

  checkboxContainer: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 4,
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { borderColor: theme.accent },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.accent,
  },
  checkboxTextContainer: { flex: 1 },
  linkText: { fontWeight: "bold", textDecorationLine: "underline" },

  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,28,24,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSoft,
  },
});
