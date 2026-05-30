import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { shadow, theme } from "@/src/theme";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";

const MYRA_AVATAR = require("@/assets/images/myra-avatar.png");

type Msg = { id: string; role: "user" | "assistant"; text: string; created_at: string; state_code?: string | null };
type ListItem = { kind: "msg"; msg: Msg } | { kind: "hint"; id: string; code: string };

function buildListItems(messages: Msg[], currentCode: string | null | undefined): ListItem[] {
  const out: ListItem[] = [];
  let lastCode: string | null | undefined = undefined;
  for (const m of messages) {
    if (m.state_code) lastCode = m.state_code;
    out.push({ kind: "msg", msg: m });
  }
  if (currentCode && lastCode !== currentCode) out.push({ kind: "hint", id: "hint-current", code: currentCode });
  return out;
}

function formatMessageTime(value: string): string {
  // A backend UTC időt ad vissza, de nem mindig Z suffix-szel – explicit UTC-ként kezeljük
  const normalized = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
}

export default function ChatScreen() {
  const { token, user } = useAuth();
  const { session_id: paramSessionId } = useLocalSearchParams<{ session_id?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [didInitialScroll, setDidInitialScroll] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef("");

  const scrollToBottom = useCallback((animated = false) => {
    scrollTimers.current.forEach(clearTimeout);
    scrollTimers.current = [0, 80, 220, 520].map((delay) =>
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated });
      }, delay)
    );
  }, []);

  useEffect(() => {
    return () => {
      scrollTimers.current.forEach(clearTimeout);
      recognitionRef.current?.stop?.();
      if (Platform.OS === "web") {
        (globalThis as any).speechSynthesis?.cancel?.();
      }
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    authedFetch(token, "/api/quiz/sessions")
      .then((r) => r.json())
      .then((d) => {
        const sessions: { id: string }[] = d.sessions || [];
        const latest = sessions[0]?.id || null;
        setActiveSessionId(latest);
        setViewSessionId(paramSessionId || latest);
      })
      .catch(() => {});
  }, [token, paramSessionId]);

  const loadHistory = useCallback(async (sid: string | null) => {
    setLoading(true);
    setDidInitialScroll(false);
    try {
      const url = sid ? `/api/chat/history?session_id=${sid}` : "/api/chat/history";
      const r = await authedFetch(token, url);
      const hist = await r.json();
      setMessages(hist.messages || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (viewSessionId !== undefined) loadHistory(viewSessionId);
  }, [viewSessionId, loadHistory]);

  const isReadOnly = viewSessionId !== null && viewSessionId !== activeSessionId;

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const toggleDictation = useCallback(() => {
    if (Platform.OS !== "web") {
      setVoiceStatus("A diktálás ebben a környezetben nem elérhető.");
      return;
    }
    if (listening) {
      stopDictation();
      return;
    }
    const SpeechRecognition = (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("A böngésző nem támogatja a beépített diktálást.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    dictationBaseRef.current = input.trimEnd();
    recognition.lang = "hu-HU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceStatus("Hallgatlak...");
      setListening(true);
    };
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript || "";
        if (event.results[i]?.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const spoken = (finalText || interimText).trim();
      const base = dictationBaseRef.current;
      setInput([base, spoken].filter(Boolean).join(base && spoken ? " " : ""));
      if (finalText.trim()) {
        dictationBaseRef.current = [base, finalText.trim()].filter(Boolean).join(base && finalText.trim() ? " " : "");
      }
    };
    recognition.onerror = () => {
      setVoiceStatus("Nem sikerült rögzíteni a diktálást.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      setVoiceStatus(null);
      recognitionRef.current = null;
    };
    recognition.start();
  }, [input, listening, stopDictation]);

  const speakMessage = useCallback((msg: Msg) => {
    if (Platform.OS !== "web") {
      setVoiceStatus("A felolvasás ebben a környezetben nem elérhető.");
      return;
    }
    const synth = (globalThis as any).speechSynthesis;
    const Utterance = (globalThis as any).SpeechSynthesisUtterance;
    if (!synth || !Utterance) {
      setVoiceStatus("A böngésző nem támogatja a beépített felolvasást.");
      return;
    }
    if (speakingId === msg.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }
    synth.cancel();
    const utterance = new Utterance(msg.text);
    utterance.lang = "hu-HU";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voices = synth.getVoices?.() || [];
    const huVoice = voices.find((v: any) => String(v.lang || "").toLowerCase().startsWith("hu"));
    if (huVoice) utterance.voice = huVoice;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    synth.speak(utterance);
  }, [speakingId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || isReadOnly) return;
    setInput("");
    setSending(true);
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      text,
      created_at: new Date().toISOString(),
      state_code: user?.state_code || null,
    };
    setMessages((m) => [...m, optimistic]);
    scrollToBottom(true);
    try {
      const r = await authedFetch(token, "/api/chat/send", { method: "POST", body: JSON.stringify({ message: text, session_id: activeSessionId }) });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            text: `Figyelem: ${data?.detail || "Nem sikerült elküldeni az üzenetet."}`,
            created_at: new Date().toISOString(),
            state_code: user?.state_code || null,
          },
        ]);
        return;
      }
      const data = await r.json();
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), data.user_message, data.assistant_message]);
      scrollToBottom(true);
    } finally {
      setSending(false);
    }
  };

  const items = buildListItems(messages, user?.state_code);

  useEffect(() => {
    if (!loading && items.length > 0 && !didInitialScroll) {
      scrollToBottom(false);
      setDidInitialScroll(true);
    }
  }, [didInitialScroll, items.length, loading, scrollToBottom]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]} testID="chat-screen">
      <TopBar title="Myra Project" rightLabel={user?.state_code || undefined} />
      <ContentBackground>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyWrap} testID="chat-empty-state">
              <View style={styles.emptyAvatarRing}><Image source={MYRA_AVATAR} style={styles.emptyAvatar} /></View>
              <T variant="display" align="center" color={theme.textOnDark} style={{ marginTop: 24 }}>Myra vagyok.</T>
              <View style={styles.emptyRule} />
              <T variant="body" align="center" color="rgba(247,251,255,0.72)" style={{ maxWidth: 300 }}>
                {'Írj, amikor készen állsz. Egy "szia" is elég a kezdéshez.'}
              </T>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => (item.kind === "msg" ? item.msg.id : item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) =>
                item.kind === "hint" ? (
                  <View style={styles.hintWrap}>
                    <Image source={MYRA_AVATAR} style={styles.hintAvatar} />
                    <T variant="small" color="rgba(247,251,255,0.66)" align="center" style={{ marginTop: 10 }}>
                      Új mérés a {item.code} kóddal. Myra ehhez a szálhoz igazodva folytatja.
                    </T>
                  </View>
                ) : <Bubble msg={item.msg} onSpeak={speakMessage} speaking={speakingId === item.msg.id} />
              }
              onContentSizeChange={() => {
                if (!didInitialScroll) {
                  scrollToBottom(false);
                  setDidInitialScroll(true);
                }
              }}
              onLayout={() => {
                if (!didInitialScroll) scrollToBottom(false);
              }}
              ListFooterComponent={sending ? (
                <View style={styles.typing} testID="typing-indicator">
                  <ActivityIndicator color={theme.primary} size="small" />
                  <T variant="small" color="rgba(247,251,255,0.66)" style={{ marginLeft: 8 }}>Myra ír...</T>
                </View>
              ) : null}
            />
          )}

          {isReadOnly ? (
            <View style={styles.readOnlyBar} testID="read-only-bar">
              <T variant="small" color="rgba(247,251,255,0.70)" align="center">Ez egy korábbi mérési szál, jelenleg csak olvasható.</T>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TouchableOpacity
                onPress={toggleDictation}
                style={[styles.voiceBtn, listening && styles.voiceBtnActive]}
                disabled={sending}
                testID="chat-dictation-button"
                activeOpacity={0.82}
              >
                <Ionicons name={listening ? "mic" : "mic-outline"} size={21} color={listening ? theme.primaryDark : "rgba(247,251,255,0.82)"} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={listening ? "Hallgatlak..." : "Írj vagy diktálj Myrának..."}
                placeholderTextColor="rgba(247,251,255,0.48)"
                value={input}
                onChangeText={setInput}
                multiline
                testID="chat-input"
                editable={!sending}
              />
              <TouchableOpacity onPress={send} style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} disabled={!input.trim() || sending} testID="chat-send-button" activeOpacity={0.8}>
                <LinearGradient colors={[theme.accentDeep, theme.primarySoft]} style={styles.sendGradient}>
                  <Ionicons name="arrow-up" size={20} color={theme.white} />
                </LinearGradient>
              </TouchableOpacity>
              {voiceStatus ? (
                <T variant="small" color="rgba(247,251,255,0.54)" style={styles.voiceStatus}>{voiceStatus}</T>
              ) : null}
            </View>
          )}
        </KeyboardAvoidingView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function Bubble({ msg, onSpeak, speaking }: { msg: Msg; onSpeak: (msg: Msg) => void; speaking: boolean }) {
  const isUser = msg.role === "user";
  const time = formatMessageTime(msg.created_at);
  return (
    <View style={[styles.messageWrap, isUser ? styles.messageWrapUser : styles.messageWrapAi]}>
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]} testID={`message-${msg.role}`}>
        {!isUser ? <Image source={MYRA_AVATAR} style={styles.aiAvatar} /> : null}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi, isUser ? null : shadow.card]}>
          <T variant="bodyLg" color={theme.textOnDark}>{msg.text}</T>
          {!isUser ? (
            <TouchableOpacity onPress={() => onSpeak(msg)} style={styles.speakBtn} activeOpacity={0.75} testID="message-speak-button">
              <Ionicons name={speaking ? "stop" : "volume-medium-outline"} size={16} color="rgba(247,251,255,0.72)" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {time ? (
        <T variant="small" color="rgba(247,251,255,0.42)" style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
          {time}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  emptyAvatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,19,32,0.50)",
  },
  emptyAvatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: "rgba(6,19,32,0.50)" },
  emptyRule: { width: 36, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginTop: 14, marginBottom: 14 },
  listContent: { padding: 18, paddingBottom: 24, gap: 12 },
  messageWrap: { gap: 4 },
  messageWrapUser: { alignItems: "flex-end" },
  messageWrapAi: { alignItems: "flex-start" },
  bubbleRow: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end", paddingLeft: 32 },
  bubbleRowAi: { justifyContent: "flex-start", paddingRight: 24 },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(6,19,32,0.50)" },
  bubble: { maxWidth: "82%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  bubbleUser: { backgroundColor: "rgba(29,142,216,0.78)", borderBottomRightRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  bubbleAi: { backgroundColor: "rgba(6,19,32,0.62)", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(18px)" },
  speakBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,251,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(247,251,255,0.14)",
  },
  timestamp: { fontSize: 10, lineHeight: 14 },
  timestampUser: { marginRight: 4 },
  timestampAi: { marginLeft: 42 },
  typing: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  hintWrap: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  hintAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(6,19,32,0.50)" },
  readOnlyBar: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "rgba(6,19,32,0.62)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)", backdropFilter: "blur(18px)" },
  inputBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "rgba(6,19,32,0.62)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backdropFilter: "blur(18px)",
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,251,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(247,251,255,0.18)",
  },
  voiceBtnActive: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accent,
  },
  voiceStatus: {
    position: "absolute",
    left: 18,
    top: -22,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: theme.textOnDark,
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  sendGradient: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.45 },
});
