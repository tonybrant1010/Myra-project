import React, { useState, useEffect } from "react";
import { StyleSheet, View, TouchableOpacity, Dimensions, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

// Calming pastel palette
const PALETTE = [
  "#FF8A8A", // Soft Red
  "#FFB38A", // Soft Orange
  "#FFF58A", // Soft Yellow
  "#8AFF9C", // Soft Green
  "#8AE0FF", // Soft Blue
  "#A08AFF", // Soft Violet
  "#FF8AE0", // Soft Pink
  "transparent", // Eraser
];

type TemplateName = "HEART" | "FLOWER" | "SUN" | "FREE";

// 12x12 Boolean matrix for outlines
const TEMPLATES: Record<TemplateName, boolean[][]> = {
  FREE: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false)),
  
  HEART: [
    [false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, true,  true,  false, false, false, false, true,  true,  false, false],
    [false, true,  false, false, true,  false, false, true,  false, false, true,  false],
    [true,  false, false, false, false, true,  true,  false, false, false, false, true ],
    [true,  false, false, false, false, false, false, false, false, false, false, true ],
    [false, true,  false, false, false, false, false, false, false, false, true,  false],
    [false, false, true,  false, false, false, false, false, false, true,  false, false],
    [false, false, false, true,  false, false, false, false, true,  false, false, false],
    [false, false, false, false, true,  false, false, true,  false, false, false, false],
    [false, false, false, false, false, true,  true,  false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  FLOWER: [
    [false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, true,  true,  false, false, false, false, false],
    [false, false, false, false, true,  false, false, true,  false, false, false, false],
    [false, false, true,  false, false, true,  true,  false, false, true,  false, false],
    [false, true,  false, true,  false, false, false, false, true,  false, true,  false],
    [false, true,  false, false, true,  true,  true,  true,  false, false, true,  false],
    [false, false, true,  false, false, true,  true,  false, false, true,  false, false],
    [false, false, false, true,  false, false, false, false, true,  false, false, false],
    [false, false, false, false, true,  false, false, true,  false, false, false, false],
    [false, false, false, false, false, true,  true,  false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  SUN: [
    [false, false, false, false, false, true,  true,  false, false, false, false, false],
    [false, true,  false, false, false, false, false, false, false, false, true,  false],
    [false, false, true,  false, false, false, false, false, false, true,  false, false],
    [false, false, false, true,  true,  true,  true,  true,  true,  false, false, false],
    [false, false, false, true,  false, false, false, false, true,  false, false, false],
    [true,  false, false, true,  false, false, false, false, true,  false, false, true ],
    [true,  false, false, true,  false, false, false, false, true,  false, false, true ],
    [false, false, false, true,  false, false, false, false, true,  false, false, false],
    [false, false, false, true,  true,  true,  true,  true,  true,  false, false, false],
    [false, false, true,  false, false, false, false, false, false, true,  false, false],
    [false, true,  false, false, false, false, false, false, false, false, true,  false],
    [false, false, false, false, false, true,  true,  false, false, false, false, false],
  ],
};

export default function RelaxColoringScreen() {
  const router = useRouter();

  // State
  const [activeTemplate, setActiveTemplate] = useState<TemplateName>("HEART");
  const [activeColor, setActiveColor] = useState(PALETTE[0]);
  const [grid, setGrid] = useState<string[][]>([]);

  // Initialize board on load / template switch
  useEffect(() => {
    resetGrid();
  }, [activeTemplate]);

  const resetGrid = () => {
    setGrid(
      Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill(""))
    );
  };

  const handleCellPress = (r: number, c: number) => {
    const newGrid = grid.map((row) => [...row]);
    newGrid[r][c] = activeColor === "transparent" ? "" : activeColor;
    setGrid(newGrid);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.safe} testID="relax-coloring-screen">
      <TopBar title="Pixel Színező" showBack={true} backPath="/relax" />
      <ContentBackground>
        <View style={styles.container}>
          {/* Template Selector Options */}
          <View style={styles.templatePanel}>
            {(["HEART", "FLOWER", "SUN", "FREE"] as TemplateName[]).map((name) => {
              const isActive = activeTemplate === name;
              let label = "Szív";
              if (name === "FLOWER") label = "Virág";
              if (name === "SUN") label = "Nap";
              if (name === "FREE") label = "Szabad";

              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.templateBtn, isActive && styles.templateBtnActive]}
                  onPress={() => {
                    setActiveTemplate(name);
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch (e) {}
                  }}
                  activeOpacity={0.75}
                >
                  <T variant="small" color={isActive ? theme.white : "rgba(247,251,255,0.7)"} style={{ fontWeight: "600" }}>
                    {label}
                  </T>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Board Grid Wrap */}
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
            style={[styles.boardWrap, shadow.card]}
          >
            {grid.map((row, rIdx) => (
              <View key={`row-${rIdx}`} style={styles.boardRow}>
                {row.map((color, cIdx) => {
                  const isTemplateOutline = TEMPLATES[activeTemplate][rIdx][cIdx];
                  const hasColor = color !== "";

                  return (
                    <TouchableOpacity
                      key={`cell-${rIdx}-${cIdx}`}
                      style={[
                        styles.cell,
                        hasColor && { backgroundColor: color, borderColor: "rgba(255,255,255,0.15)" },
                      ]}
                      onPress={() => handleCellPress(rIdx, cIdx)}
                      activeOpacity={0.75}
                    >
                      {/* Guide dot for outline template */}
                      {!hasColor && isTemplateOutline ? (
                        <View style={styles.outlineDot} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </LinearGradient>

          {/* Palette Colors Selector */}
          <View style={styles.paletteContainer}>
            <T variant="small" color="rgba(247,251,255,0.5)" style={{ marginBottom: 12 }}>
              Válassz színt és érintsd meg a rácsot:
            </T>
            <View style={styles.paletteRow}>
              {PALETTE.map((color) => {
                const isSelected = activeColor === color;
                const isEraser = color === "transparent";

                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorBubble,
                      isEraser ? styles.eraserBubble : { backgroundColor: color },
                      isSelected && styles.colorBubbleSelected,
                    ]}
                    onPress={() => {
                      setActiveColor(color);
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch (e) {}
                    }}
                    activeOpacity={0.8}
                  >
                    {isEraser ? (
                      <Ionicons name="trash-outline" size={20} color={isSelected ? theme.white : "rgba(247,251,255,0.7)"} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Control Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={resetGrid}
            >
              <Ionicons name="refresh" size={18} color={theme.textOnDark} />
              <T variant="label" color={theme.textOnDark} style={{ marginLeft: 6 }}>Törlés</T>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.exitButton]}
              onPress={() => router.back()}
            >
              <Ionicons name="exit-outline" size={18} color="rgba(247,251,255,0.8)" />
              <T variant="label" color="rgba(247,251,255,0.8)" style={{ marginLeft: 6 }}>Kilépés</T>
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
  templatePanel: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  templateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(87, 199, 255, 0.12)",
    borderWidth: 1,
  },
  templateBtnActive: {
    backgroundColor: theme.violet,
    borderColor: theme.violet,
    ...shadow.glow,
  },
  boardWrap: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    padding: BOARD_PADDING,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(87,199,255,0.16)",
    borderWidth: 1.2,
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
    borderColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  outlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(247,251,255,0.22)",
  },
  paletteContainer: {
    marginTop: spacing.lg,
    width: "100%",
    alignItems: "center",
  },
  paletteRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  colorBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  colorBubbleSelected: {
    borderColor: theme.white,
    transform: [{ scale: 1.15 }],
    ...shadow.glow,
  },
  eraserBubble: {
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
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
