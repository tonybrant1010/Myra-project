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

const { width } = Dimensions.get("window");
const BOARD_PADDING = 8;
const BOARD_SIZE = width - 32;

type CellCoord = { r: number; c: number } | null;
type SudokuSize = 4 | 6 | 9;


const isValid = (board: number[][], r: number, c: number, val: number, size: SudokuSize): boolean => {

  for (let i = 0; i < size; i++) {
    if (board[r][i] === val) return false;
  }

  for (let i = 0; i < size; i++) {
    if (board[i][c] === val) return false;
  }

  let boxRows = 3;
  let boxCols = 3;
  if (size === 4) {
    boxRows = 2;
    boxCols = 2;
  } else if (size === 6) {
    boxRows = 2;
    boxCols = 3;
  }
  const boxStartRow = Math.floor(r / boxRows) * boxRows;
  const boxStartCol = Math.floor(c / boxCols) * boxCols;
  for (let i = 0; i < boxRows; i++) {
    for (let j = 0; j < boxCols; j++) {
      if (boxStartRow + i < size && boxStartCol + j < size && board[boxStartRow + i][boxStartCol + j] === val) return false;
    }
  }
  return true;
};


const solveSudoku = (board: number[][], size: SudokuSize): boolean => {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) {
        const nums = Array.from({ length: size }, (_, i) => i + 1);

        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }
        for (const val of nums) {
          if (isValid(board, r, c, val, size)) {
            board[r][c] = val;
            if (solveSudoku(board, size)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
};


const generateSudoku = (size: SudokuSize) => {
  const solved = Array.from({ length: size }, () => Array(size).fill(0));
  solveSudoku(solved, size);

  const puzzle = solved.map((row) => [...row]);
  let cellsToRemove = 0;
  if (size === 4) cellsToRemove = 8;
  else if (size === 6) cellsToRemove = 18;
  else if (size === 9) cellsToRemove = 42;

  let removed = 0;
  while (removed < cellsToRemove) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      removed++;
    }
  }

  return { solved, puzzle };
};


const checkConflicts = (currentBoard: (number | null)[][], size: SudokuSize): boolean[][] => {
  const conf = Array.from({ length: size }, () => Array(size).fill(false));
  if (!currentBoard || currentBoard.length < size) return conf;
  let boxRows = 3;
  let boxCols = 3;
  if (size === 4) {
    boxRows = 2;
    boxCols = 2;
  } else if (size === 6) {
    boxRows = 2;
    boxCols = 3;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = currentBoard[r][c];
      if (val === null || val === 0) continue;


      for (let i = 0; i < size; i++) {
        if (i !== c && currentBoard[r][i] === val) {
          conf[r][c] = true;
          conf[r][i] = true;
        }
      }


      for (let i = 0; i < size; i++) {
        if (i !== r && currentBoard[i][c] === val) {
          conf[r][c] = true;
          conf[i][c] = true;
        }
      }


      const boxStartRow = Math.floor(r / boxRows) * boxRows;
      const boxStartCol = Math.floor(c / boxCols) * boxCols;
      for (let i = 0; i < boxRows; i++) {
        for (let j = 0; j < boxCols; j++) {
          const nr = boxStartRow + i;
          const nc = boxStartCol + j;
          if (nr < size && nc < size && (nr !== r || nc !== c) && currentBoard[nr][nc] === val) {
            conf[r][c] = true;
            conf[nr][nc] = true;
          }
        }
      }
    }
  }
  return conf;
};

