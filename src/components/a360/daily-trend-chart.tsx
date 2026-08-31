"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { A360_STATUS_HEX, A360_STATUS_LABELS, A360_STATUS_VALUES } from "@/types/a360";
import type { A360TrendPoint } from "@/types/a360";

interface DailyTrendChartProps {
  points: A360TrendPoint[];
}

export function DailyTrendChart({ points }: DailyTrendChartProps) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} strokeWidth={1.8} className="text-success" />
        <h3 className="text-base font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Daily Trend
        </h3>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Legend
              formatter={(value) => <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{value}</span>}
            />
            {A360_STATUS_VALUES.map((status) => (
              <Line
                key={status}
                type="monotone"
                dataKey={status}
                name={A360_STATUS_LABELS[status]}
                stroke={A360_STATUS_HEX[status]}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {/* Drawn last so it renders on top — the aggregate across every status. */}
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="var(--foreground)"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
