import React, { useState, useEffect, useCallback } from "react";
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme } from "@/src/theme";

type SessionItem = {
  id: string;
  code: string;
  norms: { a: number; p: number; h: number; c: number };
  created_at: string;
};

type Goal = {
  id: number;
  text: string;
  scale: string;
  scale_label: string;
  status: string;
};

const chartDimensions = [
  { key: "a" as const, label: "Érzelem (A)", color: "#57C7FF" },
  { key: "p" as const, label: "Szabályozás (P)", color: "#ecc94b" },
  { key: "h" as const, label: "Stressz (H)", color: "#38a169" },
  { key: "c" as const, label: "Testi tünetek (C)", color: "#e53e3e" },
];

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.`;
}

function UserTrendChart({ sessions, onNewQuiz }: { sessions: SessionItem[]; onNewQuiz: () => void }) {
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const chartSessions = sessions.slice(0, 8).reverse();
  const plotWidth = Math.max(chartSize.width - 40, 0);
  const plotHeight = Math.max(chartSize.height - 35, 0);

  const onChartLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setChartSize({ width, height });
  };

  const pointFor = (session: SessionItem, sessionIndex: number, key: "a" | "p" | "h" | "c") => {
    const x = chartSessions.length === 1 ? plotWidth / 2 + 28 : 28 + (sessionIndex / (chartSessions.length - 1)) * plotWidth;
    const value = Math.max(0, Math.min(1, session.norms?.[key] ?? 0));
    const y = (1 - value) * plotHeight + 8;
    return { x, y };
  };

  if (sessions.length === 0) {
    return (
      <View style={[styles.emptyChartCard, shadow.card]}>
        <View style={styles.emptyChartIcon}>
          <Ionicons name="analytics-outline" size={28} color={theme.accent} />
        </View>
        <T variant="title" color={theme.textOnDark} style={{ marginBottom: 8, fontWeight: "700" }}>
          Nincs még mérési eredményed
        </T>
        <T variant="body" color="rgba(247,251,255,0.7)" align="center" style={{ marginBottom: 18, maxWidth: 320 }}>
          Mérd fel az aktuális Érzelem-Stressz-Viselkedés állapotodat, és kövesd itt a fejlődésedet!
        </T>
        <TouchableOpacity style={styles.startQuizBtn} onPress={onNewQuiz}>
          <T variant="label" color={theme.white} style={{ fontWeight: "700" }}>Első mérés indítása</T>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.trendCard, shadow.card]}>
      <View style={styles.trendHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.chartBadge}>
            <Ionicons name="trending-up-outline" size={16} color={theme.accent} />
          </View>
          <T variant="caption" color={theme.accent} style={{ fontWeight: "700" }}>SAJÁT ÁLLAPOT TREND</T>
        </View>
        <T variant="small" color="rgba(247,251,255,0.66)">{sessions.length} mérés összesen</T>
      </View>
      <View style={styles.chartArea} onLayout={onChartLayout}>
        <View style={[styles.gridLine, { top: "0%" }]} />
        <View style={[styles.gridLine, { top: "25%" }]} />
        <View style={[styles.gridLine, { top: "50%" }]} />
        <View style={[styles.gridLine, { top: "75%" }]} />
        <View style={[styles.gridLine, { top: "100%" }]} />
        <View style={styles.axisLine} />
        <T variant="small" color="rgba(247,251,255,0.4)" style={[styles.axisLabel, { top: 0 }]}>1.0</T>
        <T variant="small" color="rgba(247,251,255,0.4)" style={[styles.axisLabel, { bottom: 4 }]}>0.0</T>

        {plotWidth > 0 && (
          <>

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

            {chartDimensions.map((dimension) => (
              <React.Fragment key={`points-${dimension.key}`}>
                {chartSessions.map((session, idx) => {
                  const point = pointFor(session, idx, dimension.key);
                  return (
                    <View
                      key={`${dimension.key}-${session.id}-point`}
                      style={[styles.chartPoint, { left: point.x - 5, top: point.y - 5, borderColor: dimension.color }]}
                    />
                  );
                })}
              </React.Fragment>
            ))}

            {chartSessions.map((session, idx) => {
              const point = pointFor(session, idx, "a");
              return (
                <View
                  key={`date-${session.id}`}
                  style={[
                    styles.dateLabelContainer,
                    {
                      left: point.x - 20,
                      bottom: 2,
                    }
                  ]}
                >
                  <T variant="small" color="rgba(247,251,255,0.58)" style={{ fontSize: 9, textAlign: "center" }}>
                    {shortDate(session.created_at)}
                  </T>
                </View>
              );
            })}
          </>
        )}
      </View>
      <View style={styles.legend}>
        {chartDimensions.map((dimension) => (
          <View key={dimension.key} style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: dimension.color }]} />
            <T variant="small" color="rgba(247,251,255,0.66)" style={{ fontSize: 10 }}>{dimension.label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

function GoalsCard({ token }: { token: string | null }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await authedFetch(token, "/api/goals");
      if (r.ok) {
        const data = await r.json();
        setGoals(data.goals || []);
      }
    } catch {
      // opcionális kártya — hiba esetén egyszerűen nem jelenik meg
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = useCallback(async (id: number) => {
    if (!token || busyId !== null) return;
    setBusyId(id);
    try {
      const r = await authedFetch(token, `/api/goals/${id}/done`, { method: "POST" });
      if (r.ok) setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, status: "done" } : g)));
    } catch {
    } finally {
      setBusyId(null);
    }
  }, [busyId, token]);

  const removeGoal = useCallback(async (id: number) => {
    if (!token || busyId !== null) return;
    setBusyId(id);
    try {
      const r = await authedFetch(token, `/api/goals/${id}`, { method: "DELETE" });
      if (r.ok) setGoals((gs) => gs.filter((g) => g.id !== id));
    } catch {
    } finally {
      setBusyId(null);
    }
  }, [busyId, token]);

  const active = goals.filter((g) => g.status === "active");
  const doneCount = goals.filter((g) => g.status === "done").length;
  if (!loaded || (active.length === 0 && doneCount === 0)) return null;

  return (
    <View style={[styles.infoCard, shadow.card]} testID="welcome-goals-card">
      <View style={styles.infoHead}>
        <View style={styles.infoIcon}>
          <Ionicons name="flag-outline" size={18} color={theme.accentSoft} />
        </View>
        <T variant="caption" color={theme.accentSoft} style={styles.infoTitle}>
          Apró céljaim
        </T>
        {doneCount > 0 ? (
          <T variant="small" color="rgba(247,251,255,0.6)">{doneCount} teljesítve</T>
        ) : null}
      </View>
      {active.length === 0 ? (
        <T variant="body" color="rgba(247,251,255,0.72)" style={styles.infoText}>
          Minden vállalt célodat teljesítetted. Új célokat a következő mérés után választhatsz.
        </T>
      ) : (
        active.map((g) => (
          <View key={g.id} style={styles.goalRow}>
            <TouchableOpacity
              onPress={() => markDone(g.id)}
              disabled={busyId !== null}
              activeOpacity={0.7}
              testID={`welcome-goal-done-${g.id}`}
              accessibilityLabel="Cél teljesítve"
            >
              <Ionicons name="ellipse-outline" size={22} color={theme.accent} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <T variant="small" color="rgba(247,251,255,0.82)" style={{ lineHeight: 19 }}>{g.text}</T>
              {g.scale_label ? (
                <T variant="small" color="rgba(247,251,255,0.45)" style={{ fontSize: 10, marginTop: 2 }}>
                  {g.scale_label}
                </T>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => removeGoal(g.id)}
              disabled={busyId !== null}
              activeOpacity={0.7}
              testID={`welcome-goal-delete-${g.id}`}
              accessibilityLabel="Cél törlése"
            >
              <Ionicons name="close-outline" size={18} color="rgba(247,251,255,0.4)" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

export default function WelcomeScreen() {
  useAuthGuard();
  const { user, token } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportBusy, setReportBusy] = useState(false);

  const greeting = user?.name ? `Szia ${user.name}!` : "Szia!";

  const downloadReport = useCallback(async () => {
    if (Platform.OS !== "web" || !token || reportBusy) return;
    setReportBusy(true);
    try {
      const r = await authedFetch(token, "/api/quiz/report.pdf");
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const link = document.createElement("a");
      link.href = url;
      link.download = `myra_esv25_osszefoglalo_${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // csendes hiba — a letöltés újrapróbálható
    } finally {
      setReportBusy(false);
    }
  }, [reportBusy, token]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await authedFetch(token, "/api/quiz/sessions");
      if (r.ok) {
        const data = await r.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <ContentBackground>
        <TopBar title="" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.heroCard, shadow.card]}>
            <View style={[styles.cardSheen, styles.noPointer]} />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={15} color={theme.accentSoft} />
            </View>
            <T variant="display" color={theme.textOnDark} style={styles.heroName}>
              {greeting}
            </T>
            <View style={styles.heroRule} />
            <T variant="body" color="rgba(247,251,255,0.74)" style={styles.heroText}>
              Jó, hogy itt vagy.
            </T>
          </LinearGradient>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <UserTrendChart sessions={sessions} onNewQuiz={() => router.push("/quiz")} />
          )}

          {!loading && sessions.length > 0 && Platform.OS === "web" ? (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={downloadReport}
              disabled={reportBusy}
              activeOpacity={0.85}
              testID="welcome-download-report"
            >
              {reportBusy ? (
                <ActivityIndicator color={theme.accentSoft} size="small" />
              ) : (
                <Ionicons name="document-attach-outline" size={17} color={theme.accentSoft} />
              )}
              <View style={{ flex: 1 }}>
                <T variant="label" color={theme.textOnDark} style={{ fontWeight: "700" }}>
                  ESV25 összefoglaló szakembernek (PDF)
                </T>
                <T variant="small" color="rgba(247,251,255,0.6)" style={{ fontSize: 11, marginTop: 1 }}>
                  Mérési előzményeid átlátható kivonata módszertani magyarázattal — megoszthatod pszichológusoddal.
                </T>
              </View>
              <Ionicons name="download-outline" size={17} color="rgba(247,251,255,0.55)" />
            </TouchableOpacity>
          ) : null}

          <GoalsCard token={token} />

          <InfoCard
            icon="chatbubble-ellipses-outline"
            title="Mi a Myra?"
            text="A Myra egy önismereti beszélgetőtárs, amely a mérésed eredményéhez igazodva segít átgondolni az aktuális állapotodat. Nem diagnózis, és nem helyettesít szakembert."
          />

          <InfoCard
            icon="analytics-outline"
            title="Mi az ESV-modell?"
            text="Az Érzelem-Stressz-Viselkedés modell négy területen ad pillanatképet az aktuális pszichés állapotodról: érzelem, szabályozás, stressz és testi tünetek."
          />

          <View style={styles.supportBlock}>
            <T variant="small" color="rgba(247,251,255,0.66)">Kérdés vagy probléma esetén:</T>
            <T variant="small" color={theme.accentSoft} style={{ marginTop: 2 }}>
              myra-project@research.hu
            </T>
          </View>
        </ScrollView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function InfoCard({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={[styles.infoCard, shadow.card]}>
      <View style={styles.infoHead}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={18} color={theme.accentSoft} />
        </View>
        <T variant="caption" color={theme.accentSoft} style={styles.infoTitle}>
          {title}
        </T>
      </View>
      <T variant="body" color="rgba(247,251,255,0.72)" style={styles.infoText}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: "none" },
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { padding: 18, paddingBottom: 44 },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    padding: 24,
    minHeight: 196,
    justifyContent: "center",
    overflow: "hidden",
  },
  cardSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "linear-gradient(135deg, rgba(79,209,197,0.24), transparent 45%, rgba(159,122,234,0.14))",
  } as any,
  heroBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(79,209,197,0.18)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroName: { fontSize: 34, lineHeight: 40, marginBottom: 18, fontFamily: "Manrope_700Bold" },
  heroRule: { width: 44, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginBottom: 14 },
  heroText: { maxWidth: 300 },
  infoCard: {
    backgroundColor: "rgba(7,27,48,0.48)",
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.18)",
    backdropFilter: "blur(20px)",
  } as any,
  infoHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(79,209,197,0.16)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { flex: 1, fontFamily: "Manrope_600SemiBold" },
  infoText: { lineHeight: 23 },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(87,199,255,0.28)",
    backgroundColor: "rgba(87,199,255,0.10)",
  },
  supportBlock: {
    marginTop: 18,
    alignItems: "center",
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
  trendCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    backgroundColor: "rgba(7,27,48,0.48)",
    borderRadius: 18,
    padding: 16,
    backdropFilter: "blur(20px)",
  } as any,
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(79,209,197,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.2)",
  },
  chartArea: {
    height: 220,
    marginTop: 14,
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
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  axisLine: {
    position: "absolute",
    left: 28,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#05111F",
    borderWidth: 2,
  },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 28,
    marginBottom: 12,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendMark: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  emptyChartCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.18)",
    backgroundColor: "rgba(7,27,48,0.48)",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    backdropFilter: "blur(20px)",
  } as any,
  emptyChartIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(79,209,197,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    marginBottom: 16,
  },
  startQuizBtn: {
    backgroundColor: theme.accentDeep,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: "100%",
    maxWidth: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabelContainer: {
    position: "absolute",
    width: 40,
    alignItems: "center",
  },
});
