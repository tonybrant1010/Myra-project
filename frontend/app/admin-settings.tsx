import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Provider = "openai" | "anthropic" | "gemini" | "groq" | "cerebras" | "mistral" | "ollama";

type Settings = {
  llm_provider: Provider;
  llm_model: string;
  llm_api_key_set: boolean;
  llm_api_key_preview: string;
  system_prompt: string;
  global_notice_text: string;
  suggested_models: Record<string, string[]>;
  live_model: string;
  live_api_key_set: boolean;
  live_api_key_preview: string;
};

const PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "groq", "cerebras", "mistral", "ollama"];
const MODEL_MAX_CHARS = 160;
const API_KEY_MAX_CHARS = 4096;
const SYSTEM_PROMPT_MAX_CHARS = 50000;
const GLOBAL_NOTICE_MAX_CHARS = 1200;
const PASSWORD_MAX_CHARS = 128;

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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [liveModel, setLiveModel] = useState("");
  const [liveApiKey, setLiveApiKey] = useState("");


  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [diag, setDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [forceLogoutBusy, setForceLogoutBusy] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const [downBusy, setDownBusy] = useState(false);
  const [emergencyPassword, setEmergencyPassword] = useState("");

  const requireEmergencyPassword = () => {
    if (!emergencyPassword.trim()) {
      setErr("Az SOS muvelethez add meg az admin jelszavadat.");
      return null;
    }
    return emergencyPassword;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authedFetch(token, "/api/admin/settings");
      if (r.ok) {
        const d: Settings = await r.json();
        setData(d);
        setProvider(d.llm_provider);
        setModel(d.llm_model);
        setNotice(d.global_notice_text || "");
        setPrompt(d.system_prompt);
        setLiveModel(d.live_model || "gemini-3.1-flash-live-preview");
      }


      const mr = await authedFetch(token, "/api/admin/maintenance");
      if (mr.ok) {
        const md = await mr.json();
        setMaintenance(md.maintenance_mode);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
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

  const toggleMaintenance = async () => {
    const currentPassword = requireEmergencyPassword();
    if (!currentPassword) return;
    setMaintenanceLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await authedFetch(token, "/api/admin/maintenance", {
        method: "POST",
        body: JSON.stringify({ maintenance_mode: !maintenance, current_password: currentPassword }),
      });
      if (r.ok) {
        const d = await r.json();
        setMaintenance(d.maintenance_mode);
        setEmergencyPassword("");
        setMsg(d.maintenance_mode ? "Karbantartási mód bekapcsolva." : "Karbantartási mód kikapcsolva.");
      }
    } catch (e: any) {
      setErr(e.message || "Hiba történt.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagLoading(true);
    setDiag(null);
    try {
      const r = await authedFetch(token, "/api/admin/diagnostics");
      if (r.ok) {
        const d = await r.json();
        setDiag(d);
      } else {
        setDiag({ error: "Nem sikerült lekérni a diagnosztikát." });
      }
    } catch (e: any) {
      setDiag({ error: e.message || "Hálózati hiba." });
    } finally {
      setDiagLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const r = await authedFetch(token, "/api/admin/logs");
      if (r.ok) {
        const d = await r.json();
        setLogs(d.logs || []);
      }
    } catch {}
    setLogsLoading(false);
  };

  const forceLogoutAll = async () => {
    const currentPassword = requireEmergencyPassword();
    if (!currentPassword) return;
    setForceLogoutBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await authedFetch(token, "/api/admin/force-logout-all", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword }),
      });
      if (r.ok) {
        setEmergencyPassword("");
        setMsg("Minden nem-admin felhasználó sikeresen kijelentkeztetve.");
      } else {
        setErr("Kijelentkeztetés sikertelen.");
      }
    } catch (e: any) {
      setErr(e.message || "Hiba.");
    } finally {
      setForceLogoutBusy(false);
    }
  };

  const restartBackend = async () => {
    const currentPassword = requireEmergencyPassword();
    if (!currentPassword) return;
    setRestartBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await authedFetch(token, "/api/admin/restart", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword }),
      });
      if (r.ok) {
        setEmergencyPassword("");
        setMsg("A szerver leállítása elindult. A Docker konténer hamarosan újraindul (kb. 5-10 mp).");
      } else {
        setErr("Újraindítás sikertelen.");
      }
    } catch (e: any) {
      setErr(e.message || "Hiba.");
    } finally {
      setRestartBusy(false);
    }
  };

  const dockerComposeDown = async () => {
    Alert.alert(
      "Rendszer leállítása",
      "Biztosan le akarod állítani a rendszert (docker compose down)? Ez a frontendet és a backendet is leállítja, így a szolgáltatás elérhetetlenné válik!",
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "LEÁLLÍTÁS",
          style: "destructive",
          onPress: async () => {
            const currentPassword = requireEmergencyPassword();
            if (!currentPassword) return;
            setDownBusy(true);
            setMsg(null);
            setErr(null);
            try {
              const r = await authedFetch(token, "/api/admin/down", {
                method: "POST",
                body: JSON.stringify({ current_password: currentPassword }),
              });
              if (r.ok) {
                setEmergencyPassword("");
                setMsg("Leállítás elindítva. A szerver le fog állni, a konténerek leállnak.");
              } else {
                setErr("Leállítás sikertelen.");
              }
            } catch (e: any) {
              setErr(e.message || "Hiba (a szerver valószínűleg már leállt).");
            } finally {
              setDownBusy(false);
            }
          }
        }
      ]
    );
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentBackground>
          <TopBar title="Beállítások" showBack />
          <View style={styles.center}><T variant="body" color={theme.danger}>Nincs jogosultságod ehhez.</T></View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  const suggested = data?.suggested_models?.[provider] || [];

  return (
    <SafeAreaView style={styles.safe} testID="admin-settings-screen">
      <ContentBackground>
        <TopBar title="Admin beállítások" showBack />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>


              <Section title="Chatbot & MI Asszisztens" icon="sparkles-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  Itt adhatod meg a Myra chatbot és a hangalapú asszisztens működését vezérlő MI modellek adatait és a system promptot.
                </T>

                <FieldLabel text="LLM Szolgáltató" />
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
                    maxLength={MODEL_MAX_CHARS}
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

                <FieldLabel text="Modell API kulcs" />
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={data?.llm_api_key_set ? `Beállítva (${data.llm_api_key_preview})` : "API kulcs"}
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  secureTextEntry
                  autoCapitalize="none"
                  maxLength={API_KEY_MAX_CHARS}
                  testID="api-key-input"
                />
                <T variant="small" color="rgba(247,251,255,0.58)" style={{ marginTop: 6, marginBottom: 12 }}>
                  {providerHelp(provider)}
                </T>

                <FieldLabel text="Live (Hangalapú) modell neve" />
                <TextInput
                  style={styles.input}
                  value={liveModel}
                  onChangeText={setLiveModel}
                  autoCapitalize="none"
                  maxLength={MODEL_MAX_CHARS}
                  placeholder="Pl. gemini-2.0-flash-exp"
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
                  maxLength={API_KEY_MAX_CHARS}
                  testID="live-api-key-input"
                />

                <FieldLabel text="Chatbot System Prompt" />
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  maxLength={SYSTEM_PROMPT_MAX_CHARS}
                  placeholder="A Myra chatbot viselkedését meghatározó prompt..."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  testID="prompt-input"
                />
              </Section>


              <Section title="Rendszer & Karbantartás" icon="construct-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  Globális értesítés a felhasználók felé és biztonsági adatbázis mentések.
                </T>

                <FieldLabel text="Felhasználói közlemény" />
                <TextInput
                  style={styles.input}
                  value={notice}
                  onChangeText={setNotice}
                  placeholder="Pl. Ma este 22:00 után rövid karbantartás várható."
                  placeholderTextColor="rgba(247,251,255,0.48)"
                  maxLength={GLOBAL_NOTICE_MAX_CHARS}
                  testID="global-notice-input"
                />

                {msg ? <T variant="small" color={theme.success} style={styles.feedback}>{msg}</T> : null}
                {err ? <T variant="small" color={theme.danger} style={styles.feedback}>{err}</T> : null}

                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="save-button">
                  {saving ? <ActivityIndicator color={theme.white} /> : <T variant="title" color={theme.white}>Beállítások mentése</T>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.outlineBtn} onPress={() => downloadBackup(token, setErr)} testID="backup-button">
                  <Ionicons name="download-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                  <T variant="label" color={theme.accent}>Adatbázis mentés letöltése</T>
                </TouchableOpacity>
              </Section>


              <View style={styles.sosCard}>
                <View style={styles.sosHeader}>
                  <View style={styles.sosIcon}>
                    <Ionicons name="warning-outline" size={18} color="#ef5350" />
                  </View>
                  <T variant="title" color="#ef5350" style={{ flex: 1, fontWeight: "bold" }}>Sürgősségi Eszközök (SOS)</T>
                </View>

                <T variant="small" color="rgba(255,255,255,0.7)" style={styles.sectionHelp}>
                  Rendszerdiagnosztika, karbantartási mód, munkamenetek törlése, backend újraindítás és teljes rendszer-leállítás közvetlenül mobilról.
                </T>


                <View style={styles.emergencyCard}>
                  <TouchableOpacity style={styles.emergencyRowHeader} onPress={runDiagnostics} disabled={diagLoading}>
                    <T variant="label" color={theme.accent}>Rendszerdiagnosztika futtatása</T>
                    {diagLoading ? <ActivityIndicator size="small" color={theme.accent} /> : <Ionicons name="refresh-outline" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                  {diag ? (
                    <View style={styles.diagDetails}>
                      {diag.error ? (
                        <T variant="small" color={theme.danger}>{diag.error}</T>
                      ) : (
                        <>
                          <View style={styles.diagLine}>
                            <T variant="small" color="rgba(247,251,255,0.7)">Adatbázis:</T>
                            <T variant="small" color={diag.db === "ok" ? theme.success : theme.danger}>
                              {diag.db === "ok" ? "Kapcsolódva" : diag.db}
                            </T>
                          </View>
                          <View style={styles.diagLine}>
                            <T variant="small" color="rgba(247,251,255,0.7)">Gemini API kulcs:</T>
                            <T variant="small" color={diag.gemini_api_key_configured ? theme.success : theme.danger}>
                              {diag.gemini_api_key_configured ? "Beállítva" : "Hiányzik"}
                            </T>
                          </View>
                          <View style={styles.diagLine}>
                            <T variant="small" color="rgba(247,251,255,0.7)">TTS motor ({diag.tts_engine}):</T>
                            <T variant="small" color={diag.tts_status === "ok" ? theme.success : theme.danger}>
                              {diag.tts_status === "ok" ? "Működik" : diag.tts_status}
                            </T>
                          </View>
                          <View style={styles.diagLine}>
                            <T variant="small" color="rgba(247,251,255,0.7)">Tudásanyag PDF-ek száma:</T>
                            <T variant="small" color={diag.pdf_count > 0 ? theme.success : theme.warm}>
                              {diag.pdf_count} db PDF
                            </T>
                          </View>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>

                <T variant="caption" color="rgba(247,251,255,0.72)" style={styles.lbl}>Admin jelszo az SOS muveletekhez</T>
                <TextInput
                  value={emergencyPassword}
                  onChangeText={setEmergencyPassword}
                  placeholder="Jelenlegi admin jelszo"
                  placeholderTextColor="rgba(247,251,255,0.45)"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  maxLength={PASSWORD_MAX_CHARS}
                  style={styles.input}
                  testID="sos-admin-password"
                />


                <TouchableOpacity
                  style={[styles.emergencyActionBtn, maintenance && { backgroundColor: theme.warm }]}
                  onPress={toggleMaintenance}
                  disabled={maintenanceLoading}
                  testID="sos-maintenance-button"
                >
                  {maintenanceLoading ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <T variant="label" color={theme.white}>
                      {maintenance ? "Karbantartási mód kikapcsolása" : "Karbantartási mód bekapcsolása"}
                    </T>
                  )}
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.emergencyActionBtn, { backgroundColor: "#851c1c" }]}
                  onPress={forceLogoutAll}
                  disabled={forceLogoutBusy}
                  testID="sos-force-logout-button"
                >
                  {forceLogoutBusy ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <T variant="label" color={theme.white}>Összes nem-admin kijelentkeztetése</T>
                  )}
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.emergencyActionBtn, { backgroundColor: theme.danger }]}
                  onPress={restartBackend}
                  disabled={restartBusy}
                  testID="sos-restart-button"
                >
                  {restartBusy ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <T variant="label" color={theme.white}>Backend konténer újraindítása</T>
                  )}
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.emergencyActionBtn, { backgroundColor: "#b71c1c", borderWidth: 1, borderColor: "#ffcdd2" }]}
                  onPress={dockerComposeDown}
                  disabled={downBusy}
                  testID="sos-down-button"
                >
                  {downBusy ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <T variant="label" color={theme.white} style={{ fontWeight: "bold" }}>Rendszer leállítása (Docker Compose Down)</T>
                  )}
                </TouchableOpacity>


                <View style={[styles.emergencyCard, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={styles.emergencyRowHeader}
                    onPress={() => {
                      const next = !showLogs;
                      setShowLogs(next);
                      if (next) fetchLogs();
                    }}
                    testID="sos-logs-header"
                  >
                    <T variant="label" color={theme.accent}>Élő memórialogok</T>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {logsLoading ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                      <Ionicons name={showLogs ? "chevron-up" : "chevron-down"} size={18} color={theme.accent} />
                    </View>
                  </TouchableOpacity>
                  {showLogs ? (
                    <ScrollView style={styles.logScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                      {logs.length === 0 ? (
                        <T variant="small" color="rgba(247,251,255,0.4)">Nincsenek elérhető logok.</T>
                      ) : (
                        logs.map((l, i) => (
                          <T key={i} variant="caption" color="#cfd8dc" style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 4 }}>
                            {l}
                          </T>
                        ))
                      )}
                    </ScrollView>
                  ) : null}
                </View>
              </View>
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

function downloadBackup(token: string | null, setErr: (message: string) => void) {
  if (Platform.OS !== "web") return;
  fetch(apiUrl("/api/admin/backup"), {
    cache: "no-store",
    credentials: "omit",
    headers: { Authorization: `Bearer ${token || ""}` },
  })
    .then(async (r) => {
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setErr(data.detail || "Adatbázis mentés nem érhető el ezen a környezeten.");
        return;
      }
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
    .catch(() => setErr("Nem sikerült elindítani az adatbázis mentést."));
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
  saveBtn: { marginTop: 10, backgroundColor: theme.accentDeep, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  outlineBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    flexDirection: "row",
  },
  feedback: { marginBottom: 10, marginTop: 10 },


  sosCard: {
    marginBottom: 20,
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 83, 80, 0.4)",
    backgroundColor: "rgba(239, 83, 80, 0.08)",
    padding: 18,
  },
  sosHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sosIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 83, 80, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 83, 80, 0.3)",
  },
  emergencyCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    marginTop: 10,
  },
  emergencyRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  diagDetails: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 8,
    gap: 4,
  },
  diagLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  emergencyActionBtn: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emergencyOutlineBtn: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "rgba(87,199,255,0.3)",
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  logScroll: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 8,
    maxHeight: 250,
  },
});
