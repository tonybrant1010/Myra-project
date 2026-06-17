import React, { useState, useEffect, useRef } from "react";
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

const GRID_SIZE = 12;
const { width } = Dimensions.get("window");
const BOARD_PADDING = 12;
const BOARD_SIZE = width - 32;
const CELL_SIZE = Math.floor((BOARD_SIZE - BOARD_PADDING * 2) / GRID_SIZE);

type Coord = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export default function RelaxSnakeScreen() {
  const router = useRouter();

  // State
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

  const directionRef = useRef<Direction>("UP");
  const lastDirectionRef = useRef<Direction>("UP");

  // Load high score
  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const val = await AsyncStorage.getItem("myra_snake_highscore");
        if (val !== null) {
          setHighScore(parseInt(val, 10));
        }
      } catch (e) {}
    };
    loadHighScore();
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("myra_snake_highscore", score.toString()).catch(() => {});
    }
  }, [score, highScore]);

  // Main Game Loop
  useEffect(() => {
    if (!isRunning || gameOver) return;

    const interval = setInterval(() => {
      moveSnake();
    }, 180);

    return () => clearInterval(interval);
  }, [isRunning, gameOver, snake, direction]);

  // Generate random food coordinates not on the snake
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

    // Check Wall Collisions
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      triggerGameOver();
      return;
    }

    // Check Self Collisions (excluding the tail if it's going to move, but standard self-collision checks body)
    const hitSelf = snake.some((segment) => segment.x === newHead.x && segment.y === newHead.y);
    if (hitSelf) {
      triggerGameOver();
      return;
    }

    const newSnake = [newHead, ...snake];

    // Check Food Collision
    if (newHead.x === food.x && newHead.y === food.y) {
      // Eat food
      setScore((prev) => prev + 10);
      setFood(generateFood(newSnake));
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        Vibration.vibrate(40);
      }
    } else {
      // Move forward (pop tail)
      newSnake.pop();
    }

    setSnake(newSnake);
  };

  const triggerGameOver = () => {
    setIsRunning(false);
    setGameOver(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
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
    } catch (e) {}
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
  };

  const toggleGame = () => {
    if (gameOver) {
      startNewGame();
    } else {
      setIsRunning((prev) => !prev);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-snake-screen">
      <TopBar title="Kígyó Játék" showBack={true} backPath="/relax" />
      <ContentBackground>
        <View style={styles.container}>
          {/* Header Stats */}
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

          {/* Board Wrap */}
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
            style={[styles.boardWrap, shadow.card]}
          >
            {/* Render cells */}
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

            {/* Game overlays */}
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
                    onPress={startNewGame}
                    activeOpacity={0.82}
                  >
                    <T variant="title" color={theme.white} style={{ fontWeight: "700" }}>Új játék</T>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}

            {!isRunning && !gameOver && (
              <View style={styles.overlay}>
                <TouchableOpacity
                  style={styles.playButtonOverlay}
                  onPress={toggleGame}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={40} color={theme.white} />
                  <T variant="title" color={theme.white} style={{ marginTop: 8, fontWeight: "600" }}>
                    Játék Indítása
                  </T>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>

          {/* D-Pad Controller */}
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
              {/* Pause/Play Button in the center */}
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
});
