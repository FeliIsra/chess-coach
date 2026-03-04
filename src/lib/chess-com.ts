import { ChessComGame, ChessGame } from "./types";
import { sanitizeOpeningName } from "./chess-format";

const BASE_URL = "https://api.chess.com/pub";
const HEADERS = {
  "User-Agent": "ChessCoach/1.0 (chess improvement app)",
  Accept: "application/json",
};

const WINNING_RESULTS = new Set(["win"]);
const LOSING_RESULTS = new Set([
  "checkmated",
  "timeout",
  "resigned",
  "abandoned",
]);

export async function validateUser(username: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/player/${username.toLowerCase()}`, {
    headers: HEADERS,
  });
  return res.ok;
}

export async function fetchRecentGames(
  username: string,
  count: number
): Promise<ChessGame[]> {
  const lowerUser = username.toLowerCase();

  // Get archives list
  const archivesRes = await fetch(
    `${BASE_URL}/player/${lowerUser}/games/archives`,
    { headers: HEADERS }
  );
  if (!archivesRes.ok) {
    throw new Error(`Player "${username}" not found`);
  }
  const { archives } = (await archivesRes.json()) as { archives: string[] };

  if (!archives.length) {
    throw new Error(`No games found for "${username}"`);
  }

  // Fetch from most recent months until we have enough games
  const allGames: ChessGame[] = [];
  for (let i = archives.length - 1; i >= 0 && allGames.length < count; i--) {
    const monthRes = await fetch(archives[i], { headers: HEADERS });
    if (!monthRes.ok) continue;

    const { games } = (await monthRes.json()) as { games: ChessComGame[] };

    // Filter to standard chess only, most recent first
    const standardGames = games
      .filter((g) => g.rules === "chess")
      .reverse();

    for (const game of standardGames) {
      if (allGames.length >= count) break;
      allGames.push(toChessGame(game, lowerUser));
    }
  }

  return allGames;
}

function toChessGame(raw: ChessComGame, username: string): ChessGame {
  const isWhite = raw.white.username.toLowerCase() === username;
  const userSide = isWhite ? raw.white : raw.black;
  const opponentSide = isWhite ? raw.black : raw.white;
  const userColor = isWhite ? "white" : "black";

  let result: "win" | "loss" | "draw";
  if (WINNING_RESULTS.has(userSide.result)) {
    result = "win";
  } else if (LOSING_RESULTS.has(userSide.result)) {
    result = "loss";
  } else {
    result = "draw";
  }

  // Extract opening from PGN ECOUrl header
  const openingMatch = raw.pgn.match(/\[ECOUrl ".*?\/([^"]+)"\]/);
  const openingName = sanitizeOpeningName(openingMatch?.[1]);

  // Extract date
  const dateMatch = raw.pgn.match(/\[Date "([^"]+)"\]/);
  const date = dateMatch ? dateMatch[1].replace(/\./g, "-") : "";

  return {
    url: raw.url,
    pgn: raw.pgn,
    timeClass: raw.time_class,
    userColor,
    userRating: userSide.rating,
    opponentName: opponentSide.username,
    opponentRating: opponentSide.rating,
    result,
    accuracy: raw.accuracies
      ? raw.accuracies[userColor]
      : undefined,
    openingName,
    date,
  };
}
