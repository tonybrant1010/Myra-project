import React, { useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, TextInput,
  ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

// A pontos útvonalról importált jogi és ismertető szövegek
import { gdprText } from "@/src/constants/docs/gdpr";
import { termsText } from "@/src/constants/docs/terms";
import { kisokosText } from "@/src/constants/docs/kisokos";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/0ff43180-0fdd-4eb7-a3a2-f49a414159e8/images/8177347f2d5512a27dc0af04ed126ce500bb6cdacb283eeee78621e67e0b7dd8.png";

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
      <ImageBackground source={{ uri: HERO_BG }} style={styles.bg} imageStyle={styles.bgImg}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <T variant="caption" color={theme.accent} style={{ marginTop: 20 }}>ESV-MODELL</T>
            <T variant="display" style={{ marginTop: 6 }}>Hozz létre fiókot</T>
            <T variant="body" color={theme.textSecondary} style={{ marginTop: 8, maxWidth: 360 }}>
              A neved, email címed és jelszavad megadásával létrehozhatsz egy fiókot.
            </T>

            <View style={styles.form}>
              <T variant="label" color={theme.textSecondary} style={styles.lbl}>Név</T>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Teljes név" placeholderTextColor={theme.textSecondary} testID="reg-name" />

              <T variant="label" color={theme.textSecondary} style={styles.lbl}>Email</T>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="name@name.hu" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} testID="reg-email" />

              <T variant="label" color={theme.textSecondary} style={styles.lbl}>Jelszó (min. 8 karakter)</T>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder=" " placeholderTextColor={theme.textSecondary} secureTextEntry testID="reg-password" />

              {/* Kötelezően bepipálandó feltételek és linkek */}
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
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
  safe: { flex: 1, backgroundColor: theme.bg },
  bg: { flex: 1 },
  bgImg: { opacity: 0.18 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 24 },
  backTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  form: { gap: 4, marginTop: 18 },
  lbl: { marginTop: 14, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase" },
  input: {
    backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.border, fontSize: 16, color: theme.textPrimary,
  },
  checkboxContainer: {
    flexDirection: "row",
    marginTop: 20,
    alignItems: "flex-start",
    gap: 12,
    paddingRight: 16,
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
  checkboxChecked: {
    borderColor: theme.accent,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.accent,
  },
  checkboxTextContainer: {
    flex: 1,
  },
  linkText: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  primaryBtn: {
    backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 999,
    alignItems: "center", justifyContent: "center", marginTop: 22,
  },
  foot: { flexDirection: "row", justifyContent: "center", marginTop: 18, alignItems: "center" },
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
