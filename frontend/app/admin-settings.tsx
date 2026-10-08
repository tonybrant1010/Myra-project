import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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

type Provider = "openai" | "anthropic" | "gemini" | "groq" | "cerebras" | "mistral" | "openrouter" | "ollama";

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
  profile_memory_enabled: boolean;
  local_llm_enabled: boolean;
  local_llm_model: string;
  ollama_reachable: boolean;
  ollama_models: { name: string; size_gb: number }[];
  ollama_base_url: string;
  local_llm_fallback_active: boolean;
};

/** A `GET /api/admin/security` valasza. A figyelo (ops/myra-watch.py) es a
 *  backend is ide ir; ez a kepernyo csak megjeleniti. */
type SecurityEvent = {
  id: number;
  created_at: string | null;
  source: string;
  kind: string;
  severity: "info" | "warn" | "critical" | string;
  label: string;
  detail: string;
  quarantined: boolean;
};

type SecurityState = {
  quarantine_active: boolean;
  quarantine_reason: string;
  quarantine_at: string;
  quarantine_source: string;
  maintenance_mode: boolean;
  watch_heartbeat: string;
  watch_age_seconds: number | null;
  counts_24h: { critical: number; warn: number; info: number };
  events: SecurityEvent[];
};

/** Ennyi masodperc utan tekintjuk halottnak a figyelot (5 perces koteg + tartalek). */
const WATCH_STALE_SECONDS = 600;

const PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "groq", "cerebras", "mistral", "openrouter", "ollama"];
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

  const [memoryOn, setMemoryOn] = useState(true);
  const [localOn, setLocalOn] = useState(false);
  const [localModel, setLocalModel] = useState("");
  const [sec, setSec] = useState<SecurityState | null>(null);
  const [secLoading, setSecLoading] = useState(false);
  const [secBusy, setSecBusy] = useState(false);
  const [secPassword, setSecPassword] = useState("");
  const [showEvents, setShowEvents] = useState(false);

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
        setMemoryOn(d.profile_memory_enabled !== false);
        setLocalOn(d.local_llm_enabled === true);
        setLocalModel(d.local_llm_model || "");
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
        profile_memory_enabled: memoryOn,
        local_llm_enabled: localOn,
        local_llm_model: localModel,
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

  const loadSecurity = useCallback(async () => {
    setSecLoading(true);
    try {
      const r = await authedFetch(token, "/api/admin/security");
      if (r.ok) setSec(await r.json());
    } catch {
      /* a biztonsagi panel sosem torheti el a kepernyot */
    } finally {
      setSecLoading(false);
    }
  }, [token]);

  useEffect(() => { loadSecurity(); }, [loadSecurity]);

  /** Kozos vaz a harom karanten-muvelethez: jelszo -> POST -> ujratoltes. */
  const securityAction = async (path: string, body: Record<string, unknown>, okMsg: string) => {
    if (!secPassword.trim()) {
      setErr("A muvelethez add meg az admin jelszavadat.");
      return;
    }
    setSecBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await authedFetch(token, path, {
        method: "POST",
        body: JSON.stringify({ ...body, current_password: secPassword }),
      });
      if (r.ok) {
        setSecPassword("");
        setMsg(okMsg);
        await loadSecurity();
        const mr = await authedFetch(token, "/api/admin/maintenance");
        if (mr.ok) setMaintenance((await mr.json()).maintenance_mode);
      } else {
        const d = await r.json().catch(() => ({}));
        setErr(d?.detail || "A muvelet nem sikerult.");
      }
    } catch (e: any) {
      setErr(e?.message || "Halozati hiba.");
    } finally {
      setSecBusy(false);
    }
  };

  const releaseQuarantine = () =>
    securityAction("/api/admin/security/release", { reason: "" }, "Karanten feloldva, a platform ujra elerheto.");

  const manualQuarantine = () =>
    Alert.alert(
      "Karantén bekapcsolása",
      "A platform minden nem-admin kérésre 503-at fog adni, amíg fel nem oldod. Te admin jogon továbbra is be tudsz lépni.",
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "KARANTÉN",
          style: "destructive",
          onPress: () =>
            securityAction("/api/admin/security/quarantine", { reason: "kézi karantén" }, "Karantén bekapcsolva."),
        },
      ],
    );

  const clearEvents = () =>
    securityAction("/api/admin/security/events/clear", {}, "Eseménylista ürítve.");

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

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <T variant="label" color={theme.textOnDark}>Helyi modell (saját szerver)</T>
                    <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginTop: 2, lineHeight: 18 }}>
                      Bekapcsolva a Myra először a saját gépen futó modellt kérdezi. Ha a gép nem
                      érhető el vagy hibázik, automatikusan a lent beállított szolgáltató válaszol.
                    </T>
                  </View>
                  <Switch
                    value={localOn}
                    onValueChange={setLocalOn}
                    trackColor={{ false: "rgba(255,255,255,0.22)", true: theme.accentDeep }}
                    thumbColor={theme.white}
                    testID="admin-local-llm-switch"
                  />
                </View>
                <T
                  variant="small"
                  color={data?.ollama_reachable ? theme.success : theme.danger}
                  style={{ marginBottom: 8 }}
                  testID="local-llm-status"
                >
                  {data?.ollama_reachable
                    ? `Szerver elérhető (${data.ollama_models.length} modell)`
                    : `Szerver nem érhető el (${data?.ollama_base_url || "-"})`}
                  {data?.local_llm_fallback_active ? " · most a tartalék szolgáltató válaszol" : ""}
                </T>
                {data?.ollama_models?.length ? (
                  <View style={styles.dropList}>
                    {data.ollama_models.map((m) => (
                      <TouchableOpacity
                        key={m.name}
                        style={[styles.dropItem, localModel === m.name && styles.dropItemSelected]}
                        onPress={() => setLocalModel(m.name)}
                        testID={`local-model-option-${m.name}`}
                      >
                        <T variant="small" color={localModel === m.name ? theme.white : theme.textOnDark}>
                          {m.name}{m.size_gb ? `  ·  ${m.size_gb} GB` : ""}
                        </T>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : localModel ? (
                  <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginBottom: 8 }}>
                    Kiválasztott helyi modell: {localModel}
                  </T>
                ) : null}
                <TouchableOpacity style={styles.outlineBtn} onPress={load} testID="local-llm-refresh">
                  <Ionicons name="refresh-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                  <T variant="label" color={theme.accent}>Modellek frissítése</T>
                </TouchableOpacity>

                <FieldLabel text="LLM Szolgáltató (tartalék, ha a helyi modell ki van kapcsolva vagy nem elérhető)" />
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

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <T variant="label" color={theme.textOnDark}>Myra memóriája (globális kapcsoló)</T>
                    <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginTop: 2, lineHeight: 18 }}>
                      Ha kikapcsolod, senkinél nem készül és nem használódik profil, akkor sem, ha a
                      felhasználó a saját beállításaiban bekapcsolta. A meglévő profilok nem törlődnek.
                    </T>
                  </View>
                  <Switch
                    value={memoryOn}
                    onValueChange={setMemoryOn}
                    trackColor={{ false: "rgba(255,255,255,0.22)", true: theme.accentDeep }}
                    thumbColor={theme.white}
                    testID="admin-memory-switch"
                  />
                </View>

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


              <Section title="Biztonság & Karantén" icon="shield-checkmark-outline">
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.sectionHelp}>
                  A szerveren futó figyelő (myra-watch) jelzései. Karantén alatt a platform minden
                  nem-admin kérésre 503-at ad, te admin jogon be tudsz lépni és fel tudod oldani.
                </T>

                <View
                  style={[
                    styles.secBanner,
                    sec?.quarantine_active ? styles.secBannerAlarm : styles.secBannerCalm,
                  ]}
                >
                  <Ionicons
                    name={sec?.quarantine_active ? "lock-closed" : "shield-checkmark"}
                    size={20}
                    color={sec?.quarantine_active ? "#ef5350" : theme.success}
                  />
                  <View style={{ flex: 1 }}>
                    <T variant="label" color={sec?.quarantine_active ? "#ef5350" : theme.success}>
                      {sec?.quarantine_active ? "KARANTÉN AKTÍV" : "Nincs karantén"}
                    </T>
                    {sec?.quarantine_active ? (
                      <T variant="small" color="rgba(247,251,255,0.78)" style={{ marginTop: 2 }}>
                        {sec.quarantine_reason || "ismeretlen ok"}
                        {sec.quarantine_at ? ` · ${sec.quarantine_at}` : ""}
                        {sec.quarantine_source ? ` · forrás: ${sec.quarantine_source}` : ""}
                      </T>
                    ) : (
                      <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginTop: 2 }}>
                        A platform normálisan kiszolgálja a felhasználókat.
                      </T>
                    )}
                  </View>
                  <TouchableOpacity onPress={loadSecurity} disabled={secLoading} testID="security-refresh">
                    {secLoading ? (
                      <ActivityIndicator size="small" color={theme.accent} />
                    ) : (
                      <Ionicons name="refresh-outline" size={18} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.diagLine}>
                  <T variant="small" color="rgba(247,251,255,0.7)">Figyelő állapota:</T>
                  <T
                    variant="small"
                    color={
                      sec?.watch_age_seconds == null
                        ? theme.warm
                        : sec.watch_age_seconds > WATCH_STALE_SECONDS
                          ? theme.danger
                          : theme.success
                    }
                  >
                    {sec?.watch_age_seconds == null
                      ? "nem jelentkezett"
                      : sec.watch_age_seconds > WATCH_STALE_SECONDS
                        ? `nem fut (${Math.round(sec.watch_age_seconds / 60)} perce néma)`
                        : "fut"}
                  </T>
                </View>

                <View style={styles.diagLine}>
                  <T variant="small" color="rgba(247,251,255,0.7)">Utolsó 24 óra:</T>
                  <T variant="small" color="rgba(247,251,255,0.86)">
                    {(sec?.counts_24h?.critical ?? 0)} súlyos · {(sec?.counts_24h?.warn ?? 0)} figyelmeztetés · {(sec?.counts_24h?.info ?? 0)} egyéb
                  </T>
                </View>

                <View style={styles.emergencyCard}>
                  <TouchableOpacity
                    style={styles.emergencyRowHeader}
                    onPress={() => setShowEvents((v) => !v)}
                    testID="security-events-header"
                  >
                    <T variant="label" color={theme.accent}>
                      Események ({sec?.events?.length ?? 0})
                    </T>
                    <Ionicons name={showEvents ? "chevron-up" : "chevron-down"} size={18} color={theme.accent} />
                  </TouchableOpacity>
                  {showEvents ? (
                    <ScrollView style={styles.logScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                      {!sec?.events?.length ? (
                        <T variant="small" color="rgba(247,251,255,0.4)">Nincs rögzített esemény.</T>
                      ) : (
                        sec.events.map((e) => (
                          <View key={e.id} style={styles.eventRow}>
                            <View style={[styles.severityDot, { backgroundColor: severityColor(e.severity) }]} />
                            <View style={{ flex: 1 }}>
                              <T variant="small" color={theme.textOnDark}>
                                {e.quarantined ? "🔒 " : ""}{e.label}
                              </T>
                              <T variant="caption" color="rgba(247,251,255,0.45)" style={{ marginTop: 1 }}>
                                {formatEventTime(e.created_at)} · {e.kind} · {e.source}
                              </T>
                              {e.detail ? (
                                <T
                                  variant="caption"
                                  color="#cfd8dc"
                                  style={{ fontFamily: "monospace", fontSize: 10, marginTop: 3 }}
                                >
                                  {e.detail}
                                </T>
                              ) : null}
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  ) : null}
                </View>

                <T variant="caption" color="rgba(247,251,255,0.72)" style={styles.lbl}>
                  Admin jelszó a karantén műveletekhez
                </T>
                <TextInput
                  value={secPassword}
                  onChangeText={setSecPassword}
                  placeholder="Jelenlegi admin jelszó"
                  placeholderTextColor="rgba(247,251,255,0.45)"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  maxLength={PASSWORD_MAX_CHARS}
                  style={styles.input}
                  testID="security-password"
                />

                {msg ? <T variant="small" color={theme.success} style={styles.feedback}>{msg}</T> : null}
                {err ? <T variant="small" color={theme.danger} style={styles.feedback}>{err}</T> : null}

                {sec?.quarantine_active ? (
                  <TouchableOpacity
                    style={[styles.emergencyActionBtn, { backgroundColor: theme.accentDeep }]}
                    onPress={releaseQuarantine}
                    disabled={secBusy}
                    testID="security-release-button"
                  >
                    {secBusy ? (
                      <ActivityIndicator color={theme.white} />
                    ) : (
                      <T variant="label" color={theme.white}>Karantén feloldása</T>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.emergencyActionBtn, { backgroundColor: theme.warm }]}
                    onPress={manualQuarantine}
                    disabled={secBusy}
                    testID="security-quarantine-button"
                  >
                    {secBusy ? (
                      <ActivityIndicator color={theme.white} />
                    ) : (
                      <T variant="label" color={theme.white}>Karantén bekapcsolása (kézzel)</T>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.emergencyOutlineBtn}
                  onPress={clearEvents}
                  disabled={secBusy}
                  testID="security-clear-button"
                >
                  <T variant="label" color={theme.accent}>Eseménylista ürítése</T>
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

function severityColor(severity: string) {
  if (severity === "critical") return "#ef5350";
  if (severity === "warn") return theme.warm;
  return theme.accent;
}

/** A figyelo helyi ido szerinti "YYYY-MM-DD HH:MM:SS"-t ir, a backend ISO-t.
 *  Mindkettonel a ma torteneteknel csak az orat mutatjuk. */
function formatEventTime(raw: string | null) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const ma = new Date();
  const azonosNap =
    d.getFullYear() === ma.getFullYear() && d.getMonth() === ma.getMonth() && d.getDate() === ma.getDate();
  const ora = d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return azonosNap ? ora : `${d.toLocaleDateString("hu-HU")} ${ora}`;
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
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "ollama") return "Ollama";
  return "Mistral";
}

function providerHelp(provider: Provider) {
  if (provider === "openai") return "platform.openai.com/api-keys";
  if (provider === "anthropic") return "console.anthropic.com/settings/keys";
  if (provider === "groq") return "console.groq.com/keys";
  if (provider === "cerebras") return "cloud.cerebras.ai/api-keys";
  if (provider === "mistral") return "console.mistral.ai/api-keys";
  if (provider === "openrouter") return "openrouter.ai/settings/keys";
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
      // A szerver adja a fájlnevet (pl. myra_backup_20261004_1700.sql.gz); ha nincs, saját nevet adunk.
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/i);
      a.download = m?.[1] || `myra_backup_${new Date().toISOString().slice(0, 10)}.sql.gz`;
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  secBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  secBannerAlarm: { borderColor: "rgba(239,83,80,0.45)", backgroundColor: "rgba(239,83,80,0.10)" },
  secBannerCalm: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.05)" },
  eventRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },


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
