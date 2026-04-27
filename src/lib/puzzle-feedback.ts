type PuzzleFeedbackCue = "pickup" | "correct" | "wrong" | "reveal";

interface ToneStep {
  frequency: number;
  durationMs: number;
  gain: number;
}

const CUE_MAP: Record<PuzzleFeedbackCue, ToneStep[]> = {
  pickup: [{ frequency: 660, durationMs: 55, gain: 0.025 }],
  correct: [
    { frequency: 523.25, durationMs: 70, gain: 0.03 },
    { frequency: 659.25, durationMs: 90, gain: 0.032 },
  ],
  wrong: [
    { frequency: 246.94, durationMs: 110, gain: 0.028 },
    { frequency: 196, durationMs: 120, gain: 0.02 },
  ],
  reveal: [
    { frequency: 392, durationMs: 70, gain: 0.024 },
    { frequency: 493.88, durationMs: 70, gain: 0.024 },
    { frequency: 587.33, durationMs: 110, gain: 0.026 },
  ],
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const win = window as typeof window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = win.AudioContext || win.webkitAudioContext;
  if (!Context) return null;

  if (!audioContext) {
    try {
      audioContext = new Context();
    } catch {
      return null;
    }
  }

  return audioContext;
}

function scheduleTone(context: AudioContext, step: ToneStep, offsetMs: number): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + offsetMs / 1000;
  const endTime = startTime + step.durationMs / 1000;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(step.frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(step.gain, startTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

export function describeEvalLoss(centipawns: number): string {
  const pawns = Math.abs(centipawns) / 100;

  if (pawns < 0.3) return "a slight edge";
  if (pawns < 0.7) return "a small advantage";
  if (pawns < 1.5) return "a significant advantage";
  if (pawns < 3.0) return "roughly a piece worth of advantage";
  return "a decisive advantage";
}

export function formatEvalLossPawns(centipawns: number): string {
  return `${(Math.abs(centipawns) / 100).toFixed(1)} pawns`;
}

export function playPuzzleCue(cue: PuzzleFeedbackCue): void {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }

  let offsetMs = 0;
  for (const step of CUE_MAP[cue]) {
    scheduleTone(context, step, offsetMs);
    offsetMs += step.durationMs + 20;
  }
}
