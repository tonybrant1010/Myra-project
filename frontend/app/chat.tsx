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
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { shadow, theme } from "@/src/theme";
import ContentBackground from "@/src/components/ContentBackground";
import FeedbackButton from "@/src/components/FeedbackButton";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import type { ViewStyle } from "react-native";

/** A `backdropFilter` bongeszos CSS-tulajdonsag: RN Web futasidoben atengedi a DOM-nak,
 *  a ViewStyle tipus viszont nem ismeri, ezert a `tsc --noEmit` elhasal rajta. Igy a
 *  vizualis hatas megmarad, a tipusellenorzes pedig tiszta. */
const webBlur = (px: number) => ({ backdropFilter: `blur(${px}px)` }) as ViewStyle;


/** Enterrel küldés CSAK asztali gépen. Érintőképernyős eszközön az Enter marad
 *  sortörés, különben a virtuális billentyűzet return gombja félkész üzeneteket
 *  küldene ki. A "(pointer: fine)" az egér/trackpad jelenlétét jelzi. */
const IS_DESKTOP_WEB = (() => {
  if (Platform.OS !== "web") return false;
  const g: any = globalThis as any;
  if (typeof g.matchMedia !== "function") return false;
  const ua = String(g.navigator?.userAgent || "");
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return false;
  try {
    return g.matchMedia("(pointer: fine)").matches === true;
  } catch {
    return false;
  }
})();

const MYRA_AVATAR = require("@/assets/images/myra-avatar.png");
const CHAT_MESSAGE_MAX_CHARS = 8000;

// A backend akkor is elmenti Myra válaszát, ha a küldő kérés közben elszállt: a
// szerveroldali proxy (Caddy) időkorlátja 15 perc, egy lassabb Gemini- vagy helyi
// modell-válasz viszont ennél is tovább tarthat (mértünk 100 mp-es, sikeresen
// elmentett választ). Ilyenkor nincs értelme hibát mutatni — megvárjuk és beolvassuk
// az előzményből. Összesen ~90 mp-ig próbálkozunk.
// A helyi (CPU-n futó) modell egy válasza percekig is tarthat, főleg a hideg
// gyorsítótár utáni első kérésnél (a prompt előfeldolgozása akár 2-3 perc).
// Ilyenkor a backend tovább dolgozik és elmenti a választ: ennyi ideig várjuk
// (összesen kb. 7 perc), közben a „Myra ír...” jelzés látszik.
const REPLY_RECOVERY_DELAYS_MS = [3000, 5000, 7000, 10000, 15000, 20000, 30000, ...Array(20).fill(15000)];

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

  const normalized = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
}

function formatExportDate(value: string): string {
  const normalized = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value || "";
  return d.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Budapest",
  });
}

