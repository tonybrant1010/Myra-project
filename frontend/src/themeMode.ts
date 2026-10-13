import { Platform } from "react-native";


export type ThemeMode = "day" | "night";

export const THEME_STORAGE_KEY = "myra.theme.mode";

const isWeb = Platform.OS === "web";

export function getThemeMode(): ThemeMode {
  if (!isWeb) return "day";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

export function setThemeMode(mode: ThemeMode): void {
  if (!isWeb) return;
  try {
    const root = document.documentElement;
    if (mode === "night") {
      root.setAttribute("data-theme", "night");
    } else {
      root.removeAttribute("data-theme");
    }
  } catch {
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
  }
}

export function toggleThemeMode(): ThemeMode {
  const next: ThemeMode = getThemeMode() === "night" ? "day" : "night";
  setThemeMode(next);
  return next;
}
