"use client";

interface ProgressBarProps {
  currentPhase: "fetching" | "stockfish" | "llm" | "overall" | "done";
  gamesCompleted: number;
  totalGames: number;
  phaseProgressPercent: number;
  activeGameIndex: number | null;
  message: string;
  lastCompletedMessage?: string;
}

const steps = [
  { key: "fetching", icon: "♟", label: "Fetch" },
  { key: "stockfish", icon: "⚙", label: "Engine" },
  { key: "llm", icon: "♞", label: "AI Review" },
  { key: "done", icon: "♔", label: "Done" },
] as const;

type StepKey = (typeof steps)[number]["key"];

const stepOrder: StepKey[] = ["fetching", "stockfish", "llm", "done"];

const getStepIndex = (phase: string): number => {
  if (phase === "overall") return stepOrder.indexOf("llm");
  const idx = stepOrder.indexOf(phase as StepKey);
  return idx >= 0 ? idx : 0;
};

export default function ProgressBar({
  currentPhase,
  gamesCompleted,
  totalGames,
  phaseProgressPercent,
  activeGameIndex,
  message,
  lastCompletedMessage,
}: ProgressBarProps) {
  const activeIdx = getStepIndex(currentPhase);
  const normalizedProgress =
    totalGames > 0 ? Math.min(100, Math.max(0, phaseProgressPercent)) : 0;
  const showPhaseProgress =
    (currentPhase === "stockfish" || currentPhase === "llm") && totalGames > 0;
  const phaseLabel = currentPhase === "llm" ? "AI review" : "Engine analysis";
  const phaseProgressLabel =
    currentPhase === "stockfish" && activeGameIndex !== null
      ? `Game ${activeGameIndex + 1} progress`
      : `${phaseLabel} progress`;
  const completedGamesLabel =
    currentPhase === "llm"
      ? `Games reviewed: ${gamesCompleted} / ${totalGames}`
      : `Games finished: ${gamesCompleted} / ${totalGames}`;

  return (
    <div className="w-full space-y-4">
      {/* Step indicators */}
      <div className="grid grid-cols-4 gap-2">
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

      {/* Sub-progress for stockfish and llm phases */}
      {showPhaseProgress && (
        <div className="bg-surface-1 rounded-lg p-3 border border-border">
          <div className="flex justify-between text-xs text-muted mb-1.5">
            <span>{phaseProgressLabel}</span>
            <span>{normalizedProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${normalizedProgress}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">{completedGamesLabel}</p>
        </div>
      )}

      {/* Message */}
      <div className="flex items-center gap-2.5">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="text-sm text-muted">{message}</p>
      </div>

      {lastCompletedMessage && currentPhase !== "done" && (
        <p className="text-xs text-foreground/70 bg-surface-2 rounded-lg border border-border px-3 py-2">
          Latest completed game: {lastCompletedMessage}
        </p>
      )}
    </div>
  );
}
