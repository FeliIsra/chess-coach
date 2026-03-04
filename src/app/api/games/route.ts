import { NextRequest, NextResponse } from "next/server";
import { validateUser, fetchRecentGames } from "@/lib/chess-com";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  const count = parseInt(searchParams.get("count") || "5", 10);

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  if (count < 1 || count > 20) {
    return NextResponse.json({ error: "Count must be between 1 and 20" }, { status: 400 });
  }

  const exists = await validateUser(username);
  if (!exists) {
    return NextResponse.json(
      { error: `Player "${username}" not found on Chess.com` },
      { status: 404 }
    );
  }

  try {
    const games = await fetchRecentGames(username, count);
    return NextResponse.json({ games });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch games";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
