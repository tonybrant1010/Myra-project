import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, TouchableOpacity, Dimensions, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { startLeaderboardSession } from "@/src/utils/crypto";

import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme, radii, spacing } from "@/src/theme";

const GRID_SIZE = 6;
const EMOJIS = ["🌸", "💎", "🍀", "☀️", "💧", "⭐"];
const { width } = Dimensions.get("window");
const TILE_SIZE = Math.floor((width - 48) / GRID_SIZE);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function RelaxMatchScreen() {
  const { token } = useAuth();
  const sessionTokenRef = useRef<string | null>(null);


  const [board, setBoard] = useState<string[][]>([]);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [moves, setMoves] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [combo, setCombo] = useState(1);
  const [showShuffleBanner, setShowShuffleBanner] = useState(false);


  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const val = await AsyncStorage.getItem("myra_match_highscore");
        if (val !== null) {
          setHighScore(parseInt(val, 10));
        }
      } catch {}
    };
    loadHighScore();
    startNewGame();
  }, []);


  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("myra_match_highscore", score.toString()).catch(() => {});
    }
  }, [score, highScore]);


  const getRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];


  const findMatches = (currentBoard: string[][]): Set<string> => {
    const matchedCoords = new Set<string>();


    for (let r = 0; r < GRID_SIZE; r++) {
      let matchCount = 1;
      let matchEmoji = currentBoard[r][0];
      let matchStart = 0;

      for (let c = 1; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === matchEmoji && matchEmoji !== "" && matchEmoji !== "✨") {
          matchCount++;
        } else {
          if (matchCount >= 3) {
            for (let i = matchStart; i < c; i++) {
              matchedCoords.add(`${r},${i}`);
            }
          }
          matchEmoji = currentBoard[r][c];
          matchCount = 1;
          matchStart = c;
        }
      }
      if (matchCount >= 3) {
        for (let i = matchStart; i < GRID_SIZE; i++) {
          matchedCoords.add(`${r},${i}`);
        }
      }
    }


    for (let c = 0; c < GRID_SIZE; c++) {
      let matchCount = 1;
      let matchEmoji = currentBoard[0][c];
      let matchStart = 0;

      for (let r = 1; r < GRID_SIZE; r++) {
        if (currentBoard[r][c] === matchEmoji && matchEmoji !== "" && matchEmoji !== "✨") {
          matchCount++;
        } else {
          if (matchCount >= 3) {
            for (let i = matchStart; i < r; i++) {
              matchedCoords.add(`${i},${c}`);
            }
          }
          matchEmoji = currentBoard[r][c];
          matchCount = 1;
          matchStart = r;
        }
      }
      if (matchCount >= 3) {
        for (let i = matchStart; i < GRID_SIZE; i++) {
          matchedCoords.add(`${i},${c}`);
        }
      }
    }

    return matchedCoords;
  };


  const hasValidMoves = (currentBoard: string[][]): boolean => {
    if (currentBoard.length === 0) return false;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {

        if (c + 1 < GRID_SIZE) {
          const tempBoard = performSwap(currentBoard, r, c, r, c + 1);
          if (findMatches(tempBoard).size > 0) {
            return true;
          }
        }

        if (r + 1 < GRID_SIZE) {
          const tempBoard = performSwap(currentBoard, r, c, r + 1, c);
          if (findMatches(tempBoard).size > 0) {
            return true;
          }
        }
      }
    }
    return false;
  };


  const shuffleBoardUntilValid = (currentBoard: string[][]): string[][] => {
    let copy = currentBoard.map((row) => [...row]);
    let attempts = 0;
    const flat = copy.flat();

    while (attempts < 150) {

      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = flat[i];
        flat[i] = flat[j];
        flat[j] = temp;
      }


      const newBoard: string[][] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        newBoard.push(flat.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE));
      }

      if (findMatches(newBoard).size === 0 && hasValidMoves(newBoard)) {
        return newBoard;
      }
      attempts++;
    }
    return currentBoard;
  };


  const startNewGame = () => {
    let newBoard: string[][] = [];
    let attempts = 0;

    while (attempts < 100) {
      let tempBoard = Array(GRID_SIZE)
        .fill(null)
        .map(() =>
          Array(GRID_SIZE)
            .fill(null)
            .map(() => getRandomEmoji())
        );

      let matches = findMatches(tempBoard);
      let matchAttempts = 0;
      while (matches.size > 0 && matchAttempts < 50) {
        for (const coord of matches) {
          const [r, c] = coord.split(",").map(Number);
          tempBoard[r][c] = getRandomEmoji();
        }
        matches = findMatches(tempBoard);
        matchAttempts++;
      }

      if (findMatches(tempBoard).size === 0 && hasValidMoves(tempBoard)) {
        newBoard = tempBoard;
        break;
      }
      attempts++;
    }

    if (newBoard.length === 0) {

      newBoard = Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill(getRandomEmoji()));
    }

    setBoard(newBoard);
    setScore(0);
    setMoves(30);
    setGameOver(false);
    setSelected(null);
    setAnimating(false);
    setCombo(1);
    setShowShuffleBanner(false);
    sessionTokenRef.current = null;
    if (token) {
      startLeaderboardSession(token, "match").then((sessionToken) => {
        sessionTokenRef.current = sessionToken;
      });
    }
  };


  const animateCascade = async (currentBoard: string[][], initialCombo = 1) => {
    let boardCopy = currentBoard.map((row) => [...row]);
    let currentCombo = initialCombo;
    let matches = findMatches(boardCopy);
    let currentScore = score;

    while (matches.size > 0) {

      for (const coord of matches) {
        const [r, c] = coord.split(",").map(Number);
        boardCopy[r][c] = "✨";
      }
      setBoard(boardCopy.map((row) => [...row]));


      try {
        if (currentCombo === 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        Vibration.vibrate(50);
      }

      await sleep(220);


      for (const coord of matches) {
        const [r, c] = coord.split(",").map(Number);
        boardCopy[r][c] = "";
      }
      setBoard(boardCopy.map((row) => [...row]));


      const pointsEarned = matches.size * 10 * currentCombo;
      currentScore += pointsEarned;
      setScore(currentScore);

      await sleep(150);


      for (let c = 0; c < GRID_SIZE; c++) {
        let emptySlots = 0;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
          if (boardCopy[r][c] === "") {
            emptySlots++;
          } else if (emptySlots > 0) {
            boardCopy[r + emptySlots][c] = boardCopy[r][c];
            boardCopy[r][c] = "";
          }
        }
      }
      setBoard(boardCopy.map((row) => [...row]));

      await sleep(150);


      for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE; r++) {
          if (boardCopy[r][c] === "") {
            boardCopy[r][c] = getRandomEmoji();
          }
        }
      }
      setBoard(boardCopy.map((row) => [...row]));

      await sleep(220);


      matches = findMatches(boardCopy);
      if (matches.size > 0) {
        currentCombo++;
        setCombo(currentCombo);
      }
    }


    if (!hasValidMoves(boardCopy) && moves > 0) {
      const shuffled = shuffleBoardUntilValid(boardCopy);
      boardCopy = shuffled;
      setBoard(shuffled);
      setShowShuffleBanner(true);
      setTimeout(() => setShowShuffleBanner(false), 2000);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }

    setAnimating(false);
    setSelected(null);
    setCombo(1);


    setMoves((currentMoves) => {
      if (currentMoves <= 0) {
        setGameOver(true);
        if (token && sessionTokenRef.current) {
          authedFetch(token, "/api/leaderboard/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              game_type: "match",
              score: currentScore,
              session_token: sessionTokenRef.current,
            }),
          }).catch(() => {});
          sessionTokenRef.current = null;
        }
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}
      }
      return currentMoves;
    });
  };


  const performSwap = (
    currentBoard: string[][],
    r1: number,
    c1: number,
    r2: number,
    c2: number
  ) => {
    const copy = currentBoard.map((row) => [...row]);
    const temp = copy[r1][c1];
    copy[r1][c1] = copy[r2][c2];
    copy[r2][c2] = temp;
    return copy;
  };


  const handleTilePress = async (r: number, c: number) => {
    if (animating || gameOver) return;

    if (!selected) {
      setSelected({ r, c });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      return;
    }

    const prev = selected;
    const isAdjacent = Math.abs(prev.r - r) + Math.abs(prev.c - c) === 1;

    if (isAdjacent) {
      setAnimating(true);

      let swappedBoard = performSwap(board, prev.r, prev.c, r, c);
      setBoard(swappedBoard);


      const matches = findMatches(swappedBoard);

      if (matches.size > 0) {

        setMoves((prevMoves) => prevMoves - 1);
        await animateCascade(swappedBoard, 1);
      } else {

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {
          Vibration.vibrate(80);
        }
        await sleep(250);
        let revertedBoard = performSwap(swappedBoard, prev.r, prev.c, r, c);
        setBoard(revertedBoard);
        setAnimating(false);
        setSelected(null);
      }
    } else {

      setSelected({ r, c });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-match-screen">
      <ContentBackground>
        <TopBar title="Myra Match" showBack={true} backPath="/relax" />
        <View style={styles.container}>

          <View style={styles.statsPanel}>
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
              style={[styles.statBox, shadow.card]}
            >
              <T variant="small" color="rgba(247,251,255,0.6)" align="center">Lépések</T>
              <T variant="display" color={theme.accent} align="center" style={styles.statVal}>
                {moves}
              </T>
            </LinearGradient>

            <LinearGradient
              colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
              style={[styles.statBox, shadow.card]}
            >
              <T variant="small" color="rgba(247,251,255,0.6)" align="center">Pontszám</T>
              <T variant="display" color={theme.success} align="center" style={styles.statVal}>
                {score}
              </T>
            </LinearGradient>

            <LinearGradient
              colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
              style={[styles.statBox, shadow.card]}
            >
              <T variant="small" color="rgba(247,251,255,0.6)" align="center">Rekord</T>
              <T variant="display" color={theme.warm} align="center" style={styles.statVal}>
                {highScore}
              </T>
            </LinearGradient>
          </View>


          <View style={styles.indicatorRow}>
            {combo > 1 ? (
              <View style={styles.comboBadge}>
                <T variant="label" color={theme.accentSoft} style={{ fontWeight: "700" }}>
                  🔥 Combo x{combo}!
                </T>
              </View>
            ) : (
              <T variant="body" color="rgba(247,251,255,0.5)">
                Cserélj fel két szomszédos elemet!
              </T>
            )}
          </View>


          <LinearGradient
            colors={["rgba(255, 255, 255, 0.06)", "rgba(255, 255, 255, 0.02)"]}
            style={[styles.boardWrap, shadow.card]}
          >
            {board.map((row, rIdx) => (
              <View key={`row-${rIdx}`} style={styles.boardRow}>
                {row.map((emoji, cIdx) => {
                  const isSelected = selected?.r === rIdx && selected?.c === cIdx;
                  return (
                    <TouchableOpacity
                      key={`tile-${rIdx}-${cIdx}`}
                      style={[
                        styles.tile,
                        isSelected && styles.tileSelected,
                        emoji === "✨" && styles.tileMatched,
                        emoji === "" && styles.tileEmpty,
                      ]}
                      onPress={() => handleTilePress(rIdx, cIdx)}
                      disabled={animating || gameOver || emoji === ""}
                      activeOpacity={0.7}
                    >
                      <T style={styles.emojiText}>{emoji}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}


            {gameOver && (
              <View style={styles.overlay}>
                <LinearGradient
                  colors={["rgba(6,19,32,0.92)", "rgba(10,35,64,0.96)"]}
                  style={styles.overlayGradient}
                >
                  <Ionicons name="trophy-outline" size={60} color={theme.warm} style={{ marginBottom: 12 }} />
                  <T variant="display" color={theme.textOnDark} align="center" style={{ marginBottom: 8 }}>
                    Játék Vége!
                  </T>
                  <T variant="title" color="rgba(247,251,255,0.7)" align="center" style={{ marginBottom: 24 }}>
                    Elért pontszám: {score}
                  </T>
                  <TouchableOpacity
                    style={styles.restartBtn}
                    onPress={startNewGame}
                    activeOpacity={0.82}
                  >
                    <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>Új játék</T>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}


            {showShuffleBanner && (
              <View style={styles.overlay}>
                <LinearGradient
                  colors={["rgba(6,19,32,0.92)", "rgba(10,35,64,0.96)"]}
                  style={styles.overlayGradient}
                >
                  <Ionicons name="shuffle-outline" size={56} color={theme.accent} style={{ marginBottom: 12 }} />
                  <T variant="display" color={theme.textOnDark} align="center" style={{ marginBottom: 8 }}>
                    Nincs több lépés!
                  </T>
                  <T variant="title" color="rgba(247,251,255,0.7)" align="center">
                    Tábla újrakeverése...
                  </T>
                </LinearGradient>
              </View>
            )}
          </LinearGradient>


          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={startNewGame}
              disabled={animating}
            >
              <Ionicons name="refresh" size={18} color={theme.textOnDark} />
              <T variant="label" color={theme.textOnDark} style={{ marginLeft: 6 }}>Újrakezdés</T>
            </TouchableOpacity>
          </View>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  container: {
    flex: 1,
    padding: spacing.md,
    alignItems: "center",
  },
  statsPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statBox: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(87,199,255,0.12)",
    borderWidth: 1,
  },
  statVal: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  indicatorRow: {
    height: 32,
    marginVertical: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  comboBadge: {
    backgroundColor: theme.accentDeep,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  boardWrap: {
    width: width - 32,
    height: width - 32,
    padding: 8,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(87,199,255,0.16)",
    borderWidth: 1.2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  boardRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  tile: {
    width: TILE_SIZE - 4,
    height: TILE_SIZE - 4,
    margin: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
  },
  tileSelected: {
    backgroundColor: "rgba(87, 199, 255, 0.22)",
    borderColor: theme.accent,
    borderWidth: 1.8,
  },
  tileMatched: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  tileEmpty: {
    opacity: 0,
  },
  emojiText: {
    fontSize: 26,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  restartBtn: {
    backgroundColor: theme.accentDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    ...shadow.glow,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.xl,
    width: "100%",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(87, 199, 255, 0.12)",
    borderWidth: 1,
  },
  exitButton: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
});