export default function RelaxSudokuScreen() {
  const { token } = useAuth();

  const [boardSize, setBoardSize] = useState<SudokuSize>(4);
  const [solvedBoard, setSolvedBoard] = useState<number[][]>([]);
  const [puzzleBoard, setPuzzleBoard] = useState<(number | null)[][]>([]);
  const [playerBoard, setPlayerBoard] = useState<(number | null)[][]>([]);

  const [selectedCell, setSelectedCell] = useState<CellCoord>(null);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);

  const timerRef = useRef<any>(null);
  const sessionTokenRef = useRef<string | null>(null);


  useEffect(() => {
    const loadBestTime = async () => {
      try {
        const key = `myra_sudoku_besttime_${boardSize}`;
        const val = await AsyncStorage.getItem(key);
        if (val !== null) {
          setBestTime(parseInt(val, 10));
        } else {
          setBestTime(null);
        }
      } catch (e) {}
    };
    loadBestTime();
  }, [boardSize]);


  useEffect(() => {
    if (isRunning && !gameOver) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, gameOver]);


  const cellWidth = Math.floor((BOARD_SIZE - BOARD_PADDING * 2) / boardSize);


  let boxRows = 3;
  let boxCols = 3;
  if (boardSize === 4) {
    boxRows = 2;
    boxCols = 2;
  } else if (boardSize === 6) {
    boxRows = 2;
    boxCols = 3;
  }

  const startNewGame = (size: SudokuSize) => {
    const { solved, puzzle } = generateSudoku(size);


    const initBoard = puzzle.map((row) => row.map((val) => (val === 0 ? null : val)));
    const playBoard = puzzle.map((row) => row.map((val) => (val === 0 ? null : val)));

    setSolvedBoard(solved);
    setPuzzleBoard(initBoard);
    setPlayerBoard(playBoard);
    setSelectedCell(null);
    setTimer(0);
    setGameOver(false);
    setIsRunning(true);
    sessionTokenRef.current = null;
    if (token) {
      startLeaderboardSession(token, "sudoku").then((sessionToken) => {
        sessionTokenRef.current = sessionToken;
      });
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
  };

  const handleCellPress = (r: number, c: number) => {

    if (puzzleBoard[r][c] !== null) return;

    setSelectedCell({ r, c });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handleNumberInput = (num: number | null) => {
    if (!selectedCell) return;
    const { r, c } = selectedCell;

    const newBoard = playerBoard.map((row) => [...row]);
    newBoard[r][c] = num;
    setPlayerBoard(newBoard);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}


    const hasConflictsList = checkConflicts(newBoard, boardSize);
    const hasAnyConflict = hasConflictsList.some((row) => row.some((c) => c));
    const isFull = newBoard.every((row) => row.every((val) => val !== null));

    if (isFull && !hasAnyConflict) {

      setGameOver(true);
      setIsRunning(false);
      saveBestTime();


      let calculatedScore = 100;
      if (boardSize === 4) {
        calculatedScore = Math.max(100, 1000 - 5 * timer);
      } else if (boardSize === 6) {
        calculatedScore = Math.max(300, 3000 - 3 * timer);
      } else if (boardSize === 9) {
        calculatedScore = Math.max(1000, 10000 - 2 * timer);
      }

      if (token && sessionTokenRef.current) {
        authedFetch(token, "/api/leaderboard/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_type: "sudoku",
            score: calculatedScore,
            session_token: sessionTokenRef.current,
          }),
        }).catch(() => {});
        sessionTokenRef.current = null;
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        Vibration.vibrate(200);
      }
    }
  };

  const saveBestTime = async () => {
    try {
      const key = `myra_sudoku_besttime_${boardSize}`;
      const currentBest = await AsyncStorage.getItem(key);
      if (currentBest === null || timer < parseInt(currentBest, 10)) {
        await AsyncStorage.setItem(key, timer.toString());
        setBestTime(timer);
      }
    } catch (e) {}
  };

  const resetToStartScreen = () => {
    setIsRunning(false);
    setGameOver(false);
    setTimer(0);
    setSelectedCell(null);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const conflicts = checkConflicts(playerBoard, boardSize);

  return (
    <SafeAreaView style={styles.safe} testID="relax-sudoku-screen">
      <ContentBackground>
        <TopBar title="Sudoku" showBack={true} backPath="/relax" />
        <View style={styles.container}>

          {isRunning && (
            <View style={styles.statsPanel}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
                style={[styles.statBox, shadow.card]}
              >
                <T variant="small" color="rgba(247,251,255,0.6)" align="center">Idő</T>
                <T variant="display" color={theme.accent} align="center" style={styles.statVal}>
                  {formatTime(timer)}
                </T>
              </LinearGradient>

              <LinearGradient
                colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
                style={[styles.statBox, shadow.card]}
              >
                <T variant="small" color="rgba(247,251,255,0.6)" align="center">Legjobb idő</T>
                <T variant="display" color={theme.warm} align="center" style={styles.statVal}>
                  {bestTime !== null ? formatTime(bestTime) : "--:--"}
                </T>
              </LinearGradient>
            </View>
          )}


          {isRunning && (
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
              style={[styles.boardWrap, shadow.card]}
            >
              {playerBoard.map((row, rIdx) => (
                <View key={`row-${rIdx}`} style={styles.boardRow}>
                  {row.map((val, cIdx) => {
                    const isInitial = puzzleBoard[rIdx][cIdx] !== null;
                    const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                    const hasConflict = conflicts[rIdx][cIdx];


                    const isRightBorderThick = (cIdx + 1) % boxCols === 0 && cIdx !== boardSize - 1;
                    const isBottomBorderThick = (rIdx + 1) % boxRows === 0 && rIdx !== boardSize - 1;

                    return (
                      <TouchableOpacity
                        key={`cell-${rIdx}-${cIdx}`}
                        style={[
                          styles.cell,
                          { width: cellWidth, height: cellWidth },
                          isInitial && styles.cellInitial,
                          isSelected && styles.cellSelected,
                          hasConflict && styles.cellConflict,
                          isRightBorderThick && { borderRightWidth: 2.2, borderRightColor: "rgba(255, 255, 255, 0.4)" },
                          isBottomBorderThick && { borderBottomWidth: 2.2, borderBottomColor: "rgba(255, 255, 255, 0.4)" },
                        ]}
                        onPress={() => handleCellPress(rIdx, cIdx)}
                        activeOpacity={0.7}
                      >
                        <T
                          style={[
                            styles.cellText,
                            { fontSize: boardSize === 9 ? 18 : 22 },
                            isInitial && styles.cellTextInitial,
                            hasConflict && { color: theme.danger },
                          ]}
                        >
                          {val !== null ? val : ""}
                        </T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}


              {gameOver && (
                <View style={styles.overlay}>
                  <LinearGradient
                    colors={["rgba(6,19,32,0.94)", "rgba(10,35,64,0.97)"]}
                    style={styles.overlayGradient}
                  >
                    <Ionicons name="trophy-outline" size={60} color={theme.warm} style={{ marginBottom: 12 }} />
                    <T variant="display" color={theme.textOnDark} align="center" style={{ marginBottom: 8 }}>
                      Sikeres Megoldás!
                    </T>
                    <T variant="title" color="rgba(247,251,255,0.7)" align="center" style={{ marginBottom: 8 }}>
                      Elért idő: {formatTime(timer)}
                    </T>
                    {bestTime !== null && timer <= bestTime && (
                      <T variant="label" color={theme.success} align="center" style={{ marginBottom: 24, fontWeight: "700" }}>
                        🎉 Új egyéni rekord!
                      </T>
                    )}
                    <TouchableOpacity
                      style={styles.restartBtn}
                      onPress={resetToStartScreen}
                      activeOpacity={0.82}
                    >
                      <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>Menübe</T>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              )}
            </LinearGradient>
          )}


          {isRunning && !gameOver && (
            <View style={styles.keypadContainer}>
              <View style={styles.keypadRow}>
                {Array.from({ length: boardSize }, (_, i) => i + 1).map((num) => (
                  <TouchableOpacity
                    key={`key-${num}`}
                    style={styles.keyBtn}
                    onPress={() => handleNumberInput(num)}
                    activeOpacity={0.75}
                  >
                    <T variant="title" color={theme.white} style={{ fontWeight: "600" }}>
                      {num}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.keypadRow}>
                <TouchableOpacity
                  style={[styles.keyBtn, styles.clearBtn]}
                  onPress={() => handleNumberInput(null)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="backspace-outline" size={20} color={theme.danger} />
                  <T variant="label" color={theme.danger} style={{ marginLeft: 6, fontWeight: "600" }}>
                    Törlés
                  </T>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.keyBtn, styles.menuBtn]}
                  onPress={resetToStartScreen}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close-circle-outline" size={20} color={theme.white} />
                  <T variant="label" color={theme.white} style={{ marginLeft: 6, fontWeight: "600" }}>
                    Kilépés
                  </T>
                </TouchableOpacity>
              </View>
            </View>
          )}


          {!isRunning && (
            <View style={styles.startPanel}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
                style={[styles.startCard, shadow.card]}
              >
                <Ionicons name="apps-outline" size={48} color={theme.violet} style={{ marginBottom: 12 }} />

                <T variant="h2" color={theme.textOnDark} style={{ marginBottom: 8, fontWeight: "700" }}>
                  Sudoku
                </T>
                <T variant="body" color="rgba(247,251,255,0.68)" align="center" style={{ marginBottom: 24, paddingHorizontal: 12 }}>
                  Válassz egy méretet a képességeidnek vagy a hangulatodnak megfelelően. A 4x4 kiváló gyors fejtéshez, míg a 9x9 a klasszikus Sudoku kihívás.
                </T>

                <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginBottom: 12 }}>
                  Rácsméret kiválasztása:
                </T>

                <View style={styles.sizeSelectionRow}>
                  {([4, 6, 9] as SudokuSize[]).map((size) => {
                    const isActive = boardSize === size;
                    let label = "Klasszikus 9x9";
                    if (size === 4) label = "Mini 4x4";
                    if (size === 6) label = "Közepes 6x6";

                    return (
                      <TouchableOpacity
                        key={size}
                        style={[styles.sizeBtn, isActive && styles.sizeBtnActive]}
                        onPress={() => {
                          setBoardSize(size);
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch (e) {}
                        }}
                        activeOpacity={0.8}
                      >
                        <T variant="label" color={isActive ? theme.white : "rgba(247,251,255,0.7)"} style={{ fontWeight: "600" }}>
                          {label}
                        </T>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.playButtonOverlay, { marginTop: 24 }]}
                  onPress={() => startNewGame(boardSize)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={28} color={theme.white} />
                  <T variant="title" color={theme.white} style={{ marginTop: 6, fontWeight: "600" }}>
                    Játék Indítása
                  </T>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
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
    marginBottom: spacing.md,
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
  boardWrap: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    padding: BOARD_PADDING,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.2,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  boardRow: {
    flexDirection: "row",
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 0.8,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  cellInitial: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cellSelected: {
    backgroundColor: "rgba(139, 143, 232, 0.22)",
    borderColor: theme.violet,
    borderWidth: 1.8,
  },
  cellConflict: {
    backgroundColor: "rgba(255, 138, 138, 0.18)",
    borderColor: "rgba(255, 138, 138, 0.5)",
  },
  cellText: {
    fontWeight: "600",
    color: "rgba(247,251,255,0.85)",
  },
  cellTextInitial: {
    fontFamily: "Manrope_700Bold",
    color: theme.white,
  },
  keypadContainer: {
    marginTop: spacing.lg,
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    width: "100%",
  },
  keyBtn: {
    minWidth: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    ...shadow.card,
  },
  clearBtn: {
    flexDirection: "row",
    backgroundColor: "rgba(255,138,138,0.1)",
    borderColor: "rgba(255,138,138,0.25)",
  },
  menuBtn: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  startPanel: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
  },
  startCard: {
    width: "100%",
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderColor: "rgba(139,143,232,0.16)",
    borderWidth: 1.2,
    alignItems: "center",
  },
  sizeSelectionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  sizeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
  },
  sizeBtnActive: {
    backgroundColor: theme.violet,
    borderColor: theme.violet,
    ...shadow.glow,
  },
  playButtonOverlay: {
    backgroundColor: "rgba(139,143,232,0.22)",
    borderColor: theme.violet,
    borderWidth: 1.5,
    borderRadius: radii.xl,
    paddingHorizontal: 36,
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.glow,
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
    backgroundColor: theme.violet,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    ...shadow.glow,
  },
});
