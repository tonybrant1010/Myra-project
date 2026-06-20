import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { shadow, theme } from "@/src/theme";
import { T } from "@/src/components/Typography";

type Session = { id: string; code: string; created_at: string };
type Props = { visible: boolean; onClose: () => void };

function formatSessionLabel(s: Session): string {
  const d = new Date(s.created_at);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.`;
  return `${s.code} - ${date}`;
}

function isSessionExpired(s: Session): boolean {
  const created = new Date(s.created_at);
  const now = new Date();
  const msIn30Days = 30 * 24 * 60 * 60 * 1000;
  return (now.getTime() - created.getTime()) >= msIn30Days;
}

export default function SideMenu({ visible, onClose }: Props) {
  const router = useRouter();
  const { user, token, logout, setUserLocal } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmRetake, setConfirmRetake] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const loadSessions = () => {
    if (!token) return;
    setSessionsLoading(true);
    authedFetch(token, "/api/quiz/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    if (visible) loadSessions();
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

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setBusy(true);
    try {
      const r = await authedFetch(token, `/api/quiz/sessions/${sessionToDelete.id}`, { method: "DELETE" });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        setSessions((items) => items.filter((item) => item.id !== sessionToDelete.id));
        setUserLocal((u) => (u ? {
          ...u,
          state_code: data.state_code ?? null,
          is_code_expired: data.is_code_expired ?? false,
          code_days_remaining: data.code_days_remaining ?? 0
        } : u));
        setSessionToDelete(null);
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={styles.drawer} edges={["top", "left", "bottom"]}>
          <LinearGradient colors={["#061320", "#0A2340", "#11365A"]} style={styles.drawerGradient}>
            <View pointerEvents="none" style={styles.drawerMist} />
            <View style={styles.drawerInner} testID="side-menu">
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                  <View style={styles.avatarFallback}>
                    <T variant="h2" color={theme.textOnDark}>{user?.name ? user.name.charAt(0).toUpperCase() : "?"}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="h2" color={theme.textOnDark} testID="menu-user-name">{user?.name || "Felhasználó"}</T>
                    <T variant="small" color="rgba(247,251,255,0.68)">{user?.email}</T>
                  </View>
                </View>

                {user?.state_code ? (
                  <View style={styles.codeBadge}>
                    <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10 }}>Jelenlegi állapotkód</T>
                    <T variant="hero" color={theme.textOnDark} style={styles.codeText} testID="menu-current-code">
                      {user.state_code}
                    </T>
                  </View>
                ) : null}

                <MenuGroup title="Alapműveletek">
                  <MenuItem label="Főoldal" icon="home-outline" onPress={() => { onClose(); router.replace("/welcome"); }} testID="menu-welcome" />
                  <MenuItem label="Új mérés" icon="analytics-outline" onPress={() => setConfirmRetake(true)} testID="menu-retake" disabled={busy} />
                  <MenuItem label="Beállítások" icon="person-circle-outline" onPress={() => { onClose(); router.push("/settings" as any); }} testID="menu-settings" />
                </MenuGroup>

                <MenuGroup title="Béta">
                  <MenuItem label="Myra Live" icon="mic-circle-outline" onPress={() => { onClose(); router.push("/myra-live" as any); }} testID="menu-myra-live" />
                </MenuGroup>

                <MenuGroup title="Kikapcsolódás">
                  <MenuItem label="Játszótér" icon="game-controller-outline" onPress={() => { onClose(); router.push("/relax"); }} testID="menu-relax" />
                </MenuGroup>

                {user?.is_admin ? (
                  <View style={styles.menuGroup}>
                    <TouchableOpacity
                      style={styles.collapsibleHeader}
                      onPress={() => setAdminExpanded(!adminExpanded)}
                      activeOpacity={0.72}
                      testID="menu-admin-collapsible"
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={styles.menuIcon}>
                          <Ionicons name="shield-checkmark-outline" size={18} color={theme.textOnDark} />
                        </View>
                        <T variant="bodyLg" color={theme.textOnDark} style={styles.menuLabel}>Adminisztráció</T>
                      </View>
                      <Ionicons
                        name={adminExpanded ? "chevron-down" : "chevron-forward"}
                        size={16}
                        color="rgba(247,251,255,0.60)"
                      />
                    </TouchableOpacity>
                    {adminExpanded ? (
                      <View style={styles.submenu}>
                        <MenuItemSub
                          label="Rendszerbeállítások"
                          icon="settings-outline"
                          onPress={() => { onClose(); router.push("/admin-settings"); }}
                          testID="menu-admin-settings"
                        />
                        <MenuItemSub
                          label="Tudásanyag"
                          icon="book-outline"
                          onPress={() => { onClose(); router.push("/admin-kb"); }}
                          testID="menu-admin-kb"
                        />
                        <MenuItemSub
                          label="Állapotkódok"
                          icon="keypad-outline"
                          onPress={() => { onClose(); router.push("/admin"); }}
                          testID="menu-admin"
                        />
                        <MenuItemSub
                          label="Felhasználók"
                          icon="people-outline"
                          onPress={() => { onClose(); router.push("/admin-users"); }}
                          testID="menu-admin-users"
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.historyBox}>
                  <View style={styles.historyHeader}>
                    <T variant="caption" color="rgba(247,251,255,0.60)">Mérések és chatek</T>
                    {sessionsLoading ? <ActivityIndicator color={theme.accent} size="small" /> : null}
                  </View>
                  <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator>
                    {sessions.length === 0 && !sessionsLoading ? (
                      <T variant="small" color="rgba(247,251,255,0.58)" style={styles.emptyHistory}>Nincs korábbi mérés.</T>
                    ) : null}
                    {sessions.map((s, idx) => (
                      <View key={s.id} style={styles.sessionItem}>
                        <TouchableOpacity
                          style={styles.sessionOpen}
                          onPress={() => {
                            onClose();
                            router.push({ pathname: "/chat", params: { session_id: s.id } });
                          }}
                          testID={`session-item-${s.id}`}
                          activeOpacity={0.75}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {isSessionExpired(s) ? (
                              <Ionicons name="lock-closed-outline" size={12} color="rgba(247,251,255,0.40)" />
                            ) : null}
                            <T
                              variant="small"
                              color={isSessionExpired(s) ? "rgba(247,251,255,0.40)" : idx === 0 ? theme.success : "#FF8A8A"}
                              style={styles.sessionText}
                            >
                              {formatSessionLabel(s)}{isSessionExpired(s) ? " (Archivált)" : ""}
                            </T>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteSessionBtn}
                          onPress={() => setSessionToDelete(s)}
                          testID={`session-delete-${s.id}`}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="rgba(247,251,255,0.70)" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <MenuItem label="Kijelentkezés" icon="log-out-outline" onPress={handleLogout} testID="menu-logout" subtle />
              </View>
            </View>
          </LinearGradient>
        </SafeAreaView>
      </View>

      <ConfirmModal
        visible={confirmRetake}
        title="Új mérés indítása"
        text="Egy új kérdőívet töltesz ki, amely új állapotkódot generál. A korábbi beszélgetéseid megmaradnak, az új mérés külön szálként indul."
        confirmLabel="Új mérés"
        onCancel={() => setConfirmRetake(false)}
        onConfirm={handleRetake}
        busy={busy}
      />

      <ConfirmModal
        visible={!!sessionToDelete}
        title="Mérési szál törlése"
        text={sessionToDelete ? `Törlöd ezt a mérési és chat szálat: ${formatSessionLabel(sessionToDelete)}?` : ""}
        confirmLabel="Törlés"
        onCancel={() => setSessionToDelete(null)}
        onConfirm={handleDeleteSession}
        busy={busy}
        danger
      />
    </Modal>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuGroup}>
      <T variant="caption" color="rgba(247,251,255,0.54)" style={styles.menuGroupTitle}>{title}</T>
      {children}
    </View>
  );
}

function MenuItem({ label, icon, onPress, testID, disabled, subtle, danger }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  subtle?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "#FF9AA8" : subtle ? "rgba(247,251,255,0.66)" : theme.textOnDark;
  return (
    <TouchableOpacity style={[styles.menuItem, disabled && { opacity: 0.4 }]} onPress={onPress} testID={testID} disabled={disabled} activeOpacity={0.72}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <T variant="bodyLg" color={color} style={styles.menuLabel}>{label}</T>
    </TouchableOpacity>
  );
}

function MenuItemSub({ label, icon, onPress, testID, disabled }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, { paddingLeft: 24 }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      testID={testID}
      disabled={disabled}
      activeOpacity={0.72}
    >
      <View style={[styles.menuIcon, { backgroundColor: "transparent" }]}>
        <Ionicons name={icon} size={16} color="rgba(247,251,255,0.85)" />
      </View>
      <T variant="body" color="rgba(247,251,255,0.85)" style={styles.menuLabel}>{label}</T>
    </TouchableOpacity>
  );
}

function ConfirmModal({ visible, title, text, confirmLabel, onCancel, onConfirm, busy, danger }: {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={[styles.confirmCard, shadow.card]}>
          <T variant="h2" color={danger ? theme.danger : theme.textPrimary}>{title}</T>
          <T variant="body" color={theme.textSecondary} style={{ marginTop: 8 }}>{text}</T>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.confirmCancel} onPress={onCancel} disabled={busy}>
              <T variant="title" color={theme.primary}>Mégse</T>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmGo, danger && { backgroundColor: theme.danger }]} onPress={onConfirm} disabled={busy}>
              {busy ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>{confirmLabel}</T>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(3,12,22,0.60)" },
  backdropTouch: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  drawer: { width: "86%", maxWidth: 370, height: "100%" },
  drawerGradient: { flex: 1, backgroundColor: theme.primary },
  drawerMist: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "radial-gradient(ellipse at 12% 0%, rgba(87,199,255,0.26), transparent 34%), radial-gradient(ellipse at 100% 78%, rgba(139,143,232,0.18), transparent 38%)",
  } as any,
  drawerInner: { flex: 1, paddingHorizontal: 18, paddingVertical: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.borderOnDark,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBadge: {
    backgroundColor: theme.surfaceGlass,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.borderOnDark,
  },
  codeText: { fontSize: 34, lineHeight: 40, letterSpacing: 3, marginTop: 4 },
  menuGroup: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderOnDark,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 6,
  },
  menuGroupTitle: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  submenu: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuLabel: { fontSize: 15, lineHeight: 20 },
  historyBox: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderOnDark,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  historyHeader: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  historyScroll: { flex: 1 },
  emptyHistory: { padding: 12 },
  sessionItem: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  sessionOpen: { flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 6 },
  sessionText: { fontFamily: "Manrope_600SemiBold" },
  deleteSessionBtn: { width: 42, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  footer: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingTop: 6 },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(3,12,22,0.64)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  confirmCard: { backgroundColor: theme.surfaceStrong, borderRadius: 16, padding: 24, width: "100%", maxWidth: 390, borderWidth: 1, borderColor: theme.borderSoft },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.primary, alignItems: "center" },
  confirmGo: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: theme.primary, alignItems: "center" },
});
