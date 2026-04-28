"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Dot,
} from "recharts";
import type { EloPoint } from "@/lib/types";

const TIME_CLASSES = ["all", "bullet", "blitz", "rapid", "daily"] as const;
type TabKey = (typeof TIME_CLASSES)[number];

interface EloProgressChartProps {
  points: EloPoint[];
}

interface ChartRow {
  capturedAt: string;
  ts: number;
  isoDate: string;
  rating: number;
  analysisId: string | null;
}

function filterByTimeClass(points: EloPoint[], tab: TabKey): EloPoint[] {
  if (tab === "all") return points;
  return points.filter((p) => p.timeClass === tab);
}

function toRows(points: EloPoint[]): ChartRow[] {
  return points
    .map((p) => {
      const ts = Date.parse(p.capturedAt) || 0;
      return {
        capturedAt: p.capturedAt,
        ts,
        isoDate: new Date(ts).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        rating: p.rating,
        analysisId: p.analysisId,
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

function AnalysisDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
  fill?: string;
}) {
  const { cx, cy, payload, fill } = props;
  if (cx == null || cy == null || !payload) return null;
  const isAnalysis = !!payload.analysisId;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={isAnalysis ? 5 : 3}
      fill={isAnalysis ? "var(--primary, #4f46e5)" : fill ?? "#6366f1"}
      stroke={isAnalysis ? "var(--background, #fff)" : "none"}
      strokeWidth={isAnalysis ? 2 : 0}
    />
  );
}

export default function EloProgressChart({ points }: EloProgressChartProps) {
  const [tab, setTab] = useState<TabKey>("all");

  const filtered = useMemo(() => filterByTimeClass(points, tab), [points, tab]);
  const rows = useMemo(() => toRows(filtered), [filtered]);
  const grouped = useMemo(() => {
    const byClass = new Map<string, ChartRow[]>();
    for (const p of filtered) {
      const list = byClass.get(p.timeClass) ?? [];
      list.push({
        capturedAt: p.capturedAt,
        ts: Date.parse(p.capturedAt) || 0,
        isoDate: new Date(Date.parse(p.capturedAt) || 0).toLocaleDateString(),
        rating: p.rating,
        analysisId: p.analysisId,
      });
      byClass.set(p.timeClass, list);
    }
    for (const list of byClass.values()) list.sort((a, b) => a.ts - b.ts);
    return byClass;
  }, [filtered]);

  if (rows.length < 2) {
    return (
      <section className="rounded-xl border border-border bg-surface-1 p-6 text-foreground">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ELO progress</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Run a few analyses across different time controls to see your progress
          here. Each analysis captures one rating point per time class.
        </p>
      </section>
    );
  }

  const lineColors: Record<string, string> = {
    bullet: "#ef4444",
    blitz: "#f97316",
    rapid: "#22c55e",
    daily: "#6366f1",
  };

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-6 text-foreground">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">ELO progress</h2>
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface-2 p-1">
          {TIME_CLASSES.map((tc) => (
            <button
              key={tc}
              type="button"
              onClick={() => setTab(tc)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors " +
                (tab === tc
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {tc}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) =>
                new Date(ts).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              }
              stroke="var(--muted-foreground, #6b7280)"
              fontSize={11}
            />
            <YAxis
              dataKey="rating"
              domain={["auto", "auto"]}
              stroke="var(--muted-foreground, #6b7280)"
              fontSize={11}
              width={48}
            />
            <Tooltip
              labelFormatter={(label) =>
                new Date(Number(label)).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
              formatter={(value) => [value as number, "Rating"]}
            />
            <Legend />
            {tab === "all" ? (
              Array.from(grouped.entries()).map(([tc, data]) => (
                <Line
                  key={tc}
                  data={data}
                  type="monotone"
                  dataKey="rating"
                  name={tc}
                  stroke={lineColors[tc] ?? "#6366f1"}
                  strokeWidth={2}
                  dot={<AnalysisDot />}
                />
              ))
            ) : (
              <Line
                data={rows}
                type="monotone"
                dataKey="rating"
                name={tab}
                stroke={lineColors[tab] ?? "#6366f1"}
                strokeWidth={2}
                dot={<AnalysisDot />}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Larger filled dots = days you ran an analysis. Hover any point for date and rating.
      </p>
    </section>
  );
}
