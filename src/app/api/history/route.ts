import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisSession } from "@/lib/analysis-session";
import { FullAnalysisResult, AnalysisSession } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  fromScopedUsername,
  getHistoryViewerKey,
  scopedUsernameLikePattern,
  toScopedUsername,
} from "@/lib/history-viewer";

type AnalysisSessionRow = {
  created_at: string;
  username: string;
  games_count: number;
  total_blunders: number;
  total_mistakes: number;
  average_accuracy: number;
  avg_blunders_per_game: number;
};

function mapRowToSession(row: AnalysisSessionRow): AnalysisSession {
  return {
    date: row.created_at,
    username: fromScopedUsername(row.username),
    gamesCount: row.games_count,
    totalBlunders: row.total_blunders,
    totalMistakes: row.total_mistakes,
    averageAccuracy: row.average_accuracy,
    avgBlundersPerGame: row.avg_blunders_per_game,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const username = searchParams.get("username");
    const viewerKey = getHistoryViewerKey(request);
    const supabase = getSupabaseAdminClient();

    const query = supabase
      .from("analysis_sessions")
      .select(
        "created_at, username, games_count, total_blunders, total_mistakes, average_accuracy, avg_blunders_per_game"
      )
      .like("username", scopedUsernameLikePattern(viewerKey))
      .order("created_at", { ascending: true })
      .limit(50);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    let sessions = (data ?? []).map(mapRowToSession);
    if (username?.trim()) {
      const normalized = username.trim().toLowerCase();
      sessions = sessions.filter(
        (session) => session.username.toLowerCase() === normalized
      );
    }

    return NextResponse.json({
      sessions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, result } = (await request.json()) as {
      username?: string;
      result?: FullAnalysisResult;
    };
    const viewerKey = getHistoryViewerKey(request);

    if (!username?.trim() || !result) {
      return NextResponse.json(
        { error: "Username and result are required" },
        { status: 400 }
      );
    }

    const session = buildAnalysisSession(username.trim(), result);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("analysis_sessions").insert({
      created_at: session.date,
      username: toScopedUsername(session.username, viewerKey),
      games_count: session.gamesCount,
      total_blunders: session.totalBlunders,
      total_mistakes: session.totalMistakes,
      average_accuracy: session.averageAccuracy,
      avg_blunders_per_game: session.avgBlundersPerGame,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
