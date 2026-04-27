export const CONCEPT_LINKS: Record<string, string> = {
  "pawn breaks": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "pawn structure": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "isolated pawns": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "backward pawns": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "passed pawns": "https://lichess.org/practice/intermediate/passed-pawns/eVOppNAk/",
  "passed pawn": "https://lichess.org/practice/intermediate/passed-pawns/eVOppNAk/",
  "piece activity": "https://lichess.org/practice/intermediate/piece-activity/gKEadopi/",
  "piece coordination": "https://lichess.org/practice/intermediate/piece-activity/gKEadopi/",
  "development": "https://lichess.org/practice/basics/the-opening/JRLbGEoL/",
  "opening principles": "https://lichess.org/practice/basics/the-opening/JRLbGEoL/",
  "center control": "https://lichess.org/practice/basics/the-center/eCQBzGMl/",
  "central control": "https://lichess.org/practice/basics/the-center/eCQBzGMl/",
  "space advantage": "https://lichess.org/practice/basics/the-center/eCQBzGMl/",
  "king safety": "https://lichess.org/practice/intermediate/king-safety/IoBeSMJD/",
  "attack the king": "https://lichess.org/practice/intermediate/king-safety/IoBeSMJD/",
  "checkmate patterns": "https://lichess.org/practice/basics/checkmate-patterns/Qx9aTnin/",
  "back rank": "https://lichess.org/practice/intermediate/back-rank-mate/MJxYIilF/",
  "back rank mate": "https://lichess.org/practice/intermediate/back-rank-mate/MJxYIilF/",
  "pin": "https://lichess.org/practice/basics/pin/QCzahMEo/",
  "pins": "https://lichess.org/practice/basics/pin/QCzahMEo/",
  "fork": "https://lichess.org/practice/basics/fork/N2cXMhAV/",
  "forks": "https://lichess.org/practice/basics/fork/N2cXMhAV/",
  "discovered attack": "https://lichess.org/practice/intermediate/discovered-attack/WPSMga9E/",
  "discovered attacks": "https://lichess.org/practice/intermediate/discovered-attack/WPSMga9E/",
  "skewer": "https://lichess.org/practice/intermediate/skewer/eXMhw3Gp/",
  "deflection": "https://lichess.org/practice/advanced/deflection/RWBaaJOB/",
  "decoy": "https://lichess.org/practice/advanced/deflection/RWBaaJOB/",
  "outpost": "https://lichess.org/practice/intermediate/piece-activity/gKEadopi/",
  "rook activity": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "rook endgames": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "open file": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "semi-open file": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "endgame": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "opposition": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "zugzwang": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "minority attack": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "material advantage": "https://lichess.org/practice/basics/value-of-pieces/qKBOAPJy/",
  "piece value": "https://lichess.org/practice/basics/value-of-pieces/qKBOAPJy/",
  "time management": "https://lichess.org/training",
  "time trouble": "https://lichess.org/training",
  "clock management": "https://lichess.org/training",
  "candidate moves": "https://lichess.org/training",
  "calculation": "https://lichess.org/training",
  tactics: "https://lichess.org/training",
};

function normalizeConceptText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string): string {
  return value.replace(/\s+/g, "");
}

const ORDERED_CONCEPT_LINKS = Object.entries(CONCEPT_LINKS)
  .map(([key, value]) => [normalizeConceptText(key), value] as const)
  .sort((a, b) => b[0].length - a[0].length);

export function getConceptLink(concept: string): string | null {
  const normalized = normalizeConceptText(concept);
  if (!normalized) return null;

  const normalizedCompact = compactText(normalized);

  for (const [key, url] of ORDERED_CONCEPT_LINKS) {
    const compactKey = compactText(key);

    if (
      normalized === key ||
      normalized.includes(key) ||
      key.includes(normalized) ||
      normalizedCompact === compactKey ||
      normalizedCompact.includes(compactKey) ||
      compactKey.includes(normalizedCompact)
    ) {
      return url;
    }
  }

  return null;
}
