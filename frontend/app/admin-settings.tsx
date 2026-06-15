import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiUrl, authedFetch, useAuth } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme } from "@/src/theme";

type Provider = "openai" | "anthropic" | "gemini" | "groq" | "cerebras" | "mistral";

type Settings = {
  llm_provider: Provider;
  llm_model: string;
  llm_api_key_set: boolean;
  llm_api_key_preview: string;
  system_prompt: string;
  kb_text: string;
  global_notice_text: string;
  suggested_models: Record<string, string[]>;
  live_model: string;
  live_api_key_set: boolean;
  live_api_key_preview: string;
};

const PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "groq", "cerebras", "mistral"];

export default function AdminSettingsScreen() {
  useAuthGuard();
  const { token, user } = useAuth();
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
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
  const [liveModel, setLiveModel] = useState("");
  const [liveApiKey, setLiveApiKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authedFetch(token, "/api/admin/settings");
    if (r.ok) {
      const d: Settings = await r.json();
      setData(d);
      setProvider(d.llm_provider);
      setModel(d.llm_model);
      setNotice(d.global_notice_text || "");
      setPrompt(d.system_prompt);
      setKb(d.kb_text);
      setLiveModel(d.live_model || "gemini-3.1-flash-live-preview");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const body: any = {
        llm_provider: provider,
        llm_model: model,
        global_notice_text: notice,
        system_prompt: prompt,
        kb_text: kb,
        live_model: liveModel,
      };
      if (apiKey) body.llm_api_key = apiKey;
      if (liveApiKey) body.live_api_key = liveApiKey;

      const r = await authedFetch(token, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setMsg("Beállítások mentve.");
        setApiKey("");
        setLiveApiKey("");
        load();
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
        setCacheMsg(`Cache létrehozva (${d.pdf_count} PDF).`);
      } else {
        setCacheMsg(`Hiba: ${d?.detail || "Ismeretlen hiba"}`);
      }
    } catch (e: any) {
      setCacheMsg(`Hálózati hiba: ${e?.message}`);
    } finally {
      setCacheBuilding(false);
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
      <TopBar title="Admin beállítások" showBack />
      <ContentBackground>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Section title="Felhasználói közlemény" icon="megaphone-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  Ez a rövid üzenet minden bejelentkezett felhasználónál megjelenik a felső sáv alatt. Ha üresen hagyod, nem látszik semmi.
                </T>
                <TextInput
                  style={styles.input}
                  value={notice}
                  onChangeText={setNotice}
                  placeholder="Pl. Ma este 22:00 után rövid karbantartás várható."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  maxLength={180}
                  testID="global-notice-input"
                />
              </Section>

              <Section title="Nyelvi modell" icon="sparkles-outline">
                <View style={styles.providerRow}>
                  {PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.provBtn, provider === p && styles.provBtnSelected]}
                      onPress={() => setProvider(p)}
                      testID={`provider-${p}`}
                    >
                      <T variant="label" color={provider === p ? theme.white : theme.textOnDark}>
                        {providerLabel(p)}
                      </T>
                    </TouchableOpacity>
                  ))}
                </View>

                <FieldLabel text="Modell neve" />
                <View style={styles.comboRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={model}
                    onChangeText={(v) => { setModel(v); setShowModelDrop(true); }}
                    onFocus={() => setShowModelDrop(true)}
                    autoCapitalize="none"
                    placeholder="Válassz vagy írj be modellnevet..."
                    placeholderTextColor="rgba(247,251,255,0.48)"
                    testID="model-input"
                  />
                  <TouchableOpacity style={styles.dropArrow} onPress={() => setShowModelDrop((v) => !v)}>
                    <Ionicons name={showModelDrop ? "chevron-up" : "chevron-down"} size={18} color="rgba(247,251,255,0.70)" />
                  </TouchableOpacity>
                </View>
                {showModelDrop && suggested.length > 0 ? (
                  <View style={styles.dropList}>
                    {suggested.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.dropItem, model === m && styles.dropItemSelected]}
                        onPress={() => { setModel(m); setShowModelDrop(false); }}
                        testID={`model-option-${m}`}
                      >
                        <T variant="small" color={model === m ? theme.white : theme.textOnDark}>{m}</T>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <FieldLabel text="API kulcs" />
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={data?.llm_api_key_set ? `Beállítva (${data.llm_api_key_preview})` : "API kulcs"}
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  secureTextEntry
                  autoCapitalize="none"
                  testID="api-key-input"
                />
                <T variant="small" color="rgba(247,251,255,0.58)" style={{ marginTop: 6 }}>
                  {providerHelp(provider)}
                </T>
              </Section>

              <Section title="Myra Live beállítások" icon="mic-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  A Myra Live béta hangalapú asszisztens beállításai (Gemini Multimodal Live API).
                </T>

                <FieldLabel text="Live modell neve" />
                <TextInput
                  style={styles.input}
                  value={liveModel}
                  onChangeText={setLiveModel}
                  autoCapitalize="none"
                  placeholder="Válassz vagy írj be modellnevet..."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  testID="live-model-input"
                />

                <FieldLabel text="Live API kulcs" />
                <TextInput
                  style={styles.input}
                  value={liveApiKey}
                  onChangeText={setLiveApiKey}
                  placeholder={data?.live_api_key_set ? `Beállítva (${data.live_api_key_preview})` : "Live API kulcs"}
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  secureTextEntry
                  autoCapitalize="none"
                  testID="live-api-key-input"
                />
              </Section>

              <Section title="System prompt" icon="construct-outline">
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  placeholder="A Myra chatbot system promptja..."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  testID="prompt-input"
                />
              </Section>

              <Section title="Tudásanyag" icon="library-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  Kézi szöveg, PDF/TXT feltöltés, vagy szerveren lévő PDF-ek beolvasása.
                </T>
                <TextInput
                  style={[styles.input, styles.textarea, { minHeight: 200 }]}
                  value={kb}
                  onChangeText={setKb}
                  multiline
                  placeholder="A tudásanyag teljes szövege..."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  testID="kb-input"
                />
                <UploadKBButton token={token} onUploaded={(text) => setKb(text)} />
                <TouchableOpacity style={styles.outlineBtn} onPress={extractKb} disabled={extracting} testID="extract-kb-button">
                  {extracting ? <ActivityIndicator color={theme.accent} /> : <T variant="label" color={theme.accent}>PDF-ek beolvasása a szerverről</T>}
                </TouchableOpacity>
                {extractMsg ? <T variant="small" color="rgba(247,251,255,0.62)" style={{ marginTop: 8 }}>{extractMsg}</T> : null}
              </Section>

              <Section title="Mentés és karbantartás" icon="save-outline">
                {msg ? <T variant="small" color={theme.success} style={styles.feedback}>{msg}</T> : null}
                {err ? <T variant="small" color={theme.danger} style={styles.feedback}>{err}</T> : null}
                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="save-button">
                  {saving ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Mentés</T>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => downloadBackup(token)} testID="backup-button">
                  <T variant="label" color={theme.accent}>Adatbázis mentés letöltése</T>
                </TouchableOpacity>
                {provider === "gemini" ? (
                  <>
                    <TouchableOpacity style={styles.outlineBtn} onPress={initCache} disabled={cacheBuilding} testID="init-cache-button">
                      {cacheBuilding ? <ActivityIndicator color={theme.accent} /> : <T variant="label" color={theme.accent}>Gemini cache inicializálása</T>}
                    </TouchableOpacity>
                    {cacheMsg ? <T variant="small" color="rgba(247,251,255,0.62)" style={{ marginTop: 8 }}>{cacheMsg}</T> : null}
                  </>
                ) : null}
              </Section>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={theme.accentSoft} />
        </View>
        <T variant="caption" color={theme.accentSoft} style={{ flex: 1 }}>{title}</T>
      </View>
      {children}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <T variant="label" color="rgba(247,251,255,0.68)" style={styles.lbl}>{text}</T>;
}

function providerLabel(provider: Provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  if (provider === "cerebras") return "Cerebras";
  return "Mistral";
}

function providerHelp(provider: Provider) {
  if (provider === "openai") return "platform.openai.com/api-keys";
  if (provider === "anthropic") return "console.anthropic.com/settings/keys";
  if (provider === "groq") return "console.groq.com/keys";
  if (provider === "cerebras") return "cloud.cerebras.ai/api-keys";
  if (provider === "mistral") return "console.mistral.ai/api-keys";
  return "aistudio.google.com/apikey";
}

function downloadBackup(token: string | null) {
  if (Platform.OS !== "web") return;
  fetch(apiUrl("/api/admin/backup"), { headers: { Authorization: `Bearer ${token || ""}` } })
    .then(async (r) => {
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myra_backup_${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(() => {});
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
      } catch {
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
    setBusy(true);
    setInfo(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(apiUrl("/api/admin/kb/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setInfo(d?.detail || "Feltöltési hiba");
      } else {
        const d = await r.json();
        setInfo(`Hozzáadva: ${d.added_chars.toLocaleString("hu-HU")} karakter.`);
        const s = await fetch(apiUrl("/api/admin/settings"), { headers: { Authorization: `Bearer ${token}` } });
        if (s.ok) {
          const d2 = await s.json();
          onUploaded(d2.kb_text || "");
        }
      }
    } catch (e: any) {
      setInfo(e?.message || "Hiba");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity style={styles.outlineBtn} onPress={pick} disabled={busy} testID="kb-upload">
        {busy ? <ActivityIndicator color={theme.accent} /> : <T variant="label" color={theme.accent}>PDF / TXT feltöltése</T>}
      </TouchableOpacity>
      {info ? <T variant="small" color="rgba(247,251,255,0.62)" style={{ marginTop: 8 }}>{info}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scroll: { padding: 18, paddingBottom: 60 },
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
  sectionHelp: { marginBottom: 10, lineHeight: 20 },
  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  provBtn: {
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
  provBtnSelected: { backgroundColor: theme.accentDeep, borderColor: theme.accentDeep },
  lbl: { marginTop: 12, marginBottom: 6 },
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
  textarea: { minHeight: 140, textAlignVertical: "top" },
  comboRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dropArrow: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropList: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, backgroundColor: "rgba(6,19,32,0.94)", marginTop: 4, overflow: "hidden" },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.10)" },
  dropItemSelected: { backgroundColor: theme.accentDeep },
  saveBtn: { marginTop: 4, backgroundColor: theme.accentDeep, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  outlineBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  feedback: { marginBottom: 10 },
});
