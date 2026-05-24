import React, { useEffect, useState, useCallback } from "react";
import {
  View, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
// A 'fonts' és az 'Ionicons' importot eltávolítottuk
import { theme, shadow } from "@/src/theme";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";

type Settings = {
  llm_provider: "openai" | "anthropic" | "gemini" | "groq";
  llm_model: string;
  llm_api_key_set: boolean;
  llm_api_key_preview: string;
  system_prompt: string;
  kb_text: string;
  suggested_models: Record<string, string[]>;
};

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini" | "groq">("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [kb, setKb] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authedFetch(token, "/api/admin/settings");
    if (r.ok) {
      const d: Settings = await r.json();
      setData(d);
      setProvider(d.llm_provider);
      setModel(d.llm_model);
      setPrompt(d.system_prompt);
      setKb(d.kb_text);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    const body: any = { llm_provider: provider, llm_model: model, system_prompt: prompt, kb_text: kb };
    if (apiKey) body.llm_api_key = apiKey;
    const r = await authedFetch(token, "/api/admin/settings", { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (r.ok) {
      setMsg("Beállítások mentve.");
      setApiKey("");
      load();
    } else {
      try { const d = await r.json(); setErr(d?.detail || "Mentési hiba"); } catch { setErr("Mentési hiba"); }
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}><TopBar title="Beállítások" showBack />
        <View style={styles.center}><T variant="body" color={theme.danger}>Nincs jogosultságod ehhez.</T></View>
      </SafeAreaView>
    );
  }

  const suggested = data?.suggested_models?.[provider] || [];

  return (
    <SafeAreaView style={styles.safe} testID="admin-settings-screen">
      <TopBar title="Chatbot beállítások" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Provider */}
            <T variant="caption" style={styles.section}>NYELVI MODELL</T>
            <View style={styles.providerRow}>
              {(["openai", "anthropic", "gemini", "groq"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.provBtn, provider === p && styles.provBtnSelected]}
                  onPress={() => setProvider(p)}
                  testID={`provider-${p}`}
                >
                  <T variant="label" color={provider === p ? theme.white : theme.textPrimary}>
                    {p === "openai" ? "OpenAI"
                      : p === "anthropic" ? "Anthropic"
                      : p === "gemini" ? "Gemini"
                      : "Groq"}
                  </T>
                </TouchableOpacity>
              ))}
            </View>

            <T variant="label" style={styles.lbl}>Modell neve</T>
            <TextInput style={styles.input} value={model} onChangeText={setModel} autoCapitalize="none" placeholder="pl. gemini-2.5-flash" placeholderTextColor={theme.textSecondary} testID="model-input" />
            <View style={styles.chipsRow}>
              {suggested.map((m) => (
                <TouchableOpacity key={m} style={styles.chip} onPress={() => setModel(m)} testID={`model-chip-${m}`}>
                  <T variant="small" color={theme.primary}>{m}</T>
                </TouchableOpacity>
              ))}
            </View>

            {/* API key */}
            <T variant="label" style={styles.lbl}>API kulcs</T>
            <View style={styles.kbRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={data?.llm_api_key_set ? `Beállítva (${data.llm_api_key_preview})` : "API kulcs"}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                testID="api-key-input"
              />
            </View>
            <T variant="small" color={theme.textSecondary} style={{ marginTop: 6 }}>
              {provider === "openai" ? "platform.openai.com/api-keys" :
                provider === "anthropic" ? "console.anthropic.com/settings/keys" :
                provider === "groq" ? "console.groq.com/keys" :
                  "aistudio.google.com/apikey"} oldalon kapsz egyet.
            </T>

            {/* System prompt */}
            <T variant="caption" style={[styles.section, { marginTop: 24 }]}>SYSTEM PROMPT</T>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              placeholder="A Myra chatbot system promptja…"
              placeholderTextColor={theme.textSecondary}
              testID="prompt-input"
            />

            {/* Knowledge base */}
            <T variant="caption" style={[styles.section, { marginTop: 24 }]}>TUDÁSANYAG</T>
            <T variant="small" color={theme.textSecondary}>
              Bemásolható szöveg, vagy PDF/TXT feltöltés alább.
            </T>
            <TextInput
              style={[styles.input, styles.textarea, { minHeight: 200, marginTop: 8 }]}
              value={kb}
              onChangeText={setKb}
              multiline
              placeholder="A tudásanyag teljes szövege…"
              placeholderTextColor={theme.textSecondary}
              testID="kb-input"
            />
            <UploadKBButton token={token} onUploaded={(text) => setKb(text)} />

            {msg ? <T variant="small" color={theme.primary} style={{ marginTop: 12 }}>{msg}</T> : null}
            {err ? <T variant="small" color={theme.danger} style={{ marginTop: 12 }}>{err}</T> : null}

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="save-button">
              {saving ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Mentés</T>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UploadKBButton({ token, onUploaded }: { token: string | null; onUploaded: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const pick = async () => {
    if (Platform.OS !== "web") {
      try {
        const dp = await import("expo-document-picker");
        const res: any = await dp.getDocumentAsync({ type: ["application/pdf", "text/plain"], copyToCacheDirectory: true });
        if (res?.canceled || !res?.assets?.[0]) return;
        const asset = res.assets[0];
        const r = await fetch(asset.uri);
        const blob = await r.blob();
        await upload(new File([blob], asset.name || "kb.pdf", { type: blob.type }));
      } catch (e: any) {
        setInfo("Telepítsd az expo-document-pickert a mobil feltöltéshez.");
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (file) await upload(file);
    };
    input.click();
  };

  const upload = async (file: any) => {
    setBusy(true); setInfo(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/kb/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setInfo(d?.detail || "Feltöltési hiba"); }
      else {
        const d = await r.json();
        setInfo(`Hozzáadva: ${d.added_chars.toLocaleString("hu-HU")} karakter (összesen: ${d.total_chars.toLocaleString("hu-HU")}).`);
        const s = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (s.ok) { const d2 = await s.json(); onUploaded(d2.kb_text || ""); }
      }
    } catch (e: any) {
      setInfo(e?.message || "Hiba");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity style={uploadStyles.btn} onPress={pick} disabled={busy} testID="kb-upload">
        {/* Ikon eltávolítva */}
        <T variant="label" color={theme.primary}>
          {busy ? "Feldolgozás…" : "PDF / TXT feltöltése"}
        </T>
      </TouchableOpacity>
      {info ? <T variant="small" color={theme.textSecondary} style={{ marginTop: 8 }}>{info}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 22, paddingBottom: 60 },
  section: { marginBottom: 12 },
  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  provBtn: { flexGrow: 1, flexBasis: "22%", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, alignItems: "center", backgroundColor: theme.surface },
  provBtnSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  lbl: { marginTop: 14, marginBottom: 6, letterSpacing: 1.2, fontSize: 11, textTransform: "uppercase", color: theme.textSecondary },
  // Kivettem innen a fontFamily: fonts.body hivatkozást
  input: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, fontSize: 15, color: theme.textPrimary },
  textarea: { minHeight: 140, textAlignVertical: "top" },
  kbRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  saveBtn: { marginTop: 28, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
});
const uploadStyles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: theme.primary },
});