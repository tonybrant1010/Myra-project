import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";
import { setForumSeenAt, newestCreatedAt } from "@/src/utils/forumSeen";
import type { TextStyle } from "react-native";

const webWordBreak = (Platform.OS === "web"
  ? { wordBreak: "break-word", overflowWrap: "break-word" }
  : {}) as TextStyle;

type ForumPost = {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  nickname: string;
  avatar: string;
};

const AVAILABLE_AVATARS = ["🦊", "🐱", "🐶", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🦄", "🦖"];

export default function ForumScreen() {
  useAuthGuard();
  const { token, user } = useAuth();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const flatListRef = useRef<FlatList>(null);


  const loadProfile = useCallback(async () => {
    if (!token) return;
    try {
      const r = await authedFetch(token, "/api/forum/profile");
      if (r.ok) {
        const data = await r.json();
        if (data.nickname) {
          setNickname(data.nickname);
          setAvatar(data.avatar || "🦊");
        } else {
          setIsSetupOpen(true);
        }
      }
    } finally {
      setProfileLoading(false);
    }
  }, [token]);


  const loadPosts = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const r = await authedFetch(token, "/api/forum/posts");
      if (r.ok) {
        const data = await r.json();
        const loaded = data.posts || [];
        setPosts(loaded);
        await setForumSeenAt(newestCreatedAt(loaded));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts]);


  useEffect(() => {
    const interval = setInterval(() => {
      loadPosts(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadPosts]);


  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSetupSave = async () => {
    const nick = nickname.trim();
    if (!nick) {
      Alert.alert("Hiba", "Kérlek, adj meg egy becenevet!");
      return;
    }
    setSetupBusy(true);
    try {
      const r = await authedFetch(token, "/api/forum/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick, avatar }),
      });
      if (r.ok) {
        setIsSetupOpen(false);
        loadPosts();
      } else {
        const data = await r.json().catch(() => ({}));
        Alert.alert("Hiba", data.detail || "Mentés sikertelen.");
      }
    } finally {
      setSetupBusy(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    setSendBusy(true);
    try {
      const r = await authedFetch(token, "/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (r.ok) {
        const newPost = await r.json();
        setPosts((prev) => [...prev, newPost]);
        await setForumSeenAt(newPost.created_at);
        setInputText("");
        scrollToBottom();
      } else {
        const data = await r.json().catch(() => ({}));
        Alert.alert("Hiba", data.detail || "Küldés sikertelen.");
      }
    } finally {
      setSendBusy(false);
    }
  };

  const handleDeletePost = (postId: number) => {
    const action = () => {
      authedFetch(token, `/api/forum/posts/${postId}`, { method: "DELETE" }).then((r) => {
        if (r.ok) {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        } else {
          Alert.alert("Hiba", "Törlés sikertelen.");
        }
      });
    };

    if (Platform.OS === "web") {
      if (window.confirm("Biztosan törlöd ezt az üzenetet?")) {
        action();
      }
    } else {
      Alert.alert("Törlés", "Biztosan törlöd ezt az üzenetet?", [
        { text: "Mégse", style: "cancel" },
        { text: "Törlés", style: "destructive", onPress: action },
      ]);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  };

  if (profileLoading || (loading && posts.length === 0)) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentBackground>
          <TopBar title="Fórum" showBack />
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="forum-screen">
      <ContentBackground>
        <TopBar title="Fórum" showBack />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.container}>
            <FlatList
              ref={flatListRef}
              data={posts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={scrollToBottom}
              onLayout={scrollToBottom}
              ListEmptyComponent={
                <View style={styles.center}>
                  <T variant="body" color="rgba(255,255,255,0.5)">Nincsenek még üzenetek. Legyél te az első!</T>
                </View>
              }
              renderItem={({ item }) => {
                const isOwn = item.user_id === user?.id;
                const canDelete = isOwn || user?.is_admin;
                return (
                  <View style={[styles.messageWrapper, isOwn && styles.messageWrapperOwn]}>
                    <View style={styles.avatarWrap}>
                      <T style={{ fontSize: 24 }}>{item.avatar || "🦊"}</T>
                    </View>
                    <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
                      <View style={styles.messageHeader}>
                        <View style={styles.messageHeaderText}>
                          <T variant="small" color={theme.accent} style={{ fontWeight: "700" }}>
                            {item.nickname}
                          </T>
                          <T variant="small" color="rgba(255,255,255,0.4)" style={{ marginLeft: 6 }}>
                            {formatTime(item.created_at)}
                          </T>
                        </View>
                        {canDelete && (
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeletePost(item.id)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={14} color="rgba(255,100,100,0.7)" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <T variant="body" color={theme.textOnDark} style={styles.messageText}>
                        {item.content}
                      </T>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, inputFocused && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Írj egy üzenetet..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  onPress={handleSendMessage}
                  disabled={sendBusy || !inputText.trim()}
                  activeOpacity={0.8}
                >
                  {sendBusy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ContentBackground>


      <Modal visible={isSetupOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.setupCard, shadow.card]}>
            <T variant="h2" color={theme.textOnDark} style={{ marginBottom: 8, fontWeight: "700" }}>
              Fórum Profil
            </T>
            <T variant="body" color="rgba(247,251,255,0.7)" style={{ marginBottom: 20 }}>
              Kérlek, válassz egy becenevet és egy hozzáillő emoji avatart a hozzászólásaidhoz!
            </T>

            <T variant="caption" color={theme.accent} style={{ marginBottom: 8, letterSpacing: 1 }}>BECENÉV</T>
            <TextInput
              style={styles.modalInput}
              placeholder="Becenév"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={nickname}
              onChangeText={setNickname}
              maxLength={30}
            />

            <T variant="caption" color={theme.accent} style={{ marginTop: 16, marginBottom: 12, letterSpacing: 1 }}>AVATAR</T>
            <View style={styles.avatarGrid}>
              {AVAILABLE_AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.avatarOption, avatar === emoji && styles.avatarOptionSelected]}
                  onPress={() => setAvatar(emoji)}
                >
                  <T style={{ fontSize: 24 }}>{emoji}</T>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSetupSave}
              disabled={setupBusy}
            >
              {setupBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <T variant="label" color="#fff" style={{ fontWeight: "700" }}>Mentés és belépés</T>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.primaryDark,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  messageWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    maxWidth: "85%",
  },
  messageWrapperOwn: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  messageBubble: {
    backgroundColor: "rgba(7,27,48,0.72)",
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.16)",
    position: "relative",
    // A maxWidth: "85%" a SZULON (messageWrapper) van, a buborekon nem. RN-ben a
    // flexShrink alapertelmezesben 0, ezert a buborek a sajat tartalmi szelesseget
    // vette fel es kilogott a szulojebol. Sajat bejegyzesnel (row-reverse) balra,
    // masenal jobbra -- innen jott, hogy az egyik telefonon az eleje, a masikon a
    // vege hianyzott. Asztali gepen a viewport eleg szeles volt, ezert nem latszott.
    flexShrink: 1,
    minWidth: 0,
  },
  messageBubbleOwn: {
    backgroundColor: "rgba(6,42,67,0.85)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderColor: "rgba(79,209,197,0.3)",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  messageHeaderText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  messageText: {
    lineHeight: 20,
    // Egy hosszu, szokoz nelkuli szovegfolyam (link, egybeirt szo) onmagaban
    // szelesebb, mint a buborek -- a zsugoritas ezt egyedul nem oldja meg,
    // torni is kell tudni.
    ...webWordBreak,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(6,19,32,0.4)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  inputWrapperFocused: {
    borderColor: theme.accent,
    boxShadow: "0 0 10px rgba(79,209,197,0.25)",
  } as any,
  input: {
    flex: 1,
    color: theme.textOnDark,
    fontSize: 15,
    paddingVertical: 6,
    outlineStyle: "none",
  } as any,
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accentDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  setupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#051626",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.22)",
    borderRadius: 24,
    padding: 24,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    color: theme.textOnDark,
    padding: 12,
    fontSize: 16,
    outlineStyle: "none",
  } as any,
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 20,
  },
  avatarOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarOptionSelected: {
    borderColor: theme.accent,
    backgroundColor: "rgba(79,209,197,0.12)",
  },
  saveBtn: {
    backgroundColor: theme.accentDeep,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
