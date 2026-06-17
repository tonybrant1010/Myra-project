import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, Dimensions, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme, radii, spacing } from "@/src/theme";

const GRID_SIZE = 6;
const EMOJIS = ["🌸", "💎", "🍀", "☀️", "💧", "⭐"];
const { width } = Dimensions.get("window");
const TILE_SIZE = Math.floor((width - 48) / GRID_SIZE); // Dynamically size tiles to fit screen

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function RelaxMatchScreen() {
  const router = useRouter();

  // State
  const [board, setBoard] = useState<string[][]>([]);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [moves, setMoves] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [combo, setCombo] = useState(1);

  // Load High Score on Mount
  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const val = await AsyncStorage.getItem("myra_match_highscore");
        if (val !== null) {
          setHighScore(parseInt(val, 10));
        }
      } catch (e) {}
    };
    loadHighScore();
    startNewGame();
  }, []);

  // Check and save high score when score updates
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("myra_match_highscore", score.toString()).catch(() => {});
    }
  }, [score, highScore]);

  // Generate random emoji
  const getRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

  // Match finder (3 or more of same emojis horizontally or vertically)
  const findMatches = (currentBoard: string[][]): Set<string> => {
    const matchedCoords = new Set<string>();

    // Horizontal check
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

    // Vertical check
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

  // Start a new game with a matchless board
  const startNewGame = () => {
    let newBoard: string[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => getRandomEmoji())
      );

    // Make sure we have no matches at the beginning
    let matches = findMatches(newBoard);
    let attempts = 0;
    while (matches.size > 0 && attempts < 100) {
      for (const coord of matches) {
        const [r, c] = coord.split(",").map(Number);
        newBoard[r][c] = getRandomEmoji();
      }
      matches = findMatches(newBoard);
      attempts++;
    }

    setBoard(newBoard);
    setScore(0);
    setMoves(30);
    setGameOver(false);
    setSelected(null);
    setAnimating(false);
    setCombo(1);
  };

  // Asynchronous gravity, clear, refill cascade loop
  const animateCascade = async (currentBoard: string[][], initialCombo = 1) => {
    let boardCopy = currentBoard.map((row) => [...row]);
    let currentCombo = initialCombo;
    let matches = findMatches(boardCopy);

    while (matches.size > 0) {
      // 1. Highlight matches as Sparkles
      for (const coord of matches) {
        const [r, c] = coord.split(",").map(Number);
        boardCopy[r][c] = "✨";
      }
      setBoard(boardCopy.map((row) => [...row]));

      // Haptics Feedback based on combo level
      try {
        if (currentCombo === 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        Vibration.vibrate(50);
      }

      await sleep(220);

      // 2. Clear matches
      for (const coord of matches) {
        const [r, c] = coord.split(",").map(Number);
        boardCopy[r][c] = "";
      }
      setBoard(boardCopy.map((row) => [...row]));

      // Update Score: matches count * 10 * combo multiplier
      const pointsEarned = matches.size * 10 * currentCombo;
      setScore((prev) => prev + pointsEarned);

      await sleep(150);

      // 3. Apply Gravity (tiles fall down)
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

      // 4. Refill empty spaces at the top
      for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE; r++) {
          if (boardCopy[r][c] === "") {
            boardCopy[r][c] = getRandomEmoji();
          }
        }
      }
      setBoard(boardCopy.map((row) => [...row]));

      await sleep(220);

      // 5. Look for cascade matches
      matches = findMatches(boardCopy);
      if (matches.size > 0) {
        currentCombo++;
        setCombo(currentCombo);
      }
    }

    setAnimating(false);
    setSelected(null);
    setCombo(1);

    // Game Over condition
    setMoves((currentMoves) => {
      if (currentMoves <= 0) {
        setGameOver(true);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (e) {}
      }
      return currentMoves;
    });
  };

  // Swap function helper
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

  // Handle tile selection and swap mechanics
  const handleTilePress = async (r: number, c: number) => {
    if (animating || gameOver) return;

    if (!selected) {
      setSelected({ r, c });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      return;
    }

    const prev = selected;
    const isAdjacent = Math.abs(prev.r - r) + Math.abs(prev.c - c) === 1;

    if (isAdjacent) {
      setAnimating(true);
      // Swap tiles in temp board
      let swappedBoard = performSwap(board, prev.r, prev.c, r, c);
      setBoard(swappedBoard);

      // Check if matches are formed
      const matches = findMatches(swappedBoard);

      if (matches.size > 0) {
        // Valid move
        setMoves((prevMoves) => prevMoves - 1);
        await animateCascade(swappedBoard, 1);
      } else {
        // Invalid swap - Swap back after a short animation delay
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (e) {
          Vibration.vibrate(80);
        }
        await sleep(250);
        let revertedBoard = performSwap(swappedBoard, prev.r, prev.c, r, c);
        setBoard(revertedBoard);
        setAnimating(false);
        setSelected(null);
      }
    } else {
      // Not adjacent, switch selection to new tile
      setSelected({ r, c });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-match-screen">
      <TopBar title="Myra Match" showBack={true} backPath="/relax" />
      <ContentBackground>
        <View style={styles.container}>
          {/* Header Stats Panel */}
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

          {/* Combo / Cascade Indicator */}
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

          {/* Game Board Grid */}
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

            {/* Game Over Screen Overlay */}
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
          </LinearGradient>

          {/* Controls Footer */}
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