function buildChatTranscript(messages: Msg[], sessionId: string | null, stateCode: string | null | undefined): string {
  const lines = [
    "Myra Project - beszelgetes export",
    `Letoltes ideje: ${new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })}`,
    `Session: ${sessionId || "-"}`,
    `Allapotkod: ${stateCode || "-"}`,
    "",
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "Felhasznalo" : "Myra";
    lines.push(`[${formatExportDate(msg.created_at)}] ${role}`);
    lines.push(msg.text);
    lines.push("");
  }

  return lines.join("\n");
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
  useAuthGuard();
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { session_id: paramSessionId } = useLocalSearchParams<{ session_id?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [revealedTexts, setRevealedTexts] = useState<Record<string, string>>({});
  const [didInitialScroll, setDidInitialScroll] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const recognitionRef = useRef<any>(null);
  // A backendtől kapott WAV lejátszója. A blob URL-t felszabadítjuk, különben
  // minden felolvasás után a memóriában marad.
  const audioRef = useRef<any>(null);
  // A `speakingId` állapot tükre. A felolvasás aszinkron: mire a hang megérkezik,
  // a felhasználó már máshol járhat. A ref azonnal frissül, az állapot csak
  // újrarendereléskor — ezért a lemondást ezen keresztül ellenőrizzük.
  const speakingIdRef = useRef<string | null>(null);
  const dictationBaseRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealActiveRef = useRef<{ id: string; text: string } | null>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  const downloadTranscript = useCallback(() => {
    if (Platform.OS !== "web" || messages.length === 0) return;
    const transcript = buildChatTranscript(messages, viewSessionId || activeSessionId, user?.state_code);
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const safeSession = (viewSessionId || activeSessionId || "chat").replace(/[^a-zA-Z0-9_-]/g, "-");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = `myra-beszelgetes-${safeSession}-${stamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [activeSessionId, messages, user?.state_code, viewSessionId]);

  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      recognitionRef.current?.stop?.();
      if (Platform.OS === "web") {
        (globalThis as any).speechSynthesis?.cancel?.();
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

  // Proaktív Myra check-in: pár nap kihagyás után Myra nyitja újra a beszélgetést.
  // A backend dönti el, kell-e (best effort); szálanként legfeljebb egyszer kérjük le.
  const checkinRequestedRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !token) return;
    if (!viewSessionId || !activeSessionId || viewSessionId !== activeSessionId) return;
    if (isReadOnly || messages.length === 0) return;
    if (checkinRequestedRef.current === viewSessionId) return;
    checkinRequestedRef.current = viewSessionId;
    (async () => {
      try {
        const r = await authedFetch(token, "/api/chat/checkin", { method: "POST" });
        if (!r.ok) return;
        const data = await r.json().catch(() => null);
        const msg = (data?.message || null) as Msg | null;
        if (msg && msg.id) {
          setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
          animateAssistantMessage(msg);
          scrollToBottom(true);
        }
      } catch {
        // csendes hiba — a check-in opcionális kényelmi funkció
      }
    })();
  }, [loading, token, viewSessionId, activeSessionId, isReadOnly, messages.length, animateAssistantMessage, scrollToBottom]);

  const stopSpeech = useCallback(() => {
    if (Platform.OS === "web") {
      (globalThis as any).speechSynthesis?.cancel?.();
    }
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        if (audio.src) (globalThis as any).URL?.revokeObjectURL?.(audio.src);
      } catch {
        // a lejátszó eldobása sosem buktathatja meg a hívót
      }
      audioRef.current = null;
    }
    speakingIdRef.current = null;
    setSpeakingId(null);
  }, []);

  // Ha a felhasználó elnavigál felolvasás közben, a hang ne szóljon tovább.
  useEffect(() => () => stopSpeech(), [stopSpeech]);

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

  /** Myra hangja. A backend `/api/tts/speak` végpontja adja a WAV-ot; ott ugyanaz
   *  a Gemini-hang szól, mint a Myra Live-ban, tehát a két felületen ugyanaz a
   *  valaki beszél. A backend lemezen gyorsítótáraz, így egy már felolvasott
   *  üzenet másodszorra azonnal jön. */
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

    const text = (msg.text || "").trim();
    if (!text) return;

    // Azonnal aktívra váltunk, hogy a gomb visszajelezzen a hálózati várakozás alatt is.
    speakingIdRef.current = msg.id;
    setSpeakingId(msg.id);
    setVoiceStatus(null);

    let objectUrl: string | null = null;
    try {
      const r = await authedFetch(token, "/api/tts/speak", {
        method: "POST",
        body: JSON.stringify({ text: text.slice(0, 2500) }),
      });
      if (!r.ok) throw new Error(String(r.status));

      // Közben a felhasználó megnyomhatta újra a gombot vagy elnavigálhatott.
      if (speakingIdRef.current !== msg.id) return;

      const blob = await r.blob();
      objectUrl = (globalThis as any).URL.createObjectURL(blob);
      if (speakingIdRef.current !== msg.id) {
        (globalThis as any).URL?.revokeObjectURL?.(objectUrl);
        return;
      }

      const audio = new (globalThis as any).Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => stopSpeech();
      audio.onerror = () => {
        setVoiceStatus("A felolvasás nem sikerült.");
        stopSpeech();
      };
      await audio.play();
    } catch {
      if (objectUrl) (globalThis as any).URL?.revokeObjectURL?.(objectUrl);
      setVoiceStatus("A felolvasás most nem érhető el.");
      speakingIdRef.current = null;
      setSpeakingId(null);
      audioRef.current = null;
    }
  }, [token, speakingId, stopSpeech]);

  /** Elszállt küldés után megnézi, megérkezett-e mégis Myra válasza az előzménybe.
   *  Visszaadja a friss üzenetlistát, ha igen — különben null. */
  const recoverPendingReply = useCallback(async (sid: string | null, sentText: string): Promise<Msg[] | null> => {
    const url = sid ? `/api/chat/history?session_id=${sid}` : "/api/chat/history";
    for (const delay of REPLY_RECOVERY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const r = await authedFetch(token, url);
        if (!r.ok) continue;
        const hist = await r.json();
        const list: Msg[] = hist.messages || [];
        // Az elküldött üzenetünk utolsó előfordulása után kell lennie assistant válasznak.
        let sentIndex = -1;
        for (let i = list.length - 1; i >= 0; i -= 1) {
          if (list[i].role === "user" && list[i].text === sentText) {
            sentIndex = i;
            break;
          }
        }
        if (sentIndex >= 0 && list.slice(sentIndex + 1).some((m) => m.role === "assistant")) {
          return list;
        }
      } catch {
        // hálózati hiba a lekérdezés közben — jöhet a következő próbálkozás
      }
    }
    return null;
  }, [token]);

  /** A /api/chat/send-stream SSE-válaszát olvassa. A "text" esemény az eddig megírt
   * teljes szöveget hozza, a "done" ugyanazt, amit a /api/chat/send adna, az "error"
   * pedig státuszt és üzenetet. Ha a stream végeredmény nélkül zárul, kivételt dob,
   * és a hívó a megszokott módon megnézi, elkészült-e közben a válasz. */
  const readChatStream = async (r: Response, onText: (text: string) => void): Promise<any> => {
    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let sep = buffer.indexOf("\n\n");
      while (sep >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
        }
        if (!dataLines.length) continue;
        const payload = JSON.parse(dataLines.join("\n"));
        if (event === "text") onText(String(payload ?? ""));
        else if (event === "done") return payload;
        else if (event === "error") {
          throw { streamError: true, status: Number(payload?.status) || 502, detail: payload?.detail };
        }
      }
      if (done) break;
    }
    throw new Error("A válasz-stream a végeredmény előtt lezárult.");
  };

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
    // Íródás közben ez a buborék mutatja Myra válaszát; a végén a mentett üzenet váltja.
    const streamId = `stream-${Date.now()}`;
    let streamStarted = false;
    setMessages((m) => [...m, optimistic]);
    scrollToBottom(true);

    const showSendError = async (status: number, detail?: string) => {
      // 500/502/504 esetén a backend jó eséllyel MÉG DOLGOZIK (vagy már végzett is,
      // csak a proxy adta fel) — ilyenkor előbb megvárjuk a választ, és csak utána
      // mondjuk azt, hogy nem sikerült. A 4xx-ek (kvóta, jogosultság) végleges hibák.
      if (status >= 500) {
        const recovered = await recoverPendingReply(activeSessionId, text);
        if (recovered) {
          finishReveal();
          setMessages(recovered);
          const lastAssistant = [...recovered].reverse().find((m) => m.role === "assistant");
          if (lastAssistant) animateAssistantMessage(lastAssistant);
          scrollToBottom(true);
          return;
        }
      }
      const errorMessage: Msg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: `Figyelem: ${detail || "Nem sikerült elküldeni az üzenetet."}`,
        created_at: new Date().toISOString(),
        state_code: user?.state_code || null,
      };
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id && x.id !== streamId),
        errorMessage,
      ]);
      animateAssistantMessage(errorMessage);
      // A beírt szöveg SOHA ne vesszen el hibánál: visszakerül a beviteli mezőbe,
      // hogy egyetlen gombnyomással újraküldhető legyen.
      setInput(text);
      scrollToBottom(true);
    };

    const onStreamText = (partial: string) => {
      if (!partial) {
        // A helyi modell félúton elakadt, az API-válasz egyben jön: a félkész szöveg eltűnik.
        if (streamStarted) {
          streamStarted = false;
          setStreamingId(null);
          setMessages((m) => m.filter((x) => x.id !== streamId));
        }
        return;
      }
      if (!streamStarted) {
        streamStarted = true;
        finishReveal();
        setStreamingId(streamId);
        setMessages((m) => [
          ...m,
          { id: streamId, role: "assistant", text: partial, created_at: new Date().toISOString(), state_code: user?.state_code || null },
        ]);
      } else {
        setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, text: partial } : x)));
      }
      scrollToBottom(false);
    };

    try {
      const r = await authedFetch(token, "/api/chat/send-stream", { method: "POST", body: JSON.stringify({ message: text, session_id: activeSessionId }) });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        await showSendError(r.status, errData?.detail);
        return;
      }
      let data: any;
      if ((r.headers.get("content-type") || "").includes("text/event-stream") && r.body) {
        try {
          data = await readChatStream(r, onStreamText);
        } catch (e: any) {
          if (e?.streamError) {
            await showSendError(e.status, e.detail);
            return;
          }
          throw e;
        }
      } else {
        data = await r.json();
      }
      const assistantMessage = data.assistant_message as Msg;
      // Amit már íródás közben látott, azt nem gépeljük ki még egyszer.
      if (streamStarted) animatedMessageIdsRef.current.add(assistantMessage.id);
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id && x.id !== streamId),
        data.user_message,
        assistantMessage,
      ]);
      if (!streamStarted) animateAssistantMessage(assistantMessage);
      scrollToBottom(true);
    } catch {
      // Megszakadt kapcsolat: a kérés ettől még elérhette a backendet, ezért itt is
      // előbb megnézzük, megjött-e a válasz, és csak utána hibázunk.
      const recovered = await recoverPendingReply(activeSessionId, text).catch(() => null);
      if (recovered) {
        finishReveal();
        setMessages(recovered);
        const lastAssistant = [...recovered].reverse().find((m) => m.role === "assistant");
        if (lastAssistant) {
          if (streamStarted) animatedMessageIdsRef.current.add(lastAssistant.id);
          animateAssistantMessage(lastAssistant);
        }
        scrollToBottom(true);
        return;
      }
      // Hálózati hiba / megszakadt kapcsolat: enélkül az optimista buborék bent maradt
      // "elküldve" látszattal, a felhasználó pedig semmilyen visszajelzést nem kapott.
      const networkError: Msg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: "Figyelem: nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot, és küldd el újra az üzenetet.",
        created_at: new Date().toISOString(),
        state_code: user?.state_code || null,
      };
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id && x.id !== streamId), networkError]);
      animateAssistantMessage(networkError);
      setInput(text);
      scrollToBottom(true);
    } finally {
      setStreamingId(null);
      setSending(false);
    }
  };

  /** Asztali gépen az Enter küld, a Shift+Enter (és a módosítós változatok) sortörnek. */
  const handleInputKeyPress = (e: any) => {
    if (!IS_DESKTOP_WEB) return;
    const native = e?.nativeEvent || {};
    const key = native.key ?? e?.key;
    if (key !== "Enter") return;
    if (native.shiftKey || native.altKey || native.ctrlKey || native.metaKey) return;
    if (e?.shiftKey || e?.altKey || e?.ctrlKey || e?.metaKey) return;
    e?.preventDefault?.();
    native?.preventDefault?.();
    void send();
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
      <ContentBackground>
        <TopBar
          title="Myra Project"
          rightLabel={user?.state_code || undefined}
          rightAction={
            Platform.OS === "web" && messages.length > 0
              ? { icon: "download-outline", onPress: downloadTranscript, testID: "chat-download-transcript-button" }
              : undefined
          }
        />
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
              ListHeaderComponent={sending && !streamingId ? (
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
                onKeyPress={handleInputKeyPress}
                maxLength={CHAT_MESSAGE_MAX_CHARS}
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
            <FeedbackButton context="chat" />
            <T variant="small" color="rgba(247,251,255,0.58)" align="center" style={styles.disclaimerText}>
              Mesterséges intelligenciával beszélgetsz, nem emberrel. A Myra nem ad orvosi tanácsot és nem helyettesíti a szakembert.
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
    borderColor: "rgba(79,209,197,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,27,48,0.48)",
  },
  emptyAvatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: "rgba(7,27,48,0.48)" },
  emptyRule: { width: 36, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginTop: 14, marginBottom: 14 },
  listContent: { padding: 18, paddingBottom: 24, gap: 12 },
  messageWrap: { gap: 4 },
  messageWrapUser: { alignItems: "flex-end" },
  messageWrapAi: { alignItems: "flex-start" },
  bubbleRow: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end", paddingLeft: 32 },
  bubbleRowAi: { justifyContent: "flex-start", paddingRight: 24 },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(7,27,48,0.48)" },
  bubble: { maxWidth: "82%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  bubbleUser: { backgroundColor: "rgba(79,209,197,0.22)", borderBottomRightRadius: 4, borderWidth: 1, borderColor: "rgba(79,209,197,0.45)" },
  bubbleAi: { backgroundColor: "rgba(7,27,48,0.58)", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "rgba(79,209,197,0.22)", ...webBlur(20) },
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
  readOnlyBar: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: "rgba(6,19,32,0.62)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)", ...webBlur(18) },
  inputBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "rgba(4,11,20,0.72)",
    borderTopWidth: 1,
    borderColor: "rgba(79,209,197,0.25)",
    ...webBlur(20),
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.25)",
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.25)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: theme.textOnDark,
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  sendGradient: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.45 },
  disclaimerBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(6,19,32,0.62)",
    borderTopWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    gap: 6,
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
