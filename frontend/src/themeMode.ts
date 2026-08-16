import { Platform } from "react-native";

/**
 * Nappali / éjszakai mód kapcsoló.
 *
 * Miért így: a színek nem itt élnek, hanem CSS-változókban (lásd app/+html.tsx).
 * Ez a modul mindössze egyetlen attribútumot billent át a <html> elemen:
 *
 *     <html data-theme="night">
 *
 * Ettől a böngésző CSS-motorja újraértékeli az összes `var(--myra-*)` hivatkozást,
 * anélkül hogy egyetlen React komponens is újrarenderelne. Ez azért fontos, mert a
 * projektben 27 fájl modulszintű `StyleSheet.create`-et használ: azok importáláskor
 * egyszer futnak le, tehát egy JS-alapú témaváltás náluk nem érne semmit.
 *
 * Natívon (iOS/Android) nincs CSS, ezért ott ez a modul szándékosan nem csinál
 * semmit — a natív build a nappali paletta fix értékeit kapja a theme.ts-ből.
 */

export type ThemeMode = "day" | "night";

export const THEME_STORAGE_KEY = "myra.theme.mode";

const isWeb = Platform.OS === "web";

/** A mód beolvasása. Hibás vagy hiányzó érték esetén mindig "day". */
export function getThemeMode(): ThemeMode {
  if (!isWeb) return "day";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "night" ? "night" : "day";
  } catch {
    // privát böngészés / letiltott storage: ilyenkor is működjön az oldal
    return "day";
  }
}

/** A mód beállítása: attribútum a <html>-en + megjegyzés a következő látogatásra. */
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
    // ha nincs DOM, ne dőljön el semmi
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // a mentés hiánya nem hiba: a mód a munkamenetre így is érvényes marad
  }
}

/** Átváltás, visszaadja az új módot. */
export function toggleThemeMode(): ThemeMode {
  const next: ThemeMode = getThemeMode() === "night" ? "day" : "night";
  setThemeMode(next);
  return next;
}
