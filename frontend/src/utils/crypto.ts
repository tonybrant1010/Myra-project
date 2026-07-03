import { authedFetch } from "@/src/auth/AuthContext";


export async function startLeaderboardSession(
  token: string | null,
  gameType: "match" | "snake" | "sudoku"
): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await authedFetch(token, "/api/leaderboard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_type: gameType }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.session_token === "string" ? data.session_token : null;
  } catch {
    return null;
  }
}
