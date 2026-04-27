import { Chess } from "chess.js";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function titleCaseWord(word: string): string {
  return word
    .split("-")
    .map((part) => {
      if (/^[A-Z]{2,}$/.test(part)) return part;
      if (part === "s") return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("-");
}

export function sanitizeOpeningName(name?: string): string {
  if (!name) return "Unknown opening";

  const normalized = safeDecode(name)
    .replace(/^\/+/, "")
    .replace(/^https?:\/\/(?:www\.)?chess\.com\/openings\//i, "")
    .replace(/^www\.chess\.com\/openings\//i, "")
    .replace(/^chess\.com\/openings\//i, "")
    .replace(/^openings\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\+/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-zA-Z0-9'.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "Unknown opening";

  // Title-case each word
  const titled = normalized
    .split(" ")
    .map(titleCaseWord)
    .join(" ");

  const polished = titled
    .replace(/\bCaro Kann\b/gi, "Caro-Kann")
    .replace(/\bNimzo Indian\b/gi, "Nimzo-Indian")
    .replace(/\bNimzo Larsen\b/gi, "Nimzo-Larsen")
    .replace(/\bQueens Indian\b/gi, "Queen's Indian");

  // Strip move notation (e.g. "1...E5", "2.Nf3", "3.Bb2", trailing "E5", "O O")
  const stripped = polished
    .replace(/\.{2,}\d+\.\S+.*$/g, "")          // "Variation...4.Bg2 ..." (dots glued to digits)
    .replace(/\s+\d+\.\.\.?\s*\S+/g, "")        // " 2...d6", " 1...E5"
    .replace(/\s+\d+\.\S+.*$/g, "")             // " 3.Bb2 E5"
    .replace(/\s+[A-H]\d+$/i, "")               // trailing like " E5"
    .replace(/\s+O\s+O\s*/gi, "")               // castling "O O"
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) return "Unknown opening";

  // Keywords that typically end the "main opening" portion of the name
  const BOUNDARY_KW =
    /^(Opening|Defense|Defence|Gambit|Game|Attack|System|Counter)$/i;

  const words = stripped.split(" ");

  // Find the index of the first boundary keyword — everything up to and
  // including it is the main opening name.
  let boundaryIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (BOUNDARY_KW.test(words[i])) {
      boundaryIdx = i;
      break;
    }
  }

  let mainOpening: string;
  let variation: string | undefined;

  if (boundaryIdx >= 0 && boundaryIdx < words.length - 1) {
    mainOpening = words.slice(0, boundaryIdx + 1).join(" ");
    const rest = words.slice(boundaryIdx + 1);

    // Extract the first variation name from the remaining words.
    // Strategy: scan for a "stop" keyword. "Variation" means stop before it.
    // Other opening-family keywords (Indian, Defense, etc.) mean stop AFTER
    // them — they are the last word of the variation sub-name.
    const STOP_BEFORE =
      /^(Variation)$/i;
    const STOP_AFTER =
      /^(Indian|Opening|Defense|Defence|Gambit|Game|Attack|System|Counter)$/i;

    let endIdx = rest.length; // default: take everything
    for (let i = 0; i < rest.length; i++) {
      if (STOP_BEFORE.test(rest[i])) {
        endIdx = i; // exclude the keyword itself
        break;
      }
      if (STOP_AFTER.test(rest[i]) && i > 0) {
        // Include this keyword, stop after it
        endIdx = i + 1;
        break;
      }
    }

    // Cap at 3 words to keep names concise
    const varWords = rest.slice(0, Math.min(endIdx, 3));
    const cleaned = varWords.join(" ").trim();
    if (cleaned) variation = cleaned;
  } else {
    mainOpening = stripped;
  }

  let result: string;
  if (variation) {
    const hyphenated =
      variation.includes(" ") ? variation.replace(/\s+/g, "-") : variation;
    result = `${mainOpening} (${hyphenated})`;
  } else {
    result = mainOpening;
  }

  // Truncate at ~50 chars on a word boundary
  if (result.length > 50) {
    const truncated = result.slice(0, 50).replace(/\s+\S*$/, "");
    result = truncated + "...";
  }

  return result;
}

export function formatBestMoveLabel(fen: string, bestMove: string): string {
  const cleanMove = bestMove.trim();
  if (!cleanMove) return "No engine move available";

  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: cleanMove.slice(0, 2),
      to: cleanMove.slice(2, 4),
      promotion: cleanMove.slice(4, 5) || undefined,
    });

    if (move?.san) {
      return `${move.san} (${cleanMove})`;
    }
  } catch {
    // Fall through to raw engine move.
  }

  return cleanMove;
}
