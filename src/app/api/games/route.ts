import { NextRequest, NextResponse } from "next/server";
import { fetchRecentGames } from "@/lib/chess-com";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  const count = parseInt(searchParams.get("count") || "5", 10);

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  if (count < 1 || count > 20) {
    return NextResponse.json({ error: "Count must be between 1 and 20" }, { status: 400 });
  }

  try {
    const games = await fetchRecentGames(username, count);
    console.info("Games fetch performance", {
      username,
      count,
      fetchMs: Date.now() - startedAt,
      gamesReturned: games.length,
    });
    return NextResponse.json({ games });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch games";
    const isNotFound =
      /not found/i.test(message) || /no games found/i.test(message);
    console.error("Games fetch failed", {
      username,
      count,
      fetchMs: Date.now() - startedAt,
      message,
    });
    return NextResponse.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
