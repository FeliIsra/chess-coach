"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useContainerReady } from "@/components/use-container-ready";

interface WinRateChartProps {
  wins: number;
  losses: number;
  draws: number;
}

const COLORS = {
  wins: "#4ade80",
  losses: "#f87171",
  draws: "#888880",
};

export default function WinRateChart({ wins, losses, draws }: WinRateChartProps) {
  const { ref, isReady, width, height } = useContainerReady<HTMLDivElement>();
  const total = wins + losses + draws;
  if (total === 0) return null;
  const winRate = Math.round((wins / total) * 100);

  const data = [
    { name: "Wins", value: wins },
    { name: "Losses", value: losses },
    { name: "Draws", value: draws },
  ].filter((d) => d.value > 0);

  const colorMap: Record<string, string> = {
    Wins: COLORS.wins,
    Losses: COLORS.losses,
    Draws: COLORS.draws,
  };

  return (
    <div className="flex items-center gap-4">
      <div ref={ref} className="relative w-24 h-24 shrink-0 min-w-[96px]">
        {isReady ? (
          <ResponsiveContainer width={Math.max(width, 96)} height={Math.max(height, 96)}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={colorMap[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-full bg-surface-2/70" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{winRate}%</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            win rate
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.wins }} />
          <span className="text-sm text-foreground">
            {wins} Win{wins !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.losses }} />
          <span className="text-sm text-foreground">
            {losses} Loss{losses !== 1 ? "es" : ""}
          </span>
        </div>
        {draws > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.draws }} />
            <span className="text-sm text-foreground">
              {draws} Draw{draws !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
