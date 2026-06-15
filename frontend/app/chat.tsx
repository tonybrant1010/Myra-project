import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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
  // A backend UTC időt ad vissza, de nem mindig Z suffix-szel - explicit UTC-ként kezeljük
  const normalized = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const isStrong = token.startsWith("**");
    const clean = isStrong ? token.slice(2, -2) : token.slice(1, -1);
    parts.push(
      <Text key={`${keyPrefix}-${match.index}`} style={isStrong ? styles.markdownStrong : styles.markdownEm}>
        {clean}
      </Text>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function MarkdownMessage({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <View>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trimEnd()).filter(Boolean);
        const isList = lines.every((line) => /^(\*|-)\s+/.test(line.trim()));

        if (isList) {
          return (
            <View key={`block-${blockIndex}`} style={styles.markdownBlock}>
              {lines.map((line, lineIndex) => {
                const item = line.trim().replace(/^(\*|-)\s+/, "");
                return (
                  <View key={`item-${blockIndex}-${lineIndex}`} style={styles.markdownListRow}>
                    <Text style={styles.markdownBullet}>•</Text>
                    <Text style={styles.markdownText}>{renderInlineMarkdown(item, `li-${blockIndex}-${lineIndex}`)}</Text>
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <View key={`block-${blockIndex}`} style={styles.markdownBlock}>
            {lines.map((line, lineIndex) => {
              const heading = line.match(/^#{1,4}\s+(.+)$/);
              if (heading) {
                return (
                  <Text key={`h-${blockIndex}-${lineIndex}`} style={styles.markdownHeading}>
                    {renderInlineMarkdown(heading[1], `h-${blockIndex}-${lineIndex}`)}
                  </Text>
                );
              }

              const listItem = line.match(/^(\*|-)\s+(.+)$/);
              if (listItem) {
                return (
                  <View key={`mixed-li-${blockIndex}-${lineIndex}`} style={styles.markdownListRow}>
                    <Text style={styles.markdownBullet}>•</Text>
                    <Text style={styles.markdownText}>{renderInlineMarkdown(listItem[2], `mli-${blockIndex}-${lineIndex}`)}</Text>
                  </View>
                );
              }

              return (
                <Text key={`p-${blockIndex}-${lineIndex}`} style={styles.markdownText}>
                  {renderInlineMarkdown(line, `p-${blockIndex}-${lineIndex}`)}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default function ChatScreen() {
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { session_id: paramSessionId } = useLocalSearchParams<{ session_id?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [revealedTexts, setRevealedTexts] = useState<Record<string, string>>({});
  const [didInitialScroll, setDidInitialScroll] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const audioRef = useRef<any>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealActiveRef = useRef<{ id: string; text: string } | null>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      recognitionRef.current?.stop?.();
      audioRef.current?.pause?.();
      if (audioUrlRef.current && Platform.OS === "web") {
        (globalThis as any).URL?.revokeObjectURL?.(audioUrlRef.current);
      }
    };
  }, []);

  const finishReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    const active = revealActiveRef.current;
    if (active) {
      setRevealedTexts((prev) => ({ ...prev, [active.id]: active.text }));
      revealActiveRef.current = null;
    }
  }, []);

  const animateAssistantMessage = useCallback((message: Msg) => {
    if (message.role !== "assistant" || animatedMessageIdsRef.current.has(message.id)) return;
    animatedMessageIdsRef.current.add(message.id);
    finishReveal();

    const chars = Array.from(message.text);
    if (chars.length === 0) return;

    const chunkSize = chars.length > 900 ? 6 : chars.length > 520 ? 4 : chars.length > 260 ? 3 : 2;
    const intervalMs = chars.length > 900 ? 10 : 14;
    let index = 0;
    let tick = 0;

    revealActiveRef.current = { id: message.id, text: message.text };
    setRevealedTexts((prev) => ({ ...prev, [message.id]: "" }));

    const step = () => {
      index = Math.min(index + chunkSize, chars.length);
      setRevealedTexts((prev) => ({ ...prev, [message.id]: chars.slice(0, index).join("") }));

      tick += 1;
      if (tick % 16 === 0) scrollToBottom(false);

      if (index >= chars.length) {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        revealActiveRef.current = null;
        scrollToBottom(false);
      }
    };

    step();
    revealTimerRef.current = setInterval(step, intervalMs);
  }, [finishReveal, scrollToBottom]);

  useEffect(() => {
    if (!token) return;

    const fetchSessions = () => {
      authedFetch(token, "/api/quiz/sessions")
        .then((r) => r.json())
        .then((d) => {
          const sessions: { id: string }[] = d.sessions || [];
          const latest = sessions[0]?.id || null;
          setActiveSessionId(latest);
          setViewSessionId(paramSessionId || latest);
        })
        .catch(() => {});
    };

    fetchSessions();

    const unsubscribe = navigation.addListener("focus", () => {
      fetchSessions();
    });

    return unsubscribe;
  }, [token, paramSessionId, navigation]);

  const loadHistory = useCallback(async (sid: string | null) => {
    setLoading(true);
    setDidInitialScroll(false);
    try {
      const url = sid ? `/api/chat/history?session_id=${sid}` : "/api/chat/history";
      const r = await authedFetch(token, url);
      const hist = await r.json();
      finishReveal();
      setRevealedTexts({});
      animatedMessageIdsRef.current.clear();
      setMessages(hist.messages || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (viewSessionId !== null && viewSessionId !== undefined) {
      loadHistory(viewSessionId);
    } else {
      setMessages([]);
      setLoading(false);
    }
  }, [viewSessionId, loadHistory]);

  const isExpired = !!user?.is_code_expired;
  const isReadOnly = (viewSessionId !== null && viewSessionId !== activeSessionId) || isExpired;

  const stopSpeech = useCallback(() => {
    audioRef.current?.pause?.();
    audioRef.current = null;
    if (audioUrlRef.current && Platform.OS === "web") {
      (globalThis as any).URL?.revokeObjectURL?.(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeakingId(null);
  }, []);

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

  const speakMessage = useCallback(async (msg: Msg) => {
    if (Platform.OS !== "web") {
      setVoiceStatus("A felolvasás ebben a környezetben nem elérhető.");
      return;
    }
    if (speakingId === msg.id) {
      stopSpeech();
      return;
    }
    stopSpeech();
    setVoiceStatus("Hang készül...");
    try {
      const response = await authedFetch(token, "/api/tts/speak", {
        method: "POST",
        body: JSON.stringify({ text: msg.text }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setVoiceStatus(data?.detail || "A felolvasás most nem indult el.");
        return;
      }
      const blob = await response.blob();
      const url = (globalThis as any).URL.createObjectURL(blob);
      const audio = new (globalThis as any).Audio(url);
      audio.playbackRate = 1.03;
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onended = stopSpeech;
      audio.onerror = () => {
        setVoiceStatus("A hang lejátszása nem sikerült.");
        stopSpeech();
      };
      setSpeakingId(msg.id);
      setVoiceStatus(null);
      await audio.play();
    } catch {
      setVoiceStatus("A felolvasás most nem indult el.");
      stopSpeech();
    }
  }, [speakingId, stopSpeech, token]);

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
        const errorMessage: Msg = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Figyelem: ${data?.detail || "Nem sikerült elküldeni az üzenetet."}`,
          created_at: new Date().toISOString(),
          state_code: user?.state_code || null,
        };
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          errorMessage,
        ]);
        animateAssistantMessage(errorMessage);
        return;
      }
      const data = await r.json();
      const assistantMessage = data.assistant_message as Msg;
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), data.user_message, assistantMessage]);
      animateAssistantMessage(assistantMessage);
      scrollToBottom(true);
    } finally {
      setSending(false);
    }
  };

  const items = buildListItems(messages, user?.state_code);
  const visibleItems = [...items].reverse();

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
          {!isReadOnly && user?.code_days_remaining !== undefined && user.code_days_remaining <= 2 && user.code_days_remaining > 0 ? (
            <View style={styles.warningBanner}>
              <T variant="small" color={theme.white} align="center" style={{ fontWeight: "600" }}>
                ⏳ A mérési ciklusod {user.code_days_remaining} nap múlva lejár. Ezután a beszélgetés archiválásra kerül. Készülj fel az újramérésre!
              </T>
            </View>
          ) : null}
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
              data={visibleItems}
              inverted
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
                ) : (
                  <Bubble
                    msg={item.msg}
                    displayText={item.msg.role === "assistant" && revealedTexts[item.msg.id] !== undefined ? revealedTexts[item.msg.id] : item.msg.text}
                    onSpeak={speakMessage}
                    speaking={speakingId === item.msg.id}
                  />
                )
              }
              onLayout={() => {
                if (!didInitialScroll) scrollToBottom(false);
              }}
              ListHeaderComponent={sending ? (
                <View style={styles.typing} testID="typing-indicator">
                  <ActivityIndicator color={theme.primary} size="small" />
                  <T variant="small" color="rgba(247,251,255,0.66)" style={{ marginLeft: 8 }}>Myra ír...</T>
                </View>
              ) : null}
            />
          )}

          {isReadOnly ? (
            <View style={styles.readOnlyBar} testID="read-only-bar">
              {isExpired && viewSessionId === activeSessionId ? (
                <View style={{ gap: 10, alignItems: "center" }}>
                  <T variant="small" color="rgba(247,251,255,0.70)" align="center">
                    Ez a mérési ciklus lezárult. A beszélgetés archiválásra került, így ide már nem küldhetsz új üzenetet.
                  </T>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      router.replace("/quiz");
                    }}
                    activeOpacity={0.8}
                  >
                    <T variant="title" color={theme.white}>Új mérés indítása</T>
                  </TouchableOpacity>
                </View>
              ) : (
                <T variant="small" color="rgba(247,251,255,0.70)" align="center">
                  Ez egy korábbi mérési szál, jelenleg csak olvasható.
                </T>
              )}
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

          <View style={styles.disclaimerBar}>
            <T variant="small" color="rgba(247,251,255,0.42)" align="center" style={styles.disclaimerText}>
              A Myra egy mesterséges intelligenciával támogatott önismereti asszisztens. Nem ad orvosi tanácsot és nem helyettesíti a szakembert.
            </T>
          </View>
        </KeyboardAvoidingView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function Bubble({ msg, displayText, onSpeak, speaking }: { msg: Msg; displayText: string; onSpeak: (msg: Msg) => void; speaking: boolean }) {
  const isUser = msg.role === "user";
  const time = formatMessageTime(msg.created_at);
  const isRevealing = !isUser && displayText !== msg.text;
  return (
    <View style={[styles.messageWrap, isUser ? styles.messageWrapUser : styles.messageWrapAi]}>
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]} testID={`message-${msg.role}`}>
        {!isUser ? <Image source={MYRA_AVATAR} style={styles.aiAvatar} /> : null}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi, isUser ? null : shadow.card]}>
          {isUser || isRevealing ? (
            <T variant="bodyLg" color={theme.textOnDark}>
              {displayText}
              {isRevealing ? "|" : ""}
            </T>
          ) : (
            <MarkdownMessage text={displayText} />
          )}
          {!isUser && !isRevealing ? (
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
  markdownBlock: { marginBottom: 8 },
  markdownText: {
    color: theme.textOnDark,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    lineHeight: 25,
  },
  markdownHeading: {
    color: theme.textOnDark,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 4,
  },
  markdownStrong: {
    color: theme.textOnDark,
    fontFamily: "Manrope_600SemiBold",
  },
  markdownEm: {
    color: theme.textOnDark,
    fontFamily: "Manrope_400Regular",
    fontStyle: "italic",
  },
  markdownListRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
    paddingRight: 4,
  },
  markdownBullet: {
    width: 16,
    paddingTop: 1,
    color: "rgba(247,251,255,0.78)",
    fontSize: 16,
    lineHeight: 25,
  },
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
  disclaimerBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(6,19,32,0.62)",
    borderTopWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 14,
  },
  warningBanner: {
    backgroundColor: "rgba(226,135,67,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.16)",
  },
  actionBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    marginTop: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
});
