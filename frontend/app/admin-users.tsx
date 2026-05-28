import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";

type UserItem = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_suspended: boolean;
  state_code: string | null;
  created_at: string | null;
};

type SessionItem = {
  id: string;
  code: string;
  norms: { a: number; p: number; h: number; c: number };
  answers: number[];
  created_at: string;
};

export default function AdminUsersScreen() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [suspendBusy, setSuspendBusy] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authedFetch(token, "/api/admin/users");
      if (r.ok) {
        const data = await r.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openSessions = async (u: UserItem) => {
    setSelectedUser(u);
    setSessions([]);
    setSessionsLoading(true);
    try {
      const r = await authedFetch(token, `/api/admin/users/${u.id}/sessions`);
      if (r.ok) {
        const data = await r.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSuspend = async (u: UserItem) => {
    setSuspendBusy(u.id);
    try {
      const r = await authedFetch(token, `/api/admin/users/${u.id}/suspend`, { method: "PUT" });
      if (r.ok) {
        const data = await r.json();
        setUsers((prev) =>
          prev.map((x) => x.id === u.id ? { ...x, is_suspended: data.is_suspended } : x)
        );
      }
    } finally {
      setSuspendBusy(null);
    }
  };

  const handleDelete = async (u: UserItem) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`Biztosan törlöd ${u.name} fiókját? Ez visszafordíthatatlan — minden adata elvész!`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Felhasználó törlése",
            `Biztosan törlöd ${u.name} fiókját? Ez visszafordíthatatlan!`,
            [
              { text: "Mégse", onPress: () => resolve(false), style: "cancel" },
              { text: "Törlés", onPress: () => resolve(true), style: "destructive" },
            ]
          )
        );
    if (!confirmed) return;
    setDeleteBusy(u.id);
    try {
      const r = await authedFetch(token, `/api/admin/users/${u.id}`, { method: "DELETE" });
      if (r.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } finally {
      setDeleteBusy(null);
    }
  };

  const handleDownload = async (u: UserItem) => {
    setDownloadBusy(true);
    try {
      const r = await authedFetch(token, `/api/admin/users/${u.id}/sessions/download`);
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myra_meresek_${u.name.replace(/\s+/g, "_")}_${u.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadBusy(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Felhasználók" showBack />
        <ContentBackground>
          <View style={styles.center}>
            <T variant="body" color={theme.textSecondary}>Nincs jogosultságod ehhez az oldalhoz.</T>
          </View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="admin-users-screen">
      <TopBar title="Felhasználók" showBack />
      <ContentBackground>
        <View style={styles.container}>
          <View style={styles.headRow}>
            <T variant="small" color={theme.textSecondary}>{users.length} felhasználó</T>
            <TouchableOpacity onPress={load} style={styles.refreshBtn}>
              <T variant="small" color={theme.primary}>Frissítés</T>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(u) => String(u.id)}
              contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
              ListEmptyComponent={
                <T variant="body" color={theme.textSecondary} align="center" style={{ padding: 24 }}>
                  Még nincs regisztrált felhasználó.
                </T>
              }
              renderItem={({ item }) => (
                <View style={[styles.row, item.is_suspended && styles.rowSuspended]}>
                  <View style={styles.avatar}>
                    <T variant="title" color={theme.white} style={{ fontWeight: "bold" }}>
                      {item.name.charAt(0).toUpperCase()}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <T variant="label" color={theme.textPrimary} style={{ fontWeight: "600" }}>
                        {item.name}
                      </T>
                      {item.is_admin && (
                        <View style={styles.adminBadge}>
                          <T variant="caption" color={theme.accent} style={{ fontSize: 10, letterSpacing: 1 }}>ADMIN</T>
                        </View>
                      )}
                      {item.is_suspended && (
                        <View style={styles.suspendedBadge}>
                          <T variant="caption" color={theme.danger} style={{ fontSize: 10, letterSpacing: 1 }}>FELFÜGGESZTVE</T>
                        </View>
                      )}
                    </View>
                    <T variant="small" color={theme.textSecondary}>{item.email}</T>
                    {item.state_code ? (
                      <T variant="small" color={theme.secondary} style={{ marginTop: 2 }}>
                        Kód: {item.state_code}
                      </T>
                    ) : (
                      <T variant="small" color={theme.border} style={{ marginTop: 2 }}>
                        Kód: —
                      </T>
                    )}

                    {/* Akció gombok */}
                    {!item.is_admin && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => openSessions(item)}
                        >
                          <T variant="small" color={theme.primary}>Mérések</T>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleDownload(item)}
                          disabled={downloadBusy}
                        >
                          <T variant="small" color={theme.primary}>CSV ↓</T>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, item.is_suspended && styles.actionBtnActive]}
                          onPress={() => handleSuspend(item)}
                          disabled={suspendBusy === item.id}
                        >
                          {suspendBusy === item.id ? (
                            <ActivityIndicator size="small" color={theme.danger} />
                          ) : (
                            <T variant="small" color={item.is_suspended ? theme.white : theme.danger}>
                              {item.is_suspended ? "Felold" : "Felfüggeszt"}
                            </T>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnDelete]}
                          onPress={() => handleDelete(item)}
                          disabled={deleteBusy === item.id}
                        >
                          {deleteBusy === item.id ? (
                            <ActivityIndicator size="small" color={theme.white} />
                          ) : (
                            <T variant="small" color={theme.white}>Törlés</T>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {item.created_at ? (
                    <T variant="small" color={theme.textSecondary} style={{ fontSize: 11, alignSelf: "flex-start" }}>
                      {new Date(item.created_at).toLocaleDateString("hu-HU")}
                    </T>
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      </ContentBackground>

      {/* Mérések modal */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <T variant="h2">{selectedUser?.name} – Mérések</T>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <T variant="label" color={theme.primary}>Bezár</T>
              </TouchableOpacity>
            </View>
            {sessionsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : sessions.length === 0 ? (
              <T variant="body" color={theme.textSecondary} align="center" style={{ padding: 24 }}>
                Nincs még mérési adat.
              </T>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {sessions.map((s, idx) => (
                  <View key={s.id} style={styles.sessionRow}>
                    <View style={styles.sessionHead}>
                      <T variant="label" style={{ fontWeight: "700" }}>{s.code}</T>
                      <T variant="small" color={theme.textSecondary}>
                        {new Date(s.created_at).toLocaleDateString("hu-HU", {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </T>
                    </View>
                    <View style={styles.normsRow}>
                      {(["a", "p", "h", "c"] as const).map((k) => (
                        <View key={k} style={styles.normChip}>
                          <T variant="caption" color={theme.textSecondary} style={{ letterSpacing: 1 }}>
                            {k.toUpperCase()}
                          </T>
                          <T variant="label" color={theme.primary}>
                            {((s.norms[k] || 0) * 100).toFixed(0)}%
                          </T>
                        </View>
                      ))}
                    </View>
                    {s.answers && s.answers.length > 0 && (
                      <T variant="small" color={theme.textSecondary} style={{ marginTop: 6 }}>
                        Válaszok: {s.answers.join(", ")}
                      </T>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    backgroundColor: theme.surface,
  },
  rowSuspended: {
    borderColor: theme.danger,
    opacity: 0.8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  adminBadge: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  suspendedBadge: {
    backgroundColor: "rgba(220,53,69,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  actionRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    backgroundColor: theme.background,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
  },
  actionBtnActive: {
    backgroundColor: theme.danger,
    borderColor: theme.danger,
  },
  actionBtnDelete: {
    backgroundColor: "#7f1d1d",
    borderColor: "#7f1d1d",
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
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sessionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSoft,
  },
  sessionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  normsRow: {
    flexDirection: "row",
    gap: 8,
  },
  normChip: {
    alignItems: "center",
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
});
