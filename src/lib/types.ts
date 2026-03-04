export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: "bullet" | "blitz" | "rapid" | "daily";
  rated: boolean;
  rules: string;
  white: {
    username: string;
    rating: number;
    result: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
  };
  accuracies?: {
    white: number;
    black: number;
  };
}

export interface ChessGame {
  url: string;
  pgn: string;
  timeClass: string;
  userColor: "white" | "black";
  userRating: number;
  opponentName: string;
  opponentRating: number;
  result: "win" | "loss" | "draw";
  accuracy?: number;
  openingName: string;
  date: string;
}

export interface PositionEval {
  fen: string;
  eval: number; // centipawns, positive = white advantage
  bestMove: string;
  depth: number;
}

export interface MoveAnalysis {
  moveNumber: number;
  san: string; // e.g. "Bxf7"
  userColor: "white" | "black";
  evalBefore: number; // centipawns from user's perspective
  evalAfter: number;
  evalDiff: number; // negative = user lost eval
  bestMove: string; // what Stockfish recommended
  classification: "brilliant" | "great" | "good" | "inaccuracy" | "mistake" | "blunder";
  fen: string; // position before the move
  from: string; // square the piece moved from (e.g. "e2")
  to: string; // square the piece moved to (e.g. "e4")
  fenAfter: string; // position after the move
  clockSeconds?: number; // remaining time in seconds when move was made
}

export interface GameAnalysis {
  game: ChessGame;
  moves: MoveAnalysis[];
  bestMoves: MoveAnalysis[]; // top 10 best
  worstMoves: MoveAnalysis[]; // bottom 10 worst
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  averageEvalLoss: number;
}

export type TacticalCategory =
  | "tactics"
  | "piece safety"
  | "king safety"
  | "pawn structure"
  | "endgame"
  | "opening"
  | "positional"
  | "time management";

export interface LLMInsight {
  worstMovesAnalysis: {
    move: string;
    moveNumber: number;
    explanation: string;
    concept: string;
    category?: TacticalCategory;
  }[];
  bestMovesAnalysis: {
    move: string;
    moveNumber: number;
    explanation: string;
    concept: string;
  }[];
  summary: string;
  improvementPlan: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface WeakSpot {
  category: string;
  count: number;
  tip: string;
}

export interface FullAnalysisResult {
  games: GameAnalysis[];
  llmInsights: LLMInsight[];
  overallSummary: {
    wins: number;
    losses: number;
    draws: number;
    totalBlunders: number;
    totalMistakes: number;
    averageAccuracy: number;
    timePressureBlunderPercent?: number;
  };
  overallInsight: {
    summary: string;
    topStrengths: string[];
    topWeaknesses: string[];
    studyPlan: string[];
  };
  weakSpots?: WeakSpot[];
}

export interface AnalysisSession {
  date: string;
  username: string;
  gamesCount: number;
  totalBlunders: number;
  totalMistakes: number;
  averageAccuracy: number;
  avgBlundersPerGame: number;
}

export interface AnalysisProgress {
  type: "progress" | "game_complete" | "llm_analysis" | "done" | "error";
  sequence?: number;
  gameIndex?: number;
  activeGameIndex?: number;
  totalGames?: number;
  moveIndex?: number;
  totalMoves?: number;
  phaseProgressPercent?: number;
  message: string;
  phase?: "stockfish" | "llm" | "overall";
  gamesCompleted?: number;
  data?: GameAnalysis | LLMInsight | FullAnalysisResult;
}
