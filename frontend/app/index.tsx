import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { theme } from "@/src/theme";

export default function Index() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}
        testID="splash-loading"
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  if (!user.state_code) return <Redirect href="/quiz" />;

  return <Redirect href="/chat" />;
}