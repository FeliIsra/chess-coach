"use client";

import { useContainerReady } from "@/components/use-container-ready";
import {
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { MoveAnalysis } from "@/lib/types";

interface EvalChartProps {
  moves: MoveAnalysis[];
  timeControlSeconds?: number;
}

function formatPhase(phase?: MoveAnalysis["phase"], moveNumber?: number): string {
  if (phase) {
    return phase.charAt(0).toUpperCase() + phase.slice(1);
  }
  if (moveNumber === undefined) return "Unknown";
  if (moveNumber <= 10) return "Opening";
  if (moveNumber <= 25) return "Middlegame";
  return "Endgame";
}

export default function EvalChart({ moves, timeControlSeconds }: EvalChartProps) {
  const { ref, isReady, width, height } = useContainerReady<HTMLDivElement>();
  if (moves.length === 0) return null;

  const data = moves.map((m) => ({
    move: m.moveNumber,
    eval: Math.max(-10, Math.min(10, m.evalAfter / 100)), // clamp ±10 pawns
    classification: m.classification,
    phase: m.phase,
    clockPercent:
      timeControlSeconds && m.clockSeconds !== undefined
        ? Math.max(0, Math.min(100, (m.clockSeconds / timeControlSeconds) * 100))
        : null,
  }));
  const hasClockData = data.some((entry) => entry.clockPercent !== null);

  return (
    <div ref={ref} className="w-full min-w-0 h-[120px]">
      {isReady ? (
        <ResponsiveContainer
          width={Math.max(width, 280)}
          height={Math.max(height, 120)}
        >
          <ComposedChart data={data} margin={{ top: 5, right: hasClockData ? 30 : 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="evalGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="evalRed" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="move"
              tick={{ fontSize: 10, fill: "#888880" }}
              axisLine={{ stroke: "#444" }}
              tickLine={false}
            />
            <YAxis
              domain={[-10, 10]}
              yAxisId="left"
              tick={{ fontSize: 10, fill: "#888880" }}
              axisLine={{ stroke: "#444" }}
              tickLine={false}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
            />
            {hasClockData && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#888880" }}
                axisLine={{ stroke: "#444" }}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "#2e2e2e",
                border: "1px solid #444",
                borderRadius: "8px",
                color: "#e8e0d0",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const numericValue = Number(value ?? 0);
                if (name === "Clock remaining") {
                  return [`${numericValue.toFixed(0)}%`, name];
                }
                return [
                  `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(1)}`,
                  name,
                ];
              }}
              labelFormatter={(label, payload) => {
                const move = Number(label);
                const phase = formatPhase(
                  payload?.[0]?.payload?.phase,
                  Number.isFinite(move) ? move : undefined
                );
                return `Move ${label} · ${phase}`;
              }}
            />
            <ReferenceLine y={0} yAxisId="left" stroke="#444" strokeDasharray="3 3" />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="eval"
              name="Eval"
              stroke="#4ade80"
              fill="url(#evalGreen)"
              strokeWidth={1.5}
              dot={(props: Record<string, unknown>) => {
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: { classification: string };
                };
                if (payload.classification === "blunder") {
                  return <circle cx={cx} cy={cy} r={3} fill="#f87171" stroke="none" key={`dot-${cx}`} />;
                }
                if (payload.classification === "brilliant") {
                  return <circle cx={cx} cy={cy} r={3} fill="#4ade80" stroke="none" key={`dot-${cx}`} />;
                }
                return <circle cx={cx} cy={cy} r={0} key={`dot-${cx}`} />;
              }}
            />
            {hasClockData && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="clockPercent"
                name="Clock remaining"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full rounded-lg bg-surface-2/70" />
      )}
    </div>
  );
}
