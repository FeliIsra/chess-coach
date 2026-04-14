import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { PositionEval } from "./types";

type PendingEvaluation = {
  fen: string;
  depth: number;
  bestMove: string;
  scoreCp: number;
  resolve: (value: PositionEval) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type StockfishFlavor = "full" | "lite" | "single" | "lite-single" | "asm";

type ReadyState = "booting" | "awaiting-ready" | "ready";

function readPositiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

function readFlavorEnv(name: string, fallback: StockfishFlavor): StockfishFlavor {
  const value = process.env[name]?.trim().toLowerCase();
  if (
    value === "full" ||
    value === "lite" ||
    value === "single" ||
    value === "lite-single" ||
    value === "asm"
  ) {
    return value;
  }
  return fallback;
}

function scoreToCentipawns(kind: "cp" | "mate", value: number): number {
  if (kind === "mate") {
    return value > 0 ? 10000 : -10000;
  }
  return value;
}

function defaultPoolSize(): number {
  const parallelism =
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length;
  return Math.max(1, Math.min(3, parallelism - 1));
}

const LOCAL_STOCKFISH_ENABLED = readBooleanEnv("LOCAL_STOCKFISH_ENABLED", true);
const LOCAL_STOCKFISH_TIMEOUT_MS = readPositiveIntEnv(
  "LOCAL_STOCKFISH_TIMEOUT_MS",
  5000
);
const LOCAL_STOCKFISH_FLAVOR = readFlavorEnv(
  "LOCAL_STOCKFISH_FLAVOR",
  "lite-single"
);
const LOCAL_STOCKFISH_POOL_SIZE = readPositiveIntEnv(
  "LOCAL_STOCKFISH_POOL_SIZE",
  defaultPoolSize()
);
const LOCAL_STOCKFISH_HASH_MB = readPositiveIntEnv("LOCAL_STOCKFISH_HASH_MB", 16);

let poolPromise: Promise<LocalStockfishPool> | null = null;
let localStockfishDisabled = false;

function resolveStockfishEntrypoint(): string {
  const packageJsonPath = path.join(
    process.cwd(),
    "node_modules",
    "stockfish",
    "package.json"
  );

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("stockfish package is not installed");
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    buildVersion?: string;
  };
  const buildVersion = packageJson.buildVersion;

  if (!buildVersion) {
    throw new Error("stockfish package buildVersion is missing");
  }

  const fileByFlavor: Record<StockfishFlavor, string> = {
    full: `stockfish-${buildVersion}.js`,
    lite: `stockfish-${buildVersion}-lite.js`,
    single: `stockfish-${buildVersion}-single.js`,
    "lite-single": `stockfish-${buildVersion}-lite-single.js`,
    asm: `stockfish-${buildVersion}-asm.js`,
  };

  const entrypoint = path.join(
    process.cwd(),
    "node_modules",
    "stockfish",
    "bin",
    fileByFlavor[LOCAL_STOCKFISH_FLAVOR]
  );

  if (!fs.existsSync(entrypoint)) {
    throw new Error(`stockfish engine not found at ${entrypoint}`);
  }

  return entrypoint;
}

class LocalStockfishProcess {
  private readonly child: ChildProcessWithoutNullStreams;

  private readonly ready: Promise<void>;

  private readyState: ReadyState = "booting";

  private readyResolve!: () => void;

  private readyReject!: (error: Error) => void;

  private pending: PendingEvaluation | null = null;

  private queue: Promise<PositionEval> = Promise.resolve({
    fen: "",
    eval: 0,
    bestMove: "",
    depth: 0,
  });

  private load = 0;

  constructor(private readonly entrypoint: string) {
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.child = spawn(process.execPath, [entrypoint], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });
    stdout.on("line", (line) => {
      this.handleLine(line);
    });

    const stderr = readline.createInterface({
      input: this.child.stderr,
      crlfDelay: Infinity,
    });
    stderr.on("line", (line) => {
      if (line.trim()) {
        console.error("Local Stockfish stderr", line);
      }
    });

    this.child.once("error", (error) => {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    });

