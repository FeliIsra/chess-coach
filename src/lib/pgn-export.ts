import { GameAnalysis, LLMInsight } from "./types";

interface AnnotationEntry {
  move: string;
  text: string;
}

/**
 * Extract PGN headers from a raw PGN string.
 * Returns header block lines and the move text portion.
 */
function splitPGN(rawPgn: string): { headers: string; moveText: string } {
  const lines = rawPgn.split("\n");
  const headerLines: string[] = [];
  let moveStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("[")) {
      headerLines.push(line);
      moveStart = i + 1;
    } else if (line === "" && headerLines.length > 0) {
      moveStart = i + 1;
    } else if (line !== "") {
      // First non-header, non-empty line starts move text
      moveStart = i;
      break;
    }
  }

  return {
    headers: headerLines.join("\n"),
    moveText: lines
      .slice(moveStart)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Tokenize PGN move text into an array of tokens (move numbers, moves, results, existing comments).
 */
function tokenizeMoveText(moveText: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < moveText.length) {
    // Skip whitespace
    if (moveText[i] === " " || moveText[i] === "\n" || moveText[i] === "\r") {
      i++;
      continue;
    }

    // Existing comment in braces
    if (moveText[i] === "{") {
      const end = moveText.indexOf("}", i);
      if (end === -1) {
        tokens.push(moveText.slice(i));
        break;
      }
      tokens.push(moveText.slice(i, end + 1));
      i = end + 1;
      continue;
    }

    // Regular token (move number, move, result)
    let end = i;
    while (end < moveText.length && moveText[end] !== " " && moveText[end] !== "{") {
      end++;
    }
    if (end > i) {
      tokens.push(moveText.slice(i, end));
    }
    i = end;
  }

  return tokens;
}

/**
 * Build annotation map from LLM insights keyed by move number.
 */
function normalizeSanToken(token: string): string {
  return token.trim().replace(/[!?+#]+$/g, "");
}

function sanitizeCommentText(text: string): string {
  return text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function buildAnnotationMap(insight: LLMInsight | undefined): Map<number, AnnotationEntry[]> {
  const annotations = new Map<number, AnnotationEntry[]>();
  if (!insight) return annotations;

  const appendAnnotation = (moveNumber: number, move: string, text: string) => {
    if (!moveNumber || !move.trim()) return;

    const existing = annotations.get(moveNumber) ?? [];
    const normalizedMove = normalizeSanToken(move);
    const normalizedText = sanitizeCommentText(text);

    if (!normalizedMove || !normalizedText) return;

    if (
      !existing.some(
        (entry) => entry.move === normalizedMove && entry.text === normalizedText,
      )
    ) {
      existing.push({
        move: normalizedMove,
        text: normalizedText,
      });
      annotations.set(moveNumber, existing);
    }
  };

  for (const m of insight.worstMovesAnalysis ?? []) {
    const explanation = sanitizeCommentText(m.explanation) || "No explanation provided";
    const bestMove = sanitizeCommentText(m.move);
    const body = bestMove
      ? `Mistake: ${explanation}. Best was ${bestMove}`
      : `Mistake: ${explanation}`;
    appendAnnotation(m.moveNumber, m.move, body);
  }

  for (const m of insight.bestMovesAnalysis ?? []) {
    const explanation = sanitizeCommentText(m.explanation) || "No explanation provided";
    appendAnnotation(m.moveNumber, m.move, `Great move: ${explanation}`);
  }

  return annotations;
}

/**
 * Insert annotations into PGN move text tokens.
 * Annotations are inserted after the move that corresponds to the move number.
 */
function insertAnnotations(
  tokens: string[],
  annotations: Map<number, AnnotationEntry[]>,
): string[] {
  if (annotations.size === 0) return tokens;

  const result: string[] = [];
  let currentMoveNumber = 0;

  for (const token of tokens) {
    // Detect move number (e.g. "1.", "12.", "1...")
    const moveNumMatch = token.match(/^(\d+)\./);
    if (moveNumMatch) {
      currentMoveNumber = parseInt(moveNumMatch[1], 10);
    }

    result.push(token);

    // Check if this token is a move (not a move number, not a result, not a comment)
    const isMove =
      !token.match(/^\d+\./) && // not a move number
      !token.startsWith("{") && // not a comment
      !["1-0", "0-1", "1/2-1/2", "*"].includes(token) && // not a result
      token.match(/^[a-hKQRBNO]/i) !== null; // looks like a chess move

    if (isMove && annotations.has(currentMoveNumber)) {
      const normalizedToken = normalizeSanToken(token);
      const comments = annotations.get(currentMoveNumber) ?? [];
      const matchingComments = comments.filter((entry) => entry.move === normalizedToken);

      if (matchingComments.length > 0) {
        result.push(...matchingComments.map((entry) => `{${entry.text}}`));
        annotations.set(
          currentMoveNumber,
          comments.filter((entry) => entry.move !== normalizedToken),
        );
      }
    }
  }

  return result;
}

/**
 * Generate annotated PGN string from analyzed games with AI coaching comments.
 */
export function generateAnnotatedPGN(
  games: GameAnalysis[],
  llmInsights: LLMInsight[],
): string {
  const pgnBlocks: string[] = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const insight = llmInsights[i];
    const rawPgn = game.game.pgn;

    if (!rawPgn?.trim()) continue;

    const { headers, moveText } = splitPGN(rawPgn);
    const tokens = tokenizeMoveText(moveText);
    const annotations = buildAnnotationMap(insight);
    const annotatedTokens = insertAnnotations(tokens, annotations);

    const annotatedMoveText = annotatedTokens.join(" ");
    const block = headers
      ? `${headers}\n\n${annotatedMoveText}`
      : annotatedMoveText;

    pgnBlocks.push(block);
  }

  return pgnBlocks.join("\n\n\n");
}
