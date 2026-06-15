import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, authedFetch } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { theme } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
// A severity hivatalosan is a típus része lett
type Item = { code: string; title: string; profile: string; severity?: string };
export default function AdminScreen() {
  useAuthGuard();
  const { token, user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null,
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authedFetch(token, "/api/admin/codes");
      if (r.ok) {
        const data = await r.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);
  const del = (code: string) => {
    Alert.alert("Törlés", `Biztos törlöd a ${code} kódot?`, [
      { text: "Mégse", style: "cancel" },
      {
        text: "Törlés",
        style: "destructive",
        onPress: async () => {
          await authedFetch(token, `/api/admin/codes/${code}`, { method: "DELETE" });
          load();
        },
      },
    ]);
  };
  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Admin" showBack />
        <ContentBackground>
          <View style={styles.center}>
            <Text style={styles.empty}>Nincs jogosultságod ehhez az oldalhoz.</Text>
          </View>
        </ContentBackground>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} testID="admin-screen">
      <TopBar title="Állapotkódok" showBack />
      <ContentBackground>
        <View style={styles.container}>
          <View style={styles.headRow}>
            <Text style={styles.count}>{items.length} kód</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setEditor({ open: true, item: null })}
                testID="admin-add-code"
              >
                <Text style={styles.addBtnText}>+ Új kód</Text>
              </TouchableOpacity>
            </View>
          </View>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.code}
              contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
              ListEmptyComponent={
                <Text style={styles.empty}>Még nincs kód. Adj hozzá egyet.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row} testID={`code-row-${item.code}`}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.code}>{item.code}</Text>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={styles.rowProfile} numberOfLines={2}>
                      {item.profile}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      onPress={() => setEditor({ open: true, item })}
                      testID={`edit-${item.code}`}
                      style={styles.textBtn}
                    >
                      <Text style={styles.editBtnText}>Szerkeszt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => del(item.code)}
                      testID={`delete-${item.code}`}
                      style={styles.textBtn}
                    >
                      <Text style={styles.deleteBtnText}>Töröl</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </ContentBackground>
      <EditorModal
        visible={editor.open}
        item={editor.item}
        onClose={() => setEditor({ open: false, item: null })}
        onSaved={() => {
          setEditor({ open: false, item: null });
          load();
        }}
        token={token}
      />
    </SafeAreaView>
  );
}
function EditorModal({
  visible,
  item,
  onClose,
  onSaved,
  token,
}: {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [profile, setProfile] = useState("");
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCode(item?.code || "");
    setTitle(item?.title || "");
    setProfile(item?.profile || "");
    setSeverity(item?.severity);
    setError(null);
  }, [item, visible]);
  const save = async () => {
    setError(null);
    if (!/^\d{4}$/.test(code)) {
      setError("A kódnak 4 számjegyűnek kell lennie");
      return;
    }
    if (!title.trim() || !profile.trim()) {
      setError("Cím és profil leírás kötelező");
      return;
    }
    setBusy(true);
    const url = item ? `/api/admin/codes/${code}` : "/api/admin/codes";
    const method = item ? "PUT" : "POST";
    const aVal = parseInt(code[0], 10);
    const pVal = parseInt(code[1], 10);
    const hVal = parseInt(code[2], 10);
    const cVal = parseInt(code[3], 10);
    try {
      const r = await authedFetch(token, url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          title: title.trim(),
          profile: profile.trim(),
          severity: severity || "CRITICAL",
          a: aVal,
          p: pVal,
          h: hVal,
          c: cVal,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d?.detail || "Mentési hiba");
        setBusy(false);
        return;
      }
      onSaved();
    } catch (err) {
      setError("Hálózati hiba történt a mentés során.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={modalStyles.sheet}
        >
          <ScrollView
            contentContainerStyle={modalStyles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={modalStyles.handleWrap}>
              <View style={modalStyles.handle} />
            </View>
            <Text style={modalStyles.title}>
              {item ? "Kód szerkesztése" : "Új állapotkód"}
            </Text>
            <Text style={modalStyles.label}>Kód (4 számjegy)</Text>
            <TextInput
              style={modalStyles.input}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={theme.textSecondary}
              editable={!item}
              testID="editor-code"
            />
            <Text style={modalStyles.label}>Cím</Text>
            <TextInput
              style={modalStyles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="pl. Egyensúly állapot"
              placeholderTextColor={theme.textSecondary}
              testID="editor-title"
            />
            <Text style={modalStyles.label}>Profil leírás (kontextus az AI-nak)</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.textarea]}
              value={profile}
              onChangeText={setProfile}
              multiline
              placeholder="Részletes leírás az állapotról…"
              placeholderTextColor={theme.textSecondary}
              testID="editor-profile"
            />
            {error ? <Text style={modalStyles.error}>{error}</Text> : null}
            <View style={modalStyles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={modalStyles.cancelBtn}
                testID="editor-cancel"
              >
                <Text style={modalStyles.cancelBtnText}>Mégse</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={save}
                style={modalStyles.saveBtn}
                disabled={busy}
                testID="editor-save"
              >
                {busy ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={modalStyles.saveBtnText}>Mentés</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "rgba(247,251,255,0.72)", textAlign: "center", padding: 24 },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  count: { color: "rgba(247,251,255,0.66)", fontSize: 13 },
  usersBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  usersBtnText: { color: theme.primary, fontWeight: "500", fontSize: 14 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.accentDeep,
  },
  addBtnText: { color: theme.white, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(6,19,32,0.58)",
    backdropFilter: "blur(18px)",
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  code: { fontSize: 20, fontWeight: "300", color: theme.accentSoft, width: 56 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: theme.textOnDark, flex: 1 },
  rowProfile: { fontSize: 12, color: "rgba(247,251,255,0.62)", marginTop: 4, marginLeft: 66 },
  rowActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  textBtn: { padding: 4 },
  editBtnText: { color: theme.accent, fontSize: 13, fontWeight: "500" },
  deleteBtnText: { color: theme.danger, fontSize: 13, fontWeight: "500" },
});
const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(3,12,22,0.64)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "rgba(6,19,32,0.96)", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  sheetContent: { padding: 24, paddingBottom: 36 },
  handleWrap: { alignItems: "center", marginBottom: 8 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: theme.border },
  title: { fontSize: 22, fontWeight: "500", color: theme.textOnDark, marginBottom: 18 },
  label: { fontSize: 12, color: "rgba(247,251,255,0.66)", marginTop: 12, marginBottom: 6, letterSpacing: 1 },
  input: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: theme.textOnDark },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  error: { color: theme.danger, marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 999, borderWidth: 2, borderColor: theme.border, alignItems: "center" },
  cancelBtnText: { color: theme.accent, fontWeight: "500" },
  saveBtn: { flex: 1, paddingVertical: 16, borderRadius: 999, backgroundColor: theme.accentDeep, alignItems: "center" },
  saveBtnText: { color: theme.white, fontWeight: "500" },
});
