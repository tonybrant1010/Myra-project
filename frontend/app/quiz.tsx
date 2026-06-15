import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";

type ScaleOpt = { value: number; label: string };
type Section = { id: string; title: string; intro: string; scale: ScaleOpt[]; questions: string[] };

export default function QuizScreen() {
  useAuthGuard();
  const router = useRouter();
  const { token, setUserLocal } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [showConsent, setShowConsent] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch(token, "/api/quiz/questions");
        if (r.ok) {
          const data = await r.json();
          setSections(data.sections || []);
        } else {
          setError("Nem sikerült betölteni a kérdéseket.");
        }
      } catch (e: any) {
        setError(e?.message || "Hálózati hiba.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const totalQuestions = useMemo(() => sections.reduce((n, s) => n + s.questions.length, 0), [sections]);
  const section = sections[sectionIdx];
  const sectionQs = section?.questions || [];
  const sectionAnsweredCount = sectionQs.reduce((acc, _q, i) => acc + (answers[`${section?.id}-${i}`] !== undefined ? 1 : 0), 0);
  const allAnsweredCount = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? allAnsweredCount / totalQuestions : 0;

  const setAnswer = (key: string, value: number) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setError(null);
  };

  const goNext = () => {
    if (sectionAnsweredCount < sectionQs.length) {
      setError("Kérlek, válaszolj minden kérdésre ezen az oldalon.");
      return;
    }
    setError(null);
    if (sectionIdx < sections.length - 1) {
      setSectionIdx((i) => i + 1);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 0);
      return;
    }
    submit();
  };

  const goBack = () => {
    setError(null);
    if (sectionIdx > 0) setSectionIdx((i) => i - 1);
    else router.replace("/welcome");
  };

  const submit = async () => {
    if (allAnsweredCount !== totalQuestions) {
      setError("Még maradt kitöltetlen kérdés.");
      return;
    }
    setSubmitting(true);
    try {
      const ordered: number[] = [];
      for (const s of sections) {
        for (let i = 0; i < s.questions.length; i++) ordered.push(answers[`${s.id}-${i}`]);
      }
      const r = await authedFetch(token, "/api/quiz/submit", { method: "POST", body: JSON.stringify({ answers: ordered }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.detail || "Beküldési hiba.");
        setSubmitting(false);
        return;
      }
      setUserLocal((u) => (u ? { ...u, state_code: data.code } : u));
      router.replace({ pathname: "/quiz-result", params: { code: data.code } });
    } catch (e: any) {
      setError(e?.message || "Hálózati hiba.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Kérdőív" />
        <ContentBackground>
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  if (!section) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Kérdőív" />
        <ContentBackground>
          <View style={styles.center}><T variant="body" color={theme.danger}>Nem sikerült betölteni a kérdőívet.</T></View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  if (showConsent) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Kérdőív" />
        <ContentBackground>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.sectionHeader, shadow.card]}>
              <View pointerEvents="none" style={styles.sectionSheen} />
              <T variant="caption" color={theme.accentSoft}>TÁJÉKOZTATÁS ÉS HOZZÁJÁRULÁS</T>
              <T variant="display" color={theme.textOnDark} style={styles.sectionTitle}>Mérés indítása</T>
              <T variant="body" color="rgba(247,251,255,0.72)" style={styles.sectionIntro}>
                A Myra kérdőíves állapotfelmérése az ESV-modell (Érzelem-Stressz-Viselkedés) alapján segít feltérképezni a pillanatnyi közérzetedet és testi-lelki stressz-szintedet.
              </T>
            </LinearGradient>

            <View style={[styles.qCard, shadow.card]}>
              <T variant="bodyLg" color={theme.textOnDark} style={{ marginBottom: 12, fontFamily: "Manrope_700Bold" }}>Fontos tudnivalók:</T>
              <View style={{ gap: 10, marginBottom: 16 }}>
                <T variant="body" color="rgba(247,251,255,0.80)">
                  • <T color={theme.textOnDark} style={{ fontFamily: "Manrope_700Bold" }}>Nem diagnózis:</T> A kapott állapotkód és a profil kizárólag önismereti célú, nem minősül orvosi, pszichológiai vagy egyéb klinikai diagnózisnak.
                </T>
                <T variant="body" color="rgba(247,251,255,0.80)">
                  • <T color={theme.textOnDark} style={{ fontFamily: "Manrope_700Bold" }}>Nem orvostechnikai eszköz:</T> A rendszer nem alkalmas betegségek megelőzésére, diagnosztizálására vagy kezelésére.
                </T>
                <T variant="body" color="rgba(247,251,255,0.80)">
                  • <T color={theme.textOnDark} style={{ fontFamily: "Manrope_700Bold" }}>Adatkezelési hozzájárulás:</T> A kérdésekre adott válaszaid mentális és testi stresszre utaló, érzékeny adatokat tartalmazhatnak. A mérés elindításával kifejezetten és önkéntesen hozzájárulsz ezek feldolgozásához az állapotkódod képzése és az önismereti csevegés céljából.
                </T>
                <T variant="body" color="rgba(247,251,255,0.80)">
                  • <T color={theme.textOnDark} style={{ fontFamily: "Manrope_700Bold" }}>Érvényességi idő:</T> A méréssel egy egyéni, 30 napos ciklus indul el. A Myra ezen időszak alatt támogat a kapott állapotkód alapján. A 30 nap letelte után a beszélgetés archiválásra kerül (visszaolvasható marad), és új mérést végezhetsz a folytatáshoz.
                </T>
              </View>

              <TouchableOpacity style={styles.consentBtn} onPress={() => setShowConsent(false)} activeOpacity={0.85}>
                <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.consentGradient}>
                  <T variant="title" color={theme.white}>Elfogadom és megkezdem</T>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelConsentBtn} onPress={() => router.replace("/welcome")} activeOpacity={0.80}>
                <T variant="title" color={theme.textOnDark}>Mégse</T>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="quiz-screen">
      <TopBar title={`Kérdőív · ${sectionIdx + 1}/${sections.length}`} />
      <ContentBackground>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} testID="quiz-progress" />
        </View>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={[styles.sectionHeader, shadow.card]}>
            <View pointerEvents="none" style={styles.sectionSheen} />
            <T variant="caption" color={theme.accentSoft}>{`${sectionIdx + 1}. SZAKASZ`}</T>
            <T variant="display" color={theme.textOnDark} style={styles.sectionTitle}>{section.title}</T>
            <T variant="body" color="rgba(247,251,255,0.72)" style={styles.sectionIntro}>{section.intro}</T>
          </LinearGradient>

          {section.questions.map((q, qi) => {
            const key = `${section.id}-${qi}`;
            const current = answers[key];
            return (
              <View key={key} style={[styles.qCard, shadow.card]} testID={`question-${key}`}>
                <T variant="bodyLg" color={theme.textOnDark}>{`${qi + 1}. ${q}`}</T>
                <View style={styles.scaleRow}>
                  {section.scale.map((opt) => {
                    const selected = current === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.scaleBtn, selected && styles.scaleBtnSelected]}
                        onPress={() => setAnswer(key, opt.value)}
                        testID={`answer-${key}-${opt.value}`}
                        activeOpacity={0.85}
                      >
                        <T variant="label" color={selected ? theme.white : theme.textOnDark} style={{ fontSize: 16 }}>{opt.value}</T>
                        <T variant="small" color={selected ? theme.white : "rgba(247,251,255,0.62)"} align="center" style={{ fontSize: 10, marginTop: 2 }}>
                          {opt.label}
                        </T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {error ? <T variant="small" color={theme.danger} align="center" testID="quiz-error">{error}</T> : null}
          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="quiz-back">
            <T variant="title" color={theme.textOnDark}>{sectionIdx === 0 ? "Mégse" : "Vissza"}</T>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.nextBtn, submitting && { opacity: 0.6 }]} onPress={goNext} disabled={submitting} testID="quiz-next" activeOpacity={0.85}>
            <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nextGradient}>
              {submitting ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>{sectionIdx === sections.length - 1 ? "Eredmény" : "Tovább"}</T>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  progressTrack: { height: 5, backgroundColor: "rgba(255,255,255,0.20)", marginHorizontal: 18, marginTop: 14, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: theme.accent },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  sectionHeader: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: "linear-gradient(135deg, rgba(87,199,255,0.16), transparent 48%, rgba(139,143,232,0.10))",
  } as any,
  sectionTitle: { marginTop: 6, fontSize: 34, lineHeight: 40 },
  sectionIntro: { marginTop: 8 },
  qCard: {
    backgroundColor: "rgba(6,19,32,0.58)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(18px)",
  },
  scaleRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  scaleBtn: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  scaleBtnSelected: { backgroundColor: theme.accentDeep, borderColor: theme.accentDeep },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(6,19,32,0.62)", backdropFilter: "blur(18px)" },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: { flex: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  nextGradient: { width: "100%", paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  consentBtn: { marginTop: 20, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  consentGradient: { width: "100%", paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  cancelConsentBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center", marginTop: 10 },
});
