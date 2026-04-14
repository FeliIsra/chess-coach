import { ChessComGame, ChessGame } from "./types";
import { sanitizeOpeningName } from "./chess-format";

const BASE_URL = "https://api.chess.com/pub";
const HEADERS = {
  "User-Agent": "ChessCoach/1.0 (chess improvement app)",
  Accept: "application/json",
};
const ARCHIVE_FETCH_CONCURRENCY = 4;
const CHESS_COM_TIMEOUT_MS = 6000;

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
    signal: AbortSignal.timeout(CHESS_COM_TIMEOUT_MS),
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
    {
      headers: HEADERS,
      signal: AbortSignal.timeout(CHESS_COM_TIMEOUT_MS),
    }
  );
  if (!archivesRes.ok) {
    throw new Error(`Player "${username}" not found`);
  }
  const { archives } = (await archivesRes.json()) as { archives: string[] };

  if (!archives.length) {
    throw new Error(`No games found for "${username}"`);
  }

  // Fetch most recent archive months in small concurrent batches.
  const archivesNewestFirst = [...archives].reverse();
  const allGames: ChessGame[] = [];
  for (
    let i = 0;
    i < archivesNewestFirst.length && allGames.length < count;
    i += ARCHIVE_FETCH_CONCURRENCY
  ) {
    const batch = archivesNewestFirst.slice(i, i + ARCHIVE_FETCH_CONCURRENCY);
    const monthGamesBatch = await Promise.all(
      batch.map(async (archiveUrl) => {
        const monthRes = await fetch(archiveUrl, {
          headers: HEADERS,
          signal: AbortSignal.timeout(CHESS_COM_TIMEOUT_MS),
        });
        if (!monthRes.ok) return [] as ChessComGame[];
        const { games } = (await monthRes.json()) as { games: ChessComGame[] };
        return games.filter((g) => g.rules === "chess").reverse();
      })
    );

    for (const monthGames of monthGamesBatch) {
      for (const game of monthGames) {
        if (allGames.length >= count) break;
        allGames.push(toChessGame(game, lowerUser));
      }
      if (allGames.length >= count) break;
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
