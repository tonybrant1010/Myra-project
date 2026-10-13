import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { T } from "@/src/components/Typography";
import { theme } from "@/src/theme";

const FEEDBACK_MAX_CHARS = 2000;

type Props = {
  context: "chat" | "live";
  label?: string;
};

export default function FeedbackButton({ context, label = "Visszajelzés" }: Props) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = useCallback(() => {
    if (sending) return;
    setOpen(false);
    setError(null);
    setSent(false);
    setText("");
  }, [sending]);

  const submit = useCallback(async () => {
    const message = text.trim();
    if (message.length < 3 || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await authedFetch(token, "/api/feedback", {
        method: "POST",
        body: JSON.stringify({ message, context }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.detail || "Nem sikerült elküldeni a visszajelzést.");
        return;
      }
      setSent(true);
      setText("");
    } catch {
      setError("Nem sikerült elérni a szervert. Próbáld meg később.");
    } finally {
      setSending(false);
    }
  }, [context, sending, text, token]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.trigger}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Visszajelzés küldése a fejlesztőnek"
        testID={`feedback-button-${context}`}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={13} color="rgba(247,251,255,0.62)" />
        <T variant="small" color="rgba(247,251,255,0.62)" style={styles.triggerText}>
          {label}
        </T>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card} testID="feedback-modal">
            <View style={styles.header}>
              <T variant="title" color={theme.textOnDark}>
                Visszajelzés a fejlesztőnek
              </T>
              <TouchableOpacity onPress={close} style={styles.closeBtn} testID="feedback-close">
                <Ionicons name="close" size={20} color="rgba(247,251,255,0.72)" />
              </TouchableOpacity>
            </View>

            {sent ? (
              <View style={styles.doneWrap}>
                <Ionicons name="checkmark-circle-outline" size={34} color={theme.accent} />
                <T variant="body" color={theme.textOnDark} align="center" style={styles.doneText}>
                  Köszönjük! A visszajelzésed elment a fejlesztőnek.
                </T>
                <TouchableOpacity onPress={close} style={styles.primaryBtn} activeOpacity={0.8}>
                  <T variant="title" color={theme.white}>Bezárás</T>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <T variant="small" color="rgba(247,251,255,0.66)" style={styles.hint}>
                  Írd le, mit tapasztaltál — hibát, ötletet, bármit. A neved és az e-mail-címed
                  automatikusan mellékelődik, hogy vissza lehessen kérdezni.
                </T>
                <TextInput
                  style={styles.input}
                  placeholder="Ide írhatsz..."
                  placeholderTextColor="rgba(247,251,255,0.42)"
                  value={text}
                  onChangeText={setText}
                  maxLength={FEEDBACK_MAX_CHARS}
                  multiline
                  editable={!sending}
                  autoFocus={Platform.OS === "web"}
                  testID="feedback-input"
                />
                <View style={styles.footer}>
                  <T variant="small" color="rgba(247,251,255,0.42)">
                    {`${text.trim().length}/${FEEDBACK_MAX_CHARS}`}
                  </T>
                  <TouchableOpacity
                    onPress={submit}
                    style={[styles.primaryBtn, (text.trim().length < 3 || sending) && styles.primaryBtnDisabled]}
                    disabled={text.trim().length < 3 || sending}
                    activeOpacity={0.8}
                    testID="feedback-submit"
                  >
                    {sending ? (
                      <ActivityIndicator color={theme.white} size="small" />
                    ) : (
                      <T variant="title" color={theme.white}>Küldés</T>
                    )}
                  </TouchableOpacity>
                </View>
                {error ? (
                  <T variant="small" color={theme.danger} style={styles.error} testID="feedback-error">
                    {error}
                  </T>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  triggerText: { fontSize: 11, lineHeight: 15 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,12,22,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#0a1a2b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.28)",
    padding: 18,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  hint: { marginBottom: 12, lineHeight: 17 },
  input: {
    minHeight: 120,
    maxHeight: 240,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(79,209,197,0.25)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.textOnDark,
    textAlignVertical: "top",
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  primaryBtn: {
    backgroundColor: theme.accentDeep,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 108,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  error: { marginTop: 10 },
  doneWrap: { alignItems: "center", gap: 12, paddingVertical: 14 },
  doneText: { maxWidth: 340, lineHeight: 21 },
});
