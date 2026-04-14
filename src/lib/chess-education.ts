export const CONCEPT_LINKS: Record<string, string> = {
  "pawn breaks": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "pawn structure": "https://lichess.org/practice/intermediate/pawn-structures/dR7Yq3hG/",
  "piece activity": "https://lichess.org/practice/intermediate/piece-activity/gKEadopi/",
  "king safety": "https://lichess.org/practice/intermediate/king-safety/IoBeSMJD/",
  "center control": "https://lichess.org/practice/basics/the-center/eCQBzGMl/",
  "central control": "https://lichess.org/practice/basics/the-center/eCQBzGMl/",
  "passed pawns": "https://lichess.org/practice/intermediate/passed-pawns/eVOppNAk/",
  "rook activity": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "rook endgames": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "tactics": "https://lichess.org/training",
  "pin": "https://lichess.org/practice/basics/pin/QCzahMEo/",
  "pins": "https://lichess.org/practice/basics/pin/QCzahMEo/",
  "fork": "https://lichess.org/practice/basics/fork/N2cXMhAV/",
  "forks": "https://lichess.org/practice/basics/fork/N2cXMhAV/",
  "discovered attack": "https://lichess.org/practice/intermediate/discovered-attack/WPSMga9E/",
  "discovered attacks": "https://lichess.org/practice/intermediate/discovered-attack/WPSMga9E/",
  "back rank": "https://lichess.org/practice/intermediate/back-rank-mate/MJxYIilF/",
  "back rank mate": "https://lichess.org/practice/intermediate/back-rank-mate/MJxYIilF/",
  "skewer": "https://lichess.org/practice/intermediate/skewer/eXMhw3Gp/",
  "deflection": "https://lichess.org/practice/advanced/deflection/RWBaaJOB/",
  "decoy": "https://lichess.org/practice/advanced/deflection/RWBaaJOB/",
  "piece coordination": "https://lichess.org/practice/intermediate/piece-activity/gKEadopi/",
  "material advantage": "https://lichess.org/practice/basics/value-of-pieces/qKBOAPJy/",
  "piece value": "https://lichess.org/practice/basics/value-of-pieces/qKBOAPJy/",
  "checkmate patterns": "https://lichess.org/practice/basics/checkmate-patterns/Qx9aTnin/",
  "endgame": "https://lichess.org/practice/intermediate/rook-endgames/WBytcDE3/",
  "opening principles": "https://lichess.org/practice/basics/the-opening/JRLbGEoL/",
  "development": "https://lichess.org/practice/basics/the-opening/JRLbGEoL/",
  "time management": "https://lichess.org/training",
  "calculation": "https://lichess.org/training",
};

export function getConceptLink(concept: string): string | null {
  const normalized = concept.toLowerCase().trim();

  // Direct match
  if (CONCEPT_LINKS[normalized]) {
    return CONCEPT_LINKS[normalized];
  }

  // Partial match: check if any key is contained in the concept or vice versa
  for (const [key, url] of Object.entries(CONCEPT_LINKS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }

  return null;
}
