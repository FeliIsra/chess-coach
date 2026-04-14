"use client";

interface ProgressBarProps {
  currentPhase: "fetching" | "stockfish" | "llm" | "overall" | "done";
  gamesCompleted: number;
  totalGames: number;
  activeGamesCount: number;
  phaseProgressPercent: number;
  activeGameIndex: number | null;
  message: string;
  lastCompletedMessage?: string;
}

const steps = [
  { key: "fetching", icon: "♟", label: "Fetch" },
  { key: "stockfish", icon: "⚙", label: "Engine" },
  { key: "llm", icon: "♞", label: "AI Review" },
  { key: "overall", icon: "✦", label: "Plan" },
  { key: "done", icon: "♔", label: "Done" },
] as const;

type StepKey = (typeof steps)[number]["key"];

const stepOrder: StepKey[] = ["fetching", "stockfish", "llm", "overall", "done"];

const getStepIndex = (phase: string): number => {
  const idx = stepOrder.indexOf(phase as StepKey);
  return idx >= 0 ? idx : 0;
};

function getPhaseTitle(currentPhase: ProgressBarProps["currentPhase"]): string {
  if (currentPhase === "fetching") return "Fetching games";
  if (currentPhase === "stockfish") return "Engine analysis";
  if (currentPhase === "llm") return "AI review";
  if (currentPhase === "overall") return "Building study plan";
  return "Analysis complete";
}

export default function ProgressBar({
  currentPhase,
  gamesCompleted,
  totalGames,
  activeGamesCount,
  phaseProgressPercent,
  activeGameIndex,
  message,
  lastCompletedMessage,
}: ProgressBarProps) {
  const activeIdx = getStepIndex(currentPhase);
  const normalizedProgress =
    totalGames > 0 ? Math.min(100, Math.max(0, phaseProgressPercent)) : 0;
  const showPhaseProgress = currentPhase !== "fetching" && totalGames > 0;
  const title = getPhaseTitle(currentPhase);
  const progressLabel =
    currentPhase === "llm"
      ? `${gamesCompleted} of ${totalGames} games reviewed`
      : currentPhase === "overall"
      ? "Final synthesis in progress"
      : `${gamesCompleted} of ${totalGames} games analyzed`;
  const detailLabel =
    currentPhase === "stockfish" && activeGamesCount > 0
      ? `${activeGamesCount} game${activeGamesCount === 1 ? "" : "s"} in flight`
      : currentPhase === "stockfish" && activeGameIndex !== null
      ? `Focused on game ${activeGameIndex + 1}`
      : currentPhase === "llm" && activeGamesCount > 0
      ? `${activeGamesCount} review${activeGamesCount === 1 ? "" : "s"} in progress`
      : message;

  return (
    <div className="w-full space-y-4">
      {/* Step indicators */}
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, i) => {
          const isCompleted = i < activeIdx;
          const isActive = i === activeIdx;

          return (
            <div
              key={step.key}
              className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
                isCompleted
                  ? "border-primary/50 bg-primary/10"
                  : isActive
                  ? "border-primary bg-primary/15"
                  : "border-border bg-surface-2"
              }`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-base transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary text-white"
                      : isActive
                      ? "bg-primary text-white pulse-active"
                      : "bg-surface-3 text-muted border border-border"
                  }`}
                >
                  {step.icon}
                </div>
                <span
                  className={`mt-1 text-[11px] leading-tight ${
                    isActive
                      ? "text-primary font-semibold"
                      : isCompleted
                      ? "text-foreground"
                      : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface-1 rounded-xl border border-border px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              {title}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {showPhaseProgress ? progressLabel : message}
            </p>
          </div>
          {showPhaseProgress && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-primary">{normalizedProgress}%</p>
              <p className="text-xs text-muted">phase progress</p>
            </div>
          )}
        </div>

        {detailLabel && (
          <p className="text-sm text-foreground/70">{detailLabel}</p>
        )}

        {showPhaseProgress && (
          <div className="space-y-2">
            <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${normalizedProgress}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{currentPhase === "llm" ? "Reviews complete" : "Games complete"}</span>
              <span>
                {gamesCompleted} / {totalGames}
              </span>
            </div>
          </div>
        )}
      </div>

      {showPhaseProgress && (
        <div className="flex items-start gap-2.5 bg-surface-2 rounded-lg border border-border px-3 py-2.5">
          <div className="mt-0.5 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Live detail
            </p>
            <p className="text-sm text-foreground/75">{message}</p>
            {lastCompletedMessage && currentPhase !== "done" && (
              <p className="text-xs text-foreground/60">
                Latest completed game: {lastCompletedMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
