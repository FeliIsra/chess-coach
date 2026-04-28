import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EloPoint, FullAnalysisResult, ChessGame } from "@/lib/types";

interface EloSnapshotRow {
  rating: number;
  captured_at: string;
  analysis_id: string | null;
  time_class: string;
  chess_username: string;
}

function mapRow(row: EloSnapshotRow): EloPoint {
  return {
    rating: row.rating,
    capturedAt: row.captured_at,
    analysisId: row.analysis_id,
    timeClass: row.time_class,
    chessUsername: row.chess_username,
  };
}

export async function getEloHistory(
  userId: string,
  options: { timeClass?: string; chessUsername?: string; limit?: number } = {}
): Promise<EloPoint[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("elo_snapshots")
    .select("rating, captured_at, analysis_id, time_class, chess_username")
    .eq("user_id", userId)
    .order("captured_at", { ascending: true });

  if (options.timeClass) query = query.eq("time_class", options.timeClass);
  if (options.chessUsername) query = query.eq("chess_username", options.chessUsername);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

interface SnapshotInput {
  chessUsername: string;
  timeClass: string;
  rating: number;
}

/**
 * Walks a finished analysis result and returns one snapshot per time class,
 * picking the most recent rating per (chessUsername, timeClass) seen in the
 * analyzed games. The chessUsername we capture is whatever Chess.com returned
 * for the player who matched the input handle (case-preserving).
 */
export function extractSnapshotsFromResult(
  result: FullAnalysisResult,
  fallbackUsername: string
): SnapshotInput[] {
  const games = result.games ?? [];
  const byKey = new Map<string, { game: ChessGame; date: number }>();

  for (const g of games) {
    const game = g.game;
    if (!game) continue;
    const username = fallbackUsername.trim();
    const timeClass = (game.timeClass || "").toLowerCase();
    const rating = Number(game.userRating);
    if (!timeClass || !Number.isFinite(rating) || rating <= 0) continue;
    const date = Date.parse(game.date) || 0;
    const key = `${username.toLowerCase()}::${timeClass}`;
    const existing = byKey.get(key);
    if (!existing || existing.date < date) {
      byKey.set(key, { game, date });
    }
  }

  const snapshots: SnapshotInput[] = [];
  for (const { game } of byKey.values()) {
    snapshots.push({
      chessUsername: fallbackUsername,
      timeClass: (game.timeClass || "").toLowerCase(),
      rating: Number(game.userRating),
    });
  }
  return snapshots;
}
