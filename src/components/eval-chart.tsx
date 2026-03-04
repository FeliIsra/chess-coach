"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { MoveAnalysis } from "@/lib/types";

interface EvalChartProps {
  moves: MoveAnalysis[];
}

export default function EvalChart({ moves }: EvalChartProps) {
  if (moves.length === 0) return null;

  const data = moves.map((m) => ({
    move: m.moveNumber,
    eval: Math.max(-10, Math.min(10, m.evalAfter / 100)), // clamp ±10 pawns
    classification: m.classification,
  }));

  return (
    <div className="w-full min-w-0 h-[120px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={120}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
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
            tick={{ fontSize: 10, fill: "#888880" }}
            axisLine={{ stroke: "#444" }}
            tickLine={false}
            tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#2e2e2e",
              border: "1px solid #444",
              borderRadius: "8px",
              color: "#e8e0d0",
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${(value ?? 0) > 0 ? "+" : ""}${Number(value ?? 0).toFixed(1)}`, "Eval"]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `Move ${label}`}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="eval"
            stroke="#4ade80"
            fill="url(#evalGreen)"
            strokeWidth={1.5}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { classification: string } };
              if (payload.classification === "blunder") {
                return <circle cx={cx} cy={cy} r={3} fill="#f87171" stroke="none" key={`dot-${cx}`} />;
              }
              if (payload.classification === "brilliant") {
                return <circle cx={cx} cy={cy} r={3} fill="#4ade80" stroke="none" key={`dot-${cx}`} />;
              }
              return <circle cx={cx} cy={cy} r={0} key={`dot-${cx}`} />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
