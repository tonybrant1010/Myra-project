import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";

type ScaleOpt = { value: number; label: string };
type Section = {
  id: string;
  title: string;
  intro: string;
  scale: ScaleOpt[];
  questions: string[];
};

export default function QuizScreen() {
  const router = useRouter();
  const { token, setUserLocal } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionIdx, setSectionIdx] = useState(0);
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
        setError(e?.message || "Hálózati hiba");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const flat = useMemo(() => {
    let n = 0;
    sections.forEach((s) => {
      n += s.questions.length;
    });
    return n;
  }, [sections]);

  const section = sections[sectionIdx];
  const sectionQs = section?.questions || [];
  const sectionAnsweredCount = sectionQs.reduce(
    (acc, _q, i) => acc + (answers[`${section?.id}-${i}`] !== undefined ? 1 : 0),
    0,
  );
  const allAnsweredCount = Object.keys(answers).length;
  const progress = flat > 0 ? allAnsweredCount / flat : 0;

  const setAnswer = (key: string, value: number) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setError(null);
  };

  const goNext = () => {
    if (sectionAnsweredCount < sectionQs.length) {
      setError("Kérlek válaszolj minden kérdésre ezen az oldalon.");
      return;
    }
    setError(null);
    if (sectionIdx < sections.length - 1) {
      setSectionIdx((i) => i + 1);
      return;
    }
    submit();
  };

  const goBack = () => {
    setError(null);
    if (sectionIdx > 0) setSectionIdx((i) => i - 1);
    else router.back();
  };

  const submit = async () => {
    if (allAnsweredCount !== flat) {
      setError("Még maradt kitöltetlen kérdés.");
      return;
    }
    setSubmitting(true);
    try {
      const ordered: number[] = [];
      for (const s of sections) {
        for (let i = 0; i < s.questions.length; i++) {
          ordered.push(answers[`${s.id}-${i}`]);
        }
      }
      const r = await authedFetch(token, "/api/quiz/submit", {
        method: "POST",
        body: JSON.stringify({ answers: ordered }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.detail || "Beküldési hiba");
        setSubmitting(false);
        return;
      }
      setUserLocal((u) => (u ? { ...u, state_code: data.code } : u));
      router.replace({ pathname: "/quiz-result", params: { code: data.code } });
    } catch (e: any) {
      setError(e?.message || "Hálózati hiba");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Kérdőív" />
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!section) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Kérdőív" />
        <View style={styles.center}>
          <T variant="body" color={theme.danger}>Nem sikerült betölteni a kérdőívet.</T>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="quiz-screen">
      <TopBar title={`Kérdőív · ${sectionIdx + 1}/${sections.length}`} />

      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
          testID="quiz-progress"
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <T variant="caption">{`${sectionIdx + 1}. SZAKASZ`}</T>
        <T variant="display" style={{ marginTop: 6 }}>
          {section.title}
        </T>
        <T variant="body" color={theme.textSecondary} style={{ marginTop: 8, marginBottom: 20 }}>
          {section.intro}
        </T>

        {section.questions.map((q, qi) => {
          const key = `${section.id}-${qi}`;
          const current = answers[key];
          return (
            <View key={key} style={[styles.qCard, shadow.card]} testID={`question-${key}`}>
              <T variant="bodyLg">{`${qi + 1}. ${q}`}</T>
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
                      <T
                        variant="label"
                        color={selected ? theme.white : theme.textPrimary}
                        style={{ fontSize: 16 }}
                      >
                        {opt.value}
                      </T>
                      <T
                        variant="small"
                        color={selected ? theme.white : theme.textSecondary}
                        align="center"
                        style={{ fontSize: 10, marginTop: 2 }}
                      >
                        {opt.label}
                      </T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {error ? (
          <T variant="small" color={theme.danger} align="center" testID="quiz-error">
            {error}
          </T>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="quiz-back">
          <T variant="title" color={theme.primary} style={{ fontWeight: "bold" }}>
            {sectionIdx === 0 ? "Mégse" : "Vissza"}
          </T>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, submitting && { opacity: 0.6 }]}
          onPress={goNext}
          disabled={submitting}
          testID="quiz-next"
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <T variant="title" color={theme.white} style={{ fontWeight: "bold" }}>
              {sectionIdx === sections.length - 1 ? "Eredmény" : "Tovább"}
            </T>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  progressTrack: {
    height: 2,
    backgroundColor: theme.borderSoft,
    marginHorizontal: 24,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 2, backgroundColor: theme.accent },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  qCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  scaleRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  scaleBtn: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleBtnSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: theme.borderSoft,
    backgroundColor: theme.bg,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
});