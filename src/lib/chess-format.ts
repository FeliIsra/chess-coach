import { Chess } from "chess.js";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

  return normalized
    .split(" ")
    .map((word) => {
      if (/^\d+(\.\.\.)?$/.test(word)) return word;
      if (/^[A-Z]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
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
