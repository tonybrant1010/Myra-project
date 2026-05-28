import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import { T } from "@/src/components/Typography";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";

type Settings = {
  llm_provider: "openai" | "anthropic" | "gemini" | "groq" | "cerebras" | "mistral";
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
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini" | "groq" | "cerebras" | "mistral">("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [kb, setKb] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cacheBuilding, setCacheBuilding] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [showModelDrop, setShowModelDrop] = useState(false);

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

  const extractKb = async () => {
    setExtracting(true);
    setExtractMsg(null);
    try {
      const r = await authedFetch(token, "/api/admin/extract-kb", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setExtractMsg(`Kész: ${d.pdf_count} PDF, ${d.total_chars?.toLocaleString("hu-HU")} karakter betöltve.`);
        load();
      } else {
        setExtractMsg(`Hiba: ${d?.detail || "Ismeretlen hiba"}`);
      }
    } catch (e: any) {
      setExtractMsg(`Hálózati hiba: ${e?.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const initCache = async () => {
    setCacheBuilding(true);
    setCacheMsg(null);
    try {
      const r = await authedFetch(token, "/api/admin/init-cache", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setCacheMsg(`Cache létrehozva (${d.pdf_count} PDF). Neve: ${d.cache_name}`);
      } else {
        setCacheMsg(`Hiba: ${d?.detail || "Ismeretlen hiba"}`);
      }
    } catch (e: any) {
      setCacheMsg(`Hálózati hiba: ${e?.message}`);
    } finally {
      setCacheBuilding(false);
    }
  };

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const body: any = { llm_provider: provider, llm_model: model, system_prompt: prompt, kb_text: kb };
      if (apiKey) body.llm_api_key = apiKey;
      const r = await authedFetch(token, "/api/admin/settings", { method: "PUT", body: JSON.stringify(body) });
      if (r.ok) {
        setMsg("Beállítások mentve.");
        setApiKey("");
        load();
      } else {
        try { const d = await r.json(); setErr(d?.detail || "Mentési hiba"); } catch { setErr("Mentési hiba"); }
      }
    } catch (e: any) {
      setErr(e?.message || "Hálózati hiba a mentés során.");
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Beállítások" showBack />
        <ContentBackground>
          <View style={styles.center}><T variant="body" color={theme.danger}>Nincs jogosultságod ehhez.</T></View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  const suggested = data?.suggested_models?.[provider] || [];

  return (
    <SafeAreaView style={styles.safe} testID="admin-settings-screen">
      <TopBar title="Chatbot beállítások" showBack />
      <ContentBackground>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {/* Provider */}
              <T variant="caption" style={styles.section}>NYELVI MODELL</T>
              <View style={styles.providerRow}>
                {(["openai", "anthropic", "gemini", "groq", "cerebras", "mistral"] as const).map((p) => (
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
                        : p === "groq" ? "Groq"
                        : p === "cerebras" ? "Cerebras"
                        : "Mistral"}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>

              <T variant="label" style={styles.lbl}>Modell neve</T>
              <View>
                <View style={styles.comboRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={model}
                    onChangeText={(v) => { setModel(v); setShowModelDrop(true); }}
                    onFocus={() => setShowModelDrop(true)}
                    autoCapitalize="none"
                    placeholder="Válassz vagy írj be modellnevet…"
                    placeholderTextColor={theme.textSecondary}
                    testID="model-input"
                  />
                  <TouchableOpacity
                    style={styles.dropArrow}
                    onPress={() => setShowModelDrop((v) => !v)}
                  >
                    <T variant="label" color={theme.textSecondary}>{showModelDrop ? "▲" : "▼"}</T>
                  </TouchableOpacity>
                </View>
                {showModelDrop && suggested.length > 0 && (
                  <View style={styles.dropList}>
                    {suggested.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.dropItem, model === m && styles.dropItemSelected]}
                        onPress={() => { setModel(m); setShowModelDrop(false); }}
                        testID={`model-option-${m}`}
                      >
                        <T variant="small" color={model === m ? theme.white : theme.textPrimary}>{m}</T>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
                  provider === "cerebras" ? "cloud.cerebras.ai/api-keys" :
                  provider === "mistral" ? "console.mistral.ai/api-keys" :
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
              <TouchableOpacity style={[uploadStyles.btn, { marginTop: 8 }]} onPress={extractKb} disabled={extracting} testID="extract-kb-button">
                <T variant="label" color={theme.primary}>
                  {extracting ? "Feldolgozás…" : "PDF-ek beolvasása a szerverről"}
                </T>
              </TouchableOpacity>
              {extractMsg ? <T variant="small" color={theme.textSecondary} style={{ marginTop: 8 }}>{extractMsg}</T> : null}

              {msg ? <T variant="small" color={theme.primary} style={{ marginTop: 12 }}>{msg}</T> : null}
              {err ? <T variant="small" color={theme.danger} style={{ marginTop: 12 }}>{err}</T> : null}

              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="save-button">
                {saving ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Mentés</T>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backupBtn}
                onPress={() => {
                  const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/backup`;
                  if (Platform.OS === "web") {
                    const a = document.createElement("a");
                    a.href = url;
                    a.setAttribute("Authorization", `Bearer ${token}`);
                    // fetch-szel töltjük le, hogy az auth header átmenjen
                    authedFetch(token, "/api/admin/backup").then(async (r) => {
                      if (!r.ok) return;
                      const blob = await r.blob();
                      const burl = URL.createObjectURL(blob);
                      const a2 = document.createElement("a");
                      a2.href = burl;
                      const now = new Date();
                      a2.download = `myra_backup_${now.toISOString().slice(0,10)}.db`;
                      document.body.appendChild(a2);
                      a2.click();
                      document.body.removeChild(a2);
                      URL.revokeObjectURL(burl);
                    });
                  }
                }}
                testID="backup-button"
              >
                <T variant="label" color={theme.primary}>⬇ Adatbázis mentés letöltése</T>
              </TouchableOpacity>

              {provider === "gemini" && (
                <View style={{ marginTop: 16 }}>
                  <T variant="caption" style={[styles.section, { marginTop: 8 }]}>CONTEXT CACHING (GEMINI)</T>
                  <T variant="small" color={theme.textSecondary} style={{ marginBottom: 10 }}>
                    A PDF tudásanyagot és a system promptot a Google szerverein tároljuk. Minden chat üzenet 75%-kal olcsóbb lesz. Mentés után inicializáld, ha változott a prompt vagy a PDF-ek.
                  </T>
                  <TouchableOpacity style={styles.cacheBtn} onPress={initCache} disabled={cacheBuilding} testID="init-cache-button">
                    {cacheBuilding
                      ? <ActivityIndicator color={theme.primary} />
                      : <T variant="label" color={theme.primary}>Cache inicializálása (PDF-ek feltöltése)</T>}
                  </TouchableOpacity>
                  {cacheMsg ? <T variant="small" color={theme.textSecondary} style={{ marginTop: 8 }}>{cacheMsg}</T> : null}
                </View>
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </ContentBackground>
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
        <T variant="label" color={theme.primary}>
          {busy ? "Feldolgozás…" : "PDF / TXT feltöltése"}
        </T>
      </TouchableOpacity>
      {info ? <T variant="small" color={theme.textSecondary} style={{ marginTop: 8 }}>{info}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 22, paddingBottom: 60 },
  section: { marginBottom: 12 },
  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  provBtn: { flexGrow: 1, flexBasis: "22%", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, alignItems: "center", backgroundColor: theme.surface },
  provBtnSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  lbl: { marginTop: 14, marginBottom: 6, letterSpacing: 1.2, fontSize: 11, textTransform: "uppercase", color: theme.textSecondary },
  input: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, fontSize: 15, color: theme.textPrimary },
  textarea: { minHeight: 140, textAlignVertical: "top" },
  kbRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  comboRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dropArrow: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  dropList: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.surface, marginTop: 4, overflow: "hidden" },
  dropItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderSoft },
  dropItemSelected: { backgroundColor: theme.primary },
  saveBtn: { marginTop: 28, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  cacheBtn: { paddingVertical: 14, borderRadius: 999, borderWidth: 1.5, borderColor: theme.primary, alignItems: "center" },
  backupBtn: { marginTop: 10, paddingVertical: 14, borderRadius: 999, borderWidth: 1.5, borderColor: theme.primary, alignItems: "center" },
});
const uploadStyles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: theme.primary },
});
