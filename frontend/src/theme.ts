import { Platform } from "react-native";

/**
 * Színpaletta.
 *
 * Weben a mód-függő tokenek nem fix értéket, hanem CSS-változót kapnak
 * (`var(--myra-...)`). A változók konkrét értékét az app/+html.tsx definiálja,
 * nappali és éjszakai változatban. A váltás így egyetlen attribútum átbillentése
 * a <html> elemen (lásd src/themeMode.ts), és nem igényel JS újrarenderelést —
 * ami azért létfontosságú, mert a képernyők modulszintű `StyleSheet.create`-et
 * használnak, ami importáláskor egyszer fut le.
 *
 * Ezt a React Native Web és az expo-linear-gradient is szándékosan támogatja:
 * mindkettőben van egy `isWebColor` ellenőrzés, ami a `var(`-ral KEZDŐDŐ
 * stringet érintetlenül továbbengedi a CSS-be. FONTOS: a `var(` csak a string
 * ELEJÉN állhat — `"rgba(var(--x), 0.5)"` már nem menne át.
 *
 * Natívon nincs CSS-változó, ezért ott a nappali paletta fix értékei érvényesek.
 */
const mod = <T,>(webValue: T, nativeValue: T): T =>
  Platform.OS === "web" ? webValue : nativeValue;

export const theme = {

  bg: mod("var(--myra-bg)", "#040b14"),
  background: mod("var(--myra-bg)", "#040b14"),
  surface: mod("var(--myra-surface)", "rgba(255,255,255,0.96)"),
  surfaceStrong: mod("var(--myra-surface-strong)", "#FFFFFF"),
  surfaceAlt: mod("var(--myra-surface-alt)", "rgba(244,249,255,0.85)"),
  surfaceGlass: mod("var(--myra-glass)", "rgba(255,255,255,0.08)"),
  surfaceGlassStrong: mod("var(--myra-glass-strong)", "rgba(255,255,255,0.15)"),


  // FIGYELEM: a `primary` szándékosan NEM mód-függő. Három, egymásnak ellentmondó
  // szerepben használjuk: gomb HÁTTERE (confirmGo), gomb KERETE (confirmCancel), és
  // sötét SZÖVEG világos kártyán. Ha éjszakára világosra váltanánk, a rajta ülő
  // fehér gombfelirat olvashatatlanná válna; ha sötétebbre, a szöveg tűnne el.
  // A megoldás: az érték marad, a néhány szöveg-használat pedig textPrimary-t kap.
  primary: "#071b30",
  primaryDark: mod("var(--myra-primary-dark)", "#030c16"),
  primarySoft: mod("var(--myra-primary-soft)", "#0f2d4e"),
  // A kiemelő színek szándékosan azonosak mindkét módban: a türkiz/kék paletta
  // sötét háttéren is jól olvasható, a fölösleges eltérés csak kockázat lenne.
  secondary: "#7ea3ff",
  accent: "#4fd1c5",
  accentDeep: "#2baba0",
  // FIGYELEM: az accentSoft 41 helyen VILÁGOS SZÖVEG sötét felületen (feliratok,
  // ikonok, a welcome oldali e-mail cím) és csak 1 helyen háttér. Éjszakára sötétre
  // váltani hiba volt: a szöveg eltűnt. Marad világos mindkét módban.
  accentSoft: "#e6fffa",
  info: "#4299e1",
  warm: "#ecc94b",
  calm: "#319795",
  violet: "#9f7aea",


  // Ez a három a világos kártyákon ülő szöveg, éjszaka ezek fordulnak meg.
  textPrimary: mod("var(--myra-text-primary)", "#0d1f35"),
  textSecondary: mod("var(--myra-text-secondary)", "#4a5d73"),
  textMuted: mod("var(--myra-text-muted)", "#718096"),
  // A sötét háttéren ülő szöveg mindkét módban világos marad.
  textOnDark: "#f7fafc",


  border: mod("var(--myra-border)", "rgba(79,209,197,0.3)"),
  borderSoft: mod("var(--myra-border-soft)", "rgba(79,209,197,0.15)"),
  borderOnDark: mod("var(--myra-border-on-dark)", "rgba(255,255,255,0.12)"),


  danger: "#e53e3e",
  success: "#38a169",
  white: "#FFFFFF",
};

/**
 * A ContentBackground színátmenetének négy megállója. Éjszakai módban a negyedik
 * (eddig majdnem fehér) megálló is besötétedik — ez adja a látvány nagy részét.
 */
export const backgroundGradient: [string, string, string, string] = [
  mod("var(--myra-grad-1)", "#04101D"),
  mod("var(--myra-grad-2)", "#08223B"),
  mod("var(--myra-grad-3)", "#123E66"),
  mod("var(--myra-grad-4)", "#EAF7FF"),
];

export const fonts = {
  display: Platform.select({
    ios: "Manrope_700Bold",
    android: "Manrope_700Bold",
    default: "Manrope_700Bold",
  })!,
  displayBook: "Manrope_600SemiBold",
  body: Platform.select({
    ios: "Manrope_400Regular",
    android: "Manrope_400Regular",
    default: "Manrope_400Regular",
  })!,
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const shadow = {
  card: Platform.select({
    web: {
      boxShadow: "0 14px 28px rgba(3,17,31,0.18)",
    },
    ios: {
      shadowColor: "#03111F",
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 3 },
    default: {
      shadowColor: "#03111F",
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
    },
  })!,
  glow: Platform.select({
    web: {
      boxShadow: "0 8px 22px rgba(87,199,255,0.28)",
    },
    ios: {
      shadowColor: "#57C7FF",
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 4 },
    default: {
      shadowColor: "#57C7FF",
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
    },
  })!,
};
