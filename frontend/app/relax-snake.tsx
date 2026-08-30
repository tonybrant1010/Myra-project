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

const GRID_SIZE = 12;
const { width } = Dimensions.get("window");
const BOARD_PADDING = 12;
const BOARD_SIZE = width - 32;
const CELL_SIZE = Math.floor((BOARD_SIZE - BOARD_PADDING * 2) / GRID_SIZE);

type Coord = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export default function RelaxSnakeScreen() {
  const { token } = useAuth();


  const [snake, setSnake] = useState<Coord[]>([
    { x: 6, y: 6 },
    { x: 6, y: 7 },
    { x: 6, y: 8 },
  ]);
  const [food, setFood] = useState<Coord>({ x: 6, y: 3 });
  const [direction, setDirection] = useState<Direction>("UP");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState<"SLOW" | "MEDIUM" | "FAST">("SLOW");

  const directionRef = useRef<Direction>("UP");
  const lastDirectionRef = useRef<Direction>("UP");
  const sessionTokenRef = useRef<string | null>(null);


  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const val = await AsyncStorage.getItem("myra_snake_highscore");
        if (val !== null) {
          setHighScore(parseInt(val, 10));
        }
      } catch {}
    };
    loadHighScore();
  }, []);


  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("myra_snake_highscore", score.toString()).catch(() => {});
    }
  }, [score, highScore]);


  useEffect(() => {
    if (!isRunning || gameOver) return;

    const getSpeedInterval = (s: typeof speed) => {
      if (s === "SLOW") return 360;
      if (s === "FAST") return 150;
      return 240;
    };

    const interval = setInterval(() => {
      moveSnake();
    }, getSpeedInterval(speed));

    return () => clearInterval(interval);
  }, [isRunning, gameOver, snake, direction, speed]);


  const generateFood = (currentSnake: Coord[]): Coord => {
    let newFood: Coord;
    let isOnSnake = true;
    while (isOnSnake) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      isOnSnake = currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y);
    }
    return newFood!;
  };

  const moveSnake = () => {
    const head = snake[0];
    const currentDirection = directionRef.current;
    lastDirectionRef.current = currentDirection;

    let newHead: Coord;
    switch (currentDirection) {
      case "UP":
        newHead = { x: head.x, y: head.y - 1 };
        break;
      case "DOWN":
        newHead = { x: head.x, y: head.y + 1 };
        break;
      case "LEFT":
        newHead = { x: head.x - 1, y: head.y };
        break;
      case "RIGHT":
        newHead = { x: head.x + 1, y: head.y };
        break;
    }


    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      triggerGameOver();
      return;
    }


    const hitSelf = snake.some((segment) => segment.x === newHead.x && segment.y === newHead.y);
    if (hitSelf) {
      triggerGameOver();
      return;
    }

    const newSnake = [newHead, ...snake];


    if (newHead.x === food.x && newHead.y === food.y) {

      setScore((prev) => prev + 10);
      setFood(generateFood(newSnake));
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        Vibration.vibrate(40);
      }
    } else {

      newSnake.pop();
    }

    setSnake(newSnake);
  };

  const triggerGameOver = () => {
    setIsRunning(false);
    setGameOver(true);
    if (token && sessionTokenRef.current) {
      authedFetch(token, "/api/leaderboard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_type: "snake",
          score,
          session_token: sessionTokenRef.current,
        }),
      }).catch(() => {});
      sessionTokenRef.current = null;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      Vibration.vibrate(150);
    }
  };

  const changeDirection = (newDir: Direction) => {
    const lastDir = lastDirectionRef.current;
    if (newDir === "UP" && lastDir === "DOWN") return;
    if (newDir === "DOWN" && lastDir === "UP") return;
    if (newDir === "LEFT" && lastDir === "RIGHT") return;
    if (newDir === "RIGHT" && lastDir === "LEFT") return;

    setDirection(newDir);
    directionRef.current = newDir;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const startNewGame = () => {
    const initialSnake = [
      { x: 6, y: 6 },
      { x: 6, y: 7 },
      { x: 6, y: 8 },
    ];
    setSnake(initialSnake);
    setFood({ x: 6, y: 3 });
    setDirection("UP");
    directionRef.current = "UP";
    lastDirectionRef.current = "UP";
    setScore(0);
    setGameOver(false);
    setIsRunning(true);
    sessionTokenRef.current = null;
    if (token) {
      startLeaderboardSession(token, "snake").then((sessionToken) => {
        sessionTokenRef.current = sessionToken;
      });
    }
  };

  const resetToStartScreen = () => {
    const initialSnake = [
      { x: 6, y: 6 },
      { x: 6, y: 7 },
      { x: 6, y: 8 },
    ];
    setSnake(initialSnake);
    setFood({ x: 6, y: 3 });
    setDirection("UP");
    directionRef.current = "UP";
    lastDirectionRef.current = "UP";
    setScore(0);
    setGameOver(false);
    setIsRunning(false);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const toggleGame = () => {
    if (gameOver) {
      startNewGame();
    } else {
      setIsRunning((prev) => !prev);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-snake-screen">
      <ContentBackground>
        <TopBar title="Kígyó Játék" showBack={true} backPath="/relax" />
        <View style={styles.container}>

          <View style={styles.statsPanel}>
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


          <LinearGradient
            colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
            style={[styles.boardWrap, shadow.card]}
          >

            {Array(GRID_SIZE)
              .fill(null)
              .map((_, r) => (
                <View key={`row-${r}`} style={styles.boardRow}>
                  {Array(GRID_SIZE)
                    .fill(null)
                    .map((_, c) => {
                      const isHead = snake[0].x === c && snake[0].y === r;
                      const isBody = snake.slice(1).some((segment) => segment.x === c && segment.y === r);
                      const isFood = food.x === c && food.y === r;

                      return (
                        <View
                          key={`cell-${r}-${c}`}
                          style={[
                            styles.cell,
                            isHead && styles.cellHead,
                            isBody && styles.cellBody,
                          ]}
                        >
                          {isFood ? <T style={styles.foodEmoji}>🍀</T> : null}
                        </View>
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
                  <Ionicons name="alert-circle-outline" size={56} color={theme.danger} style={{ marginBottom: 12 }} />
                  <T variant="display" color={theme.textOnDark} align="center" style={{ marginBottom: 8 }}>
                    Ütköztél!
                  </T>
                  <T variant="title" color="rgba(247,251,255,0.7)" align="center" style={{ marginBottom: 24 }}>
                    Elért pontszám: {score}
                  </T>
                  <TouchableOpacity
                    style={styles.restartBtn}
                    onPress={resetToStartScreen}
                    activeOpacity={0.82}
                  >
                    <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>Új játék</T>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}

            {!isRunning && !gameOver && (
              <View style={styles.overlay}>
                <LinearGradient
                  colors={["rgba(6,19,32,0.95)", "rgba(10,35,64,0.98)"]}
                  style={styles.overlayGradient}
                >
                  <Ionicons name="navigate-outline" size={44} color={theme.success} style={{ marginBottom: 12 }} />
                  <T variant="h2" color={theme.textOnDark} style={{ marginBottom: 20, fontWeight: "700" }}>
                    Kígyó Játék
                  </T>

                  <T variant="small" color="rgba(247,251,255,0.6)" style={{ marginBottom: 8 }}>
                    Sebesség kiválasztása:
                  </T>

                  <View style={styles.speedRow}>
                    {(["SLOW", "MEDIUM", "FAST"] as const).map((s) => {
                      const isActive = speed === s;
                      let label = "Közepes";
                      if (s === "SLOW") label = "Lassú";
                      if (s === "FAST") label = "Gyors";

                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.speedBtn, isActive && styles.speedBtnActive]}
                          onPress={() => {
                            setSpeed(s);
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                          }}
                          activeOpacity={0.8}
                        >
                          <T variant="small" color={isActive ? theme.white : "rgba(247,251,255,0.7)"} style={{ fontWeight: "600" }}>
                            {label}
                          </T>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.playButtonOverlay, { marginTop: 20 }]}
                    onPress={toggleGame}
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
          </LinearGradient>


          <View style={styles.controlsContainer}>
            <View style={styles.dpadRow}>
              <View style={styles.dpadCell} />
              <TouchableOpacity
                style={styles.dpadButton}
                onPress={() => changeDirection("UP")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-up" size={28} color={theme.textOnDark} />
              </TouchableOpacity>
              <View style={styles.dpadCell} />
            </View>

            <View style={styles.dpadRow}>
              <TouchableOpacity
                style={styles.dpadButton}
                onPress={() => changeDirection("LEFT")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={28} color={theme.textOnDark} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dpadButton, styles.dpadCenterButton]}
                onPress={toggleGame}
                activeOpacity={0.7}
              >
                <Ionicons name={isRunning ? "pause" : "play"} size={22} color={theme.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dpadButton}
                onPress={() => changeDirection("RIGHT")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={28} color={theme.textOnDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.dpadRow}>
              <View style={styles.dpadCell} />
              <TouchableOpacity
                style={styles.dpadButton}
                onPress={() => changeDirection("DOWN")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-down" size={28} color={theme.textOnDark} />
              </TouchableOpacity>
              <View style={styles.dpadCell} />
            </View>
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
    borderColor: "rgba(87,199,255,0.16)",
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
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.015)",
    borderWidth: 0.5,
  },
  cellHead: {
    backgroundColor: theme.success,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: theme.white,
  },
  cellBody: {
    backgroundColor: "rgba(86,214,141,0.65)",
    borderRadius: radii.pill,
    transform: [{ scale: 0.88 }],
  },
  foodEmoji: {
    fontSize: CELL_SIZE - 2,
    lineHeight: CELL_SIZE,
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
    backgroundColor: theme.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    ...shadow.glow,
  },
  playButtonOverlay: {
    backgroundColor: "rgba(86,214,141,0.25)",
    borderColor: theme.success,
    borderWidth: 1.5,
    borderRadius: radii.xl,
    paddingHorizontal: 28,
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  controlsContainer: {
    marginTop: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  dpadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dpadCell: {
    width: 54,
    height: 54,
    margin: 4,
  },
  dpadButton: {
    width: 54,
    height: 54,
    margin: 4,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(87,199,255,0.12)",
    borderWidth: 1.2,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
  },
  dpadCenterButton: {
    backgroundColor: "rgba(87,199,255,0.1)",
    borderColor: "rgba(87,199,255,0.22)",
  },
  speedRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  speedBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(87, 199, 255, 0.12)",
    borderWidth: 1.2,
  },
  speedBtnActive: {
    backgroundColor: theme.success,
    borderColor: theme.success,
    ...shadow.glow,
  },
});
