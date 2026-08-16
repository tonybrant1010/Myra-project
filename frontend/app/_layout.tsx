import React, { useCallback } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.bg }}
      onLayout={onLayout}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          {Platform.OS === "web" && (
            <style dangerouslySetInnerHTML={{ __html: `
              /* Custom Brand Scrollbars */
              ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              ::-webkit-scrollbar-track {
                background: var(--myra-scrollbar-track);
              }
              ::-webkit-scrollbar-thumb {
                background: rgba(79, 209, 197, 0.25);
                border-radius: 99px;
                border: 2px solid var(--myra-scrollbar-track);
                transition: background 0.3s ease;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: rgba(79, 209, 197, 0.45);
              }

              /* Brand text selection color */
              ::selection {
                background: rgba(79, 209, 197, 0.35);
                color: #f7fafc;
              }

              /* Smooth transition for inputs & active elements */
              input, textarea, [role="button"], button, a {
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
              }

              /* Input Focus Glows */
              input:focus, textarea:focus, [contenteditable="true"]:focus {
                outline: none !important;
                outline-width: 0 !important;
                border-color: #4fd1c5 !important;
                box-shadow: 0 0 14px rgba(79, 209, 197, 0.45) !important;
                background-color: rgba(255, 255, 255, 0.08) !important;
              }

              /* Hover scales for interactive elements (buttons, links, active pressables) */
              [role="button"]:hover, button:hover, a:hover, [role="link"]:hover, [style*="cursor: pointer"]:hover, [style*="cursor:pointer"]:hover {
                transform: translateY(-1.5px) scale(1.015) !important;
                opacity: 0.95 !important;
                filter: brightness(1.15) !important;
              }
            ` }} />
          )}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.bg },
              animation: "fade",
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
