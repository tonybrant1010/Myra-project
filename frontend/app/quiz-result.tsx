import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { shadow, theme } from "@/src/theme";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";

type GoalSuggestion = { text: string; scale: string };

type InterpretationScale = {
  key: string;
  label: string;
  pomp: number;
  band: number;
  band_label: string;
  text: string;
};

type Interpretation = {
  scales: InterpretationScale[];
  overall: { code: string; title: string; severity: string } | null;
  disclaimer: string;
};

export default function QuizResultScreen() {
  useAuthGuard();
  const router = useRouter();
  const { token } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<{ code?: string; title?: string; severity?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [focusLabel, setFocusLabel] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [goalSlots, setGoalSlots] = useState(0);
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsSavedCount, setGoalsSavedCount] = useState<number | null>(null);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch(token, "/api/codes/me");
        if (r.ok) {
          const data = await r.json();
          setProfile(data.profile || null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch(token, "/api/quiz/interpretation");
        if (!r.ok) return;
        const data = await r.json();
        setInterpretation(data || null);
      } catch {
        // az értelmezés opcionális kiegészítés — hiba esetén nem jelenik meg
      }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch(token, "/api/goals/suggest");
        if (!r.ok) return;
        const data = await r.json();
        setSuggestions(data.suggestions || []);
        setFocusLabel(data.focus_scale_label || "");
        setGoalSlots(Math.max(0, (data.max_active || 0) - (data.active_count || 0)));
      } catch {
        // a céljavaslat opcionális — hiba esetén egyszerűen nem jelenik meg
      }
    })();
  }, [token]);

  const toggleSuggestion = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < Math.max(goalSlots, 0)) {
        next.add(index);
      }
      return next;
    });
  }, [goalSlots]);

  const acceptGoals = useCallback(async () => {
    if (selected.size === 0 || goalsSaving) return;
    setGoalsSaving(true);
    try {
      const items = [...selected]
        .map((i) => suggestions[i])
        .filter(Boolean)
        .map((s) => ({ text: s.text, scale: s.scale }));
      const r = await authedFetch(token, "/api/goals", { method: "POST", body: JSON.stringify({ items }) });
      if (r.ok) {
        const data = await r.json();
        setGoalsSavedCount((data.created || []).length);
      }
    } catch {
      // csendes hiba — a felhasználó később a főoldalról is próbálkozhat
    } finally {
      setGoalsSaving(false);
    }
  }, [goalsSaving, selected, suggestions, token]);

  const displayCode = code || profile?.code || "----";
  const codeFontSize = width < 480 ? 52 : 64;
  const codeLineHeight = codeFontSize + 8;
  const showGoals = suggestions.length > 0 && goalSlots > 0;

  return (
    <SafeAreaView style={styles.safe} testID="quiz-result-screen">
      <ContentBackground>
        <TopBar title="Mérési eredmény" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.resultPanel, shadow.card]}>
            <View style={[styles.resultSheen, styles.noPointer]} />
            <T variant="caption" color={theme.accentSoft} style={styles.caption}>
              A te állapotkódod
            </T>

            <View style={styles.codeWrap} testID="result-code">
              {String(displayCode).split("").map((d, i) => (
                <View key={i} style={styles.digitBox}>
                  <T
                    variant="hero"
                    color={theme.textOnDark}
                    style={{ fontSize: codeFontSize, lineHeight: codeLineHeight, letterSpacing: 0 }}
                  >
                    {d}
                  </T>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
            ) : profile ? (
              <View style={styles.profileBlock}>
                {profile.severity ? (
                  <View style={styles.sevTag}>
                    <T variant="caption" color={theme.accentSoft} style={{ fontSize: 10, letterSpacing: 1.6 }}>
                      {profile.severity}
                    </T>
                  </View>
                ) : null}
              </View>
            ) : null}

            <T variant="body" color="rgba(247,251,255,0.72)" align="center" style={styles.note}>
              A mérés sikeresen lezárult. Myra már felkészült a fogadásodra - személyre szabott beszélgetéssel vár.
            </T>
          </LinearGradient>

          {interpretation ? (
            <View style={[styles.goalsCard, shadow.card]} testID="result-interpretation-card">
              <View style={styles.goalsHead}>
                <View style={styles.goalsIcon}>
                  <Ionicons name="reader-outline" size={16} color={theme.accentSoft} />
                </View>
                <T variant="caption" color={theme.accentSoft} style={{ flex: 1, letterSpacing: 1.4 }}>
                  MIT JELENT AZ EREDMÉNYED?
                </T>
              </View>
              {interpretation.overall ? (
                <T variant="small" color="rgba(247,251,255,0.78)" style={{ marginBottom: 12, lineHeight: 19 }}>
                  Összkép: {interpretation.overall.title}
                  {interpretation.overall.severity ? ` (${interpretation.overall.severity})` : ""}
                </T>
              ) : null}
              {interpretation.scales.map((s) => (
                <View key={s.key} style={styles.interpRow}>
                  <View style={styles.interpHead}>
                    <T variant="small" color={theme.textOnDark} style={{ fontWeight: "700", flex: 1 }}>
                      {s.label}
                    </T>
                    <View style={styles.interpChip}>
                      <T variant="small" color={theme.accentSoft} style={{ fontSize: 10 }}>
                        {s.band_label} · {s.pomp}
                      </T>
                    </View>
                  </View>
                  <T variant="small" color="rgba(247,251,255,0.72)" style={{ lineHeight: 19, marginTop: 4 }}>
                    {s.text}
                  </T>
                </View>
              ))}
              <T variant="small" color="rgba(247,251,255,0.5)" style={{ fontSize: 10.5, lineHeight: 15, marginTop: 6 }}>
                {interpretation.disclaimer}
              </T>
            </View>
          ) : null}

          {showGoals ? (
            <View style={[styles.goalsCard, shadow.card]} testID="result-goals-card">
              <View style={styles.goalsHead}>
                <View style={styles.goalsIcon}>
                  <Ionicons name="flag-outline" size={16} color={theme.accentSoft} />
                </View>
                <T variant="caption" color={theme.accentSoft} style={{ flex: 1, letterSpacing: 1.4 }}>
                  APRÓ CÉLOK A KÖVETKEZŐ HETEKRE
                </T>
              </View>
              <T variant="small" color="rgba(247,251,255,0.66)" style={{ marginBottom: 12, lineHeight: 19 }}>
                {focusLabel
                  ? `A mérésed alapján most a ${focusLabel} területét érdemes egy kicsit támogatni. Válassz legfeljebb ${goalSlots} apró vállalást — Myra időnként finoman visszakérdez majd rájuk.`
                  : "Válassz apró vállalásokat — Myra időnként finoman visszakérdez majd rájuk."}
              </T>

              {goalsSavedCount === null ? (
                <>
                  {suggestions.map((s, i) => {
                    const isOn = selected.has(i);
                    return (
                      <TouchableOpacity
                        key={`${s.scale}-${i}`}
                        style={[styles.goalRow, isOn && styles.goalRowOn]}
                        onPress={() => toggleSuggestion(i)}
                        activeOpacity={0.8}
                        testID={`result-goal-${i}`}
                      >
                        <Ionicons
                          name={isOn ? "checkmark-circle" : "ellipse-outline"}
                          size={20}
                          color={isOn ? theme.accent : "rgba(247,251,255,0.5)"}
                        />
                        <T variant="small" color={isOn ? theme.textOnDark : "rgba(247,251,255,0.78)"} style={styles.goalText}>
                          {s.text}
                        </T>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.goalsAcceptBtn, selected.size === 0 && styles.goalsAcceptBtnDisabled]}
                    onPress={acceptGoals}
                    disabled={selected.size === 0 || goalsSaving}
                    activeOpacity={0.85}
                    testID="result-goals-accept"
                  >
                    {goalsSaving ? (
                      <ActivityIndicator color={theme.white} size="small" />
                    ) : (
                      <T variant="label" color={theme.white} style={{ fontWeight: "700" }}>
                        {selected.size > 0 ? `${selected.size} cél elfogadása` : "Válassz célt, ha szeretnél"}
                      </T>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.goalsDoneWrap}>
                  <Ionicons name="checkmark-done-outline" size={20} color={theme.accent} />
                  <T variant="small" color="rgba(247,251,255,0.78)" style={{ flex: 1, lineHeight: 19 }}>
                    {goalsSavedCount > 0
                      ? "Elmentve. A céljaidat a főoldalon találod, és Myra is tud róluk."
                      : "Rendben, most nem választottál célt — később a főoldalról is beállíthatod."}
                  </T>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.ctaBlock}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/chat")} testID="result-start-chat" activeOpacity={0.88}>
              <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
                <Ionicons name="chatbubble-ellipses" size={18} color={theme.white} />
                <T variant="title" color={theme.white}>Beszélgetés Myrával</T>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/welcome")} testID="result-goto-welcome" activeOpacity={0.88}>
              <T variant="title" color={theme.textOnDark}>Vissza a főoldalra</T>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: "none" },
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flexGrow: 1, padding: 18, justifyContent: "space-between" },
  resultPanel: {
    flexGrow: 1,
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  resultSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "radial-gradient(ellipse at 78% 10%, rgba(87,199,255,0.18), transparent 38%), linear-gradient(135deg, rgba(139,143,232,0.10), transparent 46%)",
  } as any,
  caption: { fontSize: 10, letterSpacing: 2 },
  codeWrap: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 26 },
  digitBox: {
    width: 66,
    height: 78,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileBlock: { alignItems: "center", width: "100%", maxWidth: 440, marginTop: 24 },
  sevTag: { backgroundColor: "rgba(87,199,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  note: { maxWidth: 430, alignSelf: "center", marginTop: 22, lineHeight: 23 },
  goalsCard: {
    backgroundColor: "rgba(7,27,48,0.48)",
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.18)",
    backdropFilter: "blur(20px)",
  } as any,
  goalsHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  goalsIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(79,209,197,0.16)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  goalRowOn: {
    borderColor: "rgba(79,209,197,0.45)",
    backgroundColor: "rgba(79,209,197,0.10)",
  },
  goalText: { flex: 1, lineHeight: 19 },
  interpRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  interpHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  interpChip: {
    backgroundColor: "rgba(87,199,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(87,199,255,0.28)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  goalsAcceptBtn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentDeep,
    marginTop: 4,
  },
  goalsAcceptBtnDisabled: { opacity: 0.45 },
  goalsDoneWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  ctaBlock: { gap: 10, marginTop: 12 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  primaryGradient: { width: "100%", minHeight: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
