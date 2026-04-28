import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractSnapshotsFromResult } from "@/lib/elo-progress";
import type { AnalysisSession, FullAnalysisResult } from "@/lib/types";

interface AnalysisRow {
  id: string;
  user_id: string;
  chess_username: string;
  time_class: string | null;
  result_json: FullAnalysisResult;
  summary_metrics: SummaryMetrics | null;
  is_public: boolean;
  created_at: string;
}

interface SummaryMetrics {
  gamesCount: number;
  totalBlunders: number;
  totalMistakes: number;
  averageAccuracy: number;
  avgBlundersPerGame: number;
}

function buildSummary(result: FullAnalysisResult): SummaryMetrics {
  const games = result.games ?? [];
  const overall = result.overallSummary;
  const gamesCount = games.length;
  const totalBlunders = overall?.totalBlunders ?? 0;
  const totalMistakes = overall?.totalMistakes ?? 0;
  const averageAccuracy = overall?.averageAccuracy ?? 0;
  const avgBlundersPerGame = gamesCount > 0 ? totalBlunders / gamesCount : 0;
  return { gamesCount, totalBlunders, totalMistakes, averageAccuracy, avgBlundersPerGame };
}

function pickPrimaryTimeClass(result: FullAnalysisResult): string | null {
  const counts = new Map<string, number>();
  for (const g of result.games ?? []) {
    const tc = (g.game?.timeClass || "").toLowerCase();
    if (!tc) continue;
    counts.set(tc, (counts.get(tc) ?? 0) + 1);
  }
  let top: [string, number] | null = null;
  for (const entry of counts) {
    if (!top || entry[1] > top[1]) top = entry;
  }
  return top ? top[0] : null;
}

export function rowToSession(row: AnalysisRow): AnalysisSession {
  const summary = row.summary_metrics ?? buildSummary(row.result_json);
  return {
    id: row.id,
    date: row.created_at,
    username: row.chess_username,
    timeClass: row.time_class ?? undefined,
    gamesCount: summary.gamesCount,
    totalBlunders: summary.totalBlunders,
    totalMistakes: summary.totalMistakes,
    averageAccuracy: summary.averageAccuracy,
    avgBlundersPerGame: summary.avgBlundersPerGame,
    isPublic: row.is_public,
  };
}

export async function listAnalyses(
  userId: string,
  options: { chessUsername?: string; timeClass?: string; limit?: number } = {}
): Promise<AnalysisSession[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("analyses")
    .select("id, user_id, chess_username, time_class, result_json, summary_metrics, is_public, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options.chessUsername) query = query.eq("chess_username", options.chessUsername);
  if (options.timeClass) query = query.eq("time_class", options.timeClass);
  query = query.limit(options.limit ?? 50);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => rowToSession(r as AnalysisRow));
}

export async function getAnalysisById(
  id: string,
  viewer: { userId: string | null }
): Promise<{ session: AnalysisSession; result: FullAnalysisResult } | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, chess_username, time_class, result_json, summary_metrics, is_public, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as AnalysisRow;
  if (!row.is_public && row.user_id !== viewer.userId) return null;
  return { session: rowToSession(row), result: row.result_json };
}

export async function saveAnalysis(
  userId: string,
  payload: { chessUsername: string; result: FullAnalysisResult }
): Promise<{ id: string }> {
  const supabase = await getSupabaseServerClient();
  const summary = buildSummary(payload.result);
  const timeClass = pickPrimaryTimeClass(payload.result);

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      user_id: userId,
      chess_username: payload.chessUsername,
      time_class: timeClass,
      result_json: payload.result,
      summary_metrics: summary,
    })
    .select("id")
    .single();

  if (error) throw error;
  const analysisId = data.id as string;

  const snapshots = extractSnapshotsFromResult(payload.result, payload.chessUsername);
  if (snapshots.length > 0) {
    const rows = snapshots.map((s) => ({
      user_id: userId,
      chess_username: s.chessUsername,
      time_class: s.timeClass,
      rating: s.rating,
      analysis_id: analysisId,
    }));
    const { error: snapErr } = await supabase.from("elo_snapshots").insert(rows);
    if (snapErr) {
      // Snapshot capture is best-effort. Surface in logs but don't fail the analysis save.
      console.error("Failed to insert elo_snapshots", snapErr);
    }
  }

  return { id: analysisId };
}
