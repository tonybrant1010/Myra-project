import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authedFetch } from "@/src/auth/AuthContext";
import { T } from "@/src/components/Typography";
import { theme } from "@/src/theme";

type Props = { token: string | null | undefined; initial?: Record<string, any> | null };

const FIELDS = [
  { key: "local_llm_temperature", label: "Hőmérséklet (temperature)", hint: "alap: 0,6 · tartomány: 0–2", step: 0.1, min: 0, max: 2 },
  { key: "local_llm_top_p", label: "Top-p", hint: "alap: 0,8 · tartomány: 0–1", step: 0.05, min: 0, max: 1 },
  { key: "local_llm_top_k", label: "Top-k", hint: "alap: 20 · tartomány: 0–200", step: 1, min: 0, max: 200 },
  { key: "local_llm_min_p", label: "Min-p", hint: "alap: 0 · tartomány: 0–1", step: 0.05, min: 0, max: 1 },
] as const;

type Key = (typeof FIELDS)[number]["key"];
type Values = Record<Key, string> & { local_llm_thinking: string };

const THINKING_OPTIONS = [
  { value: "", label: "Alapérték" },
  { value: "false", label: "Kikapcsolva" },
  { value: "true", label: "Bekapcsolva" },
] as const;

function nudge(raw: string, delta: number, min: number, max: number, fallback: number): string {
  const current = parseFloat((raw || "").replace(",", "."));
  const base = Number.isFinite(current) ? current : fallback;
  const next = Math.min(max, Math.max(min, Math.round((base + delta) * 1000) / 1000));
  return String(next);
}

const FALLBACKS: Record<Key, number> = {
  local_llm_temperature: 0.6,
  local_llm_top_p: 0.8,
  local_llm_top_k: 20,
  local_llm_min_p: 0,
};

function fromSettings(d: Record<string, any> | null | undefined): Values {
  return {
    local_llm_temperature: String(d?.local_llm_temperature ?? ""),
    local_llm_top_p: String(d?.local_llm_top_p ?? ""),
    local_llm_top_k: String(d?.local_llm_top_k ?? ""),
    local_llm_min_p: String(d?.local_llm_min_p ?? ""),
    local_llm_thinking: String(d?.local_llm_thinking ?? ""),
  };
}

export default function LocalSamplingCard({ token, initial }: Props) {
  const [values, setValues] = useState<Values>(() => fromSettings(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const loading = !initial;

  useEffect(() => {
    if (initial) setValues(fromSettings(initial));
  }, [initial]);

  const setField = (key: keyof Values, v: string) => {
    setMsg(null);
    setErr(null);
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await authedFetch(token as string, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      if (r.ok) {
        setMsg("Mintavétel mentve. Az új értékek a következő üzenettől érvényesek.");
      } else {
        const d = await r.json().catch(() => ({}));
        setErr(d?.detail || "Mentési hiba.");
      }
    } catch (e: any) {
      setErr(e?.message || "Hálózati hiba a mentés során.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card} testID="local-sampling-card">
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="options-outline" size={20} color={theme.accent} />
        </View>
        <T variant="title" color={theme.textOnDark}>Helyi modell mintavétele</T>
      </View>

      <T variant="small" color="rgba(247,251,255,0.66)" style={styles.help}>
        Csak a helyi modellre vonatkozik, és mentés után azonnal érvényes, a modellt nem kell újraindítani.
        Üresen hagyott mezőnél a helyi szerver saját alapértéke él.
      </T>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} />
      ) : (
        FIELDS.map((f) => (
          <View key={f.key}>
            <T variant="caption" color="rgba(247,251,255,0.72)" style={styles.lbl}>{f.label}</T>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setField(f.key, nudge(values[f.key], -f.step, f.min, f.max, FALLBACKS[f.key]))}
                accessibilityLabel={`${f.label} csökkentése`}
              >
                <T variant="label" color={theme.textOnDark}>−</T>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={values[f.key]}
                onChangeText={(v) => setField(f.key, v)}
                placeholder="üres = alapérték"
                placeholderTextColor="rgba(247,251,255,0.35)"
                keyboardType="decimal-pad"
                autoCapitalize="none"
                autoCorrect={false}
                testID={`input-${f.key}`}
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setField(f.key, nudge(values[f.key], f.step, f.min, f.max, FALLBACKS[f.key]))}
                accessibilityLabel={`${f.label} növelése`}
              >
                <T variant="label" color={theme.textOnDark}>+</T>
              </TouchableOpacity>
            </View>
            <T variant="caption" color="rgba(247,251,255,0.5)" style={{ marginTop: 4 }}>{f.hint}</T>
          </View>
        ))
      )}

      {!loading ? (
        <View>
          <T variant="caption" color="rgba(247,251,255,0.72)" style={styles.lbl}>Gondolkodás (enable_thinking)</T>
          <View style={styles.row}>
            {THINKING_OPTIONS.map((o) => {
              const selected = values.local_llm_thinking === o.value;
              return (
                <TouchableOpacity
                  key={o.value || "default"}
                  style={[styles.optBtn, selected && styles.optBtnSelected]}
                  onPress={() => setField("local_llm_thinking", o.value)}
                  testID={`thinking-${o.value || "default"}`}
                >
                  <T variant="small" color={selected ? theme.white : theme.textOnDark}>{o.label}</T>
                </TouchableOpacity>
              );
            })}
          </View>
          <T variant="caption" color="rgba(247,251,255,0.5)" style={{ marginTop: 4 }}>
            alap: a helyi szerver beállítása (most kikapcsolva). A kontextusméret és a gondolkodási keret
            indítási beállítás, azt a helyi szerveren kell módosítani.
          </T>
        </View>
      ) : null}

      {msg ? <T variant="small" color={theme.success} style={styles.feedback}>{msg}</T> : null}
      {err ? <T variant="small" color={theme.danger} style={styles.feedback}>{err}</T> : null}

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving || loading} testID="save-sampling-button">
        {saving ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Mintavétel mentése</T>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(6,19,32,0.58)",
    padding: 18,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(87,199,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  help: { marginBottom: 6, lineHeight: 20 },
  lbl: { marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    fontSize: 15,
    color: theme.textOnDark,
    fontFamily: "Manrope_400Regular",
  },
  stepBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  optBtn: {
    flexGrow: 1,
    flexBasis: "30%",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  optBtnSelected: { backgroundColor: theme.accentDeep, borderColor: theme.accentDeep },
  feedback: { marginTop: 10 },
  saveBtn: {
    marginTop: 14,
    backgroundColor: theme.accentDeep,
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
