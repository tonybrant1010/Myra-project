import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";

const MYRA_AVATAR = require("@/assets/images/myra-avatar.png");

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  state_code?: string | null;
};

type ListItem =
  | { kind: "msg"; msg: Msg }
  | { kind: "sep"; id: string; code: string; date: string }
  | { kind: "hint"; id: string; code: string };

function buildListItems(messages: Msg[], currentCode: string | null | undefined): ListItem[] {
  const out: ListItem[] = [];
  let lastCode: string | null | undefined = undefined;
  for (const m of messages) {
    if (m.state_code && m.state_code !== lastCode) {
      const d = new Date(m.created_at);
      out.push({
        kind: "sep",
        id: `sep-${m.id}`,
        code: m.state_code,
        date: d.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }),
      });
      lastCode = m.state_code;
    }
    out.push({ kind: "msg", msg: m });
  }
  if (currentCode && lastCode !== currentCode) {
    out.push({
      kind: "sep",
      id: `sep-current-${currentCode}`,
      code: currentCode,
      date: new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }),
    });
    out.push({ kind: "hint", id: "hint-current", code: currentCode });
  }
  return out;
}

export default function ChatScreen() {
  const { token, user } = useAuth();
  const { session_id: paramSessionId } = useLocalSearchParams<{ session_id?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [didInitialScroll, setDidInitialScroll] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Sessionök betöltése — meghatározzuk melyik az aktív (legújabb)
  useEffect(() => {
    if (!token) return;
    authedFetch(token, "/api/quiz/sessions")
      .then((r) => r.json())
      .then((d) => {
        const sessions: { id: string }[] = d.sessions || [];
        const latest = sessions[0]?.id || null;
        setActiveSessionId(latest);
        // Ha van URL param, azt nézzük; különben a legújabb
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
    if (viewSessionId !== undefined) {
      loadHistory(viewSessionId);
    }
  }, [viewSessionId, loadHistory]);

  const isReadOnly = viewSessionId !== null && viewSessionId !== activeSessionId;

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
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await authedFetch(token, "/api/chat/send", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: activeSessionId }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            text: `⚠ ${data?.detail || "Nem sikerült elküldeni"}`,
            created_at: new Date().toISOString(),
            state_code: user?.state_code || null,
          },
        ]);
        return;
      }
      const data = await r.json();
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.user_message,
        data.assistant_message,
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } finally {
      setSending(false);
    }
  };

  const items = buildListItems(messages, user?.state_code);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]} testID="chat-screen">
      <TopBar title="Myra" rightLabel={user?.state_code || undefined} />
      <ContentBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyWrap} testID="chat-empty-state">
              <Image source={MYRA_AVATAR} style={styles.emptyAvatar} />
              <T variant="h1" align="center" style={{ marginTop: 16 }}>
                Itt vagyok.
              </T>
              <T variant="body" align="center" color={theme.textSecondary} style={{ marginTop: 8 }}>
                Írj amikor készen állsz — egy "szia" is elég a kezdéshez.
              </T>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => (item.kind === "msg" ? item.msg.id : item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) =>
                item.kind === "sep" ? null
                : item.kind === "hint" ? (
                  <View style={styles.hintWrap}>
                    <Image source={MYRA_AVATAR} style={styles.hintAvatar} />
                    <T variant="small" color={theme.textSecondary} align="center" style={{ marginTop: 10 }}>
                      Új mérés a {item.code} kóddal. Myra vár rád — kezdj egy beszélgetést.
                    </T>
                  </View>
                ) : (
                  <Bubble msg={item.msg} />
                )
              }
              onContentSizeChange={() => {
                if (!didInitialScroll) {
                  listRef.current?.scrollToEnd({ animated: false });
                  setDidInitialScroll(true);
                }
              }}
              ListFooterComponent={
                sending ? (
                  <View style={styles.typing} testID="typing-indicator">
                    <ActivityIndicator color={theme.primary} size="small" />
                    <T variant="small" color={theme.textSecondary} style={{ marginLeft: 8 }}>
                      Myra ír…
                    </T>
                  </View>
                ) : null
              }
            />
          )}

          {isReadOnly ? (
            <View style={styles.readOnlyBar} testID="read-only-bar">
              <T variant="small" color={theme.textSecondary} align="center">
                Ez egy korábbi mérés — csak olvasható
              </T>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Írj egy üzenetet Myrának…"
                placeholderTextColor={theme.textSecondary}
                value={input}
                onChangeText={setInput}
                multiline
                testID="chat-input"
                editable={!sending}
              />
              <TouchableOpacity
                onPress={send}
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                disabled={!input.trim() || sending}
                testID="chat-send-button"
                activeOpacity={0.8}
              >
                <T variant="title" color={theme.white} style={{ fontWeight: "bold" }}>
                  Küldés
                </T>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </ContentBackground>
    </SafeAreaView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <View
      style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}
      testID={`message-${msg.role}`}
    >
      {!isUser ? (
        <Image source={MYRA_AVATAR} style={styles.aiAvatar} />
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAi,
          isUser ? null : shadow.card,
        ]}
      >
        <T
          variant="bodyLg"
          color={isUser ? theme.textOnDark : theme.textPrimary}
        >
          {msg.text}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.surface,
  },
  listContent: { padding: 20, paddingBottom: 24, gap: 12 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end", marginLeft: 32 },
  bubbleRowAi: { justifyContent: "flex-start", marginRight: 24 },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
  },
  bubble: { maxWidth: "82%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22 },
  bubbleUser: { backgroundColor: theme.primary, borderBottomRightRadius: 6 },
  bubbleAi: { backgroundColor: theme.surface, borderBottomLeftRadius: 6 },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sep: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  sepLine: { flex: 1, height: 1, backgroundColor: theme.border },
  sepPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sepText: { letterSpacing: 2.4, fontSize: 10 },
  hintWrap: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  hintAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface },
  readOnlyBar: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderColor: theme.borderSoft,
  },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: theme.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: theme.border },
});
