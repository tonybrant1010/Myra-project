import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import ContentBackground from "@/src/components/ContentBackground";
import PasswordInput from "@/src/components/PasswordInput";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { gdprText } from "@/src/constants/docs/gdpr";
import { kisokosText } from "@/src/constants/docs/kisokos";
import { termsText } from "@/src/constants/docs/terms";
import { shadow, theme } from "@/src/theme";

type DocModal = { title: string; text: string } | null;
const PASSWORD_MAX_CHARS = 128;

type TrustedDevice = {
  id: number;
  label: string;
  created_at?: string | null;
  last_used_at?: string | null;
  expires_at?: string | null;
};

export default function SettingsScreen() {
  useAuthGuard();
  const router = useRouter();
  const { user, token, logout, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminChallengeId, setAdminChallengeId] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaForced, setMfaForced] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [adminCodeFocused, setAdminCodeFocused] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [docModal, setDocModal] = useState<DocModal>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSecurity = async () => {
    try {
      const r = await authedFetch(token, "/api/auth/security");
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMfaEnabled(!!d.mfa_enabled);
        setMfaForced(!!d.mfa_forced);
        setTrustedDevices(Array.isArray(d.trusted_devices) ? d.trusted_devices : []);
      }
    } catch {}
  };

  useEffect(() => {
    if (token) loadSecurity();
  }, [token]);

  const requestAdminCode = async () => {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const r = await authedFetch(token, "/api/auth/admin/action-code", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setAdminChallengeId(d.challenge_id || "");
        setMessage("Admin biztonsági kód elküldve emailben.");
      } else {
        setError(d?.detail || "Nem sikerült admin biztonsági kódot kérni.");
      }
    } catch (e: any) {
      setError(e?.message || "Hálózati hiba történt.");
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Kérlek, töltsd ki mindhárom jelszómezőt.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Az új jelszónak legalább 8 karakterből kell állnia.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A két új jelszó nem egyezik meg.");
      return;
    }
    if (user?.is_admin && (!adminChallengeId || !adminCode.trim())) {
      setError("Admin jelszóváltáshoz kérj és adj meg külön biztonsági kódot.");
      return;
    }

    setBusy(true);
    try {
      const r = await authedFetch(token, "/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          admin_security_challenge_id: adminChallengeId || undefined,
          admin_security_code: adminCode.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        Alert.alert("Jelszó módosítva", "Biztonsági okból újra be kell jelentkezned.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setAdminCode("");
        setAdminChallengeId("");
        await logout();
        router.replace("/login");
      } else {
        setError(d?.detail || "Nem sikerült módosítani a jelszót.");
      }
    } catch (e: any) {
      setError(e?.message || "Hálózati hiba történt a jelszó módosítása közben.");
    } finally {
      setBusy(false);
    }
  };

  const saveMfa = async (nextEnabled: boolean) => {
    setMessage(null);
    setError(null);
    if (!securityPassword) {
      setError("A biztonsági beállítás módosításához add meg a jelenlegi jelszavad.");
      return;
    }
    setSecurityBusy(true);
    try {
      const r = await authedFetch(token, "/api/auth/security/mfa", {
        method: "PUT",
        body: JSON.stringify({ enabled: nextEnabled, current_password: securityPassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSecurityPassword("");
        setMfaEnabled(!!d.mfa_enabled);
        setMessage(nextEnabled ? "Kétlépcsős azonosítás bekapcsolva." : "Kétlépcsős azonosítás kikapcsolva.");
        await refreshUser();
        await logout();
        router.replace("/login");
      } else {
        setError(d?.detail || "Nem sikerült módosítani a biztonsági beállítást.");
      }
    } catch (e: any) {
      setError(e?.message || "Hálózati hiba történt.");
    } finally {
      setSecurityBusy(false);
    }
  };

  const revokeDevice = async (id: number) => {
    setSecurityBusy(true);
    try {
      await authedFetch(token, `/api/auth/security/trusted-devices/${id}`, { method: "DELETE" });
      await loadSecurity();
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert("Jelszo szukseges", "A fiok torlesehez add meg a jelenlegi jelszavadat.");
      return;
    }
    setDeleteBusy(true);
    try {
      const r = await authedFetch(token, "/api/auth/delete-account", {
        method: "DELETE",
        body: JSON.stringify({ current_password: deletePassword }),
      });
      if (r.ok) {
        setConfirmDeleteAccount(false);
        setDeletePassword("");
        await logout();
        router.replace("/login");
      } else {
        const d = await r.json().catch(() => ({}));
        Alert.alert("Torles sikertelen", typeof d?.detail === "string" ? d.detail : "Nem sikerult torolni a fiokot.");
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="settings-screen">
      <ContentBackground>
        <TopBar title="Beállítások" showBack />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.profileCard, shadow.card]}>
              <View style={styles.avatar}>
                <T variant="h2" color={theme.textOnDark}>{user?.name ? user.name.charAt(0).toUpperCase() : "?"}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="caption" color={theme.accentSoft}>FIÓKADATOK</T>
                <T variant="h2" color={theme.textOnDark} style={styles.profileName}>{user?.name || "Felhasználó"}</T>
                <T variant="small" color="rgba(247,251,255,0.68)">Az email cím biztonsági okból nem módosítható.</T>
              </View>
            </LinearGradient>

            <View style={[styles.sectionCard, shadow.card]}>
              <ReadonlyField label="Email cím" value={user?.email || ""} icon="mail-outline" />
              <ReadonlyField label="Megjelenített név" value={user?.name || ""} icon="person-outline" />
            </View>

            <View style={[styles.sectionCard, shadow.card]}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={theme.accentSoft}>KÉTLÉPCSŐS AZONOSÍTÁS</T>
                  <T variant="small" color="rgba(247,251,255,0.64)" style={{ marginTop: 2 }}>
                    {mfaForced
                      ? "Admin fióknál kötelező. Új eszközről belépéskor emailes kódot kér."
                      : "Opcionális védelem: új eszközről belépéskor emailes kódot kér."}
                  </T>
                </View>
              </View>
              <View style={styles.statusPill}>
                <Ionicons name={mfaEnabled ? "lock-closed-outline" : "lock-open-outline"} size={16} color={mfaEnabled ? theme.success : theme.warm} />
                <T variant="small" color={theme.textOnDark}>{mfaEnabled ? "Bekapcsolva" : "Kikapcsolva"}</T>
              </View>
              {!mfaForced ? (
                <>
                  <FieldLabel text="Jelenlegi jelszó a módosításhoz" />
                  <PasswordInput
                    value={securityPassword}
                    onChangeText={setSecurityPassword}
                    placeholder="Jelenlegi jelszó"
                    placeholderTextColor="rgba(247,251,255,0.48)"
                    containerStyle={styles.passwordBox}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => saveMfa(!mfaEnabled)}
                    disabled={securityBusy}
                    activeOpacity={0.86}
                  >
                    {securityBusy ? <ActivityIndicator color={theme.white} /> : (
                      <T variant="title" color={theme.white}>{mfaEnabled ? "Kétlépcsős kikapcsolása" : "Kétlépcsős bekapcsolása"}</T>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
              <View style={styles.deviceList}>
                <T variant="caption" color={theme.accentSoft} style={{ marginBottom: 6 }}>MEGBÍZHATÓ ESZKÖZÖK</T>
                {trustedDevices.length === 0 ? (
                  <T variant="small" color="rgba(247,251,255,0.62)">Nincs aktív megjegyzett eszköz.</T>
                ) : trustedDevices.map((d) => (
                  <View key={d.id} style={styles.deviceRow}>
                    <View style={{ flex: 1 }}>
                      <T variant="body" color={theme.textOnDark}>{d.label || "Megbízható eszköz"}</T>
                      <T variant="small" color="rgba(247,251,255,0.58)">Lejárat: {formatDate(d.expires_at)}</T>
                    </View>
                    <TouchableOpacity style={styles.smallDangerBtn} onPress={() => revokeDevice(d.id)} disabled={securityBusy}>
                      <T variant="label" color={theme.white}>Törlés</T>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.sectionCard, shadow.card]}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="document-text-outline" size={18} color={theme.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={theme.accentSoft}>ADATKEZELÉS ÉS JOGI ANYAGOK</T>
                  <T variant="small" color="rgba(247,251,255,0.64)" style={{ marginTop: 2 }}>
                    A regisztrációnál elfogadott dokumentumok bármikor visszanézhetők.
                  </T>
                </View>
              </View>
              <DocLink title="Adatkezelési tájékoztató" icon="shield-checkmark-outline" onPress={() => setDocModal({ title: "Adatkezelési tájékoztató", text: gdprText })} />
              <DocLink title="Felhasználási feltételek" icon="reader-outline" onPress={() => setDocModal({ title: "Felhasználási feltételek", text: termsText })} />
              <DocLink title="Myra Kisokos" icon="information-circle-outline" onPress={() => setDocModal({ title: "Myra Kisokos", text: kisokosText })} />
            </View>

            <View style={[styles.sectionCard, shadow.card]}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={theme.accentSoft}>JELSZÓCSERE</T>
                  <T variant="small" color="rgba(247,251,255,0.64)" style={{ marginTop: 2 }}>
                    Jelszóváltás után biztonsági okból újra be kell jelentkezni.
                  </T>
                </View>
              </View>

              <FieldLabel text="Jelenlegi jelszó" />
              <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Jelenlegi jelszó" placeholderTextColor="rgba(247,251,255,0.48)" containerStyle={styles.passwordBox} style={styles.passwordInput} maxLength={PASSWORD_MAX_CHARS} testID="settings-current-password" />
              <FieldLabel text="Új jelszó" />
              <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="Legalább 8 karakter" placeholderTextColor="rgba(247,251,255,0.48)" containerStyle={styles.passwordBox} style={styles.passwordInput} maxLength={PASSWORD_MAX_CHARS} testID="settings-new-password" />
              <FieldLabel text="Új jelszó megerősítése" />
              <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Új jelszó még egyszer" placeholderTextColor="rgba(247,251,255,0.48)" containerStyle={styles.passwordBox} style={styles.passwordInput} maxLength={PASSWORD_MAX_CHARS} testID="settings-confirm-password" />

              {user?.is_admin ? (
                <View style={styles.adminCodeBox}>
                  <T variant="caption" color={theme.accentSoft}>ADMIN MEGERŐSÍTÉS</T>
                  <T variant="small" color="rgba(247,251,255,0.64)" style={{ marginTop: 4 }}>
                    Admin jelszóváltáshoz külön emailes biztonsági kód szükséges.
                  </T>
                  <TouchableOpacity style={styles.outlineBtn} onPress={requestAdminCode} disabled={busy}>
                    <T variant="label" color={theme.accent}>Admin biztonsági kód kérése</T>
                  </TouchableOpacity>
                  <FieldLabel text="Admin biztonsági kód" />
                  <TextInput
                    value={adminCode}
                    onChangeText={setAdminCode}
                    style={[styles.input, styles.codeInput, adminCodeFocused && styles.inputFocused]}
                    placeholder="000000"
                    placeholderTextColor="rgba(247,251,255,0.48)"
                    keyboardType="number-pad"
                    maxLength={6}
                    onFocus={() => setAdminCodeFocused(true)}
                    onBlur={() => setAdminCodeFocused(false)}
                  />
                </View>
              ) : null}

              {error ? <T variant="small" color={theme.danger} style={styles.feedback}>{error}</T> : null}
              {message ? <T variant="small" color={theme.success} style={styles.feedback}>{message}</T> : null}

              <TouchableOpacity style={styles.saveBtn} onPress={submitPassword} disabled={busy} testID="settings-save-password" activeOpacity={0.86}>
                {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Jelszó mentése</T>}
              </TouchableOpacity>
            </View>

            <View style={[styles.dangerCard, shadow.card]}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, styles.dangerIcon]}>
                  <Ionicons name="warning-outline" size={18} color="#FFD6DC" />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="caption" color="#FFD6DC">VESZÉLYZÓNA</T>
                  <T variant="small" color="rgba(247,251,255,0.70)" style={{ marginTop: 2 }}>
                    A fiók törlése végleges, és minden chatet, mérést, valamint fiókadatot eltávolít.
                  </T>
                </View>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteAccount(true)} testID="settings-delete-account" activeOpacity={0.84}>
                <Ionicons name="person-remove-outline" size={18} color={theme.white} />
                <T variant="title" color={theme.white}>Fiók törlése</T>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ContentBackground>

      <DocumentModal doc={docModal} onClose={() => setDocModal(null)} />
      <ConfirmModal
        visible={confirmDeleteAccount}
        title="Fiók törlése"
        text="Ez a művelet véglegesen törli a fiókodat, az összes chatüzenetedet és mérési eredményedet. Ez nem visszavonható."
        confirmLabel="Törlés"
        passwordValue={deletePassword}
        onPasswordChange={setDeletePassword}
        passwordPlaceholder="Jelenlegi jelszo"
        passwordTestID="settings-delete-account-password"
        onCancel={() => {
          setConfirmDeleteAccount(false);
          setDeletePassword("");
        }}
        onConfirm={handleDeleteAccount}
        busy={deleteBusy}
      />
    </SafeAreaView>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("hu-HU");
  } catch {
    return "-";
  }
}

function ReadonlyField({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.readonlyWrap}>
      <T variant="caption" color={theme.accentSoft} style={styles.readonlyLabel}>{label}</T>
      <View style={styles.readonlyBox}>
        <Ionicons name={icon} size={18} color="rgba(247,251,255,0.58)" />
        <TextInput value={value} editable={false} style={styles.readonlyInput} placeholderTextColor="rgba(247,251,255,0.45)" />
      </View>
    </View>
  );
}

function DocLink({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.docLink} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.docIcon}>
        <Ionicons name={icon} size={18} color={theme.accentSoft} />
      </View>
      <T variant="bodyLg" color={theme.textOnDark} style={{ flex: 1 }}>{title}</T>
      <Ionicons name="chevron-forward" size={18} color="rgba(247,251,255,0.52)" />
    </TouchableOpacity>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <T variant="caption" color={theme.accentSoft} style={styles.label}>{text}</T>;
}

function DocumentModal({ doc, onClose }: { doc: DocModal; onClose: () => void }) {
  return (
    <Modal visible={!!doc} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.docModalCard, shadow.card]}>
          <View style={styles.modalHeader}>
            <T variant="h2" color={theme.textPrimary} style={{ flex: 1 }}>{doc?.title}</T>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <T variant="label" color={theme.primary}>Bezár</T>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.docScroll} showsVerticalScrollIndicator>
            <T variant="body" color={theme.textPrimary} style={styles.docText}>{doc?.text}</T>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmModal({ visible, title, text, confirmLabel, passwordValue, onPasswordChange, passwordPlaceholder, passwordTestID, onCancel, onConfirm, busy }: {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  passwordValue?: string;
  onPasswordChange?: (value: string) => void;
  passwordPlaceholder?: string;
  passwordTestID?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={[styles.confirmCard, shadow.card]}>
          <T variant="h2" color={theme.danger}>{title}</T>
          <T variant="body" color={theme.textSecondary} style={{ marginTop: 8 }}>{text}</T>
          {onPasswordChange ? (
            <PasswordInput
              value={passwordValue || ""}
              onChangeText={onPasswordChange}
              placeholder={passwordPlaceholder || "Jelszo"}
              placeholderTextColor="rgba(247,251,255,0.48)"
              containerStyle={[styles.passwordBox, styles.confirmPasswordBox]}
              style={styles.passwordInput}
              maxLength={PASSWORD_MAX_CHARS}
              testID={passwordTestID}
            />
          ) : null}
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.confirmCancel} onPress={onCancel} disabled={busy}>
              <T variant="title" color={theme.primary}>Mégse</T>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmGo} onPress={onConfirm} disabled={busy}>
              {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>{confirmLabel}</T>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { padding: 18, paddingBottom: 42 },
  profileCard: { borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 16, backgroundColor: "rgba(87,199,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileName: { marginTop: 5, marginBottom: 6 },
  sectionCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(6,19,32,0.58)", padding: 18 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(87,199,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  readonlyWrap: { marginBottom: 12 },
  readonlyLabel: { marginBottom: 6 },
  readonlyBox: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 },
  readonlyInput: { flex: 1, color: theme.textOnDark, fontFamily: "Manrope_500Medium", fontSize: 15, paddingVertical: 0 },
  label: { marginTop: 12, marginBottom: 6 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.08)", color: theme.textOnDark, paddingHorizontal: 14, fontFamily: "Manrope_500Medium", fontSize: 15 },
  inputFocused: {
    borderColor: theme.accent,
    backgroundColor: "rgba(255,255,255,0.12)",
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
  codeInput: { textAlign: "center", letterSpacing: 6, fontSize: 20 },
  passwordBox: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)", borderRadius: 12 },
  passwordInput: { color: theme.textOnDark },
  feedback: { marginTop: 12 },
  saveBtn: { marginTop: 18, minHeight: 52, borderRadius: 12, backgroundColor: theme.accentDeep, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  outlineBtn: { marginTop: 12, minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(87,199,255,0.38)", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  deviceList: { marginTop: 18 },
  deviceRow: { marginTop: 8, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  smallDangerBtn: { borderRadius: 10, backgroundColor: theme.danger, paddingHorizontal: 12, paddingVertical: 9 },
  adminCodeBox: { marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: "rgba(87,199,255,0.22)", backgroundColor: "rgba(87,199,255,0.10)", padding: 14 },
  docLink: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, marginTop: 8 },
  docIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(87,199,255,0.12)" },
  dangerCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(217,95,114,0.38)", backgroundColor: "rgba(60,12,24,0.45)", padding: 18 },
  dangerIcon: { backgroundColor: "rgba(217,95,114,0.24)", borderColor: "rgba(255,255,255,0.14)" },
  deleteBtn: { minHeight: 52, borderRadius: 12, backgroundColor: theme.danger, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(3,12,22,0.66)", justifyContent: "flex-end" },
  docModalCard: { maxHeight: "86%", backgroundColor: theme.surfaceStrong, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surfaceAlt },
  docScroll: { maxHeight: "92%" },
  docText: { lineHeight: 22 },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(3,12,22,0.64)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  confirmCard: { backgroundColor: theme.surfaceStrong, borderRadius: 16, padding: 24, width: "100%", maxWidth: 390, borderWidth: 1, borderColor: theme.borderSoft },
  confirmPasswordBox: { marginTop: 16 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.primary, alignItems: "center" },
  confirmGo: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: theme.danger, alignItems: "center" },
});
