import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthContext";

export function useAuthGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);
}
