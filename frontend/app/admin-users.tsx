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
  type LayoutChangeEvent,
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

type ChatActivity = {
  generated_at: string;
  today: { assistant_messages: number; user_messages: number; active_users: number };
  last_24h: { assistant_messages: number; user_messages: number; active_users: number };
  last_7d: { assistant_messages: number; user_messages: number; active_users: number };
  last_message_at: string | null;
  top_users_24h: Array<{
    id: number;
    name: string;
    email: string;
    message_count: number;
    last_message_at: string | null;
  }>;
};

const chartDimensions = [
  { key: "a" as const, label: "A", color: "#1F7FB8" },
  { key: "p" as const, label: "P", color: "#F28E2B" },
  { key: "h" as const, label: "H", color: "#2CA24D" },
  { key: "c" as const, label: "C", color: "#D93645" },
];

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.`;
}

function activityTime(value: string | null): string {
  if (!value) return "nincs adat";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "nincs adat";
  return d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ActivityStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <View style={styles.activityStat}>
      <T variant="caption" color="rgba(247,251,255,0.58)" style={{ letterSpacing: 1 }}>{label}</T>
      <T variant="h2" color={theme.textOnDark}>{value}</T>
      <T variant="small" color="rgba(247,251,255,0.58)">{hint}</T>
    </View>
  );
}

function ChatActivityCard({ activity }: { activity: ChatActivity | null }) {
  if (!activity) {
    return (
      <View style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <T variant="label" color={theme.textOnDark}>Chatbot aktivitás</T>
          <T variant="small" color="rgba(247,251,255,0.58)">betöltés...</T>
        </View>
      </View>
    );
  }

  const topUser = activity.top_users_24h[0];

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View>
          <T variant="label" color={theme.textOnDark}>Chatbot aktivitás</T>
          <T variant="small" color="rgba(247,251,255,0.58)">
            Utolsó üzenet: {activityTime(activity.last_message_at)}
          </T>
        </View>
        <View style={styles.liveDotWrap}>
          <View style={styles.liveDot} />
          <T variant="small" color={theme.accent}>élő adat</T>
        </View>
      </View>

      <View style={styles.activityStatsRow}>
        <ActivityStat label="MA" value={activity.today.assistant_messages} hint={`${activity.today.active_users} aktív user`} />
        <ActivityStat label="24 ÓRA" value={activity.last_24h.assistant_messages} hint={`${activity.last_24h.user_messages} user üzenet`} />
        <ActivityStat label="7 NAP" value={activity.last_7d.assistant_messages} hint={`${activity.last_7d.active_users} aktív user`} />
      </View>

      <View style={styles.activityFooter}>
        <T variant="small" color="rgba(247,251,255,0.62)">
          Top 24h: {topUser ? `${topUser.name} (${topUser.message_count})` : "nincs kiugró aktivitás"}
        </T>
      </View>
    </View>
  );
}

function AdminTrendChart({ sessions }: { sessions: SessionItem[] }) {
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const chartSessions = sessions.slice(0, 8).reverse();
  const plotWidth = Math.max(chartSize.width - 40, 0);
  const plotHeight = Math.max(chartSize.height - 18, 0);

  const onChartLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setChartSize({ width, height });
  };

  const pointFor = (session: SessionItem, sessionIndex: number, key: "a" | "p" | "h" | "c") => {
    const x = chartSessions.length === 1 ? plotWidth / 2 + 28 : 28 + (sessionIndex / (chartSessions.length - 1)) * plotWidth;
    const value = Math.max(0, Math.min(1, session.norms?.[key] ?? 0));
    const y = (1 - value) * plotHeight + 6;
    return { x, y };
  };

  if (chartSessions.length === 0) return null;

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <T variant="caption" color={theme.accent}>A-P-H-C trend</T>
        <T variant="small" color="rgba(247,251,255,0.66)">{chartSessions.length} mérés</T>
      </View>
      <View style={styles.chartArea} onLayout={onChartLayout}>
        <View style={[styles.gridLine, { top: "0%" }]} />
        <View style={[styles.gridLine, { top: "25%" }]} />
        <View style={[styles.gridLine, { top: "50%" }]} />
        <View style={[styles.gridLine, { top: "75%" }]} />
        <View style={[styles.gridLine, { top: "100%" }]} />
        <View style={styles.axisLine} />
        <T variant="small" color="rgba(247,251,255,0.54)" style={[styles.axisLabel, { top: 0 }]}>1.0</T>
        <T variant="small" color="rgba(247,251,255,0.54)" style={[styles.axisLabel, { bottom: 0 }]}>0</T>

        {plotWidth > 0 && (
          <>
            {/* Előbb az összes vonal minden dimenzióra */}
            {chartDimensions.map((dimension) => (
              <React.Fragment key={`lines-${dimension.key}`}>
                {chartSessions.map((session, idx) => {
                  if (idx === 0) return null;
                  const from = pointFor(chartSessions[idx - 1], idx - 1, dimension.key);
                  const to = pointFor(session, idx, dimension.key);
                  const length = Math.hypot(to.x - from.x, to.y - from.y);
                  const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
                  return (
                    <View
                      key={`${dimension.key}-${session.id}-line`}
                      style={[
                        styles.lineSegment,
                        {
                          left: from.x,
                          top: from.y,
                          width: length,
                          backgroundColor: dimension.color,
                          transform: [{ rotate: `${angle}deg` }],
                        },
                      ]}
                    />
                  );
                })}
              </React.Fragment>
            ))}
            {/* Majd az összes pont minden dimenzióra – ezek mindig a vonalak felett */}
            {chartDimensions.map((dimension) => (
              <React.Fragment key={`points-${dimension.key}`}>
                {chartSessions.map((session, idx) => {
                  const point = pointFor(session, idx, dimension.key);
                  return (
                    <View
                      key={`${dimension.key}-${session.id}-point`}
                      style={[styles.chartPoint, { left: point.x - 6, top: point.y - 6, borderColor: dimension.color }]}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </>
        )}
      </View>
      <View style={styles.chartFooter}>
        <T variant="small" color="rgba(247,251,255,0.58)">{shortDate(chartSessions[0]?.created_at ?? "")}</T>
        <T variant="small" color="rgba(247,251,255,0.58)">{shortDate(chartSessions[chartSessions.length - 1]?.created_at ?? "")}</T>
      </View>
      <View style={styles.legend}>
        {chartDimensions.map((dimension) => (
          <View key={dimension.key} style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: dimension.color }]} />
            <T variant="small" color="rgba(247,251,255,0.66)">{dimension.label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminUsersScreen() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [activity, setActivity] = useState<ChatActivity | null>(null);
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
      const [usersResponse, activityResponse] = await Promise.all([
        authedFetch(token, "/api/admin/users"),
        authedFetch(token, "/api/admin/chat-activity"),
      ]);
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(data.users || []);
      }
      if (activityResponse.ok) {
        const data = await activityResponse.json();
        setActivity(data);
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
            <T variant="body" color="rgba(247,251,255,0.72)">Nincs jogosultságod ehhez az oldalhoz.</T>
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
            <T variant="small" color="rgba(247,251,255,0.66)">{users.length} felhasználó</T>
            <TouchableOpacity onPress={load} style={styles.refreshBtn}>
              <T variant="small" color={theme.accent}>Frissítés</T>
            </TouchableOpacity>
          </View>
          <ChatActivityCard activity={activity} />

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
                      <T variant="label" color={theme.textOnDark} style={{ fontWeight: "600" }}>
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
                    <T variant="small" color="rgba(247,251,255,0.62)">{item.email}</T>
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
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openSessions(item)}
                      >
                        <T variant="small" color={theme.accent}>Mérések</T>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDownload(item)}
                        disabled={downloadBusy}
                      >
                        <T variant="small" color={theme.accent}>CSV ↓</T>
                      </TouchableOpacity>
                      {!item.is_admin && (
                        <>
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
                        </>
                      )}
                    </View>
                  </View>
                  {item.created_at ? (
                    <T variant="small" color="rgba(247,251,255,0.52)" style={{ fontSize: 11, alignSelf: "flex-start" }}>
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
              <T variant="h2" color={theme.textOnDark}>{selectedUser?.name} – Mérések</T>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <T variant="label" color={theme.accent}>Bezár</T>
              </TouchableOpacity>
            </View>
            {sessionsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : sessions.length === 0 ? (
              <T variant="body" color="rgba(247,251,255,0.72)" align="center" style={{ padding: 24 }}>
                Nincs még mérési adat.
              </T>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <AdminTrendChart sessions={sessions} />
                {sessions.map((s, idx) => (
                  <View key={s.id} style={styles.sessionRow}>
                    <View style={styles.sessionHead}>
                      <T variant="label" color={theme.textOnDark} style={{ fontWeight: "700" }}>{s.code}</T>
                      <T variant="small" color="rgba(247,251,255,0.62)">
                        {new Date(s.created_at).toLocaleDateString("hu-HU", {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </T>
                    </View>
                    <View style={styles.normsRow}>
                      {(["a", "p", "h", "c"] as const).map((k) => (
                        <View key={k} style={styles.normChip}>
                          <T variant="caption" color="rgba(247,251,255,0.54)" style={{ letterSpacing: 1 }}>
                            {k.toUpperCase()}
                          </T>
                          <T variant="label" color={theme.textOnDark}>
                            {((s.norms[k] || 0) * 100).toFixed(0)}%
                          </T>
                        </View>
                      ))}
                    </View>
                    {s.answers && s.answers.length > 0 && (
                      <T variant="small" color="rgba(247,251,255,0.62)" style={{ marginTop: 6 }}>
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
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  activityCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(6,19,32,0.58)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  liveDotWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  activityStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  activityStat: {
    flex: 1,
    minHeight: 74,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "space-between",
  },
  activityFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(6,19,32,0.58)",
    backdropFilter: "blur(18px)",
  },
  rowSuspended: {
    borderColor: theme.danger,
    opacity: 0.8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(87,199,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
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
    backgroundColor: "rgba(87,199,255,0.16)",
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
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
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
    backgroundColor: "rgba(3,12,22,0.64)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "rgba(6,19,32,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
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
  trendCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartArea: {
    height: 210,
    marginTop: 10,
    marginBottom: 12,
    paddingLeft: 28,
    position: "relative",
    overflow: "hidden",
  },
  gridLine: {
    position: "absolute",
    left: 28,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  axisLine: {
    position: "absolute",
    left: 28,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  axisLabel: {
    position: "absolute",
    left: 0,
  },
  lineSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    transformOrigin: "0px 1.5px",
  },
  chartPoint: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(6,19,32,0.94)",
    borderWidth: 3,
  },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 28,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendMark: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  sessionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
});
