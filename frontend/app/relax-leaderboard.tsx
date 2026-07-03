import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Dimensions,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme, radii, spacing } from "@/src/theme";

const { width } = Dimensions.get("window");

type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
};

type LeaderboardData = {
  match: LeaderboardRow[];
  snake: LeaderboardRow[];
  sudoku: LeaderboardRow[];
};

export default function RelaxLeaderboardScreen() {
  const { user, token, setUserLocal } = useAuth();

  const [nicknameInput, setNicknameInput] = useState("");
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (user?.nickname) {
      setNicknameInput(user.nickname);
    } else {
      setNicknameInput("");
      setIsEditingNickname(true);
    }
  }, [user]);


  const loadLeaderboard = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authedFetch(token, "/api/leaderboard");
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      } else {
        setError("Nem sikerült letölteni a ranglistát.");
      }
    } catch (e) {
      setError("Hálózati hiba a ranglista letöltésekor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [token]);

  const saveNickname = async () => {
    if (!token) return;
    const cleanNickname = nicknameInput.trim();
    if (!cleanNickname) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (e) {}
      return;
    }

    setSavingNickname(true);
    try {
      const response = await authedFetch(token, "/api/user/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: cleanNickname }),
      });
      if (response.ok) {

        setUserLocal((u) => (u ? { ...u, nickname: cleanNickname } : u));
        setIsEditingNickname(false);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
        Keyboard.dismiss();

        loadLeaderboard();
      } else {
        const d = await response.json().catch(() => ({}));
        Alert.alert("Hiba", d.detail || "Hiba történt a becenév mentésekor.");
      }
    } catch (e) {
      Alert.alert("Hiba", "Hálózati hiba történt.");
    } finally {
      setSavingNickname(false);
    }
  };

  const formatSudokuTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const renderLeaderboardList = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    list: LeaderboardRow[] = [],
    isTimeFormat = false
  ) => {
    return (
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
        style={[styles.listCard, shadow.card]}
      >
        <View style={styles.listHeader}>
          <Ionicons name={icon} size={20} color={color} style={{ marginRight: 8 }} />
          <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>
            {title}
          </T>
        </View>

        <View style={styles.rowsContainer}>
          {list.length === 0 ? (
            <T variant="body" color="rgba(247,251,255,0.4)" style={styles.emptyText}>
              Nincs még helyezés. Legyél te az első!
            </T>
          ) : (
            list.map((row, idx) => {
              let medal = "🥇";
              let nameColor = theme.white;

              if (row.rank === 1) {
                nameColor = "#FFE066";
              } else if (row.rank === 2) {
                medal = "🥈";
                nameColor = "#E6E6E6";
              } else if (row.rank === 3) {
                medal = "🥉";
                nameColor = "#CD7F32";
              }

              return (
                <View key={`row-${idx}`} style={styles.rowItem}>
                  <View style={styles.rowLeft}>
                    <T style={{ fontSize: 18, marginRight: 8 }}>{medal}</T>
                    <T variant="bodyLg" color={nameColor} style={styles.playerName} numberOfLines={1}>
                      {row.name}
                    </T>
                  </View>
                  <T variant="title" color={color} style={{ fontWeight: "700" }}>
                    {isTimeFormat ? formatSudokuTime(row.score) : row.score}
                  </T>
                </View>
              );
            })
          )}
        </View>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-leaderboard-screen">
      <TopBar title="Globális Ranglista" showBack={true} backPath="/relax" />
      <ContentBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>


          <LinearGradient
            colors={["rgba(139,143,232,0.08)", "rgba(18,58,98,0.2)"]}
            style={[styles.nicknameCard, shadow.card]}
          >
            <View style={styles.nicknameHeader}>
              <Ionicons name="person-outline" size={18} color={theme.violet} />
              <T variant="label" color="rgba(247,251,255,0.7)" style={{ marginLeft: 6, fontWeight: "600" }}>
                Becenév a Ranglistákhoz
              </T>
            </View>

            <View style={styles.viewRow}>
              <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>
                {user?.nickname || "Nincs beállítva"}
              </T>
              <TouchableOpacity
                style={styles.modifyBtn}
                onPress={() => {
                  setNicknameInput(user?.nickname || "");
                  setIsEditingNickname(true);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={16} color={theme.violet} />
                <T variant="small" color={theme.violet} style={{ marginLeft: 4, fontWeight: "600" }}>
                  {user?.nickname ? "Módosítás" : "Beállítás"}
                </T>
              </TouchableOpacity>
            </View>
          </LinearGradient>


          <Modal
            visible={isEditingNickname}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              if (user?.nickname) {
                setIsEditingNickname(false);
              }
            }}
          >
            <View style={styles.modalOverlay}>
              <LinearGradient
                colors={["rgba(10, 30, 58, 0.98)", "rgba(6, 19, 32, 0.99)"]}
                style={[styles.modalContent, shadow.glow]}
              >
                <View style={styles.modalHeader}>
                  <Ionicons name="person-outline" size={22} color={theme.violet} />
                  <T variant="h2" color={theme.white} style={{ marginLeft: 8, fontWeight: "700" }}>
                    Becenév Megadása
                  </T>
                </View>

                <T variant="body" color="rgba(247,251,255,0.7)" style={{ marginBottom: spacing.md }}>
                  Adj meg egy becenevet, ami a ranglistákon fog megjelenni a többi játékos számára.
                </T>

                <TextInput
                  style={styles.modalInput}
                  value={nicknameInput}
                  onChangeText={setNicknameInput}
                  placeholder="Beceneved a ranglistához..."
                  placeholderTextColor="rgba(247,251,255,0.3)"
                  maxLength={25}
                  returnKeyType="done"
                  onSubmitEditing={saveNickname}
                  autoFocus={true}
                />

                <View style={styles.modalActions}>
                  {user?.nickname ? (
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setIsEditingNickname(false)}
                      disabled={savingNickname}
                      activeOpacity={0.7}
                    >
                      <T variant="label" color="rgba(247,251,255,0.6)" style={{ fontWeight: "600" }}>
                        Mégse
                      </T>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, savingNickname && { opacity: 0.6 }]}
                    onPress={saveNickname}
                    disabled={savingNickname}
                    activeOpacity={0.8}
                  >
                    {savingNickname ? (
                      <ActivityIndicator size="small" color={theme.white} />
                    ) : (
                      <T variant="label" color={theme.white} style={{ fontWeight: "700" }}>
                        Mentés
                      </T>
                    )}
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </Modal>


          <View style={styles.listsHeaderRow}>
            <T variant="h2" color={theme.textOnDark} style={{ fontWeight: "700" }}>
              Dobogós Helyezettek (Top 3)
            </T>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => {
                loadLeaderboard();
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) {}
              }}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Ionicons name="refresh" size={20} color={theme.accent} />
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={24} color={theme.danger} />
              <T variant="body" color={theme.danger} style={{ marginLeft: 8 }}>
                {error}
              </T>
            </View>
          )}


          {!error && (
            <View style={styles.listsContainer}>
              {renderLeaderboardList(
                "Myra Match",
                "grid-outline",
                theme.accent,
                leaderboard?.match,
                false
              )}
              {renderLeaderboardList(
                "Klasszikus Kígyó",
                "navigate-outline",
                theme.success,
                leaderboard?.snake,
                false
              )}
              {renderLeaderboardList(
                "Sudoku",
                "apps-outline",
                theme.warm,
                leaderboard?.sudoku,
                false
              )}
            </View>
          )}
        </ScrollView>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  nicknameCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: "rgba(139,143,232,0.16)",
    borderWidth: 1.2,
  },
  nicknameHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    color: theme.white,
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.2,
    borderColor: "rgba(139,143,232,0.22)",
    backgroundColor: "rgba(10,30,58,0.98)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modalInput: {
    width: "100%",
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    color: theme.white,
    fontFamily: "Manrope_500Medium",
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    alignItems: "center",
  },
  modalCancelBtn: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalSaveBtn: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: theme.violet,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
    ...shadow.glow,
  },
  modifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: "rgba(139,143,232,0.08)",
  },
  listsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(87, 199, 255, 0.12)",
    borderWidth: 1.2,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 138, 138, 0.1)",
    borderColor: "rgba(255, 138, 138, 0.2)",
    borderWidth: 1,
    marginVertical: spacing.md,
  },
  listsContainer: {
    gap: spacing.md,
  },
  listCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 8,
  },
  rowsContainer: {
    gap: 10,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playerName: {
    fontWeight: "600",
    maxWidth: width - 180,
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rankGold: {
    backgroundColor: "#FFE066",
  },
  rankSilver: {
    backgroundColor: "#E6E6E6",
  },
  rankBronze: {
    backgroundColor: "#CD7F32",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },
});
