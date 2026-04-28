import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisSession } from "@/lib/analysis-session";
import { FullAnalysisResult, AnalysisSession } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { listAnalyses, saveAnalysis } from "@/lib/analyses";
import {
  fromScopedUsername,
  getHistoryViewerKey,
  scopedUsernameLikePattern,
  toScopedUsername,
} from "@/lib/history-viewer";

type LegacyRow = {
  created_at: string;
  username: string;
  games_count: number;
  total_blunders: number;
  total_mistakes: number;
  average_accuracy: number;
  avg_blunders_per_game: number;
};

function legacyFallback() {
  return NextResponse.json({ sessions: [], unavailable: true });
}

function legacyAccept() {
  return NextResponse.json({ ok: false, unavailable: true }, { status: 202 });
}

function mapLegacyRow(row: LegacyRow): AnalysisSession {
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
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username")?.trim() ?? undefined;
  const timeClass = searchParams.get("time_class")?.trim() ?? undefined;

  // Authenticated flow: read from `analyses` table scoped to the user (RLS enforced).
  const user = await getUser();
  if (user) {
    try {
      const sessions = await listAnalyses(user.id, {
        chessUsername: username || undefined,
        timeClass: timeClass || undefined,
      });
      return NextResponse.json({ sessions });
    } catch (err) {
      console.error("history GET (authed) failed", err);
      return legacyFallback();
    }
  }

  // Anonymous legacy flow keyed by signed viewer cookie.
  try {
    const viewerKey = getHistoryViewerKey(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("analysis_sessions")
      .select(
        "created_at, username, games_count, total_blunders, total_mistakes, average_accuracy, avg_blunders_per_game"
      )
      .like("username", scopedUsernameLikePattern(viewerKey))
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    let sessions = (data ?? []).map(mapLegacyRow);
    if (username) {
      const normalized = username.toLowerCase();
      sessions = sessions.filter(
        (s) => s.username.toLowerCase() === normalized
      );
    }
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("history GET (legacy) failed", err);
    return legacyFallback();
  }
}

export async function POST(request: NextRequest) {
  const { username, result } = (await request.json()) as {
    username?: string;
    result?: FullAnalysisResult;
  };

  if (!username?.trim() || !result) {
    return NextResponse.json(
      { error: "Username and result are required" },
      { status: 400 }
    );
  }

  // Authenticated flow: persist full result + capture ELO snapshots.
  const user = await getUser();
  if (user) {
    try {
      const { id } = await saveAnalysis(user.id, {
        chessUsername: username.trim(),
        result,
      });
      return NextResponse.json({ ok: true, id });
    } catch (err) {
      console.error("history POST (authed) failed", err);
      return NextResponse.json(
        { error: "Failed to save analysis" },
        { status: 500 }
      );
    }
  }

  // Anonymous legacy flow: write to `analysis_sessions` scoped by viewer cookie.
  try {
    const viewerKey = getHistoryViewerKey(request);
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
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("history POST (legacy) failed", err);
    return legacyAccept();
  }
}
