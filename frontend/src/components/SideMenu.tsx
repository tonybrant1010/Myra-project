import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

type Session = {
  id: string;
  code: string;
  created_at: string;
};

function formatSessionLabel(s: Session): string {
  const d = new Date(s.created_at);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.`;
  return `${s.code} – ${date}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SideMenu({ visible, onClose }: Props) {
  const router = useRouter();
  const { user, token, logout, setUserLocal } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmRetake, setConfirmRetake] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setSessionsLoading(true);
    authedFetch(token, "/api/quiz/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [visible, token]);

  const handleRetake = async () => {
    setBusy(true);
    try {
      const r = await authedFetch(token, "/api/codes/reset", { method: "POST" });
      if (r.ok) {
        setUserLocal((u) => (u ? { ...u, state_code: null } : u));
        setConfirmRetake(false);
        onClose();
        setTimeout(() => router.replace("/quiz"), 50);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    router.replace("/login");
  };

  const handleDeleteAccount = async () => {
    setBusy(true);
    try {
      const r = await authedFetch(token, "/api/auth/delete-account", { method: "DELETE" });
      if (r.ok) {
        setConfirmDelete(false);
        await logout();
        onClose();
        router.replace("/login");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={styles.drawer} edges={["top", "left", "bottom"]}>
          <View style={styles.drawerInner} testID="side-menu">
            <View style={styles.header}>
              <View style={styles.avatarRow}>
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <T variant="h2" color={theme.textOnDark}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
                  </T>
                </View>
              </View>
              <T variant="h2" color={theme.textOnDark} style={{ marginTop: 16 }} testID="menu-user-name">
                {user?.name || "Felhasználó"}
              </T>
              <T variant="small" color="#B5BFB8">
                {user?.email}
              </T>

              {user?.state_code ? (
                <View style={styles.codeBadge}>
                  <T variant="caption" color={theme.accent} style={{ fontSize: 10 }}>
                    JELENLEGI ÁLLAPOTKÓD
                  </T>
                  <T
                    variant="hero"
                    color={theme.textOnDark}
                    style={{ fontSize: 40, lineHeight: 46, letterSpacing: 6, marginTop: 4 }}
                    testID="menu-current-code"
                  >
                    {user.state_code}
                  </T>
                </View>
              ) : null}
            </View>

            {/* Session lista — állapotkód buborék alatt */}
            {sessions.length > 0 && (
              <View style={styles.sessionsSection}>
                <T variant="caption" color="#7A9188" style={styles.sessionsTitle}>
                  KORÁBBI MÉRÉSEK
                </T>
                {sessionsLoading ? (
                  <ActivityIndicator color={theme.accent} size="small" style={{ marginTop: 8 }} />
                ) : (
                  sessions.map((s, idx) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sessionItem, idx === 0 && styles.sessionItemActive]}
                      onPress={() => {
                        onClose();
                        router.push({ pathname: "/chat", params: { session_id: s.id } });
                      }}
                      testID={`session-item-${s.id}`}
                    >
                      <T
                        variant="small"
                        color={idx === 0 ? theme.accent : "#9EAAA1"}
                      >
                        {formatSessionLabel(s)}
                      </T>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.menu}>
                <MenuItem
                  label="Új mérés"
                  onPress={() => setConfirmRetake(true)}
                  testID="menu-retake"
                  disabled={busy}
                />
                {user?.is_admin ? (
                  <>
                    <MenuItem
                      label="Chatbot beállítások"
                      onPress={() => {
                        onClose();
                        router.push("/admin-settings");
                      }}
                      testID="menu-admin-settings"
                    />
                    <MenuItem
                      label="Admin · kódok"
                      onPress={() => {
                        onClose();
                        router.push("/admin");
                      }}
                      testID="menu-admin"
                    />
                    <MenuItem
                      label="Felhasználók"
                      onPress={() => {
                        onClose();
                        router.push("/admin-users");
                      }}
                      testID="menu-admin-users"
                    />
                  </>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <MenuItem
                label="Kijelentkezés"
                onPress={handleLogout}
                testID="menu-logout"
                subtle
              />
              <MenuItem
                label="Regisztráció törlése"
                onPress={() => setConfirmDelete(true)}
                testID="menu-delete-account"
                danger
              />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Új mérés megerősítő modal */}
      <Modal
        visible={confirmRetake}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRetake(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="retake-confirm-modal">
            <T variant="h2">Új mérés indítása</T>
            <T variant="body" color={theme.textSecondary} style={{ marginTop: 8 }}>
              Egy új kérdőívet töltesz ki, amely új állapotkódot generál. A korábbi beszélgetéseid
              megmaradnak — az új mérés egy különálló szállal indul.
            </T>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmRetake(false)}
                disabled={busy}
                testID="retake-cancel"
              >
                <T variant="title" color={theme.primary}>Mégse</T>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmGo}
                onPress={handleRetake}
                disabled={busy}
                testID="retake-confirm"
              >
                {busy ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <T variant="title" color={theme.white}>Új mérés</T>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fiók törlése megerősítő modal */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="delete-account-modal">
            <T variant="h2" color={theme.danger}>Fiók törlése</T>
            <T variant="body" color={theme.textSecondary} style={{ marginTop: 8 }}>
              Ez a művelet véglegesen törli a fiókodat, az összes chat üzenetedet és mérési eredményedet. Ez nem visszavonható.
            </T>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmDelete(false)}
                disabled={busy}
                testID="delete-account-cancel"
              >
                <T variant="title" color={theme.primary}>Mégse</T>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDelete}
                onPress={handleDeleteAccount}
                disabled={busy}
                testID="delete-account-confirm"
              >
                {busy ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <T variant="title" color={theme.white}>Törlés</T>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function MenuItem({
  label,
  onPress,
  testID,
  disabled,
  subtle,
  danger,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  subtle?: boolean;
  danger?: boolean;
}) {
  const color = danger ? theme.danger : subtle ? "#9EAAA1" : theme.textOnDark;
  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      testID={testID}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <T variant="bodyLg" color={color}>
        {label}
      </T>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(20,28,24,0.5)" },
  backdropTouch: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  drawer: {
    width: "84%",
    maxWidth: 340,
    backgroundColor: theme.primary,
    height: "100%",
  },
  drawerInner: { flex: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: "space-between" },
  header: {},
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBadge: {
    marginTop: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  menu: { gap: 4, marginTop: 24 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sessionsSection: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  sessionsTitle: { marginBottom: 4, letterSpacing: 1 },
  sessionItem: { paddingVertical: 12, paddingHorizontal: 4 },
  sessionItemActive: { borderLeftWidth: 2, borderLeftColor: theme.accent, paddingLeft: 10 },
  footer: {},
  footerDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 4 },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,28,24,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  confirmCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.primary,
    alignItems: "center",
  },
  confirmGo: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.primary,
    alignItems: "center",
  },
  confirmDelete: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.danger,
    alignItems: "center",
  },
});
