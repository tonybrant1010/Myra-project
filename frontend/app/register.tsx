import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useAuth } from "@/src/auth/AuthContext";
import { shadow, theme } from "@/src/theme";
import { T } from "@/src/components/Typography";
import PasswordInput from "@/src/components/PasswordInput";
import ContentBackground from "@/src/components/ContentBackground";

import { gdprText } from "@/src/constants/docs/gdpr";
import { termsText } from "@/src/constants/docs/terms";
import { kisokosText } from "@/src/constants/docs/kisokos";

const MYRA_MARK = require("@/assets/images/uj_logo1_kor.png");

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
      setError("Kérlek, tölts ki minden mezőt.");
      return;
    }
    if (password.length < 8) {
      setError("A jelszó legalább 8 karakter legyen.");
      return;
    }
    if (!acceptedTerms) {
      setError("A regisztrációhoz el kell fogadnod a feltételeket, és kifejezetten hozzá kell járulnod az adatkezeléshez.");
      return;
    }
    setBusy(true);
    try {
      const r = await register(email.trim(), name.trim(), password);
      if (!r.ok) setError(r.error || "Nem sikerült regisztrálni.");
      else router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Nem sikerült regisztrálni.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="register-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ContentBackground>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={[styles.logoRing, shadow.glow]}>
                <Image source={MYRA_MARK} style={styles.logo} resizeMode="contain" />
              </View>
              <T variant="caption" color={theme.accentSoft} style={styles.heroCaption}>ESV-MODELL</T>
              <T variant="display" color={theme.textOnDark} style={styles.heroTitle}>Fiók létrehozása</T>
              <T variant="body" color="rgba(245,249,255,0.72)" align="center" style={styles.heroSubtitle}>
                Pár adat után elindíthatod az első önismereti mérést.
              </T>
            </View>

            <View style={styles.formSheet}>
            <View style={[styles.formCard, shadow.card]}>
              <FieldLabel text="Név" />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Teljes név"
                placeholderTextColor={styles.placeholderColor.color}
                testID="reg-name"
              />

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
                testID="reg-email"
              />

              <FieldLabel text="Jelszó" />
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="Legalább 8 karakter"
                placeholderTextColor={styles.placeholderColor.color}
                containerStyle={styles.passwordBox}
                style={styles.passwordInput}
                testID="reg-password"
              />

              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAcceptedTerms(!acceptedTerms)} activeOpacity={0.85}>
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms ? <Ionicons name="checkmark" size={15} color={theme.white} /> : null}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <T variant="small" color="rgba(247,251,255,0.70)">
                    Elfogadom a{" "}
                    <T color={theme.accentDeep} style={styles.linkText} onPress={() => setDocModal({ title: "Felhasználási feltételek", text: termsText })}>Felhasználási feltételeket</T>
                    , az{" "}
                    <T color={theme.accentDeep} style={styles.linkText} onPress={() => setDocModal({ title: "Adatkezelési tájékoztató", text: gdprText })}>Adatkezelési tájékoztatót</T>
                    , és elolvastam a{" "}
                    <T color={theme.accentDeep} style={styles.linkText} onPress={() => setDocModal({ title: "Myra Kisokos", text: kisokosText })}>Myra Kisokost</T>
                    . Kifejezetten hozzájárulok a mentálhigiénés jellegű adataim kezeléséhez az alkalmazás működéséhez szükséges mértékben.
                  </T>
                </View>
              </TouchableOpacity>

              {error ? <T variant="small" color={theme.danger} style={styles.error} testID="reg-error">{error}</T> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy} testID="reg-submit" activeOpacity={0.88}>
                <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
                  {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Regisztráció</T>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.foot}>
                <T variant="small" color="rgba(247,251,255,0.70)">Már van fiókod? </T>
                <Link href="/login" asChild>
                  <Pressable testID="link-login">
                    <T variant="small" color={theme.accentDeep} style={styles.link}>Jelentkezz be</T>
                  </Pressable>
                </Link>
              </View>
            </View>
            </View>
          </ScrollView>
        </ContentBackground>
      </KeyboardAvoidingView>

      <Modal visible={!!docModal} transparent animationType="slide" onRequestClose={() => setDocModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <T variant="h2">{docModal?.title}</T>
              <TouchableOpacity onPress={() => setDocModal(null)} style={styles.closeBtn}>
                <T variant="label" color={theme.primary}>Bezár</T>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={{ flex: 1 }}>
              <T variant="small" color={theme.textSecondary} style={{ lineHeight: 20 }}>{docModal?.text}</T>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <T variant="caption" color={theme.accentSoft} style={styles.lbl}>{text}</T>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 28,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    marginBottom: 16,
  },
  logo: { width: 82, height: 82, borderRadius: 41 },
  heroCaption: { fontSize: 10, letterSpacing: 1.4 },
  heroTitle: { fontSize: 38, lineHeight: 44, textAlign: "center", marginTop: 16 },
  heroSubtitle: { maxWidth: 300, marginTop: 10 },
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    fontSize: 16,
    color: theme.textOnDark,
    fontFamily: "Manrope_400Regular",
  },
  placeholderColor: { color: "rgba(247,251,255,0.48)" },
  passwordBox: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.22)",
  },
  passwordInput: {
    color: theme.textOnDark,
  },
  checkboxContainer: { flexDirection: "row", marginTop: 20, alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { borderColor: theme.accentDeep, backgroundColor: theme.accentDeep },
  checkboxTextContainer: { flex: 1 },
  linkText: { fontFamily: "Manrope_700Bold", textDecorationLine: "underline" },
  primaryBtn: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 18, overflow: "hidden" },
  primaryGradient: { width: "100%", minHeight: 52, alignItems: "center", justifyContent: "center" },
  error: { marginTop: 12 },
  foot: { flexDirection: "row", justifyContent: "center", marginTop: 20, alignItems: "center" },
  link: { fontFamily: "Manrope_700Bold" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(3,12,22,0.64)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.surfaceStrong,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 24,
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSoft,
  },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
});