    this.child.once("exit", (code, signal) => {
      this.fail(
        new Error(
          `Local Stockfish exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`
        )
      );
    });

    this.send("uci");
  }

  get currentLoad(): number {
    return this.load + (this.pending ? 1 : 0);
  }

  evaluate(fen: string, depth: number): Promise<PositionEval> {
    this.load += 1;

    const next = this.queue
      .catch(() => ({
        fen: "",
        eval: 0,
        bestMove: "",
        depth: 0,
      }))
      .then(() => this.runEvaluation(fen, depth))
      .finally(() => {
        this.load = Math.max(0, this.load - 1);
      });

    this.queue = next;
    return next;
  }

  private async runEvaluation(fen: string, depth: number): Promise<PositionEval> {
    await this.ready;

    return new Promise<PositionEval>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending?.fen === fen) {
          this.pending = null;
        }
        reject(new Error("Local Stockfish timed out"));
      }, LOCAL_STOCKFISH_TIMEOUT_MS);

      this.pending = {
        fen,
        depth,
        bestMove: "",
        scoreCp: 0,
        resolve,
        reject,
        timeout,
      };

      this.send("ucinewgame");
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  private handleLine(rawLine: string): void {
    const line = rawLine.trim();
    if (!line) return;

    if (this.readyState === "booting" && line === "uciok") {
      this.readyState = "awaiting-ready";
      this.send(`setoption name Hash value ${LOCAL_STOCKFISH_HASH_MB}`);
      this.send("isready");
      return;
    }

    if (this.readyState === "awaiting-ready" && line === "readyok") {
      this.readyState = "ready";
      this.readyResolve();
      return;
    }

    if (!this.pending) return;

    const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
    if (scoreMatch) {
      const [, kind, rawValue] = scoreMatch;
      this.pending.scoreCp = scoreToCentipawns(
        kind as "cp" | "mate",
        Number.parseInt(rawValue, 10)
      );
    }

    const pvMatch = line.match(/\bpv ([a-h][1-8][a-h][1-8][nbrq]?)/);
    if (pvMatch?.[1]) {
      this.pending.bestMove = pvMatch[1];
    }

    const bestMoveMatch = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][nbrq]?)/);
    if (!bestMoveMatch?.[1]) return;

    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timeout);
    pending.resolve({
      fen: pending.fen,
      eval: pending.scoreCp,
      bestMove: bestMoveMatch[1] || pending.bestMove,
      depth: pending.depth,
    });
  }

  private send(command: string): void {
    this.child.stdin.write(`${command}\n`);
  }

  private fail(error: Error): void {
    if (this.readyState !== "ready") {
      this.readyReject(error);
    }

    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(error);
      this.pending = null;
    }
  }
}

class LocalStockfishPool {
  private readonly processes: LocalStockfishProcess[];

  constructor(entrypoint: string) {
    this.processes = Array.from(
      { length: Math.max(1, LOCAL_STOCKFISH_POOL_SIZE) },
      () => new LocalStockfishProcess(entrypoint)
    );
  }

  evaluate(fen: string, depth: number): Promise<PositionEval> {
    const process = this.processes.reduce((best, current) => {
      return current.currentLoad < best.currentLoad ? current : best;
    });

    return process.evaluate(fen, depth);
  }
}

async function createPool(): Promise<LocalStockfishPool> {
  const entrypoint = resolveStockfishEntrypoint();
  const pool = new LocalStockfishPool(entrypoint);
  return pool;
}

export async function evaluatePositionWithLocalStockfish(
  fen: string,
  depth: number
): Promise<PositionEval | null> {
  if (!LOCAL_STOCKFISH_ENABLED || localStockfishDisabled) {
    return null;
  }

  try {
    if (!poolPromise) {
      poolPromise = createPool();
    }

    const pool = await poolPromise;
    return await pool.evaluate(fen, depth);
  } catch (error) {
    localStockfishDisabled = true;
    poolPromise = null;
    console.error("Local Stockfish unavailable, falling back to remote engine", error);
    return null;
  }
}
