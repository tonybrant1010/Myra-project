import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useAuth, authedFetch, apiUrl } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import { theme, shadow } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import ContentBackground from "@/src/components/ContentBackground";
import { T } from "@/src/components/Typography";

type KBFile = {
  name: string;
  size: number;
  modified_at: string;
};

type ReindexStatus = {
  running?: boolean;
  ok?: boolean | null;
  phase?: string;
  indexed_files?: number;
  chunk_count?: number;
  embedded_chunks?: number;
  pdf_count?: number;
  skipped?: string[];
  error?: string | null;
};

const KB_PDF_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export default function AdminKbScreen() {
  useAuthGuard();
  const { token, user } = useAuth();
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    setStatusErr(null);
    try {
      const r = await authedFetch(token, "/api/admin/kb/files");
      if (r.ok) {
        const d = await r.json();
        setFiles(d.files || []);
      } else {
        setStatusErr("Nem sikerült lekérni a fájlok listáját.");
      }
    } catch (e: any) {
      setStatusErr(e.message || "Hálózati hiba.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDelete = (filename: string) => {
    const performDelete = async () => {
      setBusy(true);
      setStatusMsg(null);
      setStatusErr(null);
      try {
        const r = await authedFetch(token, `/api/admin/kb/files/${filename}`, {
          method: "DELETE",
        });
        if (r.ok) {
          setStatusMsg(`"${filename}" sikeresen törölve.`);
          loadFiles();
        } else {
          const d = await r.json().catch(() => ({}));
          setStatusErr(d.detail || "Törlés sikertelen.");
        }
      } catch (e: any) {
        setStatusErr(e.message || "Hálózati hiba.");
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Biztosan törlöd a(z) "${filename}" tudásanyag PDF fájlt?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Fájl törlése",
        `Biztosan törlöd a(z) "${filename}" tudásanyag PDF fájlt?`,
        [
          { text: "Mégse", style: "cancel" },
          { text: "Törlés", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  const handleUpload = async () => {
    setBusy(true);
    setStatusMsg(null);
    setStatusErr(null);
    try {
      if (Platform.OS !== "web") {
        const res: any = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets?.[0]) {
          setBusy(false);
          return;
        }
        const asset = res.assets[0];
        const r = await fetch(asset.uri);
        const blob = await r.blob();
        await uploadFile(new File([blob], asset.name || "kb.pdf", { type: "application/pdf" }));
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf";
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            await uploadFile(file);
          } else {
            setBusy(false);
          }
        };
        input.click();
      }
    } catch (e: any) {
      setStatusErr(e.message || "Fájlválasztási hiba.");
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setStatusErr("Kizárólag .pdf formátumú fájl tölthető fel.");
      setBusy(false);
      return;
    }
    if (file.size > KB_PDF_UPLOAD_MAX_BYTES) {
      setStatusErr("A PDF túl nagy. Maximum 25 MB tölthető fel egyszerre.");
      setBusy(false);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(apiUrl("/api/admin/kb/files/upload"), {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (r.ok) {
        setStatusMsg(`"${file.name}" sikeresen feltöltve.`);
        loadFiles();
      } else {
        const d = await r.json().catch(() => ({}));
        setStatusErr(d.detail || "Feltöltési hiba.");
      }
    } catch (e: any) {
      setStatusErr(e.message || "Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  };

  const handleActivateKnowledgeWithPolling = async () => {
    setReindexing(true);
    setStatusMsg(null);
    setStatusErr(null);
    try {
      const startResponse = await authedFetch(token, "/api/admin/extract-kb", { method: "POST" });
      const started = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok) {
        throw new Error(started.detail || "Hiba tortent a PDF-ek indexelese soran.");
      }

      setStatusMsg(
        started.status === "already_running"
          ? "A tudasanyag elesitese mar fut. Figyelem az allapotat..."
          : "Tudasanyag elesitese elindult. A folyamat a hatterben fut..."
      );

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let latest: ReindexStatus = started;
      for (let i = 0; i < 720; i += 1) {
        await sleep(2500);
        const statusResponse = await authedFetch(token, "/api/admin/kb/reindex-status");
        latest = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) {
          throw new Error("Nem sikerult lekerdezni az elesites allapotat.");
        }
        setStatusMsg(
          `Elesites folyamatban: ${latest.phase || "fut"}, PDF: ${latest.indexed_files || 0}/${latest.pdf_count || "?"}, chunk: ${latest.embedded_chunks || 0}/${latest.chunk_count || 0}`
        );
        if (!latest.running) {
          break;
        }
      }

      if (latest.running) {
        throw new Error("Az elesites meg fut. Kesobb frissitsd az allapotot.");
      }
      if (latest.ok === false) {
        throw new Error(latest.error || "Hiba tortent a tudasanyag elesitese soran.");
      }
      setStatusMsg(`Sikeres elesites: ${latest.pdf_count || 0} PDF, ${latest.embedded_chunks || latest.chunk_count || 0} chunk indexelve.`);
    } catch (e: any) {
      setStatusErr(e.message || "Hiba az elesites soran.");
    } finally {
      setReindexing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return isoStr;
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Tudásanyag" showBack />
        <ContentBackground>
          <View style={styles.center}>
            <T variant="body" color={theme.danger}>Nincs jogosultságod ehhez az oldalhoz.</T>
          </View>
        </ContentBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="admin-kb-screen">
      <TopBar title="Tudásanyag kezelő" showBack />
      <ContentBackground>
        <View style={styles.container}>
          <View style={styles.headerCard}>
            <T variant="small" color="rgba(247,251,255,0.72)" style={{ lineHeight: 20 }}>
              Itt tudod kezelni a Myra chatbot által használt PDF alapú tudásanyagokat. Tölts fel dokumentumokat, töröld a feleslegeseket, majd nyomd meg a „Tudásanyag Élesítése” gombot a változások életbe lépéséhez.
            </T>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={busy || reindexing} testID="kb-upload-button">
              {busy ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.white} />
                  <T variant="label" color={theme.white}>PDF Feltöltése</T>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.reindexBtn} onPress={handleActivateKnowledgeWithPolling} disabled={busy || reindexing || files.length === 0} testID="kb-reindex-button">
              {reindexing ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color={theme.white} />
                  <T variant="label" color={theme.white}>Tudásanyag Élesítése</T>
                </>
              )}
            </TouchableOpacity>
          </View>

          {statusMsg ? (
            <View style={styles.statusBox} testID="kb-status-success">
              <T variant="small" color={theme.success}>{statusMsg}</T>
            </View>
          ) : null}

          {statusErr ? (
            <View style={[styles.statusBox, { borderColor: theme.danger }]} testID="kb-status-error">
              <T variant="small" color={theme.danger}>{statusErr}</T>
            </View>
          ) : null}

          <View style={styles.listHeader}>
            <T variant="caption" color="rgba(247,251,255,0.6)">Fájlok a szerveren ({files.length} db)</T>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} size="large" />
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.name}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color="rgba(247,251,255,0.2)" />
                  <T variant="body" color="rgba(247,251,255,0.4)" style={{ marginTop: 12 }}>
                    Nincs feltöltött PDF fájl a szerveren.
                  </T>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.fileRow} testID={`kb-file-row-${item.name}`}>
                  <View style={styles.fileIconContainer}>
                    <Ionicons name="document-outline" size={24} color={theme.accent} />
                  </View>
                  <View style={styles.fileInfo}>
                    <T variant="title" color={theme.textOnDark} numberOfLines={1}>
                      {item.name}
                    </T>
                    <View style={styles.fileMeta}>
                      <T variant="small" color="rgba(247,251,255,0.58)">
                        {formatSize(item.size)}
                      </T>
                      <T variant="small" color="rgba(247,251,255,0.3)">|</T>
                      <T variant="small" color="rgba(247,251,255,0.58)">
                        {formatDate(item.modified_at)}
                      </T>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.name)}
                    disabled={busy || reindexing}
                    testID={`kb-file-delete-${item.name}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF8A8A" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { flex: 1, padding: 16 },
  headerCard: {
    backgroundColor: "rgba(6,19,32,0.64)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: theme.accentDeep,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    ...shadow.card,
  },
  reindexBtn: {
    flex: 1,
    backgroundColor: theme.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    ...shadow.card,
  },
  statusBox: {
    borderWidth: 1,
    borderColor: theme.success,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  listHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listContainer: {
    gap: 10,
    paddingBottom: 40,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(87,199,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  fileMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 138, 138, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
});
