import { sha256 } from "./sha256";

// Secure salt used to sign leaderboard scores.
const LEADERBOARD_SALT = process.env.EXPO_PUBLIC_LEADERBOARD_SALT || "myra-default-leaderboard-salt-2026";

/**
 * Generates a SHA-256 signature for leaderboard score verification.
 * 
 * @param gameType The type of game (e.g. "match", "snake", "sudoku")
 * @param score The score achieved by the player
 * @param timestamp The Unix timestamp when the score was submitted
 */
export function generateLeaderboardSignature(
  gameType: "match" | "snake" | "sudoku",
  score: number,
  timestamp: number
): string {
  const payload = `${gameType}:${score}:${timestamp}:${LEADERBOARD_SALT}`;
  return sha256(payload);
}
